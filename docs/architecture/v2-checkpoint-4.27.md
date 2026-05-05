# Circuit v2 Checkpoint 4.27

## Summary

Phase 4.27 creates a neutral public import surface for `runs show`.

No projection internals moved. No progress, reducer, trace reader/writer,
snapshot, checkpoint, runner, or step-handler code moved. Selector behavior did
not change.

## What Changed

Added:

- `src/run-status/project-run-folder.ts`
- `tests/runner/run-status-facade.test.ts`

Updated:

- `src/cli/runs.ts`
- `src/runtime/result-writer.ts`
- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Boundary Decision

`src/run-status/project-run-folder.ts` now exports the public `runs show`
surface:

```text
projectRunStatusFromRunFolder(...)
RunStatusFolderError
```

At this checkpoint, it delegates to `src/runtime/run-status-projection.ts`.
Phase 4.28 later moved the dispatcher body into `src/run-status/project-run-folder.ts`
and left the runtime path as a compatibility re-export.

## Deletion Status

Old runtime deletion remains out of scope.

`src/runtime/run-status-projection.ts` is still live. This slice only moved the
CLI import boundary.

## Validation

Passed for this checkpoint:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/fresh-run-root.test.ts tests/runner/build-checkpoint-exec.test.ts tests/core-v2 tests/parity`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
