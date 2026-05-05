# Circuit v2 Checkpoint 4.12

## Summary

Phase 4.12 is a behavior-preserving relay selection helper extraction.

No runtime files were deleted. Selector behavior did not change. Checkpoint
resume ownership did not change.

## What Moved

The selection-depth helper surface moved to:

- `src/shared/relay-selection.ts`

The moved surface is:

- `RelayerInvocationConfig`
- `bindsExecutionDepthToRelaySelection`
- `selectionConfigLayersWithExecutionDepth`
- `deriveResolvedSelection`

`src/runtime/relay-selection.ts` re-exports those helpers for compatibility.

## Boundary

core-v2 relay now imports `deriveResolvedSelection` from the shared module.

`src/runtime/relay-selection.ts` still owns retained relayer resolution,
connector bridge behavior, and old relay provenance tests. That part was not
moved in this slice because it reaches into retained connector subprocess
implementations.

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
- `npx vitest run tests/contracts/flow-model-effort.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/build-runtime-wiring.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
