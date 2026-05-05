# Circuit v2 Checkpoint 4.13

## Summary

Phase 4.13 is a behavior-preserving relay support helper extraction.

No runtime files were deleted. Selector behavior did not change. Checkpoint
resume ownership did not change.

## What Moved

Relay prompt and check helpers moved to:

- `src/shared/relay-support.ts`

The moved surface is:

- `RelayStep`
- `CheckEvaluation`
- `NO_VERDICT_SENTINEL`
- `composeRelayPrompt`
- `evaluateRelayCheck`

`src/runtime/relay-support.ts` remains as a compatibility re-export.

## Boundary

core-v2 relay now imports prompt composition and check evaluation from the
shared module.

The shared helper still uses retained registry and path helper infrastructure:

- `src/runtime/registries/shape-hints/registry.ts`
- `src/runtime/run-relative-path.ts`

Those moves are intentionally deferred.

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
- `npx vitest run tests/runner/relay-handler-direct.test.ts tests/runner/materializer-schema-parse.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
