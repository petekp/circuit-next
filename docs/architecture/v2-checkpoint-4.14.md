# Circuit v2 Checkpoint 4.14

## Summary

Phase 4.14 is a behavior-preserving write-capable worker disclosure extraction.

No runtime files were deleted. Selector behavior did not change. Checkpoint
resume ownership did not change.

## What Moved

Write-capable worker disclosure helpers moved to:

- `src/shared/write-capable-worker-disclosure.ts`

The moved surface is:

- `WRITE_CAPABLE_WORKER_DISCLOSURE`
- `flowMayInvokeWriteCapableWorker`
- `compiledFlowMayInvokeWriteCapableWorker`

`src/runtime/write-capable-worker-disclosure.ts` remains as a compatibility
re-export.

## Boundary

core-v2 progress now imports the disclosure helper from the shared module.

Retained runtime and operator summary code can keep importing the old runtime
path until those surfaces move or stay behind explicit retained modules.

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
- retained relayer resolution and connector bridge behavior.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/progress-event-schema.test.ts tests/runner/cli-v2-runtime.test.ts tests/runner/operator-summary-writer.test.ts tests/contracts/terminology-active-surface.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
