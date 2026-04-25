---
name: arc-slice-123-codex
description: Per-slice Codex challenger record for Slice 123 Build entry-mode selection.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-25
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec + operator fold-in
review_target: slice-123-build-entry-mode-selection
target_kind: arc
target: slice-123
target_version: "Base HEAD=fbca8a0a9f7df541871f440783b3a096844a4eaa; working tree reviewed before Slice 123 commit"
arc_target: build-workflow-parity
arc_version: "Work item 7 Build entry-mode selection"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  critical: 0
  high: 1
  med: 1
  low: 0
  meta: 0
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only -m gpt-5.4 -"
  - "npm run verify"
opened_scope:
  - src/cli/dogfood.ts
  - src/runtime/runner.ts
  - tests/contracts/workflow-model-effort.test.ts
  - tests/runner/build-runtime-wiring.test.ts
  - tests/runner/cli-router.test.ts
  - tests/runner/config-loader.test.ts
  - tests/runner/dispatch-invocation-failure.test.ts
  - tests/runner/dogfood-smoke.test.ts
  - tests/runner/runner-dispatch-provenance.test.ts
skipped_scope:
  - Public slash-command Build command wiring remains Work item 8.
fold_in_disposition: |
  The Codex challenger returned REJECT-PENDING-FOLD-INS with one HIGH and one
  MED finding. Slice 123 folded both before commit. The HIGH finding was folded
  by narrowing execution-rigor injection to Build dispatch selection only,
  preserving the generic non-Build selection contract and restoring the
  P2-MODEL-EFFORT / config / dispatch-provenance expectations. The MED finding
  was folded by adding default-entry-mode plus explicit autonomous-rigor runner
  and CLI tests that prove bootstrap rigor, dispatch resolved-selection rigor,
  and safe-autonomous checkpoint policy all use the explicit override. The
  read-only challenger sandbox could not run Vitest because temp/cache writes
  were blocked with EPERM; local full verify ran in the writable parent session.
---

# Slice 123 - Build Entry-Mode Selection - Codex Challenger Record

Codex returned **REJECT-PENDING-FOLD-INS**. The accepted fold-ins:

1. Keep the execution-rigor dispatch override scoped to Build, so Explore and
   other workflows still follow the generic selection contract where workflow,
   phase, step, and invocation selection precedence decides dispatch rigor.
2. Add the missing conflict proof for `--entry-mode default --rigor autonomous`,
   including checkpoint policy, bootstrap state, and dispatch selection.

Closing evidence:

- `npm run verify` passed after the fold-ins.
