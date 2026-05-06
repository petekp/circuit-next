# Circuit v2 Checkpoint 5.32: Connector And Materializer Neutral Ownership

Date: 2026-05-06

## Summary

Phase 5.32 moves connector subprocess modules and relay materialization out of
`src/runtime/**` into neutral `src/connectors/**` ownership.

This is a behavior-preserving ownership move:

- `src/connectors/claude-code.ts` owns the Claude Code connector;
- `src/connectors/codex.ts` owns the Codex connector;
- `src/connectors/custom.ts` owns custom connector subprocess execution;
- `src/connectors/relay-materializer.ts` owns durable relay transcript and
  report materialization;
- `src/connectors/shared.ts` is the neutral connector helper barrel;
- old `src/runtime/connectors/**` paths remain compatibility re-exports.

## What Changed

Core-v2 production relay now imports built-in connector implementations from the
neutral path. Retained relay selection and retained relay handlers also import
the neutral implementations directly, while old runtime connector paths stay
available for compatibility.

Connector roundtrip source fingerprints now bind to the real neutral
implementation files and the old compatibility wrappers. This keeps live smoke
evidence tied to the code that actually determines connector behavior.

The relay materializer now imports the neutral run-relative path helper from
`src/shared/run-relative-path.ts`, not the old runtime wrapper.

## Proof

Tests now prove:

- core-v2 and neutral connector code do not import `src/runtime/connectors/**`;
- old `src/runtime/connectors/**` paths re-export the neutral implementations;
- Codex and Claude/agent fingerprint lists include neutral connector and
  materializer files;
- connector schema, materializer, custom connector, and relay roundtrip tests
  still pass.

## Non-Approvals

This checkpoint does not approve:

- changing connector subprocess behavior;
- changing sandbox, argv, timeout, model, effort, or output handling;
- changing relay transcript or materialization shape;
- deleting old runtime connector compatibility wrappers;
- changing rollback, `composeWriter`, arbitrary fixture, custom-root, or
  retained/v1 checkpoint behavior;
- moving router/compiler ownership;
- deleting old runtime files or old oracle tests.

## Validation

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2/connectors-v2.test.ts tests/contracts/connector-schema.test.ts tests/contracts/codex-connector-schema.test.ts tests/contracts/relay-transcript-schema.test.ts tests/runner/connector-shared-compat.test.ts tests/runner/materializer-schema-parse.test.ts tests/runner/agent-relay-roundtrip.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/custom-connector-runtime.test.ts tests/runner/agent-connector-smoke.test.ts tests/runner/codex-connector-smoke.test.ts tests/runner/retained-compat-facade.test.ts`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins autonomously.
Stop for review before changing connector behavior, deleting old connector
wrappers, moving router/compiler ownership, changing public compatibility
behavior, changing saved-folder semantics, or starting old runtime deletion.
