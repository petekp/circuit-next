# Circuit v2 Checkpoint 4.33

## Summary

Phase 4.33 classifies old runner and direct handler tests before any old
runtime shrink or checkpoint resume implementation.

No code moved. No old runtime files were deleted. Checkpoint resume did not
move. Selector behavior did not change.

## What Changed

Added:

- `docs/architecture/v2-runner-handler-test-classification.md`

Updated:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Decision

Old runner and handler tests are still live. They fall into these buckets:

```text
retained product fallback
checkpoint-resume product coverage
old-runtime oracle
compatibility import
```

No test is currently classified as safe to delete.

The next safest work is a current-only import inventory for old runner and
handler files before any retained checkpoint resume shrink proposal.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
