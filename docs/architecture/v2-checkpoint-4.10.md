# Circuit v2 Checkpoint 4.10

## Summary

Phase 4.10 is a behavior-preserving progress helper extraction.

No runtime files were deleted. Selector behavior did not change. Checkpoint
resume ownership did not change.

## What Moved

Shared progress output helpers moved to:

- `src/shared/progress-output.ts`

The moved helpers are:

- `progressDisplay`
- `reportProgress`

`src/runtime/progress-projector.ts` remains as the old trace-to-progress
projector and re-exports these helpers for compatibility.

## Core-v2 Boundary

core-v2 progress now imports shared output helpers from:

- `src/shared/progress-output.ts`

It no longer imports `src/runtime/progress-projector.ts`.

## Behavior Changed?

No behavior changed. This is a helper ownership move.

## Deletion Status

Old runtime deletion remains out of scope.

The retained runtime still owns:

- checkpoint resume;
- checkpoint-waiting depths;
- unsupported public modes;
- arbitrary fixtures outside `generated/flows`;
- programmatic `composeWriter` injection;
- rollback behavior;
- old runner and handler oracle tests;
- old trace-to-progress projection.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed after rerunning serially; the first
  attempt overlapped with stale-file drift tests in `test:fast`.
- `npm run verify`: passed.
- `git diff --check`: passed.
