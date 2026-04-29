#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(scriptDir, '..');
const packagedFlowRoot = resolve(pluginRoot, 'flows');
const DOCTOR_SMOKE_TIMEOUT_MS = 120_000;

function findLocalLauncher() {
  const candidate = resolve(process.cwd(), 'bin/circuit-next');
  if (existsSync(candidate)) return candidate;
  return undefined;
}

function hasPathCommand(command) {
  const pathValue = process.env.PATH ?? '';
  for (const segment of pathValue.split(delimiter)) {
    if (segment.length === 0) continue;
    if (existsSync(resolve(segment, command))) return true;
  }
  return false;
}

const localLauncher = findLocalLauncher();
const command = localLauncher ?? 'circuit-next';
const rawArgs = process.argv.slice(2);

function commandExists() {
  return localLauncher !== undefined || hasPathCommand(command);
}

function check(name, ok, detail) {
  return detail === undefined ? { name, ok } : { name, ok, detail };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function skillNameFromMarkdown(path) {
  const text = readFileSync(path, 'utf8');
  const match = /^name:\s*(\S+)\s*$/m.exec(text);
  return match?.[1];
}

function listMarkdownFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name);
}

function parseProgressEvents(stderr) {
  const events = [];
  for (const line of stderr.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    events.push(JSON.parse(line));
  }
  return events;
}

