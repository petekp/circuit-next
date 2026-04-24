---
name: arc-slice-77-codex
description: Cross-model challenger pass over Slice 77 (P2.9 review invariants and artifact schema). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance. Returns objection list per CHALLENGER-I1 and satisfies scripts/audit.mjs Check 35 for the Slice 77 commit.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 via codex exec
review_target: slice-77-p2-9-review-invariants-and-artifact-schema
target_kind: arc
target: slice-77
target_version: "Base HEAD=3b4017b (Slice 76 P2.9 policy seam); landed by the Slice 77 commit carrying this file"
arc_target: p2-9-second-workflow
arc_version: "Planned P2.9 Slice 64; actual repository Slice 77"
opening_verdict: REJECT-PENDING-FOLD-INS
post_foldin_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 2
  med: 2
  low: 0
  meta: 0
commands_run:
  - attempted repo-preferred /codex wrapper; failed before review because configured model gpt-5.5 was unavailable
  - ran codex exec --sandbox read-only -m gpt-5.4 over the initial Slice 77 working tree
  - parent session folded in the opening 2 HIGH + 1 MED findings
  - parent session ran npx vitest run tests/contracts/workflow-kind-policy.test.ts tests/contracts/review-dispatch-shape.test.ts tests/properties/visible/review-i1.test.ts tests/properties/visible/review-i2.test.ts tests/contracts/invariant-ledger.test.ts tests/contracts/artifact-authority.test.ts
  - parent session ran npm run verify
  - ran codex exec --sandbox read-only -m gpt-5.4 re-check over the folded working tree
  - parent session folded in the final MED target-slice correction
opened_scope:
  - specs/plans/p2-9-second-workflow.md §4, §5, and §9 Slice 64
  - specs/artifacts.json review.result authority row
  - specs/invariants.json REVIEW-I1 and REVIEW-I2 rows
  - src/schemas/artifacts/review.ts review artifact and dispatch result schemas
  - scripts/policy/workflow-kind-policy.mjs REVIEW-I1 structural check
  - tests/contracts/review-dispatch-shape.test.ts dispatch-shape pinning
  - tests/properties/visible/review-i1.test.ts and review-i2.test.ts
skipped_scope:
  - specs/contracts/review.md (lands next actual slice, plan Slice 65)
  - .claude-plugin/skills/review/circuit.json (lands next actual slice, plan Slice 65)
  - runtime dispatch and injected synthesis-writer wiring (planned later)
  - plugin command /circuit:review and CLI wiring (planned later)
authority:
  - AGENTS.md §Hard invariants #6
  - AGENTS.md §Cross-model challenger protocol
  - specs/plans/p2-9-second-workflow.md §4
  - specs/plans/p2-9-second-workflow.md §5
  - specs/plans/p2-9-second-workflow.md §9 Slice 64
  - scripts/audit.mjs Check 35
---

# Slice 77 - P2.9 Review Invariants and Artifact Schema - Codex Challenger Pass

This records the Codex cross-model challenger pass for the P2.9 slice
that lands `review.result` schema coverage, REVIEW-I1 / REVIEW-I2
invariant bindings, and the analyze-phase dispatch-shape pinning test.

## Wrapper Note

The repo-preferred `/codex` wrapper was attempted first, but the local
wrapper selected `gpt-5.5`, which was unavailable for this account. The
challenger was therefore run directly with
`codex exec --sandbox read-only -m gpt-5.4`, matching the fallback already
used for the immediately preceding P2.9 slice.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** Codex found that the initial working tree
had the right broad direction but still overclaimed the slice on three
points:

1. `review.result` had a schema file but no authority-graph row in
   `specs/artifacts.json`.
2. The dispatch-shape test proved one happy-path parse but did not catch
   future widening of `gate.source.kind`, `gate.source.ref`, or
   `gate.pass`.
3. REVIEW-I1 accepted any close-phase artifact writer rather than the
   primary `review.result` writer.

## Fold-Ins

Disposition: **folded in**.

- Added the `review.result` row to `specs/artifacts.json`, bound
  temporarily to the signed P2.9 plan and marked with `pending_rehome`
  for the next actual slice, where `specs/contracts/review.md` lands.
- Strengthened `tests/contracts/review-dispatch-shape.test.ts` with raw
  literal checks plus negative drift cases for source kind, source ref,
  and pass vocabulary.
- Tightened `checkReviewIdentitySeparationPolicy()` so REVIEW-I1 only
  accepts a close-phase synthesis step whose artifact schema is
  `review.result@v1`.

## Re-Check Verdict

**ACCEPT-WITH-FOLD-INS.** Codex found one remaining MED issue: the
temporary `pending_rehome.target_slice` still used the plan-relative
placeholder `65`, while the actual repository slice is 77. That would make
the "next slice" obligation look stale as soon as it landed.

Disposition: **folded in**. The row now uses actual `target_slice: 78`
and names that it corresponds to plan Slice 65 (contract + fixture).

## Closing Verdict

**ACCEPT-WITH-FOLD-INS.** All challenger findings were folded into this
slice. The remaining work is deliberately scoped to later P2.9 slices:
the workflow-specific contract, the live fixture, runtime wiring, and the
plugin command.
