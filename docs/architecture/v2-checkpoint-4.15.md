# Circuit v2 Checkpoint 4.15

## Summary

Phase 4.15 is a behavior-preserving run-relative path helper extraction.

No runtime files were deleted. Selector behavior did not change. Checkpoint
resume ownership did not change.

## What Moved

Run-relative path resolution moved to:

- `src/shared/run-relative-path.ts`

The moved surface is:

- `resolveRunRelative`

`src/runtime/run-relative-path.ts` remains as a compatibility re-export.

## Boundary

Shared relay prompt support and flow-owned report writers now import the shared
path helper directly.

Retained runtime, connector materialization, old step handlers, status
projection, progress projection, and operator summary code can keep importing
the old runtime wrapper until those surfaces move or remain explicitly retained.

## Behavior Changed?

No behavior changed. This is a helper ownership move. The containment and
symlink checks were moved without semantic edits.

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
- `npx vitest run tests/runner/run-relative-path.test.ts tests/runner/materializer-schema-parse.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/build-report-writer.test.ts tests/runner/fix-report-writer.test.ts tests/runner/explore-report-writer.test.ts tests/runner/sweep-runtime-wiring.test.ts tests/runner/migrate-runtime-wiring.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
