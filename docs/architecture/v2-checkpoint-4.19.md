# Circuit v2 Checkpoint 4.19

## Summary

Phase 4.19 is a behavior-preserving flow-kind policy ownership move.

No runtime files were deleted. Connector subprocess modules did not move.
Relay materialization did not move. Registries did not move. Selector behavior
did not change. Checkpoint resume ownership did not change.

This is a light retained-runtime narrowing slice, not a heavy review boundary.

## What Moved

The TypeScript wrapper around the canonical flow-kind policy moved to:

- `src/shared/flow-kind-policy.ts`

The old runtime path remains:

- `src/runtime/policy/flow-kind-policy.ts`

as a compatibility re-export.

The underlying canonical set table stays in:

- `scripts/policy/flow-kind-policy.mjs`

## Why This Was Safe

Flow-kind policy is generated-surface and fixture validation policy. It is not
runtime graph execution, connector execution, relay materialization, registry
ownership, or checkpoint resume behavior.

The CLI now imports the shared policy wrapper directly. Tests keep a
compatibility assertion that the runtime re-export returns the same result as
the shared helper.

## Deletion Status

Old runtime deletion remains out of scope.

`src/runtime/policy/flow-kind-policy.ts` is now a compatibility wrapper. Keep
it until old-path imports and documentation references are migrated or
intentionally retained.

## Review Cadence

This slice should not require a heavy checkpoint review. Heavy review is still
reserved for production-sensitive changes such as moving connector subprocess
modules, moving relay materialization, moving registries, changing retained
fallback policy, routing checkpoint resume through v2, or deleting old runtime
files.

## Validation

Run for this checkpoint:

- `npm run check` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npx vitest run tests/contracts/flow-kind-policy.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/cli-v2-runtime.test.ts` passed.
- `npm run test:fast` passed.
- `npm run check-flow-drift` passed.
- `npm run verify` passed.
- `git diff --check` passed.
