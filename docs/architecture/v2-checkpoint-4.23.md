# Circuit v2 Checkpoint 4.23

## Summary

Phase 4.23 is a heavy-boundary planning checkpoint.

No runtime files were deleted. Connector subprocess modules did not move. Relay
materialization did not move. Registries did not move. Router/catalog
infrastructure did not move. Trace/status/progress projection did not move.
Selector behavior did not change. Checkpoint resume ownership did not change.

## What Changed

Added:

- `docs/architecture/v2-heavy-boundary-plan.md`

Corrected release evidence for write-capable worker disclosure so the
capability now cites:

- `src/shared/write-capable-worker-disclosure.ts`
- `src/runtime/write-capable-worker-disclosure.ts`

The runtime wrapper remains listed while it is still compatibility
infrastructure.

## Boundary Decision

The low-risk helper extraction lane is complete. Remaining runtime clusters are
not cheap cleanup targets:

- connector subprocess modules;
- relay materializer;
- registries and catalog-derived report/writer infrastructure;
- router/catalog infrastructure;
- compiler/schematic projection;
- trace reader/writer/reducer/snapshot/status/progress;
- result writer;
- old runner;
- old step handlers;
- checkpoint resume.

Future work should choose a proof plan before moving any of these clusters.

## Deletion Status

Old runtime deletion remains out of scope.

## Validation

Run for this checkpoint:

- `npm run check` passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run test:fast` passed.
- `npm run check-flow-drift` passed.
- `npm run verify` passed.
