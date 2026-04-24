import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  INHERITED_PRODUCT_RATCHET_TIER_BINDINGS,
  checkInheritedProductRatchetBindings,
} from '../../scripts/audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const EXPECTED_INHERITED_RATCHET_IDS = [
  'runner_smoke_present',
  'workflow_fixture_runs',
  'event_log_round_trip',
  'snapshot_derived_from_log',
  'manifest_snapshot_byte_match',
  'status_docs_current',
  'tier_claims_current',
];

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-inherited-ratchets-'));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeRel(root: string, rel: string, body: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

function writeEvidenceFiles(root: string, skipRelPath?: string) {
  for (const binding of INHERITED_PRODUCT_RATCHET_TIER_BINDINGS) {
    for (const relPath of binding.evidence_paths) {
      if (relPath === skipRelPath) continue;
      writeRel(root, relPath, `# evidence for ${binding.ratchet_id}\n`);
    }
  }
}

function tierRows(
  overrides: Record<
    string,
    Partial<{ status: string; file_paths: string[]; planned_slice: string; rationale: string }>
  > = {},
): string {
  return INHERITED_PRODUCT_RATCHET_TIER_BINDINGS.map((binding) => {
    const override = overrides[binding.tier_claim_id] ?? {};
    const status = override.status ?? 'enforced';
    const filePaths = override.file_paths ?? binding.evidence_paths;
    const plannedSlice = override.planned_slice ?? '';
    const rationale =
      override.rationale ??
      `ADR-0007 inherited ratchet ${binding.ratchet_id} has checked-in evidence.`;
    return `| ${binding.tier_claim_id} | ${status} | ${filePaths.join('; ')} | ${plannedSlice} | ${rationale} |`;
  }).join('\n');
}

function writeTier(root: string, rows: string) {
  writeRel(
    root,
    'TIER.md',
    `---
name: circuit-next-tier
description: Test fixture.
type: tier-claim-matrix
date: 2026-04-24
---

# TIER

| claim_id | status | file_path | planned_slice | rationale |
|---|---|---|---|---|
${rows}
`,
  );
}

describe('ADR-0007 §4c inherited product ratchet TIER bindings', () => {
  it('binding table covers exactly the inherited ratchets named by ADR-0007', () => {
    expect(
      INHERITED_PRODUCT_RATCHET_TIER_BINDINGS.map((binding) => binding.ratchet_id).sort(),
    ).toEqual([...EXPECTED_INHERITED_RATCHET_IDS].sort());
  });

  it('passes on the live repo TIER matrix', () => {
    const result = checkInheritedProductRatchetBindings(REPO_ROOT);
    expect(result.level).toBe('green');
    expect(result.detail).toMatch(/inherited Phase 2 product ratchet/);
  });

  it('reds when an inherited ratchet is still marked planned', () => {
    withTempRepo((root) => {
      writeEvidenceFiles(root);
      writeTier(
        root,
        tierRows({
          runner_smoke: {
            status: 'planned',
            file_paths: [],
            planned_slice: '27d',
            rationale: 'Will become a product ratchet once the runner smoke lands.',
          },
        }),
      );

      const result = checkInheritedProductRatchetBindings(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/runner_smoke_present/);
      expect(result.detail).toMatch(/expected enforced/);
    });
  });

  it('reds when an inherited TIER claim is duplicated', () => {
    withTempRepo((root) => {
      writeEvidenceFiles(root);
      writeTier(root, `${tierRows()}\n| runner_smoke | planned |  | 27d | stale duplicate row |`);

      const result = checkInheritedProductRatchetBindings(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/duplicate claim_id runner_smoke/);
    });
  });

  it('reds when a required evidence path is missing from the TIER row', () => {
    withTempRepo((root) => {
      writeEvidenceFiles(root);
      writeTier(
        root,
        tierRows({
          event_log_round_trip: {
            file_paths: ['tests/contracts/slice-27c-runtime-boundary.test.ts'],
          },
        }),
      );

      const result = checkInheritedProductRatchetBindings(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/event_log_round_trip/);
      expect(result.detail).toMatch(/tests\/unit\/runtime\/event-log-round-trip\.test\.ts/);
    });
  });

  it('reds when a TIER row names an evidence path that does not exist', () => {
    withTempRepo((root) => {
      writeEvidenceFiles(root, 'tests/runner/dogfood-smoke.test.ts');
      writeTier(root, tierRows());

      const result = checkInheritedProductRatchetBindings(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/runner_smoke_present/);
      expect(result.detail).toMatch(/tests\/runner\/dogfood-smoke\.test\.ts/);
    });
  });
});
