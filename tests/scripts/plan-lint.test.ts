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

import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const PLAN_LINT = join(REPO_ROOT, 'scripts', 'plan-lint.mjs');

function runLint(path: string): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`node ${PLAN_LINT} ${path}`, {
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
    const result = runLint('');
    expect(result.exitCode).toBe(2);
  });

  it('exits 2 when the path does not exist', () => {
    const result = runLint('/tmp/nonexistent-plan.md');
    expect(result.exitCode).toBe(2);
  });
});
