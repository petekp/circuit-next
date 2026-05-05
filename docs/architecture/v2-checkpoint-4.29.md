# Circuit v2 Checkpoint 4.29

## Summary

Phase 4.29 splits the neutral run-status dispatcher into smaller status
modules.

Progress projection did not move. Reducer, trace reader/writer, snapshot,
checkpoint, runner, and step-handler code did not move. Selector behavior did
not change.

## What Changed

Updated:

- `src/run-status/project-run-folder.ts`
- `src/run-status/projection-common.ts`
- `src/run-status/v2-run-folder.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Boundary Decision

`src/run-status/project-run-folder.ts` still owns the public dispatcher:

```text
projectRunStatusFromRunFolder(...)
RunStatusFolderError
```

`src/run-status/v2-run-folder.ts` now owns marked core-v2 run-folder projection.

`src/run-status/projection-common.ts` owns shared projection helpers used by the
dispatcher and the v2 run-folder projector.

The retained v1 status path still calls retained helpers:

- `src/runtime/reducer.ts`
- `src/runtime/trace-reader.ts`
- `src/runtime/run-relative-path.ts`
- `src/runtime/registries/checkpoint-writers/registry.ts`

Those dependencies are intentional. This slice does not move retained
trace/reducer/checkpoint behavior.

## Deletion Status

Old runtime deletion remains out of scope.

`src/runtime/run-status-projection.ts` remains a compatibility re-export.
Retained v1 trace/reducer/checkpoint helpers remain live.

## Validation

Passed for this checkpoint:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/fresh-run-root.test.ts tests/runner/build-checkpoint-exec.test.ts tests/core-v2 tests/parity`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
