# Circuit v2 Checkpoint 4.24

## Summary

Phase 4.24 is a result-writer planning checkpoint.

No runtime files were deleted. The retained result writer did not move. The v2
result writer did not move. Trace/status/progress projection did not move.
Selector behavior did not change. Checkpoint resume ownership did not change.

## What Changed

Added:

- `docs/architecture/v2-result-writer-plan.md`

Updated:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Boundary Decision

The retained and v2 result writers both write `reports/result.json` with the
shared `RunResult` shape. They should not be merged yet.

The safest future code slice is a path-only extraction:

```text
src/shared/result-path.ts
```

with a shared relative constant/helper for `reports/result.json`.

`src/runtime/result-writer.ts` should remain the retained runtime writer, and
`src/core-v2/run/result-writer.ts` should remain the v2 writer. The path helper
can be shared without changing result lifecycle semantics.

## Deletion Status

Old runtime deletion remains out of scope.

Result-writer deletion is not approved. The retained writer remains live for
fallback execution, checkpoint waiting/resume, arbitrary fixtures,
`composeWriter`, and old runner/handler tests.

## Validation

Run for this checkpoint:

- `npm run check` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity` passed.
- `npm run test:fast` passed.
- `npm run check-flow-drift` passed.
- `npm run verify` passed.
