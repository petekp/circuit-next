import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { writeJson } from './json.mjs';

export function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export function promptCommand(argv) {
  return argv.map((arg) => (/^[A-Za-z0-9_./:@=+-]+$/.test(arg) ? arg : shellQuote(arg))).join(' ');
}

export function runSync(command, argv, options = {}) {
  const result = spawnSync(command, argv, {
    cwd: options.cwd ?? process.cwd(),
    encoding: 'utf8',
    env: options.env ?? process.env,
    timeout: options.timeoutMs,
  });
  return {
    command,
    argv,
    cwd: options.cwd ?? process.cwd(),
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message,
  };
}

export function commandOutput(command, argv, fallback = 'unavailable', options = {}) {
  try {
    const result = runSync(command, argv, options);
    if (result.status !== 0) return fallback;
    return result.stdout.trim() || fallback;
  } catch {
    return fallback;
  }
}

export function findExecutable(name, { required = true } = {}) {
  const result = runSync('zsh', ['-lc', `command -v ${shellQuote(name)}`]);
  if (result.status !== 0) {
    if (required) throw new Error(`could not find ${name} on PATH`);
    return name;
  }
  return result.stdout.trim();
}

export function redactedArgv(
  argv,
  { limit = 500, replacement = '<prompt omitted; see prompt.md>' } = {},
) {
  return argv.map((arg) => (String(arg).length > limit ? replacement : arg));
}

export function redactedCommand(command, argv, options = {}) {
  return [command, ...redactedArgv(argv, options)];
}

export async function runCommand({
  label,
  command,
  argv,
  cwd,
  env,
  timeoutMs,
  outputDir,
  metadataFilename = 'run-metadata.json',
  redactLimit = 500,
  redactReplacement = '<prompt omitted; see prompt.md>',
  metadataBuilder,
}) {
  mkdirSync(outputDir, { recursive: true });
  const startedAt = new Date();
  const start = performance.now();
  let stdout = '';
  let stderr = '';
  let timedOut = false;

  const result = await new Promise((resolvePromise) => {
    const child = spawn(command, argv, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
      setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }, 2000).unref();
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(`[${label}] ${chunk}`);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(`[${label}] ${chunk}`);
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolvePromise({ exitCode: null, signal: null, error: error.message });
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout);
      resolvePromise({ exitCode, signal, error: undefined });
    });
  });

  const finishedAt = new Date();
  const stdoutPath = resolve(outputDir, 'stdout.txt');
  const stderrPath = resolve(outputDir, 'stderr.txt');
  writeFileSync(stdoutPath, stdout);
  writeFileSync(stderrPath, stderr);

  const metadataBase = {
    label,
    command,
    argv: redactedArgv(argv, { limit: redactLimit, replacement: redactReplacement }),
    cwd,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    wallclock_ms: performance.now() - start,
    exit_code: result.exitCode,
    signal: result.signal,
    timed_out: timedOut,
    error: result.error,
    stdout_path: stdoutPath,
    stderr_path: stderrPath,
  };
  const metadata = metadataBuilder === undefined ? metadataBase : metadataBuilder(metadataBase);
  writeJson(resolve(outputDir, metadataFilename), metadata);
  return { ...metadata, stdout, stderr };
}
