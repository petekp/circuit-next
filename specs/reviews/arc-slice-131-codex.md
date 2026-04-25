---
name: arc-slice-131-codex
description: Per-slice Codex challenger record for Slice 131 Repair workflow policy shape.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 via codex exec + operator fold-in
review_target: slice-131-repair-workflow-policy-shape
target_kind: arc
target: slice-131
target_version: "Base HEAD=5895bddf4faed74f9f98021b144a7e2d015fa609; working tree reviewed before Slice 131 commit"
arc_target: repair-workflow-parity
arc_version: "Repair policy-only implementation slice"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  critical: 0
  high: 0
  med: 1
  low: 0
  meta: 0
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --ephemeral --color never -m gpt-5.4 -"
  - "npx vitest run tests/contracts/workflow-kind-policy.test.ts"
opened_scope:
  - scripts/policy/workflow-kind-policy.mjs
  - tests/contracts/workflow-kind-policy.test.ts
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - No Repair runtime fixture, artifact schemas, router wiring, command surface, or runtime execution.
fold_in_disposition: |
  The challenger found one medium evidence gap: Repair's omitted Plan phase was
  implemented, but the new tests did not directly exercise a Repair-specific
  `spine_policy.omits` mismatch. Slice 131 folds this in with a red test that
  `omits: []` reports `missing omit(s): plan`.
---

# Slice 131 - Repair Workflow Policy Shape - Codex Challenger Record

Codex returned **ACCEPT-WITH-FOLD-INS**.

The challenger confirmed the slice stays inside the signed plan's first Repair
work item: it adds Repair to the shared workflow-kind policy table and adds
policy tests, without making Repair runnable and without adding fixture,
schema, router, command, or runtime work.

## Finding

1. **MED:** The Repair policy table enforced `spine_policy.omits: ['plan']`,
   and the happy-path test checked the green detail, but there was no
   Repair-specific failing test proving the omitted-Plan list itself rejects
   malformed input.

## Fold-In

The test suite now includes a Repair-specific red case where
`spine_policy.omits` is empty and the checker reports `missing omit(s): plan`.

Focused verification after the fold-in:

- `npx vitest run tests/contracts/workflow-kind-policy.test.ts` — 25 passed.
