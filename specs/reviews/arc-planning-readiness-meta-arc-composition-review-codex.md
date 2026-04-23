---
name: arc-planning-readiness-meta-arc-composition-review-codex
description: Codex composition-challenger pass over the Planning-Readiness Meta-Arc as a composed policy, tooling, proof, and discipline system.
type: review
reviewer_model: gpt-5-codex
reviewer_model_id: gpt-5-codex
authorship_role: composition-challenger
review_kind: arc-close-composition-review
review_date: 2026-04-23
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: planning-readiness-meta-arc
target_kind: arc
target: planning-readiness-meta-arc
target_version: "HEAD=81ffe8c (slice-61a continuation); working tree also contains untracked Claude prong + P2.9 case-study plan"
arc_target: planning-readiness-meta-arc
arc_version: "revision 08 / operator-signoff / slices 57a-61a landed; Slice 62 ceremony in progress"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: "ACCEPT-WITH-FOLD-INS (requires ceremony fold-ins named below)"
severity_counts:
  critical: 0
  high: 2
  med: 2
  low: 2
commands_run:
  - git status --short
  - git rev-parse --short HEAD
  - git log --oneline --decorate -30
  - rg --files scoped to CLAUDE.md, specs/plans, specs/adrs, specs/reviews, specs/invariants.json, scripts, and tests
  - nl -ba specs/plans/planning-readiness-meta-arc.md
  - nl -ba specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - nl -ba specs/reviews/arc-planning-readiness-meta-arc-composition-review-claude.md
  - nl -ba CLAUDE.md
  - nl -ba scripts/plan-lint.mjs
  - nl -ba scripts/audit.mjs Check 26 and Check 36 regions
  - nl -ba tests/scripts/plan-lint.test.ts
  - nl -ba tests/scripts/audit-check-36.test.ts
  - nl -ba tests/contracts/artifact-backing-path-integrity.test.ts ARC_CLOSE_GATES block
  - nl -ba specs/reviews/p2-9-plan-draft-content-challenger.md
  - nl -ba specs/reviews/p2-9-plan-lint-retroactive-run.md
  - nl -ba specs/reviews/arc-slice-57-codex.md through arc-slice-61-codex.md
  - nl -ba specs/invariants.json
  - nl -ba out-of-repo Claude memory index and feedback_plans_must_be_challenger_cleared_before_signoff.md
  - cmp -s specs/plans/p2-9-second-workflow.md tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md
  - git ls-files for P2.9, Claude prong, meta-arc plan, plan-lint, and audit
  - npm run plan:lint -- specs/plans/planning-readiness-meta-arc.md
  - npm run plan:lint -- specs/plans/p2-9-second-workflow.md
  - npm run plan:lint -- tests/fixtures/plan-lint/good/minimal-compliant-plan.md
  - npm test -- tests/scripts/plan-lint.test.ts tests/scripts/audit-check-36.test.ts
  - npm test -- tests/contracts/cross-model-challenger.test.ts
  - npm run audit
  - npm run verify
opened_scope:
  - specs/plans/planning-readiness-meta-arc.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - specs/reviews/arc-planning-readiness-meta-arc-composition-review-claude.md
  - specs/reviews/p2-9-plan-draft-content-challenger.md
  - specs/reviews/p2-9-plan-lint-retroactive-run.md
  - specs/reviews/arc-slice-57-codex.md through specs/reviews/arc-slice-61-codex.md
  - scripts/plan-lint.mjs
  - scripts/audit.mjs Check 26 ARC_CLOSE_GATES + Check 36 plan-lifecycle gate
  - tests/scripts/plan-lint.test.ts
  - tests/scripts/audit-check-36.test.ts
  - tests/contracts/cross-model-challenger.test.ts authorship_role enum
  - tests/contracts/artifact-backing-path-integrity.test.ts ARC_CLOSE_GATES assertions
  - specs/invariants.json enforcement_state_semantics
  - CLAUDE.md Cross-slice composition review cadence + Plan-authoring discipline
  - out-of-repo Claude memory plan-signoff rule and MEMORY.md index
