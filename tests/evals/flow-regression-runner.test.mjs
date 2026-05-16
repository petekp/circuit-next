import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RUNNER = resolve('scripts/evals/run-flow-regression.mjs');

function dryRun(args) {
  const stdout = execFileSync('node', [RUNNER, ...args, '--dry-run'], { encoding: 'utf8' });
  return JSON.parse(stdout.split('\nDry run only.')[0] ?? stdout);
}

describe('flow regression eval runner', () => {
  it('dry-runs all registered local flow evals', () => {
    const metadata = dryRun(['--all']);
    expect(metadata.dry_run).toBe(true);
    expect(metadata.eval_ids).toEqual([
      'review-clean-control',
      'build-proof-chain',
      'explore-grounding-contract',
      'runtime-proof-smoke',
      'flow-router-intent',
    ]);
    for (const entry of metadata.evals) {
      expect(entry.command[0]).toBe('npx');
      expect(entry.command[1]).toBe('vitest');
      expect(entry.command[2]).toBe('run');
      expect(entry.test_files.length).toBeGreaterThan(0);
    }
  });

  it('dry-runs one eval by id', () => {
    const metadata = dryRun(['--eval-id', 'build-proof-chain']);
    expect(metadata.eval_ids).toEqual(['build-proof-chain']);
    expect(metadata.evals[0].test_files).toContain('tests/runner/build-runtime-wiring.test.ts');
  });

  it('fails closed on unknown eval ids', () => {
    const result = spawnSync('node', [RUNNER, '--eval-id', 'missing-eval', '--dry-run'], {
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('unknown flow regression eval id: missing-eval');
  });
});