function runDoctor() {
  const checks = [];
  const manifestPath = resolve(pluginRoot, '.codex-plugin/plugin.json');
  checks.push(check('plugin_manifest_exists', existsSync(manifestPath), manifestPath));

  let manifest;
  try {
    manifest = existsSync(manifestPath) ? readJson(manifestPath) : undefined;
    checks.push(check('plugin_manifest_parseable', manifest !== undefined, manifestPath));
  } catch (err) {
    checks.push(
      check('plugin_manifest_parseable', false, err instanceof Error ? err.message : String(err)),
    );
  }
  checks.push(
    check(
      'plugin_manifest_shape',
      manifest?.name === 'circuit' &&
        manifest?.skills === './skills/' &&
        manifest?.interface?.displayName === 'Circuit',
      manifestPath,
    ),
  );

  const skillsRoot = resolve(pluginRoot, 'skills');
  const skillDirs = existsSync(skillsRoot)
    ? readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];
  checks.push(check('skills_directory_exists', existsSync(skillsRoot), skillsRoot));
  checks.push(check('skills_present', skillDirs.length > 0, `${skillDirs.length} skills`));
  for (const entry of skillDirs) {
    const skillPath = resolve(skillsRoot, entry.name, 'SKILL.md');
    const skillName = existsSync(skillPath) ? skillNameFromMarkdown(skillPath) : undefined;
    checks.push(
      check(
        `skill_name_${entry.name}`,
        skillName === entry.name && !/^circuit[:-]/.test(skillName ?? ''),
        skillName === undefined ? `${skillPath} missing name` : `name=${skillName}`,
      ),
    );
  }

  const wrapperPath = resolve(scriptDir, 'circuit-next.mjs');
  checks.push(check('wrapper_exists', existsSync(wrapperPath), wrapperPath));
  checks.push(check('packaged_flow_root_exists', existsSync(packagedFlowRoot), packagedFlowRoot));
  for (const flow of ['build', 'explore', 'fix', 'migrate', 'review']) {
    const flowPath = resolve(packagedFlowRoot, flow, 'circuit.json');
    checks.push(check(`packaged_flow_${flow}`, existsSync(flowPath), flowPath));
  }

  const commandsRoot = resolve(pluginRoot, 'commands');
  checks.push(check('commands_directory_exists', existsSync(commandsRoot), commandsRoot));
  for (const name of listMarkdownFiles(commandsRoot)) {
    const commandPath = resolve(commandsRoot, name);
    const text = readFileSync(commandPath, 'utf8');
    checks.push(
      check(
        `command_${name}_uses_wrapper`,
        text.includes("node '<plugin root>/scripts/circuit-next.mjs'") &&
          !text.includes('./bin/circuit-next') &&
          text.includes('--progress jsonl') &&
          text.includes('task_list.updated') &&
          text.includes('user_input.requested'),
        commandPath,
      ),
    );
  }

  checks.push(check('circuit_next_binary_available', commandExists(), command));

  const smokeRoot = mkdtempSync(join(tmpdir(), 'circuit-codex-doctor-'));
  try {
    const configDir = resolve(smokeRoot, '.circuit');
    const runFolder = resolve(smokeRoot, 'run');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      resolve(configDir, 'config.yaml'),
      `${JSON.stringify(
        {
          schema_version: 1,
          host: { kind: 'codex' },
          relay: {
            roles: {
              reviewer: { kind: 'named', name: 'doctor-reviewer' },
            },
            connectors: {
              'doctor-reviewer': {
                kind: 'custom',
                name: 'doctor-reviewer',
                command: [
                  process.execPath,
                  '-e',
                  "require('node:fs').writeFileSync(process.argv[2], JSON.stringify({verdict:'NO_ISSUES_FOUND',findings:[]}))",
                ],
                prompt_transport: 'prompt-file',
                output: { kind: 'output-file' },
                capabilities: { filesystem: 'read-only', structured_output: 'json' },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    if (commandExists()) {
      const result = spawnSync(
        command,
        [
          'run',
          '--goal',
          'review this patch',
          '--flow-root',
          packagedFlowRoot,
          '--run-folder',
          runFolder,
          '--progress',
          'jsonl',
        ],
        {
          cwd: smokeRoot,
          encoding: 'utf8',
          timeout: DOCTOR_SMOKE_TIMEOUT_MS,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let output;
      try {
        output = result.stdout.length > 0 ? JSON.parse(result.stdout) : undefined;
      } catch {
        output = undefined;
      }
      let progressEvents = [];
      try {
        progressEvents = parseProgressEvents(result.stderr);
      } catch (_err) {
        progressEvents = [];
      }
      const progressTypes = progressEvents
        .map((event) => event.type)
        .filter((type) => typeof type === 'string');
      checks.push(
        check(
          'temp_repo_review_smoke',
          result.status === 0 &&
            result.error === undefined &&
            output?.selected_flow === 'review' &&
            output?.outcome === 'complete' &&
            existsSync(resolve(runFolder, 'reports', 'review-result.json')),
          `status=${result.status ?? 'unknown'} error=${result.error?.message ?? 'none'} stderr=${result.stderr.slice(0, 500)}`,
        ),
      );
      checks.push(
        check(
          'temp_repo_review_progress',
          progressTypes.includes('route.selected') &&
            progressTypes.includes('evidence.warning') &&
            progressTypes.includes('run.completed'),
          progressTypes.length > 0
            ? `events=${progressTypes.join(',')}`
            : `stderr=${result.stderr.slice(0, 500)}`,
        ),
      );
      checks.push(
        check(
          'temp_repo_review_progress_display',
          progressEvents.length > 0 &&
            progressEvents.every(
              (event) =>
                typeof event.display?.text === 'string' &&
                event.display.text.length > 0 &&
                typeof event.display?.importance === 'string' &&
                typeof event.display?.tone === 'string',
            ),
          progressEvents.length > 0
            ? `display_events=${progressEvents.length}`
            : `stderr=${result.stderr.slice(0, 500)}`,
        ),
      );
      checks.push(
        check(
          'temp_repo_review_operator_summary',
          typeof output?.operator_summary_markdown_path === 'string' &&
            existsSync(output.operator_summary_markdown_path),
          typeof output?.operator_summary_markdown_path === 'string'
            ? output.operator_summary_markdown_path
            : 'operator_summary_markdown_path missing',
        ),
      );

      const checkpointRunFolder = resolve(smokeRoot, 'checkpoint-run');
      const checkpointResult = spawnSync(
        command,
        [
          'run',
          'build',
          '--goal',
          'develop: add a focused feature that waits for framing',
          '--entry-mode',
          'deep',
          '--flow-root',
          packagedFlowRoot,
          '--run-folder',
          checkpointRunFolder,
          '--progress',
          'jsonl',
        ],
        {
          cwd: smokeRoot,
          encoding: 'utf8',
          timeout: DOCTOR_SMOKE_TIMEOUT_MS,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let checkpointOutput;
      try {
        checkpointOutput =
          checkpointResult.stdout.length > 0 ? JSON.parse(checkpointResult.stdout) : undefined;
      } catch {
        checkpointOutput = undefined;
      }
      let checkpointProgressEvents = [];
      try {
        checkpointProgressEvents = parseProgressEvents(checkpointResult.stderr);
      } catch (_err) {
        checkpointProgressEvents = [];
      }
      const checkpointProgressTypes = checkpointProgressEvents
        .map((event) => event.type)
        .filter((type) => typeof type === 'string');
      checks.push(
        check(
          'temp_repo_checkpoint_user_input_requested',
          checkpointResult.status === 0 &&
            checkpointOutput?.outcome === 'checkpoint_waiting' &&
            checkpointProgressTypes.includes('checkpoint.waiting') &&
            checkpointProgressTypes.includes('user_input.requested'),
          checkpointProgressTypes.length > 0
            ? `events=${checkpointProgressTypes.join(',')}`
            : `stderr=${checkpointResult.stderr.slice(0, 500)}`,
        ),
      );
    } else {
      checks.push(check('temp_repo_review_smoke', false, 'circuit-next binary unavailable'));
    }
  } finally {
    rmSync(smokeRoot, { recursive: true, force: true });
  }

  const ok = checks.every((item) => item.ok);
  process.stdout.write(
    `${JSON.stringify(
      {
        schema_version: 1,
        host: 'codex',
        status: ok ? 'ok' : 'fail',
        plugin_root: pluginRoot,
        flow_root: packagedFlowRoot,
        command,
        checks,
      },
      null,
      2,
    )}\n`,
  );
  return ok ? 0 : 1;
}

function shouldInjectPackagedFlowRoot(args) {
  if (args.includes('--fixture') || args.includes('--flow-root')) return false;
  if (args.includes('--help') || args.includes('-h')) return false;
  if (args[0] === 'resume' || args.includes('--checkpoint-choice')) return false;
  return args[0] === 'run' || args.includes('--goal');
}

const forwardedArgs = shouldInjectPackagedFlowRoot(rawArgs)
  ? [...rawArgs, '--flow-root', packagedFlowRoot]
  : rawArgs;

if (rawArgs[0] === 'doctor') {
  process.exit(runDoctor());
}

if (!commandExists()) {
  process.stderr.write(
    [
      'error: could not find circuit-next.',
      'Run this from a circuit-next checkout, or install a package that provides the circuit-next binary.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const result = spawnSync(command, forwardedArgs, {
  cwd: process.cwd(),
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write(`error: failed to start circuit-next: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