skipped_scope:
  - full P2.9 second-workflow redesign; only reviewed it as the retroactive proof denominator
  - full runtime implementation of the future review workflow; not part of this meta-arc
  - synthetic temporary-git-history reproduction for every Check 36 bad transition; static code path plus existing tests were inspected
  - full historical re-review of pre-57 arcs except where their arc-close gate precedent was relevant
findings:
  - id: HIGH-1
    severity: high
    title: Check 26 does not bind the Planning-Readiness Meta-Arc, so Slice 62 can be audit-green without proving this arc's two-prong close
  - id: HIGH-2
    severity: high
    title: Slice 58/59 rule-allocation story is stale after Slice 58a promoted the active lint surface to 22 rules
  - id: MED-1
    severity: med
    title: Rule #16 untracked-plan coverage still depends on outside-repo path behavior in isGitTracked
  - id: MED-2
    severity: med
    title: Check 36 closed-state validation proves a challenger-cleared predecessor but not an actual operator-signoff transition path
  - id: LOW-1
    severity: low
    title: META_ARC_FIRST_COMMIT duplication is only one-way cross-referenced
  - id: LOW-2
    severity: low
    title: Meta-arc plan still presents H4/H5 as open after Slice 60 and Slice 61 resolved them
---

# Planning-Readiness Meta-Arc - Codex Composition Review

## Verdict

**ACCEPT-WITH-FOLD-INS.**

The arc lands the substantive fix it set out to land: a pre-operator-signoff gate with plan-lint, audit Check 36, JSON-authoritative enforcement vocabulary, retroactive P2.9 proof, and an onboarding discipline layer. The 10/13 proof is honest within its stated scope: it catches every HIGH in the P2.9 denominator, discloses the three uncaught MEDs as scope choices, and does not pretend the linter replaces adversarial plan review.

But the arc is not ready to close without fold-ins. The biggest composition seam is not in plan-lint. It is in the ceremony enforcement surface: Check 26's `ARC_CLOSE_GATES` table does not include this arc, even though the plan's Slice 62 acceptance evidence says Check 26 is the arc-close gate. That repeats the same class the Clean-Clone Reality Tranche composition review caught earlier.

## Findings

### HIGH-1 - Check 26 does not bind this arc

**Location:** `scripts/audit.mjs:3213-3261`, `specs/plans/planning-readiness-meta-arc.md:770-788`, `tests/contracts/artifact-backing-path-integrity.test.ts:699-735`.

**Evidence:** `ARC_CLOSE_GATES` contains four entries: phase-2 foundation fold-ins, P2.4/P2.5, slice-47 hardening, and clean-clone reality. There is no `planning-readiness-meta-arc` entry. The plan's Slice 62 acceptance evidence requires both prongs committed and "Check 26 green", but Check 26 currently cannot red-fail this arc because it has no row for its plan path, ceremony slice, or review filename regex. The fresh `npm run audit` output confirms Check 26 reports only those four older arcs.

**Impact:** A Slice 62 commit could advance `current_slice`, add zero or one planning-readiness composition review file, and still get a Check 26 green result for all known gates. That undermines the arc's own close criterion and replays the prior "unknown arc absent from ARC_CLOSE_GATES" failure class.

**Fold-in:** Add a Check 26 gate entry for this arc in the ceremony commit:

```js
arc_id: 'planning-readiness-meta-arc',
description: 'Planning-Readiness Meta-Arc (Slices 57a-62)',
ceremony_slice: 62,
plan_path: 'specs/plans/planning-readiness-meta-arc.md',
review_file_regex: /arc-planning-readiness-meta-arc-composition-review/i,
```

Also export the ceremony-slice constant in `scripts/audit.d.mts` and update the ARC_CLOSE_GATES test from 4 to 5 entries with regex positive/negative assertions.

### HIGH-2 - The 19-vs-22 slice-allocation story is stale

**Location:** `specs/plans/planning-readiness-meta-arc.md:419-430`, `:497-505`, `:604-676`, `:681-706`, `:791-805`; `scripts/plan-lint.mjs:48-51`; partially mirrored in `specs/adrs/ADR-0010-arc-planning-readiness-gate.md:193-198`.

