# Circuit v2 Checkpoint 4.21

## Summary

Phase 4.21 is a behavior-preserving operator summary writer ownership move.

No runtime files were deleted. Connector subprocess modules did not move.
Relay materialization did not move. Registries did not move. Selector behavior
did not change. Checkpoint resume ownership did not change.

This is a light retained-runtime narrowing slice, not a heavy review boundary.

## What Moved

The operator summary writer implementation moved to:

- `src/shared/operator-summary-writer.ts`

The old runtime path remains:

- `src/runtime/operator-summary-writer.ts`

as a compatibility re-export.

## Why This Was Safe

Operator summary writing is shared CLI output infrastructure used after both v2
and retained runs. The move did not change routing, run execution, checkpoint
resume, report schemas, or summary wording.

The tests assert that the runtime compatibility wrapper produces the same
summary as the shared writer.

## Deletion Status

Old runtime deletion remains out of scope.

`src/runtime/operator-summary-writer.ts` is now a compatibility wrapper. Keep it
until old-path tests and release evidence stop using the old path or the wrapper
is explicitly retained by policy.

## Review Cadence

This slice should not require a heavy checkpoint review. Heavy review is still
reserved for production-sensitive changes such as moving connector subprocess
modules, moving relay materialization, moving registries, changing retained
fallback policy, routing checkpoint resume through v2, or deleting old runtime
files.

## Validation

Run for this checkpoint:

- `npm run check` passed.
- `npx vitest run tests/runner/operator-summary-writer.test.ts tests/runner/cli-v2-runtime.test.ts tests/contracts/progress-event-schema.test.ts tests/contracts/terminology-active-surface.test.ts` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run check-release-infra` passed.
- `npm run test:fast` passed.
- `npm run check-flow-drift` passed.
- `npm run verify` passed.
