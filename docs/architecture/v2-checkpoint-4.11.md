# Circuit v2 Checkpoint 4.11

## Summary

Phase 4.11 is a behavior-preserving selection resolver extraction.

No runtime files were deleted. Selector behavior did not change. Checkpoint
resume ownership did not change.

## What Moved

The pure relay selection precedence resolver moved to:

- `src/shared/selection-resolver.ts`

The moved surface is:

- `resolveSelectionForRelay`
- `ResolveSelectionInput`

`src/runtime/selection-resolver.ts` remains as a compatibility re-export.

## Boundary

`src/runtime/relay-selection.ts` now imports selection precedence from the
shared resolver. It still owns retained relay decision behavior and remains a
compatibility bridge used by core-v2 production relay.

The full `relay-selection.ts` move is intentionally deferred because it also
owns relayer resolution, connector bridge behavior, and retained relay tests.

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
- retained relay decision and connector bridge behavior.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/flow-model-effort.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/config-loader.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/contracts/terminology-active-surface.test.ts`: passed
  after folding in `docs/positioning-and-strategy.md`.
- `npm run test:fast`: passed after folding in
  `docs/positioning-and-strategy.md`.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed after folding in
  `docs/positioning-and-strategy.md`.
- `git diff --check`: passed.
