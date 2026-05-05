# Circuit v2 Checkpoint 4.17

## Summary

Phase 4.17 is a behavior-preserving connector helper extraction.

No runtime files were deleted. Connector subprocess modules did not move.
Relay materialization did not move. Registry ownership did not change. Selector
behavior did not change. Checkpoint resume ownership did not change.

## What Moved

Connector parsing/model helpers moved to:

- `src/shared/connector-helpers.ts`

The moved surface is:

- `selectedModelForProvider`
- `extractJsonObject`

`src/runtime/connectors/shared.ts` remains as a compatibility surface for those
exports, plus the relay data/hash re-exports moved in Phase 4.16.

## Boundary

The runtime connector subprocess modules now import connector helpers from the
shared helper module.

These surfaces did not move:

- `relayClaudeCode`
- `relayCodex`
- `relayCustom`
- `relay-materializer`
- subprocess argv construction
- sandbox policy
- registries

## Behavior Changed?

No behavior changed. This is a helper ownership move.

The connector smoke fingerprint source lists now include
`src/shared/connector-helpers.ts`, so future changes to connector parsing/model
helper behavior invalidate connector evidence.

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
- retained relayer resolution and connector bridge behavior;
- connector subprocess modules and relay materialization;
- registries and writer/report discovery.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npx vitest run tests/runner/connector-shared-compat.test.ts tests/runner/extract-json-object.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/agent-connector-smoke.test.ts tests/runner/codex-connector-smoke.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/materializer-schema-parse.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: initially failed once with unrelated full-suite
  cross-talk symptoms; isolated reruns of the affected suites passed, and the
  final `npm run verify` rerun passed.