**Evidence:** Claude's HIGH-1 is confirmed, and the drift is broader than the Slice 58 paragraph. The plan still says Slice 58 is a 19-rule baseline, Slice 59 adds +3 rules, the dependency graph repeats "baseline 19", and the Slice 58 ratchet says "0 -> 19". The plan-lint header repeats the old allocation. Slice 58a's actual resolution was Option B: promote the active lint path to all 22 rules and add rule 7/8/22 fixtures. At HEAD, `runAllRules` calls all 22 rules, tests cover 22 per-rule fixtures, and P2.9 emits the recorded 22 red findings.

**Impact:** Operational behavior is correct, but the arc's authority record now tells future maintainers the wrong sequence. That matters here because this arc is itself about preventing stale plan prose from becoming execution authority.

**Fold-in:** Rewrite the allocation story consistently: Slice 58 + 58a land the all-22 active linter surface; Slice 59 lands the JSON vocabulary addition; Slice 59a makes the JSON vocabulary mechanically authoritative. Update the plan's §3 reconciliation, §4 Slice 58/Slice 59 sections, §5 graph, the plan-lint header, and either ADR-0010 §5 or an explicit post-Slice-58a note.

### MED-1 - Rule #16 temp-file coverage remains path-shape accidental

**Location:** `scripts/plan-lint.mjs:241-255`, `tests/scripts/plan-lint.test.ts:391-455`.

**Evidence:** `isGitTracked` handles absolute paths by slicing `REPO_ROOT.length + 1` off the front. That is correct only for absolute paths under the repo root. The rule #16 test writes outside the repo under `tmpdir()`, so the slice produces a garbage relative path; `git ls-files --error-unmatch` fails; the catch returns false; rule #16 fires. The end result is correct, but the test does not specify the intended path semantics.

**Impact:** Future cleanup of outside-repo handling could break or change the test's meaning without making the rule #16 invariant clearer. This confirms Claude's MED-1.

**Fold-in:** At minimum, document the outside-repo behavior in `isGitTracked` and in the rule #16 test. Better follow-up: use a temporary git repo/worktree or an in-repo untracked path with cleanup so rule #16 exercises the normal "untracked plan under specs/plans" shape.

### MED-2 - Closed-state Check 36 validation skips one state-machine fact

**Location:** `scripts/audit.mjs:4265-4387`, `tests/scripts/audit-check-36.test.ts:1-22`, `specs/adrs/ADR-0010-arc-planning-readiness-gate.md:106-111`.

**Evidence:** Check 36 now applies to `operator-signoff` and `closed`, finds a transition commit, requires an `operator_signoff_predecessor` binding, verifies the named SHA is an ancestor, and verifies the plan at that SHA is `challenger-cleared`. That closes the original Slice 58 critical bypass. But for a current `closed` plan, the code does not prove that the plan ever actually existed at `status: operator-signoff`; a direct `challenger-cleared -> closed` commit with a body pointing to the challenger-cleared predecessor can satisfy the present checks. The only Check 36 test is a current-repo green path; no negative synthetic history covers this case.

**Impact:** This is lower risk for the current arc because the meta-arc plan is already at `operator-signoff` before Slice 62. It is still a lifecycle-contract gap that can compound downstream: the five-state machine says `challenger-cleared -> operator-signoff -> closed`, while audit currently proves only "closed has a challenger-cleared predecessor binding."

**Fold-in or follow-up:** Add synthetic temp-repo tests for bad histories, including direct `challenger-cleared -> closed`, missing binding, non-ancestor SHA, predecessor not challenger-cleared, and file-added-already-at-signoff. Then either reject direct close without an observed operator-signoff commit, or explicitly amend ADR-0010 to allow same-commit signoff+close with a stricter commit-body marker.

### LOW-1 - META_ARC_FIRST_COMMIT duplication is only one-way cross-referenced

**Location:** `scripts/plan-lint.mjs:90-97`, `scripts/audit.mjs:4182-4188`.

