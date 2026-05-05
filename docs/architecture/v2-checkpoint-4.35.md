# Circuit v2 Checkpoint 4.35

## Summary

Phase 4.35 classifies retained progress projection ownership.

No code moved. `src/runtime/progress-projector.ts` did not move. Progress event
schemas did not change. Checkpoint progress did not move. Selector behavior did
not change.

## What Changed

Added:

- `docs/architecture/v2-retained-progress-contract-plan.md`

Updated:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Decision

Keep retained v1 progress projection in `src/runtime/progress-projector.ts` for
now.

Do not add a neutral v1 progress facade yet. Do not move projector internals
yet.

The shared output helpers already live in `src/shared/progress-output.ts`.
Moving the retained v1 projector now would add churn without reducing
checkpoint resume or old runner ownership.

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
