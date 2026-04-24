---
name: arc-slice-76-codex
description: Cross-model challenger pass over Slice 76 (P2.9 review workflow policy-table seam). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance. Returns objection list per CHALLENGER-I1 and satisfies scripts/audit.mjs Check 35 for the Slice 76 commit.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-76-p2-9-review-workflow-policy-table-seam
target_kind: arc
target: slice-76
target_version: "Base HEAD=b710b6e (P2.9 operator-signoff); landed by the Slice 76 commit carrying this file"
arc_target: p2-9-second-workflow
arc_version: "First planned P2.9 second-workflow implementation slice"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 0
  med: 1
  low: 0
  meta: 0
commands_run:
  - attempted repo-preferred /codex wrapper; failed before review because configured model gpt-5.5 was unavailable
  - ran codex exec --sandbox read-only -m gpt-5.4 over the Slice 76 working tree
  - ran codex exec --sandbox read-only -m gpt-5.4 re-check over the policy-only test fold-in
  - challenger attempted targeted Vitest in read-only sandbox; Vitest failed on EPERM temp/cache writes, not product assertions
  - parent session ran npx vitest run tests/contracts/workflow-kind-policy.test.ts in writable environment
  - parent session ran npm run verify in writable environment after the challenger fold-in
opened_scope:
  - AGENTS.md / CLAUDE.md challenger discipline
  - specs/plans/p2-9-second-workflow.md §3 and §9 Slice 63
  - scripts/policy/workflow-kind-policy.mjs WORKFLOW_KIND_CANONICAL_SETS
  - tests/contracts/workflow-kind-policy.test.ts policy-table contract coverage
  - src/runtime/policy/workflow-kind-policy.ts wrapper scope, for overclaim analysis only
skipped_scope:
  - .claude-plugin/skills/review/circuit.json (not part of Slice 76; fixture lands later)
  - src/schemas/artifacts/review.ts (not part of Slice 76; artifact schema lands later)
  - runtime dispatch or synthesis behavior (not part of Slice 76)
  - prior-generation Circuit at ~/Code/circuit (characterization already captured in the P2.9 plan)
authority:
  - AGENTS.md §Hard invariants #6
  - AGENTS.md §Cross-model challenger protocol
  - specs/plans/p2-9-second-workflow.md §3
  - specs/plans/p2-9-second-workflow.md §9 Slice 63
  - scripts/audit.mjs Check 35
---

# Slice 76 - P2.9 Review Workflow Policy Seam - Codex Challenger Pass

This records the Codex cross-model challenger pass for the first P2.9
implementation slice: registering the audit-only `review` workflow's
canonical phase set in the shared workflow-kind policy table.

## Wrapper Note

The repo-preferred `/codex` wrapper was attempted first through
`run-codex.sh`, but the local wrapper selected `gpt-5.5`, which was
unavailable for this account. The challenger was therefore run directly
with `codex exec --sandbox read-only -m gpt-5.4`, matching the model
lineage used for the preceding runtime-safety-floor reviews.

## Opening Verdict

**ACCEPT-WITH-FOLD-INS.** Codex found no issue with the policy table row
itself: `review` declares `['frame', 'analyze', 'close']`, omits
`['plan', 'act', 'verify', 'review']`, and uses the §3 title map
`Intake → Independent Audit → Verdict`.

Codex raised one MED finding against the tests: the first draft used a
fully shaped hypothetical `review` workflow and a runtime-wrapper test,
which could be misread later as evidence that the review fixture,
artifact schemas, or runtime synthesis behavior were already ready.

## Objection List and Dispositions

### MED 1 - Test payload overclaimed beyond the policy-table seam

Codex objected that `tests/contracts/workflow-kind-policy.test.ts`
constructed a complete-looking review workflow with future protocol ids,
artifact schema ids, dispatch paths, and a runtime-level
`validateWorkflowKindPolicy` assertion. Slice 76 is intentionally narrower:
it only adds the policy row and a contract test for that row; the real
fixture and schema/runtime evidence land in later P2.9 slices.

Disposition: **folded in**. The test now uses
`reviewPolicyOnlyPayload()`, a minimal object with only `id`, `phases`,
and `spine_policy`, plus an explicit comment that the real review fixture,
artifact schemas, and runtime synthesis behavior land later. The
review-specific runtime-wrapper assertion was removed. The direct table
assertions still pin the exact canonical set, omitted canonicals, title,
and authority path.

## Closing Re-Check

Codex re-checked the updated diff and returned **ACCEPT**:

> Objection list: none on the scoped issue.
>
> The remaining runtime-wrapper assertions under `validateWorkflowKindPolicy(...)`
> are now explore-only; there is no review runtime-load assertion left that would
> imply review fixture/schema/runtime readiness.

Codex could not execute Vitest in the read-only sandbox because Vitest
needed temp/cache writes and failed with `EPERM`; the parent session ran
the focused contract test in the normal writable environment.

## Closing Verdict

**ACCEPT.** The single MED finding was folded in and the re-check found no
remaining objection.
