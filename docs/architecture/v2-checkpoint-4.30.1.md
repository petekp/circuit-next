# Circuit v2 Checkpoint 4.30.1

## Summary

Phase 4.30.1 corrects dependency direction in neutral run-status modules.

No behavior changed. Progress projection did not move. Retained trace
reader/writer, reducer, snapshot, checkpoint resume, runner, and step-handler
code did not move. Selector behavior did not change.

## What Changed

Updated:

- `src/run-status/projection-common.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Boundary Decision

Neutral run-status modules now use shared helper homes for helpers that have
already moved:

```text
src/run-status/projection-common.ts -> src/shared/result-path.ts
src/run-status/v1-run-folder.ts -> src/shared/run-relative-path.ts
```

The neutral status modules still depend on retained runtime only for retained
v1 machinery:

- `src/runtime/trace-reader.ts`
- `src/runtime/reducer.ts`
- `src/runtime/registries/checkpoint-writers/registry.ts`

Those retained dependencies are intentional and still block lower-level trace,
progress, checkpoint, runner, or handler moves.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts`:
  passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
