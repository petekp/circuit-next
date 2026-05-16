#!/usr/bin/env node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runSync } from './lib/process.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function runStep(label, command, argv, options = {}) {
  process.stderr.write(`\n[check-evals] ${label}\n`);
  const result = runSync(command, argv, { cwd: REPO_ROOT, ...options });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

function main() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'circuit-check-evals-'));
  runStep('registry', 'node', ['scripts/evals/check-registry.mjs']);
  runStep('fix manifest', 'node', ['scripts/evals/check-fix-manifest.mjs']);
  runStep('result hygiene', 'node', ['scripts/evals/check-results-hygiene.mjs']);
  runStep('fix held-out dry-run', 'node', [
    'evals/fix-vs-vanilla/run-fix-comparison.mjs',
    '--set',
    'held-out',
    '--dry-run',
    '--out-dir',
    resolve(tempRoot, 'fix'),
  ]);
  runStep('fix matrix dry-run', 'node', [
    'scripts/evals/run-fix-matrix.mjs',
    '--dry-run',
    '--out-dir',
    resolve(tempRoot, 'matrix'),
  ]);

  const promptPath = resolve(tempRoot, 'comparison-prompt.md');
  writeFileSync(promptPath, 'Comparison runner dry-run prompt fixture.\n');
  runStep('circuit-vs-vanilla dry-run', 'node', [
    'evals/circuit-vs-vanilla/run-comparison.mjs',
    '--task-id',
    'dry-run-test',
    '--prompt-file',
    promptPath,
    '--out-dir',
    resolve(tempRoot, 'comparison'),
    '--dry-run',
    '--skip-build',
    '--provider',
    'claude-code',
    '--flow',
    'review',
    '--model',
    'claude-haiku-4-5-20251001',
    '--effort',
    'low',
  ]);
}

try {
  main();
  process.stdout.write('\nEval checks OK\n');
} catch (error) {
  process.stderr.write(`check-evals failed: ${error.message}\n`);
  process.exit(1);
}
