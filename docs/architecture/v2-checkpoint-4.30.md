# Circuit v2 Checkpoint 4.30

## Summary

Phase 4.30 splits retained v1 run-folder status projection out of the public
dispatcher.

Progress projection did not move. Retained trace reader/writer, reducer,
snapshot, checkpoint resume, runner, and step-handler code did not move.
Selector behavior did not change.

## What Changed

Updated:

- `src/run-status/project-run-folder.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Boundary Decision

`src/run-status/project-run-folder.ts` now does only the public dispatch work:

```text
folder readability check
manifest snapshot verification
retained v1 trace read
v1/v2 projector dispatch
```

`src/run-status/v1-run-folder.ts` owns retained v1 run-folder projection,
including checkpoint-waiting status projection.

The retained v1 projector still calls retained helper modules:

- `src/runtime/reducer.ts`
- `src/runtime/run-relative-path.ts`
- `src/runtime/registries/checkpoint-writers/registry.ts`

Those dependencies are intentional. This slice does not move retained
trace/reducer/checkpoint behavior.

## Deletion Status

Old runtime deletion remains out of scope.

`src/runtime/run-status-projection.ts` remains a compatibility re-export.
Retained v1 trace/reducer/checkpoint helper modules remain live.

## Validation

Passed for this checkpoint:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/fresh-run-root.test.ts tests/runner/build-checkpoint-exec.test.ts tests/core-v2 tests/parity`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
