# Circuit v2 Checkpoint 4.9

## Summary

Phase 4.9 is a behavior-preserving shared type extraction.

No runtime files were deleted. Selector behavior did not change. Checkpoint
resume ownership did not change.

## What Moved

Shared relay/progress callback types moved to:

- `src/shared/relay-runtime-types.ts`

The moved types are:

- `RelayFn`
- `RelayInput`
- `ProgressReporter`
- `RuntimeEvidencePolicy`

`src/runtime/runner-types.ts` remains as a compatibility re-export and still
owns retained-runtime invocation/result types.

## Core-v2 Boundary

core-v2 no longer imports `src/runtime/runner-types.ts` for relay/progress
callback types. Known updated imports:

- `src/core-v2/projections/progress.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/run-context.ts`

Retained runtime and existing tests can still import through
`src/runtime/runner-types.ts` or `src/runtime/runner.ts`.

## Behavior Changed?

No behavior changed. This is a type ownership move.

## Deletion Status

Old runtime deletion remains out of scope.

The retained runtime still owns:

- checkpoint resume;
- checkpoint-waiting depths;
- unsupported public modes;
- arbitrary fixtures outside `generated/flows`;
- programmatic `composeWriter` injection;
- rollback behavior;
- old runner and handler oracle tests.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
