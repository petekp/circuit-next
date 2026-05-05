# Circuit v2 Checkpoint 4.25

## Summary

Phase 4.25 implements the path-only result helper extraction recommended by
Phase 4.24.

No runtime files were deleted. The retained result writer still owns retained
runtime result writing. The v2 result writer still owns v2 result writing.
Trace/status/progress projection did not move. Selector behavior did not
change. Checkpoint resume ownership did not change.

## What Changed

Added:

- `src/shared/result-path.ts`
- `tests/runner/result-path-compat.test.ts`

Updated:

- `src/runtime/result-writer.ts`
- `src/core-v2/run/result-writer.ts`
- `src/runtime/runner.ts`
- `src/core-v2/projections/progress.ts`
- `src/shared/operator-summary-writer.ts`
- `src/cli/circuit.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Boundary Decision

The shared result path now lives at:

```text
src/shared/result-path.ts
```

It owns:

```text
RUN_RESULT_RELATIVE_PATH = "reports/result.json"
runResultPath(runFolder)
```

`src/runtime/result-writer.ts` keeps the old `resultPath(...)` export as a
compatibility surface and delegates to the shared helper.

The writers did not merge.

## Deletion Status

Old runtime deletion remains out of scope.

`src/runtime/result-writer.ts` remains live because retained runtime still owns
fallback execution, checkpoint waiting/resume, arbitrary fixtures,
`composeWriter`, and old runner/handler tests.

## Validation

Run for this checkpoint:

- `npm run check` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npx vitest run tests/runner/result-path-compat.test.ts tests/runner/runtime-smoke.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/run-status-projection.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/fanout-runtime.test.ts tests/core-v2 tests/parity tests/runner/cli-v2-runtime.test.ts` passed.
- `npm run test:fast` passed.
- `npm run check-flow-drift` passed.
- `npm run verify` passed.
