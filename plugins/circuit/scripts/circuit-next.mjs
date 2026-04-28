#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(scriptDir, '..');
const packagedFlowRoot = resolve(pluginRoot, 'flows');

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

function shouldInjectPackagedFlowRoot(args) {
  if (args.includes('--fixture') || args.includes('--flow-root')) return false;
  if (args.includes('--help') || args.includes('-h')) return false;
  if (args[0] === 'resume' || args.includes('--checkpoint-choice')) return false;
  return args[0] === 'run' || args.includes('--goal');
}

const forwardedArgs = shouldInjectPackagedFlowRoot(rawArgs)
  ? [...rawArgs, '--flow-root', packagedFlowRoot]
  : rawArgs;

if (localLauncher === undefined && !hasPathCommand(command)) {
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
