# Circuit v2 Checkpoint 4.18

## Summary

Phase 4.18 is a planning and inventory checkpoint.

No runtime files were deleted. Connector subprocess modules did not move.
Relay materialization did not move. Registries did not move. Selector behavior
did not change. Checkpoint resume ownership did not change.

## What Changed

Added two ownership plans:

- `docs/architecture/v2-connector-materializer-plan.md`
- `docs/architecture/v2-registry-ownership-plan.md`

Also fixed a stale connector smoke comment in
`tests/runner/codex-relay-roundtrip.test.ts` that still said the fingerprint
covered "three" connector-layer source files after Phase 4.16 and 4.17 widened
the list.

## Connector / Materializer Position

The low-risk connector helper moves are complete:

- relay data/hash: `src/shared/connector-relay.ts`
- parsing/model helpers: `src/shared/connector-helpers.ts`
- old connector shared path: `src/runtime/connectors/shared.ts` compatibility
  re-export

The remaining connector files are production safety boundaries:

- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/codex.ts`
- `src/runtime/connectors/custom.ts`
- `src/runtime/connectors/relay-materializer.ts`

Recommendation: keep them in place until a dedicated connector-safety move is
reviewed.

## Registry Position

`src/runtime/registries/**` is shared flow-package and report infrastructure,
not old runner debris.

Current consumers include:

- flow packages and writers;
- core-v2 executors;
- retained runtime runner and old handlers;
- report validation;
- relay prompt shape hints;
- generated-surface and release evidence checks;
- catalog and registry tests.

Recommendation: do not move registries yet. If moved later, treat that as a
separate flow-package infrastructure migration with compatibility wrappers.

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
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/connector-shared-compat.test.ts tests/runner/extract-json-object.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/explore-e2e-parity.test.ts`: passed.
- `npx vitest run tests/runner/catalog-derivations.test.ts tests/contracts/catalog-completeness.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/close-builder-registry.test.ts tests/runner/relay-shape-hint-registry.test.ts tests/runner/cross-report-validators.test.ts tests/properties/visible/cross-report-validator.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: initially failed when run concurrently with
  `test:fast` because the emit-flows drift test temporarily created stale
  `never-a-mode` fixtures; the files were gone after the test completed, and a
  serial rerun passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
