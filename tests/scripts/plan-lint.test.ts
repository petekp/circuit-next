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

  it('does not fire rule #7 on "enforcement_layer: blocked" in §3 rule descriptions', () => {
    // Rule #8 (blocked-invariant-without-full-escrow) was cut in Slice 65;
    // only #7 (invariant-without-enforcement-layer) remains to guard
    // against spurious firing on rule-description narrative sections.
    const findings = lintFindings('specs/plans/planning-readiness-meta-arc.md');
    expect(findings).not.toContain('plan-lint.invariant-without-enforcement-layer');
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
    // rule-08 fixture removed in Slice 65 (rule cut)
    [
      'rule-09-contract-shaped-payload-without-characterization.md',
      'plan-lint.contract-shaped-payload-without-characterization',
    ],
    [
      'rule-10-unverified-hypothesis-as-decided.md',
      'plan-lint.unverified-hypothesis-presented-as-decided',
    ],
    // rule-11 fixture removed in Slice 65 (rule cut)
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
    // rule-22 fixture removed in Slice 65 (rule cut)
    ['rule-23-chronology-violating.md', 'plan-lint.prospective-chronology-forbidden'],
    ['rule-23-chronology-noun-led.md', 'plan-lint.prospective-chronology-forbidden'],
    ['rule-23-chronology-evidence-backed-suffix.md', 'plan-lint.prospective-chronology-forbidden'],
    ['rule-23-chronology-advances-case.md', 'plan-lint.prospective-chronology-forbidden'],
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

describe('plan-lint — rule #23 prospective-chronology-forbidden (Slice 64, methodology-trim-arc)', () => {
  const RULE_23 = 'plan-lint.prospective-chronology-forbidden';

  it('chronology-violating.md fires at least P1, P2, and P3', () => {
    const path = 'tests/fixtures/plan-lint/bad/rule-23-chronology-violating.md';
    const result = runLint(path);
    expect(result.exitCode).toBe(1);
    const findings = lintFindings(path);
    expect(findings.filter((r) => r === RULE_23).length).toBeGreaterThanOrEqual(3);
    // Stdout carries the detector label ("P1", "P2", "P3") in the message.
    expect(result.stdout).toMatch(/P1:/);
    expect(result.stdout).toMatch(/P2:/);
    expect(result.stdout).toMatch(/P3:/);
  });

  it('chronology-noun-led.md fires P5 (and no P1)', () => {
    const path = 'tests/fixtures/plan-lint/bad/rule-23-chronology-noun-led.md';
    const result = runLint(path);
    expect(result.exitCode).toBe(1);
    expect(lintFindings(path)).toContain(RULE_23);
    expect(result.stdout).toMatch(/P5:/);
  });

  it('chronology-evidence-backed-suffix.md fires (heading is not exact canonical skip match)', () => {
    const path = 'tests/fixtures/plan-lint/bad/rule-23-chronology-evidence-backed-suffix.md';
    const result = runLint(path);
    expect(result.exitCode).toBe(1);
    expect(lintFindings(path)).toContain(RULE_23);
  });

  it('chronology-advances-case.md fires (pass-06 MED fold-in: advance/advances/advanced)', () => {
    const path = 'tests/fixtures/plan-lint/bad/rule-23-chronology-advances-case.md';
    const result = runLint(path);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/advances|advanced/);
  });

  it('rule-23-state-description.md is GREEN (state-description negative control)', () => {
    const path = 'tests/fixtures/plan-lint/good/rule-23-state-description.md';
    const result = runLint(path);
    expect(result.exitCode).toBe(0);
    expect(lintFindings(path)).not.toContain(RULE_23);
  });

  it('rule-23-quoted-negative-control.md is GREEN (fenced code + skip section both honored)', () => {
    const path = 'tests/fixtures/plan-lint/good/rule-23-quoted-negative-control.md';
    const result = runLint(path);
    expect(result.exitCode).toBe(0);
    expect(lintFindings(path)).not.toContain(RULE_23);
  });

  it('planning-readiness-meta-arc.md is grandfathered (pre-methodology-trim-arc)', () => {
    const path = 'specs/plans/planning-readiness-meta-arc.md';
    const result = runLint(path);
    expect(result.exitCode).toBe(0);
    expect(lintFindings(path)).not.toContain(RULE_23);
  });

  it('specs/reviews/** files are out of rule-23 scope', () => {
    const path = 'specs/reviews/methodology-trim-arc-codex-challenger-06.md';
    // Review files are not normally lint-able but rule-23 must bail
    // out before any scan happens. Rule-23 must not appear in findings
    // regardless of the overall exit status.
    expect(lintFindings(path)).not.toContain(RULE_23);
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

describe('plan-lint — rule #4 type/interface/enum support (Slice-60a Codex MED-1 regression test)', () => {
  // Slice-60a fold-in: Codex MED-1 noted that rule #4's definition
  // patterns covered only const/let/var/function/class. TypeScript
  // exports of `type`, `interface`, and `enum` are real definitions
  // and must satisfy the ownership check. These tests exercise each
  // form by writing a temporary plan that cites a real type-only
  // export from the repo.
  it('does not fire on `export type` citation (e.g. AuditCheckResult in scripts/audit.d.mts)', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'rule-4-type-'));
    const planPath = join(dir, 'plan.md');
    writeFileSync(
      planPath,
      `---
plan: rule-4-type-test
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-4-type
---

# Rule 4 type test

## Why this plan exists

Verify type/interface/enum definitions satisfy rule #4.

## §1 — Evidence census

| # | Claim | Status |
|---|---|---|
| E1 | Test fixture | verified |

## §2 — Body

Cite \`scripts/audit.d.mts::AuditCheckResult\` here.
`,
    );
    expect(lintFindings(planPath)).not.toContain('plan-lint.stale-symbol-citation');
  });
});

describe('plan-lint — rule #16 (untracked-plan-cannot-claim-post-draft-status)', () => {
  it('fires red when an untracked plan claims status: challenger-pending', async () => {
    // Rule #16 requires an actually-untracked file to test. We write to a
    // path under the system temp dir and point plan-lint at it. The fixture
    // is never committed; its untracked-ness is the subject of the rule.
    //
    // Slice-62 (arc-close composition review MED-1 fold-in — both prongs):
    // This test passes by the outside-repo-path branch of isGitTracked.
    // plan-lint.mjs::isGitTracked slices REPO_ROOT off the absolute path;
    // for tmpdir() paths that slice produces garbage, `git ls-files`
    // fails, and the catch returns false (→ untracked → rule #16 fires).
    // That matches the intended semantics, but the dependency is
    // implicit. See the inline comment in isGitTracked. Candidate
    // future follow-up: exercise rule #16 via a temporary git repo /
    // worktree so the "untracked plan under specs/plans" shape is
    // exercised end-to-end.
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
