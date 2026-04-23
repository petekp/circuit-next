---
name: arc-slice-58-codex
description: Cross-model challenger pass over Slice 58 (planning-readiness-meta-arc tooling layer — plan-lint baseline + audit Check 36 + per-rule fixtures). Ratchet-advance slice per CLAUDE.md §Hard invariants #6.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-23
verdict: REJECT-PENDING-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-58-plan-lint-baseline
target_kind: arc
target: slice-58
target_version: "HEAD=7737b9509e3153965879923186b5c77edde878da (Slice 58 — plan-lint baseline + Check 36 + per-rule fixtures)"
arc_target: planning-readiness-meta-arc
arc_version: "revision 08 / operator-signoff / Slice 58 tooling layer"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: "ACCEPT-WITH-FOLD-INS (all 5 findings folded in Slice 58a continuation commit — see fold_in_status)"
severity_counts:
  critical: 1
  high: 1
  med: 2
  low: 1
commands_run:
  - read scripts/audit.mjs Check 36 block (checkPlanLintCommittedPlans)
  - read scripts/plan-lint.mjs rule #7 #8 #22 + runAllRules
  - read specs/plans/planning-readiness-meta-arc.md §4 Slice 58
  - read specs/adrs/ADR-0010-arc-planning-readiness-gate.md §Decision
  - read tests/scripts/plan-lint.test.ts per-rule table
  - read tests/fixtures/plan-lint/bad/*.md
  - read tests/fixtures/plan-lint/legacy/*.md
  - verify runtime behavior against fixtures
opened_scope:
  - scripts/audit.mjs (Check 36 — checkPlanLintCommittedPlans)
  - scripts/plan-lint.mjs (rule runAllRules array + rules #7/#8/#22)
  - tests/scripts/plan-lint.test.ts (per-rule table + rule #16 temp-file test)
  - tests/fixtures/plan-lint/bad/*.md (18 per-rule fixtures)
  - tests/fixtures/plan-lint/legacy/*.md (1 backdating fixture)
skipped_scope:
  - full synthetic-git-history Check 36 test harness (deferred — MED-2 partial)
  - strict one-rule-per-fixture isolation allowlist (deferred — LOW-1 partial)
fold_in_status:
  CRITICAL-1: resolved-in-slice-58a
  HIGH-1: "resolved-in-slice-58a (Option B — scope promoted to all 22 rules + 3 new fixtures)"
  MED-1: "resolved-in-slice-58a (--follow + closed plans + legacy exemption)"
  MED-2: "partial-resolved-in-slice-58a (green-path integration test; synthetic-history cases deferred)"
  LOW-1: "partial-resolved-in-slice-58a (execFileSync switch; uniqueness allowlist deferred)"
findings:
  - id: CRITICAL-1
    severity: CRITICAL
    title: Check 36 does not prove operator_signoff_predecessor names a challenger-cleared predecessor
  - id: HIGH-1
    severity: HIGH
    title: Slice 59 invariant rules are active in the Slice 58 lint path
  - id: MED-1
    severity: MED
    title: Transition walk is rename-blind and skips closed plans
  - id: MED-2
    severity: MED
    title: Check 36 has no direct regression tests
  - id: LOW-1
    severity: LOW
    title: Fixture tests are target-positive but not isolation/reproducibility tight
---

# Slice 58 Codex Challenger Review

## CRITICAL-1 — Check 36 does not prove operator_signoff_predecessor names a challenger-cleared predecessor

**Severity:** CRITICAL
**Finding id:** CRITICAL-1

**Description:** Check 36 finds an operator-signoff transition commit, checks that its body contains `operator_signoff_predecessor`, then only verifies that the named SHA exists as an object. It does not verify that the named SHA is in the current branch history, is an ancestor of the transition commit, contains the same plan at `status: challenger-cleared`, or has the matching committed challenger artifact with `reviewed_plan` binding. Since plan-lint rule #17 explicitly skips `operator-signoff` and `closed`, this leaves a direct signoff bypass: a plan can be added at `status: operator-signoff` with a commit body pointing at any extant SHA and satisfy the current Check 36 shape.

**Evidence:** `scripts/plan-lint.mjs:812-827` says `operator-signoff` and `closed` rely on audit ancestry instead of rule #17. `scripts/audit.mjs:4288-4299` only matches the body pattern and runs `git cat-file -e ${namedSha}`. The Slice 58 plan requires more: `specs/plans/planning-readiness-meta-arc.md:626-635` says Check 36 verifies the committed challenger artifact and that the predecessor commit has the plan at `status: challenger-cleared`.

**Proposed fold-in:** After extracting the named SHA, require `git merge-base --is-ancestor <namedSha> <transitionCommit>`, load `<namedSha>:<plan path>`, assert frontmatter `status: challenger-cleared`, and verify the matching review artifact binding for that predecessor plan content. Reject "file added already at operator-signoff" unless a same-path predecessor exists at challenger-cleared.

## HIGH-1 — Slice 59 invariant rules are active in the Slice 58 lint path

**Severity:** HIGH
**Finding id:** HIGH-1

**Description:** Slice 58 is scoped to the 19-rule baseline (#1-#6, #9-#21), with #7/#8/#22 scheduled for Slice 59. The implementation currently runs #7, #8, and #22 in `runAllRules`, before Slice 59 updates `specs/invariants.json` with the `blocked` vocabulary and before per-rule bad fixtures exist for the invariant trio. That is scope creep for a Ratchet-Advance slice and makes Slice 59 partially pre-landed but undertested.

**Evidence:** `specs/plans/planning-readiness-meta-arc.md:613-620` scopes Slice 58 to 19 rules and says #7/#8/#22 are later. `scripts/plan-lint.mjs:1135-1136` and `scripts/plan-lint.mjs:1150` include #7/#8/#22 in the active rule array. `tests/scripts/plan-lint.test.ts:168-213` has per-rule fixtures only for #1-#6 and #9-#21.

**Proposed fold-in:** Either gate #7/#8/#22 out of `runAllRules` until Slice 59, or explicitly revise Slice 58 scope to "all 22 rules" and add the missing #7/#8/#22 bad fixtures plus acceptance evidence against the updated invariant vocabulary.

## MED-1 — Transition walk is rename-blind and skips closed plans

**Severity:** MED
**Finding id:** MED-1

**Description:** The walk-back algorithm uses `git log --format=%H -- <current path>` and `git show <sha>:<current path>`. It does not use `--follow` or maintain old path names, so a plan renamed after signoff can be misread as "added while already operator-signoff," causing a false transition at the rename commit. Separately, Check 36 only runs the predecessor-chain check when the current status is exactly `operator-signoff`; ADR-0010 says `closed` should inherit the same predecessor-chain validation.

**Evidence:** Path history is current-path only at `scripts/audit.mjs:4241` and `scripts/audit.mjs:4249`. `scripts/audit.mjs:4230` continues unless current status is exactly `operator-signoff`. ADR-0010 says Check 36 validates the predecessor chain for `status: operator-signoff` or `status: closed` at `specs/adrs/ADR-0010-arc-planning-readiness-gate.md:206-208`.

**Proposed fold-in:** Use a path-aware history walk (`git log --follow --name-status` or explicit rename detection), or reject renamed plan histories with a clear audit failure until supported. Apply the predecessor-chain check to both `operator-signoff` and `closed`.

## MED-2 — Check 36 has no direct regression tests

**Severity:** MED
**Finding id:** MED-2

**Description:** The new audit behavior is the riskiest part of Slice 58, but the test expansion exercises plan-lint fixtures only. There are no tests importing `checkPlanLintCommittedPlans` or building a temporary git history for transition cases. This is how the weak predecessor validation above survived: the suite proves the current meta-arc passes, not that bad histories fail.

**Evidence:** Searching tests for `checkPlanLintCommittedPlans`, `OPERATOR_SIGNOFF_BINDING`, and `operator_signoff_predecessor` finds no audit tests. `tests/scripts/plan-lint.test.ts:13-15` also claims stale-revision/missing-binding freshness cases, but the actual rule #17 table at `tests/scripts/plan-lint.test.ts:168-220` only checks target-rule presence for one missing-artifact fixture.

**Proposed fold-in:** Add Check 36 tests using a temporary git repo or worktree for: missing binding, named SHA missing, named SHA present but not ancestor, predecessor plan not challenger-cleared, file added directly at operator-signoff, rename after signoff, and closed-plan inheritance.

## LOW-1 — Fixture tests are target-positive but not isolation/reproducibility tight

**Severity:** LOW
**Finding id:** LOW-1

**Description:** The per-rule fixtures prove each target rule appears, but they do not prove isolation. That does not invalidate the "target rule fires" claim, but it weakens any stronger "one bad fixture per rule" claim. Current observed outputs: `rule-01-missing-evidence-census.md` emits both #1 and #11; `rule-17-cleared-without-challenger-artifact.md` emits only its target; `rule-20` and `rule-21` emit multiple findings of the same rule. Rule #16's temp-file test also uses a shell string command and a path outside the repo, so it is sensitive to spaces/metacharacters in `TMPDIR` and does not exercise the normal "untracked file under specs/plans" shape.

**Evidence:** `tests/scripts/plan-lint.test.ts:214-220` only asserts `toContain(expectedRule)`. The rule #16 test writes under `tmpdir()` at `tests/scripts/plan-lint.test.ts:238-242`, while `runLint` shells an unquoted path at `tests/scripts/plan-lint.test.ts:25-28`. `isGitTracked` handles absolute paths by slicing off `REPO_ROOT.length + 1` at `scripts/plan-lint.mjs:244-247`, which is a different path shape for outside-repo temp files than for an untracked in-repo plan.

**Proposed fold-in:** Add an exact unique-rule allowlist for bad fixtures, with intentional exceptions documented. Switch test invocation to `execFileSync(process.execPath, [PLAN_LINT, path])`. For rule #16, prefer a temporary worktree/repo fixture or an in-repo untracked path with cleanup.

## Non-objection checked

The backdating fixture is meaningful, not tautological. Its first commit is HEAD `7737b95`, not a strict ancestor of `META_ARC_FIRST_COMMIT`, and plan-lint still emits `plan-lint.status-field-valid` despite `opened_at: 2026-04-20`. It proves frontmatter backdating does not create legacy status. The only caveat is naming: it is a backdating-evasion fixture, not a legacy-exemption fixture.
