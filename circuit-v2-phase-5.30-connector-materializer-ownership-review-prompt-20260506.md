# Circuit core-v2 migration review: connector/materializer neutral ownership

We need a focused review before moving connector subprocess and relay
materializer ownership out of `src/runtime/**`.

Please review the included files and answer the questions below. The desired
next implementation slice is behavior-preserving: move shared connector
subprocess/materializer infrastructure to neutral ownership with compatibility
re-exports, then update core-v2 to import the neutral paths. Do **not** approve
old runtime deletion, public behavior changes, routing changes, or removal of
old public import paths.

## Current state

Generated public fresh runs route through core-v2 by default for the current
catalog. Old runtime deletion remains blocked by retained/v1 checkpoint folders,
arbitrary fixtures, custom roots, rollback, public `composeWriter`, old public
runtime paths, retained trace/status/checkpoint behavior, connector
subprocesses/materializer, router/compiler ownership, and old oracle tests.

The connector/materializer cluster is one of the remaining `src/runtime/**`
clusters that is not old-runtime debris:

- `src/core-v2/executors/relay.ts` imports retained connector implementations
  from `src/runtime/connectors/**`.
- retained tests still exercise connector subprocess and relay materialization
  behavior.
- the relay materializer defines durable transcript/artifact behavior.

## Proposed next slice

Behavior-preserving neutral move:

1. Create a neutral connector/materializer location, for example:

   ```text
   src/connectors/claude-code.ts
   src/connectors/codex.ts
   src/connectors/custom.ts
   src/connectors/shared.ts
   src/connectors/relay-materializer.ts
   ```

2. Move implementations there without changing behavior.
3. Leave `src/runtime/connectors/**` as compatibility re-exports.
4. Update core-v2 production imports to neutral paths.
5. Keep retained tests/public compatibility tests proving old paths still work.
6. Add an import-boundary guard so future core-v2 code does not import
   connector implementations through `src/runtime/**`.

## Review questions

1. Is the proposed neutral ownership move safe as a behavior-preserving slice?
2. Should all connector files move together, or should relay materializer move
   separately from connector subprocess implementations?
3. Which old import paths must remain as compatibility re-exports?
4. What tests are required before and after the move?
5. What must explicitly remain out of scope?
6. Does this move require any public release note, or is compatibility
   re-export coverage enough?
7. After this move, what is the next highest-leverage deletion-readiness slice?

## Expected non-approvals

Please call out if any of these accidentally happen or should stay forbidden:

```text
No connector behavior change.
No relay transcript/materializer behavior change.
No public old-path removal.
No runtime routing change.
No rollback change.
No composeWriter change.
No arbitrary fixture/custom-root routing change.
No retained/v1 checkpoint folder change.
No router/compiler move.
No old runtime deletion.
No old oracle test deletion.
```

## Likely validation

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/core-v2/connectors-v2.test.ts
npx vitest run tests/contracts/connector-schema.test.ts tests/contracts/codex-connector-schema.test.ts
npx vitest run tests/contracts/relay-transcript-schema.test.ts
npx vitest run tests/runner/connector-shared-compat.test.ts
npx vitest run tests/runner/materializer-schema-parse.test.ts
npx vitest run tests/runner/agent-relay-roundtrip.test.ts tests/runner/codex-relay-roundtrip.test.ts
npx vitest run tests/runner/custom-connector-runtime.test.ts
npx vitest run tests/runner/cli-v2-runtime.test.ts
npm run verify
git diff --check
```

## Direct answer requested

Give a clear verdict:

```text
approved for behavior-preserving neutral move
approved only with changes
not approved
```

Then list blocking findings first, followed by the exact implementation slice
you recommend.
