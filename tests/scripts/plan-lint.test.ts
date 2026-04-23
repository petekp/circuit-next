/**
 * Plan-lint rule test coverage.
 *
 * Lands at Slice 58 of the planning-readiness-meta-arc.
 *
 * Coverage per ADR-0010 §6 rules #1-#22:
 *   - Each rule fires on at least one bad fixture.
 *   - Each rule stays silent on the known-good fixture.
 *   - Section-aware scoping: rules #3, #7, #8 skip matches inside
 *     narrative / rule-description sections.
 *   - Legacy exemption: plans with first-committed-date pre-effective
 *     skip all rules.
 *   - Freshness binding (rule #17): stale-same-revision, stale-
 *     different-revision, missing base_commit, missing content_sha256
 *     all rejected.
 */

import { execFileSync, execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const PLAN_LINT = join(REPO_ROOT, 'scripts', 'plan-lint.mjs');

// Slice-58a (Codex LOW-1 fold-in): use execFileSync so paths containing
// spaces, quotes, or shell metacharacters in TMPDIR pass through safely.
function runLint(path: string): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [PLAN_LINT, path], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer };
    return {
      exitCode: e.status ?? 1,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
    };
  }
}

function lintFindings(path: string): string[] {
  const result = runLint(path);
  const findingLines = result.stderr.split('\n').filter(Boolean);
  return findingLines
    .map((line) => {
      try {
        return JSON.parse(line).rule as string;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

describe('plan-lint — known-good fixture', () => {
  it('returns GREEN on tests/fixtures/plan-lint/good/minimal-compliant-plan.md', () => {
    const { exitCode } = runLint('tests/fixtures/plan-lint/good/minimal-compliant-plan.md');
    expect(exitCode).toBe(0);
  });

  it('returns GREEN on the meta-arc plan itself (reflexive self-lint)', () => {
    const { exitCode, stderr } = runLint('specs/plans/planning-readiness-meta-arc.md');
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
  });
});

describe('plan-lint — legacy plan exemption', () => {
  it('returns GREEN on phase-2-implementation.md (committed before effective-date)', () => {
    const { exitCode } = runLint('specs/plans/phase-2-implementation.md');
    expect(exitCode).toBe(0);
  });

  it('returns GREEN on clean-clone-reality-tranche.md (legacy; pre-effective)', () => {
    const { exitCode } = runLint('specs/plans/clean-clone-reality-tranche.md');
    expect(exitCode).toBe(0);
  });

  it('returns GREEN on phase-2-foundation-foldins.md (legacy active plan)', () => {
    const { exitCode } = runLint('specs/plans/phase-2-foundation-foldins.md');
    expect(exitCode).toBe(0);
  });
});

describe('plan-lint — P2.9 flawed draft (retroactive proof)', () => {
  // Use the committed fixture copy rather than the original untracked
  // draft at specs/plans/p2-9-second-workflow.md. This keeps the test
  // suite reproducible from clean checkouts per pass-05 CRITICAL 1
  // fold-in.
  const P2_9 = 'tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md';

  it('returns RED with multiple findings (≥15 red)', () => {
    const { exitCode } = runLint(P2_9);
    expect(exitCode).toBe(1);
    const findings = lintFindings(P2_9);
    expect(findings.length).toBeGreaterThanOrEqual(15);
  });

  it('catches HIGH 1: canonical phase set mismatch', () => {
    expect(lintFindings(P2_9)).toContain('plan-lint.canonical-phase-set-maps-to-schema-vocabulary');
  });

  it('catches HIGH 2: artifact cardinality overreach', () => {
    expect(lintFindings(P2_9)).toContain('plan-lint.artifact-cardinality-mapped-to-reference');
  });

  it('catches HIGH 3: invariant without enforcement_layer (REVIEW-I1)', () => {
    expect(lintFindings(P2_9)).toContain('plan-lint.invariant-without-enforcement-layer');
  });

  it('catches HIGH 4: verdict determinism missing verification-passes', () => {
    expect(lintFindings(P2_9)).toContain(
      'plan-lint.verdict-determinism-includes-verification-passes-for-successor-to-live',
    );
  });

  it('catches HIGH 5: verification runtime capability assumed without substrate slice', () => {
    expect(lintFindings(P2_9)).toContain(
      'plan-lint.verification-runtime-capability-assumed-without-substrate-slice',
    );
  });

  it('catches HIGH 6: markdown artifact materialization without registered schema', () => {
    expect(lintFindings(P2_9)).toContain(
      'plan-lint.artifact-materialization-uses-registered-schema',
    );
  });

  it('catches MED 8: CLI shape mismatch (--scope vs actual --goal)', () => {
    expect(lintFindings(P2_9)).toContain('plan-lint.cli-invocation-shape-matches');
  });

  it('catches MED 7: stale symbol citation via Slice 60 import/re-export detection', () => {
    // Rule #4 strengthening at Slice 60 (Codex P2.9 MED 7 retroactive
    // coverage): `scripts/audit.mjs::WORKFLOW_KIND_CANONICAL_SETS`
    // should fire red because audit.mjs only imports + re-exports the
    // symbol; the authoritative definition lives in the policy module.
    expect(lintFindings(P2_9)).toContain('plan-lint.stale-symbol-citation');
  });

  it('catches MED (status vocab): draft is not a valid state', () => {
    expect(lintFindings(P2_9)).toContain('plan-lint.status-field-valid');
  });
});

describe('plan-lint — section-aware scoping', () => {
  it('does not fire rule #3 on tests/contracts/*.md mentions in §Failure-mode narrative', () => {
    // The meta-arc plan itself mentions `tests/contracts/review.md` in §2
    // Failure-mode ledger as a reference to the P2.9 bad example. Rule #3
    // should skip this narrative reference.
    const findings = lintFindings('specs/plans/planning-readiness-meta-arc.md');
    expect(findings).not.toContain('plan-lint.test-path-extension');
  });

  it('does not fire rule #7/#8 on "enforcement_layer: blocked" in §3 rule descriptions', () => {
    const findings = lintFindings('specs/plans/planning-readiness-meta-arc.md');
    expect(findings).not.toContain('plan-lint.invariant-without-enforcement-layer');
    expect(findings).not.toContain('plan-lint.blocked-invariant-without-full-escrow');
  });
});

describe('plan-lint — usage / invocation errors', () => {
  it('exits 2 with usage message when no path is provided', () => {
    // Call plan-lint with zero args (execFileSync with empty array arg
    // would pass an empty-string path, which falls through to the
    // file-not-found branch instead of the usage branch).
    try {
      execFileSync(process.execPath, [PLAN_LINT], {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      expect.fail('expected non-zero exit');
    } catch (err) {
      const e = err as { status?: number };
      expect(e.status).toBe(2);
    }
  });

  it('exits 2 when the path does not exist', () => {
    const result = runLint('/tmp/nonexistent-plan.md');
    expect(result.exitCode).toBe(2);
  });
});

describe('plan-lint — per-rule bad fixtures (Slice 58 — 22 rules; Slice-58a Codex HIGH-1 scope promotion)', () => {
  const BAD = 'tests/fixtures/plan-lint/bad';
  const cases: [string, string][] = [
    ['rule-01-missing-evidence-census.md', 'plan-lint.evidence-census-present'],
    ['rule-02-tbd-in-acceptance.md', 'plan-lint.tbd-in-acceptance-evidence'],
    ['rule-03-test-path-extension.md', 'plan-lint.test-path-extension'],
    ['rule-04-stale-symbol-citation.md', 'plan-lint.stale-symbol-citation'],
    ['rule-05-arc-close-claim-without-gate.md', 'plan-lint.arc-close-claim-without-gate'],
    ['rule-06-signoff-while-pending.md', 'plan-lint.signoff-while-pending'],
    [
      'rule-07-invariant-without-enforcement-layer.md',
      'plan-lint.invariant-without-enforcement-layer',
    ],
    [
      'rule-08-blocked-invariant-without-escrow.md',
      'plan-lint.blocked-invariant-without-full-escrow',
    ],
    [
      'rule-09-contract-shaped-payload-without-characterization.md',
      'plan-lint.contract-shaped-payload-without-characterization',
    ],
    [
      'rule-10-unverified-hypothesis-as-decided.md',
      'plan-lint.unverified-hypothesis-presented-as-decided',
    ],
    ['rule-11-missing-arc-trajectory.md', 'plan-lint.arc-trajectory-check-present'],
    ['rule-12-live-state-ledger-incomplete.md', 'plan-lint.live-state-evidence-ledger-complete'],
    ['rule-13-cli-shape-mismatch.md', 'plan-lint.cli-invocation-shape-matches'],
    [
      'rule-14-artifact-cardinality-no-reference.md',
      'plan-lint.artifact-cardinality-mapped-to-reference',
    ],
    ['rule-15-invalid-status.md', 'plan-lint.status-field-valid'],
    [
      'rule-17-cleared-without-challenger-artifact.md',
      'plan-lint.status-challenger-cleared-requires-fresh-committed-challenger-artifact',
    ],
    [
      'rule-18-non-canonical-phase-set.md',
      'plan-lint.canonical-phase-set-maps-to-schema-vocabulary',
    ],
    [
      'rule-19-verdict-determinism-missing-verification.md',
      'plan-lint.verdict-determinism-includes-verification-passes-for-successor-to-live',
    ],
    [
      'rule-20-verification-runtime-without-substrate.md',
      'plan-lint.verification-runtime-capability-assumed-without-substrate-slice',
    ],
    [
      'rule-21-artifact-materialization-no-schema.md',
      'plan-lint.artifact-materialization-uses-registered-schema',
    ],
    [
      'rule-22-blocked-invariant-must-resolve.md',
      'plan-lint.blocked-invariant-must-resolve-before-arc-close',
    ],
  ];
  for (const [fixture, expectedRule] of cases) {
    it(`${fixture} fires ${expectedRule}`, () => {
      const path = `${BAD}/${fixture}`;
      const result = runLint(path);
      expect(result.exitCode).toBe(1);
      expect(lintFindings(path)).toContain(expectedRule);
    });
  }
});

describe('plan-lint — legacy/ fixture (backdating does not defeat rules)', () => {
  it('backdated-claim-does-not-defeat-rules.md still fails rule #15', () => {
    const path = 'tests/fixtures/plan-lint/legacy/backdated-claim-does-not-defeat-rules.md';
    const result = runLint(path);
    expect(result.exitCode).toBe(1);
    expect(lintFindings(path)).toContain('plan-lint.status-field-valid');
  });
});

describe('plan-lint — rule #7 vocabulary authority (Slice-59a Codex HIGH-1 regression test)', () => {
  // Slice-59a fold-in: prove the JSON is mechanically authoritative.
  // Prior to Slice-59a plan-lint had a hardcoded `layer !== 'blocked'`
  // escape that admitted `blocked` even if the JSON vocab excluded it.
  // These tests import rule #7 directly and exercise both the
  // rejection path (vocab without `blocked`) and the positive path
  // (vocab with `blocked`, loaded from the real JSON).
  const planText = `---
plan: test-vocab-authority
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: vocab-authority-proof
---

# Vocab authority test

## Why this plan exists

Fixture with a blocked invariant declaration.

## §1 — Evidence census

| # | Claim | Status |
|---|---|---|
| E1 | Test invariant | verified |

## §2 — Body

### REVIEW-I1

enforcement_layer: blocked
substrate_slice: Slice 99
owner: test
expiry_date: 2026-06-01
reopen_condition: test
acceptance_evidence: test
`;

  it('rejects `blocked` when the authoritative vocab does NOT include `blocked`', async () => {
    // @ts-ignore — plan-lint.mjs is ESM with no .d.ts
    const planLint = (await import('../../scripts/plan-lint.mjs')) as {
      rule7InvariantWithoutLayer: (
        plan: unknown,
        vocab: Set<string>,
      ) => Array<{ rule: string; message: string }>;
      parsePlan: (text: string) => unknown;
    };
    const plan = planLint.parsePlan(planText);
    const vocabWithoutBlocked = new Set([
      'test-enforced',
      'audit-only',
      'static-anchor',
      'prose-only',
      'phase2-property',
    ]);
    const findings = planLint.rule7InvariantWithoutLayer(plan, vocabWithoutBlocked);
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    if (!finding) throw new Error('finding[0] missing');
    expect(finding.rule).toBe('plan-lint.invariant-without-enforcement-layer');
    expect(finding.message).toContain('not in authoritative set');
  });

  it('accepts `blocked` when the authoritative vocab includes `blocked` (current state)', async () => {
    // @ts-ignore — plan-lint.mjs is ESM with no .d.ts
    const planLint = (await import('../../scripts/plan-lint.mjs')) as {
      rule7InvariantWithoutLayer: (
        plan: unknown,
        vocab: Set<string>,
      ) => Array<{ rule: string; message: string }>;
      parsePlan: (text: string) => unknown;
      loadInvariantLayerVocab: () => Set<string>;
    };
    const plan = planLint.parsePlan(planText);
    const findings = planLint.rule7InvariantWithoutLayer(plan, planLint.loadInvariantLayerVocab());
    expect(findings).toHaveLength(0);
  });
});

describe('plan-lint — rule #16 (untracked-plan-cannot-claim-post-draft-status)', () => {
  it('fires red when an untracked plan claims status: challenger-pending', async () => {
    // Rule #16 requires an actually-untracked file to test. We write to a
    // path under the system temp dir and point plan-lint at it. The fixture
    // is never committed; its untracked-ness is the subject of the rule.
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'plan-lint-rule-16-'));
    const planPath = join(dir, 'rule-16-untracked-post-draft.md');
    writeFileSync(
      planPath,
      `---
plan: rule-16-untracked-post-draft
status: challenger-pending
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-16-proof
---

# Untracked post-draft fixture

## Why this plan exists

Fixture verifying rule #16 fires on untracked files claiming post-draft status.

## §1 — Evidence census

| # | Claim | Status |
|---|---|---|
| E1 | Untracked file with challenger-pending status | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Discovery.

**Failure mode addressed:** Rule coverage gap.

**Deliverable:** This file.

**Acceptance evidence:** Plan-lint exits non-zero.

**Alternate framing:** *(a) Track it.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.
`,
    );
    const result = runLint(planPath);
    expect(result.exitCode).toBe(1);
    expect(lintFindings(planPath)).toContain(
      'plan-lint.untracked-plan-cannot-claim-post-draft-status',
    );
  });
});
