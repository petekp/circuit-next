# Circuit v2 Checkpoint 4.22

## Summary

Phase 4.22 is a behavior-preserving config loader ownership move.

No runtime files were deleted. Connector subprocess modules did not move.
Relay materialization did not move. Registries did not move. Selector behavior
did not change. Checkpoint resume ownership did not change.

This is a light retained-runtime narrowing slice, not a heavy review boundary.

## What Moved

The config discovery implementation moved to:

- `src/shared/config-loader.ts`

The old runtime path remains:

- `src/runtime/config-loader.ts`

as a compatibility re-export.

## Why This Was Safe

Config loading is a small schema-backed helper: discover user-global and
project config files, parse YAML, validate through `Config`, and append an
invocation layer when supplied.

The move did not change config precedence, connector selection, routing, run
execution, checkpoint resume, or selector behavior. The CLI imports the shared
loader directly, while the runtime path remains available for old tests and
external imports.

## Deletion Status

Old runtime deletion remains out of scope.

`src/runtime/config-loader.ts` is now a compatibility wrapper. Keep it until
old-path tests and external imports stop using the old path or the wrapper is
explicitly retained by policy.

## Review Cadence

This slice should not require a heavy checkpoint review. Heavy review is still
reserved for production-sensitive changes such as moving connector subprocess
modules, moving relay materialization, moving registries, changing retained
fallback policy, routing checkpoint resume through v2, or deleting old runtime
files.

## Validation

Run for this checkpoint:

- `npm run check` passed.
- `npx vitest run tests/runner/config-loader.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/contracts/flow-model-effort.test.ts tests/runner/runner-relay-provenance.test.ts` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run test:fast` passed.
- `npm run check-flow-drift` passed.
- `npm run verify` passed.
