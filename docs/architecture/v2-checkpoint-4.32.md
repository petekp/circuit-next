# Circuit v2 Checkpoint 4.32

## Summary

Phase 4.32 decides checkpoint resume ownership at the planning level.

No code moved. Checkpoint resume did not move to core-v2. Retained trace
reader/writer, reducer, snapshot, progress, runner, and step-handler code did
not move. Selector behavior did not change.

## What Changed

Added:

- `docs/architecture/v2-checkpoint-resume-ownership-plan.md`

Updated:

- `docs/architecture/v2-trace-progress-checkpoint-boundary-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Decision

Do not implement v2 checkpoint resume next.

Do not move checkpoint resume into a smaller retained module yet.

Proceed with old runner / handler test classification first. Checkpoint resume
is the largest remaining product reason the old runner and v1 trace/snapshot
stack stay live, but the old test map needs to be explicit before choosing
between:

```text
v2 checkpoint resume parity
retained checkpoint resume behind a smaller retained module
```

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
