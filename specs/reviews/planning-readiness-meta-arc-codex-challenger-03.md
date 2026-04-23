---
review: planning-readiness-meta-arc-codex-challenger-03
reviewer: codex (cross-model challenger via /codex skill)
review_date: 2026-04-23
verdict: ACCEPT-WITH-FOLD-INS
fold_ins_minimum: 4
prior_objections_count: 11
prior_objection_resolution:
  resolved: 7  # MIN 1, MIN 5/HIGH 4, MIN 6, MIN 7/HIGH 5, HIGH 3, MED 6, MED 7
  partial: 3   # MIN 2/CRITICAL 1, MIN 3/CRITICAL 2, MIN 4
new_findings:
  critical: 1
  high: 2
  med: 1
reviewed_plan:
  plan_slug: planning-readiness-meta-arc
  plan_revision: 03
  plan_base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
  plan_content_sha256: 8678b4d586594c2bc68b08d45d0c951788740680173454d101ae272a8769cc2d
  plan_status_at_review: challenger-pending (committed at c914690)
  plan_line_count_at_review: 601
  recursive_validation: passing (plan-lint exits 0 on this plan)
purpose: |
  Persist the Codex cross-model challenger pass 03 verdict against
  planning-readiness-meta-arc.md revision 03 as durable committed
  authority. Pass 03 returned ACCEPT-WITH-FOLD-INS — sign-off-close.
  The 4 fold-ins are addressed in revision 04.
---

# Planning-Readiness Meta-Arc — Codex Challenger Pass 03

## Verdict

**ACCEPT-WITH-FOLD-INS.** Revision 03 is sign-off-close. The plan is
committed, `challenger-pending`, carries a real §Entry-state, maps
pass-02 findings, and passes the committed lint command. Not a full
revision-04 rewrite; fold-ins below required before moving to
`challenger-cleared` / operator sign-off.

## Recursive validation

`node scripts/plan-lint.mjs specs/plans/planning-readiness-meta-arc.md`
exits 0: `plan-lint: .../planning-readiness-meta-arc.md — GREEN (no
findings)`.

Also verified:
- `tests/fixtures/plan-lint/good/minimal-compliant-plan.md` exits 0.
- `specs/plans/p2-9-second-workflow.md` exits non-zero with 20 red
  findings, including the new P2.9 coverage rules (#18-#21).

## Pass-02 fold-in resolution status (from pass 03)

| Pass 02 finding | Status | Note |
|---|---|---|
| MIN 1: commit plan + reviews before redispatch | RESOLVED | HEAD c914690 commits plan, reviews, linter draft, and fixture. |
| MIN 2 / CRITICAL 1: fresh challenger binding | PARTIAL | Plan text requires slug + revision + base_commit + plan_content_sha256; tool only checks slug + revision + optionally base_commit. No content hash check. |
| MIN 3 / CRITICAL 2: migration / effective date | PARTIAL | Existing corpus exemption is addressed, but new-plan backdating remains possible. |
| MIN 4: rule count + CLI consistency | PARTIAL | CLI is positional; but rule count is still internally inconsistent: plan says 21, inventory/tool expose 22 numbered ids, module header documents only 17. |
| MIN 5 / HIGH 4: explicit P2.9 HIGH coverage | RESOLVED | Rules #18-#21 exist and fire on P2.9 preview run. |
| MIN 6: entry-state + self-lint | RESOLVED | §Entry state exists; self-lint is green. |
| MIN 7 / HIGH 5: decide `blocked` | RESOLVED | Full escrow + close-out rule specified + implemented in draft. |
| HIGH 3: repo state contradicts sequence | RESOLVED | Plan/reviews committed before this pass; Slice 57 ADR work still local draft. |
| MED 6: lifecycle missing `closed` | RESOLVED | `closed` is now the fifth lifecycle state. |
| MED 7: section-aware scoping | RESOLVED | Self-lint green; prior false positives no longer block this plan. |

## New findings (pass 03)

### CRITICAL 1. Rule #17 does not enforce the freshness binding revision 03 claims

Plan text requires `plan_content_sha256` in the challenger review to
match the current plan (specs/plans/planning-readiness-meta-arc.md:110
and :178). `plan-lint.mjs::rule17ClearedRequiresArtifact` parses
slug/revision/base_commit only; no content hash computation or match
check. Base_commit is accepted even if the review omits it. Stale
ACCEPT path remains for same-revision content edits.

Resolution: add SHA-256 content hash computation in rule #17; require
plan_content_sha256 to match; require base_commit (not optional).

### HIGH 2. Rule count still not reconciled

Plan §3 says "21 rules total" (line 333); inventory has rules #1-#22;
runner invokes `rule22BlockedMustResolve` (plan-lint.mjs:1061). Module
header lists #1-#17 and still names old rule #8 (plan-lint.mjs:24).
Pick one: 22 rules everywhere, or fold #22 into #8.

Resolution: rule count = 22 everywhere. Update plan §3, §0.B MIN 4
row, Slice 58/59 ratchet numbers, plan-lint module header.

### HIGH 3. Effective-date migration allows backdated new plans

Plan says new plans MUST carry `opened_at >= 2026-04-23` and backdating
is forbidden (plan line 216). `isLegacyPlan` in plan-lint returns
exempt for `opened_at < EFFECTIVE_DATE` or for files with no
`opened_at` and no `status`. Fine for known historical committed plans;
unsafe for arbitrary untracked draft paths.

Resolution: distinguish legacy-committed files from arbitrary new
paths. Exempt only git-tracked plans whose first committed version
predates 2026-04-23; untracked plans missing `opened_at` or claiming
pre-effective `opened_at` should fail.

### MED 4. `operator_signoff_predecessor` specified but not enforced

Plan lifecycle table says operator sign-off commit bodies must carry
`operator_signoff_predecessor` (line 168). Linter does not inspect
commit bodies. Slice 58 Check 36 verifies challenger artifacts for
operator-signoff, not this predecessor binding.

Resolution: either implement predecessor check in audit Check 36, or
explicitly note it as future audit requirement outside plan-lint.

## Minimum fold-ins before sign-off

1. Update `scripts/plan-lint.mjs` rule #17 to compute current plan
   SHA-256 and require matching `plan_content_sha256`; also require
   `plan_base_commit` (not optional-prefix acceptance).

2. Reconcile rule count = 22 everywhere (plan §3, Slice 58/59
   ratchets, §0.B MIN 4 row, plan-lint module header, tests).

3. Close the effective-date loophole by distinguishing legacy
   committed files from arbitrary new paths. Exempt only git-tracked
   plans whose first committed version predates `2026-04-23`;
   untracked plans missing `opened_at` or claiming pre-effective
   `opened_at` should fail.

4. Either implement `operator_signoff_predecessor` in audit Check 36,
   or revise the plan to state it is a future audit requirement
   outside plan-lint.

## Post-fold-in verdict

"After those fold-ins, I'd be comfortable with `ACCEPT` on this plan."
