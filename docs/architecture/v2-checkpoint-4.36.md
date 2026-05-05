# Circuit v2 Checkpoint 4.36

## Summary

Phase 4.36 proposes the first retained checkpoint resume shrink.

No code moved. No old runtime files were deleted. Checkpoint resume did not
move to core-v2. Selector behavior did not change.

## What Changed

Added:

- `docs/architecture/v2-retained-checkpoint-resume-shrink-proposal.md`

Updated:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Proposal

The next implementation slice should extract checkpoint resume discovery and
validation from `src/runtime/runner.ts` into:

```text
src/runtime/checkpoint-resume.ts
```

The public `resumeCompiledFlowCheckpoint(...)` wrapper and private
`executeCompiledFlow(...)` loop should stay in `src/runtime/runner.ts`.

This keeps checkpoint resume retained-runtime-owned while reducing the runner's
inline responsibility.

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
