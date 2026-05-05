# Circuit v2 Checkpoint 4.34

## Summary

Phase 4.34 adds a current-only import inventory for old runner and handler
files.

No code moved. No old runtime files were deleted. Checkpoint resume did not
move. Selector behavior did not change.

## What Changed

Added:

- `docs/architecture/v2-runner-handler-current-import-inventory.md`

Updated:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Decision

The current import graph still has live product, release, and test references
to old runner and handler files. No old runner or handler file is
deletion-ready.

The next lower-risk planning slice is retained progress contract
classification.

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
