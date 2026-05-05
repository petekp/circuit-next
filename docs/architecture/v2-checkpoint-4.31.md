# Circuit v2 Checkpoint 4.31

## Summary

Phase 4.31 is a trace/progress/checkpoint boundary planning checkpoint.

No code moved in this phase. Progress projection did not move. Retained trace
reader/writer, reducer, snapshot, checkpoint resume, runner, and step-handler
code did not move. Selector behavior did not change.

## What Changed

Added:

- `docs/architecture/v2-trace-progress-checkpoint-boundary-plan.md`

Updated:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Boundary Decision

The next risky boundary is lower-level retained infrastructure:

```text
trace reader/writer
reducer
snapshot writer
progress projector
checkpoint resume
old runner
old step handlers
```

The plan recommends not moving those implementation files yet. The next useful
work should decide checkpoint resume ownership or classify old runner/handler
tests before any further code move.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
