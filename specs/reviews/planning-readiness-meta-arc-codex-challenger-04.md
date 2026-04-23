---
review: planning-readiness-meta-arc-codex-challenger-04
reviewer: codex (cross-model challenger via /codex skill)
review_date: 2026-04-23
verdict: REJECT-PENDING-FOLD-INS
fold_ins_minimum: 3
prior_objections_count: 4
prior_objection_resolution:
  resolved: 1  # MED 4 (operator_signoff_predecessor)
  partial: 1   # CRITICAL 1 (SHA binding implemented but not exercised due to legacy exemption)
  not_resolved: 2  # HIGH 2 (stale "21" refs), HIGH 3 (timezone bug in legacy check)
new_findings:
  critical: 1  # vacuous self-lint (legacy mis-exemption)
  high: 1      # stale "21" references in §0.B + §5
  med: 1       # §8 still says revision 03
reviewed_plan:
  plan_slug: planning-readiness-meta-arc
  plan_revision: 04
  plan_base_commit: c91469053a95519645280fd80394a4966ac7948e
  plan_content_sha256: c3388c3cf506783a5ec0dc6f8892c769958e88beb7f44e1044c1013f0741b086
  plan_status_at_review: challenger-pending (committed at fe5503d)
purpose: |
  Persist Codex cross-model challenger pass 04 verdict against
  planning-readiness-meta-arc.md revision 04 (committed at fe5503d).
  Pass 04 returned REJECT-PENDING-FOLD-INS — the beautiful meta-
  reflexive finding: revision 04's self-lint was vacuously green
  because isLegacyPlan used a sliced-local-date check that misclassified
  the Pacific-timezone commit as pre-effective, skipping all 22 rules.
  The gate was bypassing itself. All 3 fold-ins addressed in revision
  05; pass 05 re-dispatch upcoming.
---

# Planning-Readiness Meta-Arc — Codex Challenger Pass 04

## Verdict

**REJECT-PENDING-FOLD-INS.** Cannot give unqualified ACCEPT. The
requested lint command exits 0, but the green result is vacuous:
`isLegacyPlan` classifies the revision-04 plan as legacy, so
`runAllRules` returns before executing any of the 22 rules. The
recursive-validation invariant is violated.

## Pass-03 fold-in resolution status (from pass 04)

| Pass 03 finding | Status | Note |
|---|---|---|
| CRITICAL 1: rule #17 content SHA + required base_commit | PARTIAL | Rule #17 implements SHA-256 + required base_commit, but not exercised for this plan because legacy guard skips all rules first. |
| HIGH 2: 22-rule count reconciled everywhere | NOT RESOLVED | §0.C claims "22 EVERYWHERE" but §0.B MIN 4 still says "21" and §5 dependency graph still says "21 total". |
| HIGH 3: effective-date migration via first-commit-date check | NOT RESOLVED | Implementation uses `git log --format=%aI` then slices to `YYYY-MM-DD`. The plan's first-commit ISO is `2026-04-22T23:37:40-07:00`; sliced date is `2026-04-22`; compared to `2026-04-23` → legacy:true. The plan IS post-effective in UTC (`2026-04-23T06:37:40Z`) but the sliced-local-date check misclassifies it. Plan's §Migration prose still describes old `opened_at`-only path. |
| MED 4: operator_signoff_predecessor delegated to Check 36 | RESOLVED | Slice 58 Check 36 deliverable now explicitly includes commit-body predecessor-chain enforcement; plan-lint does NOT inspect commit bodies. |

## New findings (pass 04)

### CRITICAL 1. Recursive self-lint is a false green

`node scripts/plan-lint.mjs specs/plans/planning-readiness-meta-arc.md`
exits 0, but `isLegacyPlan` returns true for this file. Verified the
decision path with the script's own logic: first commit date becomes
"2026-04-22", effective date is "2026-04-23", so isLegacy=true.

Impact: rule #17, status validation, rule count behavior, and every
other rule are skipped for the plan currently under review. This
invalidates the recursive validation claim.

Resolution: fix isLegacyPlan to use UTC timestamps. `Date.parse` on
the full ISO with timezone produces correct UTC epoch, which is
what the effective boundary should compare against. Add a regression
test asserting this exact plan is non-legacy.

### HIGH 2. Rule-count reconciliation still has stale `21` text

§0.B MIN 4 row says "rule count = 21 everywhere". §5 dependency
graph says "Slice 59 (invariant dim + blocked escrow = 21 total)".
The plan explicitly says the count is reconciled everywhere, but
two stale places remain. This is exactly the pass-03 HIGH 2 failure
mode repeating.

Resolution: update both locations to "22".

### MED 3. §8 self-validation is stale revision-03 state

§8 still says "Self-validation (reflexive, revision 03)", "Revision:
03", and describes dispatching "Codex pass 03" as a next step.
Revision 04 did not update its own lifecycle evidence.

Resolution: refresh §8 to current revision + current next-step
sequence.

## Minimum fold-ins before operator sign-off

1. **Fix isLegacyPlan timezone bug.** Replace sliced-local-date
   check with Date.parse vs UTC effective boundary. Add regression
   test proving THIS plan (first-commit `2026-04-22T23:37:40-07:00`
   / `2026-04-23T06:37:40Z`) is non-legacy AND that all 22 rules
   execute against it. Update §Migration prose to remove stale
   opened_at-only implementation text.

2. **Reconcile remaining "21" references** in §0.B MIN 4 and §5
   dependency graph to "22".

3. **Refresh §8 self-validation** to revision 04/05 state + current
   next-step sequence.

## Recursive validation check

`node scripts/plan-lint.mjs specs/plans/planning-readiness-meta-arc.md`
exits 0 with `GREEN (no findings)`.

**Challenger verdict: FAIL as recursive validation.** The command is
green because the plan is incorrectly legacy-exempted, not because
revision 04 satisfies its own 22-rule gate.
