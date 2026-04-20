import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  checkAdversarialYieldLedger,
  checkProductRealityGateVisibility,
  checkTierOrphanClaims,
  parseProductGateExemptionLedger,
} from '../../scripts/audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-governance-'));
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

const VALID_EXEMPTION_LEDGER = `---
name: product-gate-exemptions
description: Ledger of consumed Product Reality Gate exemptions.
type: ledger
date: 2026-04-20
---

# Product Gate Exemptions

| phase_id | slice | reason | consumed |
|---|---|---|---|
| phase-1-pre-1.5-reopen | 25b | bootstrap exception - the slice that changes future acceptance terms cannot itself be proof those terms work | true |
`;

const VALID_TIER = `---
name: circuit-next-tier
description: Claim matrix for self-hosting and governance capabilities.
type: tier-claim-matrix
date: 2026-04-20
---

# TIER

| claim_id | status | file_path | planned_slice | rationale |
|---|---|---|---|---|
| enforced_claim | enforced | existing.md |  | Enforced by a checked-in file. |
| planned_claim | planned |  | 27d | Planned future product ratchet. |
| not_claimed_claim | not claimed |  |  | Not claimed - Tier 2+ deferral. |
`;

describe('Product Reality Gate visibility audit', () => {
  it('reds when the exemption ledger file is missing', () => {
    withTempRepo((root) => {
      const result = checkProductRealityGateVisibility(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/product-gate-exemptions\.md missing/);
    });
  });

  it('reds when the exemption ledger is malformed', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/methodology/product-gate-exemptions.md', '# no table\n');
      const result = checkProductRealityGateVisibility(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/frontmatter|table|malformed/i);
    });
  });

  it('passes on a valid consumed Slice 25b seed row', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/methodology/product-gate-exemptions.md', VALID_EXEMPTION_LEDGER);
      const result = checkProductRealityGateVisibility(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/phase-1-pre-1\.5-reopen/);
      expect(result.detail).toMatch(/25b/);
    });
  });
});

describe('TIER orphan-claim audit', () => {
  it('reds when a claim row has no file_path, planned_slice, or not-claimed status', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'TIER.md',
        `| claim_id | status | file_path | planned_slice | rationale |
|---|---|---|---|---|
| orphan_claim | enforced |  |  |  |
`,
      );
      const result = checkTierOrphanClaims(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/orphan_claim/);
      expect(result.detail).toMatch(/orphan/i);
    });
  });

  it('reds when an enforced claim points at a missing file_path', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'TIER.md',
        `| claim_id | status | file_path | planned_slice | rationale |
|---|---|---|---|---|
| broken_path_claim | enforced | missing.md |  | Enforced by a missing file. |
`,
      );
      const result = checkTierOrphanClaims(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/broken_path_claim/);
      expect(result.detail).toMatch(/missing\.md/);
    });
  });

  it('passes a matrix with enforced, planned, and not-claimed rows', () => {
    withTempRepo((root) => {
      writeRel(root, 'existing.md', '# existing\n');
      writeRel(root, 'TIER.md', VALID_TIER);
      const result = checkTierOrphanClaims(root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain(
        '3 claims - 1 enforced (file_path), 1 planned (slice), 1 not claimed',
      );
    });
  });
});

describe('adversarial yield ledger audit', () => {
  it('reds when the yield ledger is missing', () => {
    withTempRepo((root) => {
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/adversarial-yield-ledger\.md missing/);
    });
  });

  it('passes on the current adversarial yield ledger', () => {
    const result = checkAdversarialYieldLedger(REPO_ROOT);
    expect(result.level).toBe('green');
    expect(result.detail).toMatch(/\d+ yield-ledger row/);
  });
});

describe('methodology amendment parity', () => {
  it('decision.md contains only the Slice 25b D1, D4, and D10 amendment headings', () => {
    const decision = readFileSync(join(REPO_ROOT, 'specs/methodology/decision.md'), 'utf-8');
    expect(decision).toMatch(/^## Methodology Amendments \(2026-04-20, Slice 25b\)$/m);
    expect(decision).toMatch(/^### D1\. Product Reality Gate$/m);
    expect(decision).toMatch(/^### D4\. Governance Authority Graph Rule$/m);
    expect(decision).toMatch(/^### D10\. Adversarial Review Discipline$/m);
    for (const delta of ['D2', 'D3', 'D5', 'D6', 'D7', 'D8', 'D9']) {
      expect(decision).not.toMatch(new RegExp(`^### ${delta}\\.`, 'm'));
    }
  });
});

describe('Product Gate exemption ledger seed row parity', () => {
  it('records the consumed Slice 25b bootstrap-exception row', () => {
    const ledgerPath = join(REPO_ROOT, 'specs/methodology/product-gate-exemptions.md');
    expect(existsSync(ledgerPath), 'product gate exemption ledger missing').toBe(true);
    const parsed = parseProductGateExemptionLedger(ledgerPath);
    expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('; ')).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toContainEqual(
      expect.objectContaining({
        phase_id: 'phase-1-pre-1.5-reopen',
        slice: '25b',
        consumed: true,
      }),
    );
  });
});
