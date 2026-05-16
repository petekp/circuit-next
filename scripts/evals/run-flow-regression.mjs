#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { readJson } from './lib/json.mjs';
import { runSync } from './lib/process.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const MANIFEST_PATH = resolve(REPO_ROOT, 'evals/flow-regressions/manifest.json');

function usage() {
  return `Usage:
  node scripts/evals/run-flow-regression.mjs --all [--dry-run]
  node scripts/evals/run-flow-regression.mjs --eval-id <id> [--dry-run]
  node scripts/evals/run-flow-regression.mjs --list
`;
}

function parseArgs(argv) {
  const args = {
    all: false,
    dryRun: false,
    evalId: undefined,
    list: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') {
      args.all = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--list') {
      args.list = true;
    } else if (arg === '--eval-id') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error('--eval-id requires a value');
      }
      args.evalId = value;
      i += 1;
    } else {
      throw new Error(`unknown argument: ${arg}\n${usage()}`);
    }
  }

  return args;
}

function loadManifest() {
  const manifest = readJson(MANIFEST_PATH);
  if (manifest.schema_version !== 1) {
    throw new Error('flow regression manifest must have schema_version: 1');
  }
  if (!Array.isArray(manifest.evals)) {
    throw new Error('flow regression manifest must contain evals array');
  }
  return manifest;
}

function validateEval(entry) {
  if (typeof entry.id !== 'string' || entry.id.length === 0) {
    throw new Error('flow regression eval missing id');
  }
  if (!Array.isArray(entry.test_files) || entry.test_files.length === 0) {
    throw new Error(`${entry.id}: test_files must be a non-empty array`);
  }
  for (const testFile of entry.test_files) {
    if (typeof testFile !== 'string' || !existsSync(resolve(REPO_ROOT, testFile))) {
      throw new Error(`${entry.id}: test file does not exist: ${testFile}`);
    }
  }
}

function selectEvals(manifest, args) {
  for (const entry of manifest.evals) validateEval(entry);

  if (args.list) return [];
  if (args.all && args.evalId !== undefined) {
    throw new Error('use either --all or --eval-id, not both');
  }
  if (args.all) return manifest.evals;
  if (args.evalId !== undefined) {
    const entry = manifest.evals.find((candidate) => candidate.id === args.evalId);
    if (entry === undefined) {
      throw new Error(`unknown flow regression eval id: ${args.evalId}`);
    }
    return [entry];
  }
  throw new Error(`missing --all or --eval-id\n${usage()}`);
}

function commandFor(entry) {
  return ['vitest', 'run', ...entry.test_files];
}

function planFor(entry) {
  return {
    id: entry.id,
    flow: entry.flow,
    claim_level: entry.claim_level,
    purpose: entry.purpose,
    test_files: entry.test_files,
    command: ['npx', ...commandFor(entry)],
  };
}

function main() {
  const started = performance.now();
  const args = parseArgs(process.argv.slice(2));
  const manifest = loadManifest();

  if (args.list) {
    for (const entry of manifest.evals) {
      validateEval(entry);
      process.stdout.write(`${entry.id}: ${entry.claim_level}, flow=${entry.flow}\n`);
    }
    return;
  }

  const selected = selectEvals(manifest, args);
  const plans = selected.map(planFor);
  const metadata = {
    schema_version: 1,
    eval_suite: 'flow-regressions',
    dry_run: args.dryRun,
    eval_ids: plans.map((plan) => plan.id),
    evals: plans,
  };

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
    process.stdout.write('Dry run only. No tests executed.\n');
    return;
  }

  const results = [];
  for (const entry of selected) {
    const argv = commandFor(entry);
    process.stderr.write(`\n[flow-regressions] ${entry.id}\n`);
    const result = runSync('npx', argv, { cwd: REPO_ROOT });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    results.push({
      id: entry.id,
      status: result.status,
      signal: result.signal,
      error: result.error,
      command: ['npx', ...argv],
    });
    if (result.status !== 0) {
      throw new Error(`${entry.id} failed`);
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ...metadata,
        wallclock_ms: Math.round(performance.now() - started),
        results,
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write('Flow regression evals OK\n');
}

try {
  main();
} catch (error) {
  process.stderr.write(`flow regression evals failed: ${error.message}\n`);
  process.exit(1);
}
