---
review: planning-readiness-meta-arc-codex-challenger-05
reviewer: codex (cross-model challenger via /codex skill)
review_date: 2026-04-23
verdict: REJECT-PENDING-FOLD-INS
fold_ins_minimum: 3
prior_objections_count: 3
prior_objection_resolution:
  resolved: 1  # HIGH 2 (stale "21" refs)
  partial: 2   # CRITICAL 1 (code fixed; plan prose stale), MED 3 (§8 partial refresh)
new_findings:
  critical: 1  # test suite non-reproducible from clean checkout
  high: 1      # plan prose still describes rejected Date.parse approach
  med: 1       # §8 chronology drift
reviewed_plan:
  plan_slug: planning-readiness-meta-arc
  plan_revision: 05
  plan_base_commit: fe5503d
  plan_content_sha256: ad6bd6974235eda5b0579b4539eda9b8664115c7bfe94f2dbc46bc92d1647789
  plan_status_at_review: challenger-pending (committed at 2aeb351 / Slice 57c)
  recursive_validation: substantive (commit-ancestry legacy check means rules actually run)
purpose: |
  Persist Codex cross-model challenger pass 05 verdict against
  planning-readiness-meta-arc.md revision 05. Pass 05 returned
  REJECT-PENDING-FOLD-INS — not yet sign-off-ready, but the core
  isLegacyPlan fix is substantive (self-lint GREEN and rules
  actually running, verified by pass 05). Remaining fold-ins are
  (a) committed test fixture for reproducibility and (b)
  documentation drift between code and plan prose.
---

# Planning-Readiness Meta-Arc — Codex Challenger Pass 05

## Verdict

**REJECT-PENDING-FOLD-INS.** The core `isLegacyPlan` code fix is
substantive: `node scripts/plan-lint.mjs specs/plans/planning-
readiness-meta-arc.md` exits 0, and the target plan is not being
legacy-skipped. But rev 05 is not sign-off-ready because (a) the
committed test suite is only green in the dirty worktree (depends on
untracked P2.9 draft), and (b) the plan still contains stale
Date.parse/effective-date prose that contradicts the actual
merge-base fix.

## Pass-04 fold-in resolution status (from pass 05)

| Pass 04 fold-in | Verdict | Notes |
|---|---|---|
| CRITICAL 1: vacuous self-lint / isLegacyPlan | PARTIAL | Code fixed via `git merge-base --is-ancestor` against `META_ARC_FIRST_COMMIT`. But plan prose still says the fix is `Date.parse` in §0.D, §Migration, §8. |
| HIGH 2: stale "21" refs | RESOLVED | No remaining stale "21 total" / "21-rule" claims. §5 dependency graph says 22 total. |
| MED 3: §8 stale revision/pass narrative | PARTIAL | §8 is now revision 05 and references pass 04/05, but still carries stale pre-commit wording ("about to stage Slice 57c" / "will commit") and obsolete Date.parse proof. |

## Recursive validation — substantive GREEN

Evidence:
- `node scripts/plan-lint.mjs specs/plans/planning-readiness-meta-arc.md`
  exits 0 GREEN.
- `npm run plan:lint -- specs/plans/planning-readiness-meta-arc.md`
  exits 0 GREEN.
- `git log --diff-filter=A --follow --format=%H -- specs/plans/
  planning-readiness-meta-arc.md` returns
  `c91469053a95519645280fd80394a4966ac7948e`.
- That equals `META_ARC_FIRST_COMMIT`, and `scripts/plan-lint.mjs`
  explicitly returns non-legacy on equality, so `runAllRules`
  reaches the 22-rule array.

Self-lint is no longer vacuous. The objection: the plan's written
proof says the wrong mechanism.

## New findings (pass 05)

### CRITICAL 1. Committed tests depend on untracked local plan draft

`tests/scripts/plan-lint.test.ts` hard-codes
`specs/plans/p2-9-second-workflow.md`, but `git ls-files
--error-unmatch specs/plans/p2-9-second-workflow.md` fails. In the
dirty worktree, the file exists untracked, so
`npx vitest run tests/scripts/plan-lint.test.ts` passes 18/18. In a
clean detached worktree at 2aeb351, the same suite fails 9/18
because plan-lint exits 2 for the missing file. The "18 tests
passing" evidence is non-reproducible from HEAD.

Resolution: commit `tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md`
as a committed copy of the P2.9 draft. Update tests to reference
the fixture instead of the original untracked draft.

### HIGH 2. Plan prose describes rejected Date.parse / effective-date implementation

§Migration is the future implementation guide for audit Check 36.
Currently points future implementers toward the class of boundary
bug pass-04 was meant to eliminate.

Resolution: replace every remaining Date.parse / first-commit-date
/ opened_at-as-authority migration claim with the actual
commit-ancestry rule.

### MED 3. §8 still has committed-state drift

At HEAD, Slice 57c is already committed, but §8 says the plan is
"about to stage Slice 57c" and the pass-04 artifact "will commit
with this revision."

Resolution: refresh §8 chronology to describe HEAD reality.

## Minimum fold-ins before operator sign-off

1. **Make test suite clean-checkout reproducible.** Commit
   `tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md` AND update
   tests to reference it.

2. **Replace Date.parse / effective-date prose with commit-ancestry
   rule** in §0.D, §Migration, §8.

3. **Refresh §8 chronology** to describe HEAD reality.

After these fold-ins, I'd expect convergence. Core gate behavior is
substantive; remaining blockers are reproducibility and stale
authority text.
