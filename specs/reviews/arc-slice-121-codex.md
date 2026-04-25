---
name: arc-slice-121-codex
description: Per-slice Codex challenger record for Slice 121 Build checkpoint resume.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-25
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec + operator fold-in
review_target: slice-121-build-checkpoint-resume
target_kind: arc
target: slice-121
target_version: "Base HEAD=ffe6ca8a5280fd2cb089d8a3375400f0707bff9d; working tree reviewed before Slice 121 commit"
arc_target: build-workflow-parity
arc_version: "Work item 5 checkpoint resume slice: resume paused-open checkpoint runs through explicit operator choice"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  critical: 0
  high: 4
  med: 1
  low: 0
  meta: 0
commands_run:
  - "codex exec -m gpt-5.4 --sandbox read-only --color never --skip-git-repo-check (operator-approved workspace challenger)"
  - "codex exec -m gpt-5.4 --sandbox read-only --color never --skip-git-repo-check (first fold-in recheck)"
  - "codex exec -m gpt-5.4 --sandbox read-only --color never --skip-git-repo-check (second fold-in recheck)"
  - "codex exec -m gpt-5.4 --sandbox read-only --color never --skip-git-repo-check (third fold-in recheck)"
  - "npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/cli-router.test.ts tests/runner/fresh-run-root.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/contracts/schema-parity.test.ts"
  - "npm run check"
  - "npm run verify"
  - "npm run audit"
opened_scope:
  - src/runtime/runner.ts
  - src/cli/dogfood.ts
  - src/schemas/event.ts
  - tests/runner/build-checkpoint-exec.test.ts
  - tests/runner/cli-router.test.ts
  - tests/runner/fresh-run-root.test.ts
  - tests/contracts/schema-parity.test.ts
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - Public Build workflow fixture, public Build command alias, implementation/review dispatch, and custom workflow configuration remain later Build parity work.
fold_in_disposition: |
  The challenger rejected the first resume draft because resume could drift onto
  resume-time execution context, could recreate or accept the wrong Build brief,
  and exposed a CLI shape that did not match the signed plan. Follow-up reviews
  found two deeper integrity gaps: empty saved context still fell back to
  resume-time context, and matching request/brief rewrites could bypass the
  Build brief hash. Slice 121 folded all findings into runtime/schema/tests.
  Resume now treats the saved checkpoint request as authoritative, verifies the
  checkpoint request bytes against the event log, verifies the waiting Build
  brief against the request hash, preserves the saved project/config context
  including the empty case, and exposes the documented `resume --run-root
  <path> --checkpoint-choice <choice>` command shape.
---

# Slice 121 - Build Checkpoint Resume - Codex Challenger Record

Codex initially returned **REJECT-PENDING-FOLD-INS**. The accepted fold-ins:

1. Preserve the original execution context for post-checkpoint dispatch and
   verification, including the case where the original context was empty.
2. Require the waiting Build brief to already exist and match the checkpoint
   request's recorded hash.
3. Bind the checkpoint request itself to `checkpoint.requested` through
   `request_artifact_hash`, so rewriting request and brief together fails.
4. Expose the documented CLI shape:
   `circuit-next resume --run-root <path> --checkpoint-choice <choice>`.
5. Reject incompatible resume flags such as `--fixture` and `--rigor`.

Codex rechecked the folded scope and returned **ACCEPT** with no remaining
blockers. In the challenger's read-only sandbox, `npm run check` and lint
passed, but Vitest could not run because the sandbox blocked temp/cache writes.
Local verification covered the focused test set.

Verification after fold-in:

- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/cli-router.test.ts tests/runner/fresh-run-root.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/contracts/schema-parity.test.ts`
- `npm run check`
- `npm run verify`
- `npm run audit` (pre-commit red only because status docs had advanced to
  slice 121 while HEAD was still slice 120; expected to clear after commit)
