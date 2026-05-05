# Circuit v2 Checkpoint 4.38

## Summary

Phase 4.38 maps the remaining retained runner boundary after the checkpoint
resume preparation extraction.

No code moved. No old runtime files were deleted. Checkpoint resume did not
move to core-v2. Selector behavior did not change.

## What Changed

Added:

- `docs/architecture/v2-retained-runner-boundary-plan.md`

Updated:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Decision

Stop shrinking `src/runtime/runner.ts` for now.

Phase 4.37 extracted the clearest separable responsibility: checkpoint resume
preparation and validation. The remaining runner responsibilities are tangled
with retained execution-loop behavior:

- trace sequence assignment;
- route walking;
- step dispatch;
- retained progress projection side effects;
- checkpoint waiting return;
- close/result finalization;
- recursive child-run defaults.

The only plausible next shrink candidate is close/result finalization, but that
needs a focused proposal before code movement.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/core-v2 tests/parity`:
  passed.
- `npx vitest run tests/contracts/terminology-active-surface.test.ts`: passed
  after folding in the parallel positioning and strategy doc terminology
  cleanup.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
