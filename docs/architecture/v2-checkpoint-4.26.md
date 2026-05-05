# Circuit v2 Checkpoint 4.26

## Summary

Phase 4.26 is a trace/status/progress ownership planning checkpoint.

No trace, status, progress, snapshot, reducer, runner, step-handler, or
checkpoint code moved. Selector behavior did not change. Checkpoint resume
ownership did not change.

## What Changed

Added:

- `docs/architecture/v2-trace-status-progress-plan.md`

Updated:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Boundary Decision

The projection boundary is real operator-facing infrastructure:

- `runs show` is the recovery path if progress is missed;
- retained checkpoint waiting depends on v1 trace, snapshot, manifest, and
  checkpoint request files;
- v2 traces are positively marked and projected through compatibility logic;
- progress event wording and shape are host-facing.

The next safe code slice is not a projection rewrite. It is only a neutral
public import surface for `projectRunStatusFromRunFolder(...)`, with the
runtime implementation retained behind a compatibility wrapper.

## Deletion Status

Old runtime deletion remains out of scope.

Trace/reducer/snapshot/progress files remain live and should not be deleted or
moved before the ownership plan is reviewed.

## Validation

Passed for this checkpoint:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/run-status-projection.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/core-v2 tests/parity`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`
