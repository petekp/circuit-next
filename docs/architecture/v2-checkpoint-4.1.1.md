# Circuit v2 Checkpoint 4.1.1

## Summary

Phase 4.1.1 addresses the remaining production-readiness blockers before an
opt-in v2 CLI route can be reviewed.

No production CLI path is switched in this slice. No old runtime files are
deleted.

## Fixes

- `resolveRelayExecutionV2` now treats a step-declared connector as
  authoritative even when no injected relay connector is supplied.
- Built-in step connectors resolve directly; custom step connectors require
  matching registered capabilities from config layers or a matching supplied
  connector.
- Supplied relay connector identities are reconciled before execution:
  `connectorName`, resolved connector name, and step connector must agree.
- `RunFileStore.writeText` rejects schema-tagged run-file refs so typed reports
  cannot bypass v2 report validation by accident.
- The v2 relay bridge writes schema-tagged relay reports through `writeJson`
  after parsing and validation.
- Shared relay prompt/check helpers moved from the old relay step handler into
  `src/runtime/relay-support.ts`, so `core-v2` no longer imports
  `src/runtime/step-handlers/relay.ts` directly.
- A generated Review flow smoke test now runs through `runCompiledFlowV2` with
  default v2 executors, not parity helper executors.

## Still Retained

- `src/runtime/runner.ts` remains the production CLI runner.
- `src/runtime/step-handlers/relay.ts` remains for the old runtime path and old
  handler tests.
- `src/runtime/runner-types.ts` remains because `RelayFn` is still shared by the
  old runtime and v2 compatibility bridge.
- Checkpoint pause/resume remains old-runtime-owned until a dedicated v2 resume
  slice lands.

## Validation

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

## Ready for Opt-in CLI Routing?

Not yet. This checkpoint should be reviewed first. If approved, the next slice
can add an explicitly opt-in v2 CLI route while keeping the old runtime path
available.
