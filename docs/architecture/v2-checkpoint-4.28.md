# Circuit v2 Checkpoint 4.28

## Summary

Phase 4.28 moves the `runs show` status dispatcher implementation into the
neutral `src/run-status/` namespace.

Progress projection did not move. Reducer, trace reader/writer, snapshot,
checkpoint, runner, and step-handler code did not move. Selector behavior did
not change.

## What Changed

Updated:

- `src/run-status/project-run-folder.ts`
- `src/runtime/run-status-projection.ts`
- `tests/runner/run-status-projection.test.ts`
- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Boundary Decision

`src/run-status/project-run-folder.ts` now owns:

```text
projectRunStatusFromRunFolder(...)
RunStatusFolderError
```

`src/runtime/run-status-projection.ts` remains as an old-path compatibility
re-export.

The moved dispatcher still calls retained v1 helpers:

- `src/runtime/reducer.ts`
- `src/runtime/trace-reader.ts`
- `src/runtime/result-writer.ts`
- `src/runtime/run-relative-path.ts`
- `src/runtime/registries/checkpoint-writers/registry.ts`

Those dependencies are intentional. This slice changes ownership of the public
dispatcher only; it does not move retained trace/reducer/checkpoint behavior.

## Deletion Status

Old runtime deletion remains out of scope.

`src/runtime/run-status-projection.ts` is now a wrapper, but it is not deletion
approved. Keep it while old-path imports, docs, and compatibility tests cite
the wrapper.

## Validation

Passed for this checkpoint:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/fresh-run-root.test.ts tests/runner/build-checkpoint-exec.test.ts tests/core-v2 tests/parity`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`

Note: one parallel `check-flow-drift` attempt raced with the emit-flow drift
fixture tests and observed temporary `never-a-mode.json` files while the tests
were running. The stale files were gone after fixture cleanup, and
`npm run check-flow-drift` passed when rerun by itself before `npm run verify`.
