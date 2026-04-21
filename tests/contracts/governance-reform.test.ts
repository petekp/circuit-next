import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  checkAdversarialYieldLedger,
  checkCc14RetargetPresence,
  checkPhaseAuthoritySemantics,
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
| phase-1.5-alpha-proof | 25b | bootstrap exception - the slice that changes future acceptance terms cannot itself be proof those terms work | true | authorization.md |
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
      expect(result.detail).toMatch(/phase-1\.5-alpha-proof/);
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
| phase-1.5-alpha-proof | 25b | bootstrap exception | true | authorization.md |
| phase-1.5-alpha-proof | 29 | second waiver without authorization | true |  |
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
| phase-1.5-alpha-proof | 25b | bootstrap exception | true | missing.md |
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
| phase-1.5-alpha-proof | 25b | bootstrap exception | true | authorization.md |
| phase-1.5-alpha-proof | 30 | amends D1 to loosen product gate | true | authorization.md |
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
  return `${YIELD_LEDGER_HEADER}| pass_date | artifact_path | artifact_class | pass_number_for_artifact | reviewer_id | mode | HIGH_count | MED_count | LOW_count | verdict | operator_justification_if_past_cap | rigor_profile | why_continue_failure_class | prior_execution_commit_sha |
|---|---|---|---:|---|---|---:|---:|---:|---|---|---|---|---|
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
      const rows = `| 2026-04-20 | \`artifact.md\` | governance | 99 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/cap|substantive/);
    });
  });

  it('reds when pass_number exceeds cap with too-short justification', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | reversible | 3 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | short reason | pre-dog-1-grandfather | n/a | n/a |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/substantive/);
    });
  });

  it('passes when pass_number exceeds cap with substantive justification', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | governance | 4 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | hunting a specific residual defect class: callback-shape drift in the runtime boundary reducer, not covered by prior passes | pre-dog-1-grandfather | n/a | n/a |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('green');
    });
  });

  it('reds on three consecutive same-mode passes (mode-cycle violation)', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | irreversible | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | \`artifact.md\` | irreversible | 2 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | \`artifact.md\` | irreversible | 3 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/mode-cycle/);
    });
  });

  it('passes three passes when mode alternates', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | irreversible | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | \`artifact.md\` | irreversible | 2 | human | human-cold-read | 0 | 0 | 0 | ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | \`artifact.md\` | irreversible | 3 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('green');
    });
  });

  it('reds when artifact_class is invalid', () => {
    withTempRepo((root) => {
      const rows = `| 2026-04-20 | \`artifact.md\` | banana | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
`;
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', yieldLedgerWithRows(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/artifact_class/);
    });
  });
});

