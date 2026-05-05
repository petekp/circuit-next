# Circuit v2 Checkpoint 4.16

## Summary

Phase 4.16 is a behavior-preserving connector relay data/hash extraction.

No runtime files were deleted. Connector subprocess modules did not move.
Registry ownership did not change. Selector behavior did not change.
Checkpoint resume ownership did not change.

## What Moved

Shared connector relay data and hashing moved to:

- `src/shared/connector-relay.ts`

The moved surface is:

- `ConnectorRelayInput`
- `RelayResult`
- `sha256Hex`

`src/runtime/connectors/shared.ts` remains as a compatibility surface for those
exports.

## Boundary

core-v2 executors, shared relayer types, and the Build checkpoint brief writer
now import the moved surface from `src/shared/connector-relay.ts`.

Connector-only helpers remain in `src/runtime/connectors/shared.ts`:

- `selectedModelForProvider`
- `extractJsonObject`

Connector subprocess modules, relay materialization, argv construction, sandbox
policy, and registries did not move.

## Behavior Changed?

No behavior changed. This is a relay data contract and hash helper ownership
move.

The connector smoke fingerprint source lists now include
`src/shared/connector-relay.ts`, so future changes to the moved relay contract
or hash helper still invalidate connector evidence.

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
- connector subprocess modules and relay materialization.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/connector-shared-compat.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/materializer-schema-parse.test.ts tests/runner/config-loader.test.ts tests/runner/extract-json-object.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/explore-e2e-parity.test.ts tests/core-v2/connectors-v2.test.ts tests/core-v2/default-executors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
