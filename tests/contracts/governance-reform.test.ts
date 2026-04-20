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

| phase_id | slice | reason | consumed | authorization_record |
|---|---|---|---|---|
| phase-1-pre-1.5-reopen | 25b | bootstrap exception - the slice that changes future acceptance terms cannot itself be proof those terms work | true | authorization.md |
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
      writeRel(root, 'authorization.md', '# authorization\n');
      writeRel(root, 'specs/methodology/product-gate-exemptions.md', VALID_EXEMPTION_LEDGER);
      const result = checkProductRealityGateVisibility(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/phase-1-pre-1\.5-reopen/);
      expect(result.detail).toMatch(/25b/);
    });
  });

  it('reds when a second consumed row has no authorization_record', () => {
    withTempRepo((root) => {
      writeRel(root, 'authorization.md', '# authorization\n');
      const ledger = `---
name: product-gate-exemptions
description: Ledger of consumed Product Reality Gate exemptions.
type: ledger
date: 2026-04-20
---

# Product Gate Exemptions

| phase_id | slice | reason | consumed | authorization_record |
|---|---|---|---|---|
| phase-1-pre-1.5-reopen | 25b | bootstrap exception | true | authorization.md |
| phase-1-pre-1.5-reopen | 29 | second waiver without authorization | true |  |
`;
      writeRel(root, 'specs/methodology/product-gate-exemptions.md', ledger);
      const result = checkProductRealityGateVisibility(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/authorization_record/);
    });
  });

  it('reds when authorization_record points at a missing file', () => {
    withTempRepo((root) => {
      const ledger = `---
name: product-gate-exemptions
description: Ledger of consumed Product Reality Gate exemptions.
type: ledger
date: 2026-04-20
---

# Product Gate Exemptions

| phase_id | slice | reason | consumed | authorization_record |
|---|---|---|---|---|
| phase-1-pre-1.5-reopen | 25b | bootstrap exception | true | missing.md |
`;
      writeRel(root, 'specs/methodology/product-gate-exemptions.md', ledger);
      const result = checkProductRealityGateVisibility(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing\.md/);
    });
  });

  it('reds when a row reason attempts to amend D1 or D3', () => {
    withTempRepo((root) => {
      writeRel(root, 'authorization.md', '# authorization\n');
      const ledger = `---
name: product-gate-exemptions
description: Ledger of consumed Product Reality Gate exemptions.
type: ledger
date: 2026-04-20
---

# Product Gate Exemptions

| phase_id | slice | reason | consumed | authorization_record |
|---|---|---|---|---|
| phase-1-pre-1.5-reopen | 25b | bootstrap exception | true | authorization.md |
| phase-1-pre-1.5-reopen | 30 | amends D1 to loosen product gate | true | authorization.md |
`;
      writeRel(root, 'specs/methodology/product-gate-exemptions.md', ledger);
      const result = checkProductRealityGateVisibility(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/amend D1 or D3/);
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

  it('reds when status is not in {enforced, planned, not claimed}', () => {
    withTempRepo((root) => {
      writeRel(root, 'existing.md', '# existing\n');
      writeRel(
        root,
        'TIER.md',
        `| claim_id | status | file_path | planned_slice | rationale |
|---|---|---|---|---|
| weird_status | banana | existing.md |  | Banana is not a valid status. |
`,
      );
      const result = checkTierOrphanClaims(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/banana/);
    });
  });

  it('reds when status=planned but only file_path is set', () => {
    withTempRepo((root) => {
      writeRel(root, 'existing.md', '# existing\n');
      writeRel(
        root,
        'TIER.md',
        `| claim_id | status | file_path | planned_slice | rationale |
|---|---|---|---|---|
| mismatched | planned | existing.md |  | Status disagrees with signal. |
`,
      );
      const result = checkTierOrphanClaims(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/disagrees with file_path/);
    });
  });

  it('reds when status=enforced but only planned_slice is set', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'TIER.md',
        `| claim_id | status | file_path | planned_slice | rationale |
|---|---|---|---|---|
| mismatched | enforced |  | 27d | Status disagrees with signal. |
`,
      );
      const result = checkTierOrphanClaims(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/disagrees with planned_slice/);
    });
  });
});

const YIELD_LEDGER_HEADER = `---
name: adversarial-yield-ledger
description: Test fixture.
type: ledger
date: 2026-04-20
---

# Fixture

`;

function yieldLedgerWithRows(rows: string): string {
  return `${YIELD_LEDGER_HEADER}| pass_date | artifact_path | artifact_class | pass_number_for_artifact | reviewer_id | mode | HIGH_count | MED_count | LOW_count | verdict | operator_justification_if_past_cap |
|---|---|---|---:|---|---|---:|---:|---:|---|---|
${rows}`;
}

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

  it('reds when pass_number exceeds governance cap with placeholder justification', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | governance | 99 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/cap|substantive/);
    });
  });

  it('reds when pass_number exceeds cap with too-short justification', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | reversible | 3 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | short reason |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/substantive/);
    });
  });

  it('passes when pass_number exceeds cap with substantive justification', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | governance | 4 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | hunting a specific residual defect class: callback-shape drift in the runtime boundary reducer, not covered by prior passes |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('green');
    });
  });

  it('reds on three consecutive same-mode passes (mode-cycle violation)', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | irreversible | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a |
| 2026-04-20 | \`artifact.md\` | irreversible | 2 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a |
| 2026-04-20 | \`artifact.md\` | irreversible | 3 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/mode-cycle/);
    });
  });

  it('passes three passes when mode alternates', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | irreversible | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a |
| 2026-04-20 | \`artifact.md\` | irreversible | 2 | human | human-cold-read | 0 | 0 | 0 | ACCEPT | n/a |
| 2026-04-20 | \`artifact.md\` | irreversible | 3 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('green');
    });
  });

  it('reds when artifact_class is invalid', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | banana | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/artifact_class/);
    });
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