**Evidence:** Both files hardcode `c91469053a95519645280fd80394a4966ac7948e`. `scripts/audit.mjs` says it matches `plan-lint.mjs::isLegacyPlan`, but `scripts/plan-lint.mjs` does not point back to Check 36's duplicate. Claude's LOW-1 is therefore mostly confirmed, with the refinement that the cross-reference is one-way rather than absent.

**Impact:** Low because the boundary SHA is immutable and unlikely to change. If it ever does change under a superseding ADR, one side could drift.

**Fold-in:** Add the reciprocal comment in `scripts/plan-lint.mjs`, or extract the constant into a tiny shared policy module if another duplication appears.

### LOW-2 - H4/H5 still read open after the arc resolved them

**Location:** `specs/plans/planning-readiness-meta-arc.md:827-834`, `:857-860`.

**Evidence:** §7 still says H4's retroactive-run outcome is unknown and H5's CLAUDE.md line-count fit is likely. §8 still says H4 and H5 remain open. At HEAD, Slice 60 resolved H4 with 6/6 HIGH and 10/13 combined, and Slice 61/61a resolved H5 with CLAUDE.md at 279 lines.

**Impact:** Low. The actual proof files and final artifacts are correct, but the plan's open-question ledger is stale at the exact moment the arc is being closed.

**Fold-in:** Mark H4 and H5 resolved in §7/§8 and cite `specs/reviews/p2-9-plan-lint-retroactive-run.md` plus `wc -l CLAUDE.md = 279` or the Slice 61 evidence.

## Direct Answers

1. **Seams Claude missed:** yes. The Check 26 gate omission is the major one. It is the same failure class as the clean-clone arc: a cadence rule exists, but the current arc is absent from the mechanical gate table.
2. **10/13 honesty:** acceptable. The threshold is not a universal proof of plan quality, but the file is honest about that. It catches all HIGHs, discloses uncaught MED 9/10/13, and frames them as scope choices after Slice 60a.
3. **Arc shape / methodology drift:** the 57a-i preparation chain and 58/58a/59/59a/60/60a/61/61a fold-in chain is unusually granular, but I do not read it as methodology drift. It is convergence pressure from applying the new discipline to itself. The drift is in stale authority prose, not in the use of fold-ins.
4. **Three-layer story:** coherent if described as two mechanical layers plus one discipline layer. Plan-lint checks one file, audit Check 36 applies committed-corpus and commit-body history checks, and CLAUDE.md/memory is onboarding discipline. Layer 3 is not secretly enforcement and should not be described as such.
5. **Unfinished patterns:** P2.9 restart is intentionally deferred and should restart under the new plan lifecycle. The compounding risks are instead Check 26 gate-table maintenance and Check 36's weak negative-history coverage.

## Non-Findings

- The JSON vocabulary authority story is now mechanically true: `loadInvariantLayerVocab()` fails closed and rule #7 accepts `blocked` only when the JSON declares it.
- Rule #4's ownership-strengthening is principled. The TypeScript type/interface/enum fold-ins close the biggest false-positive gap; JSON nested ownership remains documented as opportunistic.
- The out-of-repo memory layer is operationally real and indexed. Its non-git nature is documented after Slice 61a.
- `specs/plans/p2-9-second-workflow.md` is still intentionally untracked, and it is byte-identical to the committed bad fixture. That keeps the proof reproducible.

## Required Fold-Ins Before Close

1. Add the Planning-Readiness Meta-Arc to `ARC_CLOSE_GATES` and update the corresponding type declaration + test.
2. Reconcile the 19/22 slice-allocation story across the plan, plan-lint header, and ADR note.
3. Mark H4/H5 resolved in the plan's open-question/self-validation sections.
4. Add reciprocal `META_ARC_FIRST_COMMIT` cross-reference comments.
5. Document or harden the rule #16 outside-repo temp-file behavior.
6. Schedule Check 36 synthetic-history negative tests, or fold them in now if the ceremony has room.

With the first two fold-ins in the ceremony commit, the arc can close. The remaining MED/LOW items should not block closure if they are either folded or captured with named follow-up triggers.