describe('methodology amendment parity', () => {
  it('decision.md contains the Slice 25b D1/D4/D10 amendments and the Slice 25d D3 mirror', () => {
    const decision = readFileSync(join(REPO_ROOT, 'specs/methodology/decision.md'), 'utf-8');
    expect(decision).toMatch(/^## Methodology Amendments \(2026-04-20, Slice 25b\)$/m);
    expect(decision).toMatch(/^### D1\. Product Reality Gate$/m);
    expect(decision).toMatch(/^### D4\. Governance Authority Graph Rule$/m);
    expect(decision).toMatch(/^### D10\. Adversarial Review Discipline$/m);
    // Slice 25d installs D3 as a mirror of ADR-0001 Addendum B. The heading
    // appears here in decision.md; the authoritative phase-graph prose lives
    // in the ADR (per the §Authority clause in that addendum).
    expect(decision).toMatch(/^## Methodology Amendments \(2026-04-20, Slice 25d\)$/m);
    expect(decision).toMatch(/^### D3\. Phase 1\.5 Alpha Proof$/m);
    for (const delta of ['D2', 'D5', 'D6', 'D7', 'D8', 'D9']) {
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
        phase_id: 'phase-1.5-alpha-proof',
        slice: '25b',
        consumed: true,
      }),
    );
  });
});

describe('Phase authority semantics audit (Slice 25d / ADR-0001 Addendum B)', () => {
  const ADR_WITH_ADDENDUM_B = `# ADR-0001

## Addendum B — 2026-04-20 (Slice 25d): D3 reopen

Phase 1.5 semantics are authored here.
`;

  const ADR_WITHOUT_ADDENDUM_B = `# ADR-0001

## Addendum A — portability

(no Phase 1.5 semantics authored yet)
`;

  const DECISION_MENTIONS_1_5_CITES_ADR = `# decision.md

Mirrors ADR-0001 Addendum B for Phase 1.5 semantics.
`;

  const DECISION_MENTIONS_1_5_NO_CITATION = `# decision.md

Phase 1.5 is the alpha proof phase.
(no ADR reference here)
`;

  const DECISION_NO_PHASE_MENTION = `# decision.md

(no phase-specific prose)
`;

  it('greens when no Phase 1.5 mention exists anywhere (pre-entry state)', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/adrs/ADR-0001-methodology-adoption.md', ADR_WITHOUT_ADDENDUM_B);
      writeRel(root, 'specs/methodology/decision.md', DECISION_NO_PHASE_MENTION);
      const result = checkPhaseAuthoritySemantics(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/pre-entry/);
    });
  });

  it('greens when Phase 1.5 is claimed in decision.md and ADR-0001 carries Addendum B', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/adrs/ADR-0001-methodology-adoption.md', ADR_WITH_ADDENDUM_B);
      writeRel(root, 'specs/methodology/decision.md', DECISION_MENTIONS_1_5_CITES_ADR);
      const result = checkPhaseAuthoritySemantics(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/backed by ADR-0001/);
    });
  });

  it('reds when decision.md claims Phase 1.5 without citing ADR-0001', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/adrs/ADR-0001-methodology-adoption.md', ADR_WITH_ADDENDUM_B);
      writeRel(root, 'specs/methodology/decision.md', DECISION_MENTIONS_1_5_NO_CITATION);
      const result = checkPhaseAuthoritySemantics(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/decision\.md mentions Phase 1\.5 but does not cite ADR-0001/);
    });
  });

  it('reds when README claims Phase 1.5 but ADR-0001 lacks Addendum B heading', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/adrs/ADR-0001-methodology-adoption.md', ADR_WITHOUT_ADDENDUM_B);
      writeRel(root, 'specs/methodology/decision.md', DECISION_NO_PHASE_MENTION);
      writeRel(root, 'README.md', '# circuit-next\n\nCurrent phase: Phase 1.5 — Alpha Proof.\n');
      const result = checkPhaseAuthoritySemantics(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/Addendum B/);
    });
  });

  it('reds when PROJECT_STATE claims Phase 1.5 but ADR-0001 lacks Addendum B heading', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/adrs/ADR-0001-methodology-adoption.md', ADR_WITHOUT_ADDENDUM_B);
      writeRel(root, 'specs/methodology/decision.md', DECISION_NO_PHASE_MENTION);
      writeRel(root, 'PROJECT_STATE.md', '# PROJECT_STATE\n\n**Phase:** 1.5 — Alpha Proof\n');
      const result = checkPhaseAuthoritySemantics(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/Addendum B/);
    });
  });

  it('yellows when ADR-0001 is missing', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/methodology/decision.md', DECISION_NO_PHASE_MENTION);
      const result = checkPhaseAuthoritySemantics(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/ADR-0001 missing/);
    });
  });

  it('yellows when decision.md is missing', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/adrs/ADR-0001-methodology-adoption.md', ADR_WITH_ADDENDUM_B);
      const result = checkPhaseAuthoritySemantics(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/decision\.md missing/);
    });
  });
});

