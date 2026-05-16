import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJson } from '../../scripts/evals/lib/json.mjs';

const manifest = readJson(resolve('evals/fix-vs-vanilla/manifest.json'));
const taskRoot = resolve('evals/fix-vs-vanilla/tasks');
const splits = ['discovery', 'regression', 'held-out'];
const expectedProvenance = {
  discovery: 'discovery-created',
  regression: 'regression-demoted',
  'held-out': 'held-out-created',
};
const expectedTuningUsed = {
  discovery: true,
  regression: true,
  'held-out': false,
};

describe('fix-vs-vanilla manifest hygiene', () => {
  it('keeps disk tasks and manifest membership in sync', () => {
    const diskIds = readdirSync(taskRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const manifestIds = splits.flatMap((split) => manifest.sets[split]).sort();
    expect(diskIds).toEqual(manifestIds);
  });

  it('requires objective checks, provenance, and held-out hygiene', () => {
    for (const split of splits) {
      for (const taskId of manifest.sets[split]) {
        const task = readJson(resolve(taskRoot, taskId, 'task.json'));
        expect(task.id).toBe(taskId);
        expect(task.split).toBe(split);
        expect(task.provenance).toBe(expectedProvenance[split]);
        expect(task.tuning_used).toBe(expectedTuningUsed[split]);
        expect(task.checks.length).toBeGreaterThan(0);
        expect(Array.isArray(task.allowed_changed_files)).toBe(true);
        expect(existsSync(resolve(taskRoot, taskId, 'repo'))).toBe(true);
      }
    }
  });
});
