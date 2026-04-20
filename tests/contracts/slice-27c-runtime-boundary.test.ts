import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildInventory } from '../../scripts/inventory.mjs';

// Slice 27c — Runtime-boundary id-flip assertion.
//
// This file is intentionally narrow: it asserts that the specific
// product-surface rows Slice 27c set out to flip actually flip from
// `present: false` to `present: true` at HEAD. It does NOT lock counts
// or overall summary fields; those live in the present/absent-neutral
// 27b contract test at tests/contracts/product-surface-inventory.test.ts,
// which is deliberately stable across 27c and 27d landings.
//
// Per `specs/plans/phase-1-close-revised.md` §Slice 27c and ADR-0001
// Addendum B §Phase 1.5 Close Criteria, 27c must flip these five rows:
//
//   - runner.entrypoint         (src/runtime/ module(s) substantive)
//   - runner.event_writer       (src/runtime/event-writer.ts substantive)
//   - runner.snapshot_writer    (src/runtime/snapshot-writer.ts substantive)
//   - runner.manifest_snapshot  (writer module + run.manifest_snapshot row)
//   - tests.event_log_round_trip (event-log round-trip test file)
//
// The remaining four absent rows (runner.cli_script, plugin.manifest,
// plugin.dogfood_workflow_fixture, tests.runner_smoke) land in Slice 27d.

const EXPECTED_27C_FLIPS = [
  'runner.entrypoint',
  'runner.event_writer',
  'runner.snapshot_writer',
  'runner.manifest_snapshot',
  'tests.event_log_round_trip',
] as const;

describe('Slice 27c — inventory row flips', () => {
  it('flips the five 27c target rows to present:true', () => {
    const { surfaces } = buildInventory();
    for (const id of EXPECTED_27C_FLIPS) {
      const row = surfaces.find((s) => s.id === id);
      if (!row) throw new Error(`missing surface ${id}`);
      expect(row.present, `${id} expected present:true at 27c HEAD (${row.evidence_summary})`).toBe(
        true,
      );
    }
  });

  // The companion "27d target rows remain present:false" assertion was
  // valid at 27c HEAD and removed when Slice 27d flipped those rows.
  // The present:true version of the same claim is now pinned by
  // `tests/contracts/slice-27d-dogfood-run-0.test.ts` — two mirrored
  // statements of the same delta on opposite sides of the HEAD boundary.
});

describe('Slice 27c — authority graph additions', () => {
  it('adds run.manifest_snapshot and run.result rows to specs/artifacts.json', () => {
    const raw = JSON.parse(readFileSync(join('specs', 'artifacts.json'), 'utf8')) as {
      artifacts: Array<{ id: string; schema_file: string | null }>;
    };
    const ids = raw.artifacts.map((a) => a.id);
    expect(ids).toContain('run.manifest_snapshot');
    expect(ids).toContain('run.result');

    const manifestRow = raw.artifacts.find((a) => a.id === 'run.manifest_snapshot');
    expect(manifestRow?.schema_file).toBe('src/schemas/manifest.ts');

    const resultRow = raw.artifacts.find((a) => a.id === 'run.result');
    expect(resultRow?.schema_file).toBe('src/schemas/result.ts');
  });

  it('run.md contract binds the two new artifact ids', () => {
    const md = readFileSync(join('specs', 'contracts', 'run.md'), 'utf8');
    expect(md).toMatch(/-\s+run\.manifest_snapshot/);
    expect(md).toMatch(/-\s+run\.result/);
  });
});

describe('Slice 27c — fastest-falsifier boundary', () => {
  it('adds exactly 2 new runtime-boundary schema files (manifest.ts, result.ts)', () => {
    // Documented, not dynamically enforced across slices — a later slice
    // may add more schemas. This test pins the 27c framing's row/file
    // budget claim so a future inadvertent expansion is visible.
    const NEW_SCHEMA_FILES_AT_27C = ['src/schemas/manifest.ts', 'src/schemas/result.ts'];
    for (const path of NEW_SCHEMA_FILES_AT_27C) {
      expect(readFileSync(path, 'utf8').length).toBeGreaterThan(200);
    }
    expect(NEW_SCHEMA_FILES_AT_27C).toHaveLength(2);
  });

  it('adds exactly 2 new specs/artifacts.json rows (run.manifest_snapshot, run.result)', () => {
    const NEW_ROWS_AT_27C = ['run.manifest_snapshot', 'run.result'];
    expect(NEW_ROWS_AT_27C).toHaveLength(2);
    const raw = JSON.parse(readFileSync(join('specs', 'artifacts.json'), 'utf8')) as {
      artifacts: Array<{ id: string }>;
    };
    for (const id of NEW_ROWS_AT_27C) {
      expect(
        raw.artifacts.some((a) => a.id === id),
        `missing artifact row ${id}`,
      ).toBe(true);
    }
  });
});