describe('CC#14 retarget presence audit (Slice 31a / ADR-0006)', () => {
  const VALID_14A = `---
name: phase-1.5-operator-product-check
description: Operator product-direction confirmation closing CC#14a per ADR-0006.
type: review
review_kind: operator-product-direction-check
target_kind: phase-close
review_target: phase-1.5-alpha-proof
review_date: 2026-04-21
operator: Pete Petrash
scope: product-direction-only
confirmation: "Directionally compatible."
not_claimed:
  - parity
  - real agent dispatch
authored_by: Pete Petrash
adr_authority: ADR-0006
---

Body.
`;

  const VALID_REVIEW = `# phase-1 close reform human review

## Delegation acknowledgment

Added per ADR-0006. The canonical non-LLM cold-read is not satisfied; this
file's LLM stand-in sections carry the F17 weaker-evidence flag.
`;

  const REVIEW_NO_ADR_CITATION = `# phase-1 close reform human review

## Delegation acknowledgment

Some acknowledgment text without the required ADR reference.
`;

  const ADR_0006 = `# ADR-0006 — CC#14 one-time waiver + retarget

Body.
`;

  const PROJECT_STATE_PHASE_2_OPEN = `# PROJECT_STATE

**Phase:** 2 — Implementation (open). Phase 1.5 closed at Slice 31a.
`;

  const PROJECT_STATE_PHASE_1_5 = `# PROJECT_STATE

**Phase:** 1.5 — Alpha Proof (open).
`;

  it('greens when neither PROJECT_STATE nor README claims Phase 2 open', () => {
    withTempRepo((root) => {
      writeRel(root, 'PROJECT_STATE.md', PROJECT_STATE_PHASE_1_5);
      const result = checkCc14RetargetPresence(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/not required yet/);
    });
  });

  it('greens when Phase 2 open + all three artifacts present and shaped correctly', () => {
    withTempRepo((root) => {
      writeRel(root, 'PROJECT_STATE.md', PROJECT_STATE_PHASE_2_OPEN);
      writeRel(root, 'specs/reviews/phase-1.5-operator-product-check.md', VALID_14A);
      writeRel(root, 'specs/reviews/phase-1-close-reform-human.md', VALID_REVIEW);
      writeRel(root, 'specs/adrs/ADR-0006-cc14-operator-governance-alignment.md', ADR_0006);
      const result = checkCc14RetargetPresence(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(
        /14a product-check \+ 14b Delegation acknowledgment \+ ADR-0006/,
      );
    });
  });

  it('reds when Phase 2 open but 14a artifact is missing', () => {
    withTempRepo((root) => {
      writeRel(root, 'PROJECT_STATE.md', PROJECT_STATE_PHASE_2_OPEN);
      writeRel(root, 'specs/reviews/phase-1-close-reform-human.md', VALID_REVIEW);
      writeRel(root, 'specs/adrs/ADR-0006-cc14-operator-governance-alignment.md', ADR_0006);
      const result = checkCc14RetargetPresence(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/phase-1\.5-operator-product-check\.md.*missing/);
    });
  });

  it('reds when 14a artifact present but missing required frontmatter field', () => {
    const missingAdrAuthority = VALID_14A.replace(/^adr_authority:.*$/m, '');
    withTempRepo((root) => {
      writeRel(root, 'PROJECT_STATE.md', PROJECT_STATE_PHASE_2_OPEN);
      writeRel(root, 'specs/reviews/phase-1.5-operator-product-check.md', missingAdrAuthority);
      writeRel(root, 'specs/reviews/phase-1-close-reform-human.md', VALID_REVIEW);
      writeRel(root, 'specs/adrs/ADR-0006-cc14-operator-governance-alignment.md', ADR_0006);
      const result = checkCc14RetargetPresence(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing required frontmatter/);
    });
  });

  it('reds when Delegation acknowledgment section is missing from review file', () => {
    const reviewNoSection = '# review without section\n';
    withTempRepo((root) => {
      writeRel(root, 'PROJECT_STATE.md', PROJECT_STATE_PHASE_2_OPEN);
      writeRel(root, 'specs/reviews/phase-1.5-operator-product-check.md', VALID_14A);
      writeRel(root, 'specs/reviews/phase-1-close-reform-human.md', reviewNoSection);
      writeRel(root, 'specs/adrs/ADR-0006-cc14-operator-governance-alignment.md', ADR_0006);
      const result = checkCc14RetargetPresence(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/Delegation acknowledgment/);
    });
  });

  it('reds when Delegation acknowledgment section exists but does not cite ADR-0006', () => {
    withTempRepo((root) => {
      writeRel(root, 'PROJECT_STATE.md', PROJECT_STATE_PHASE_2_OPEN);
      writeRel(root, 'specs/reviews/phase-1.5-operator-product-check.md', VALID_14A);
      writeRel(root, 'specs/reviews/phase-1-close-reform-human.md', REVIEW_NO_ADR_CITATION);
      writeRel(root, 'specs/adrs/ADR-0006-cc14-operator-governance-alignment.md', ADR_0006);
      const result = checkCc14RetargetPresence(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/does not cite ADR-0006/);
    });
  });

  it('reds when ADR-0006 file is missing', () => {
    withTempRepo((root) => {
      writeRel(root, 'PROJECT_STATE.md', PROJECT_STATE_PHASE_2_OPEN);
      writeRel(root, 'specs/reviews/phase-1.5-operator-product-check.md', VALID_14A);
      writeRel(root, 'specs/reviews/phase-1-close-reform-human.md', VALID_REVIEW);
      const result = checkCc14RetargetPresence(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/ADR-0006/);
    });
  });

  it('detects Phase 2 open claimed in README alone', () => {
    withTempRepo((root) => {
      writeRel(root, 'README.md', '# circuit-next\n\n**Phase 2 — Implementation (open).**\n');
      const result = checkCc14RetargetPresence(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/phase-1\.5-operator-product-check\.md.*missing/);
    });
  });
});
