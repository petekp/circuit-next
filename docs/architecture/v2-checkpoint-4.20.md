# Circuit v2 Checkpoint 4.20

## Summary

Phase 4.20 is a behavior-preserving manifest snapshot helper ownership move.

No runtime files were deleted. Connector subprocess modules did not move.
Relay materialization did not move. Registries did not move. Selector behavior
did not change. Checkpoint resume ownership did not change.

This is a light retained-runtime narrowing slice, not a heavy review boundary.

## What Moved

The old runtime manifest snapshot implementation moved to:

- `src/shared/manifest-snapshot.ts`

The old runtime path remains:

- `src/runtime/manifest-snapshot-writer.ts`

as a compatibility re-export.

The v2 raw-byte snapshot implementation remains separate:

- `src/core-v2/run/manifest-snapshot.ts`

## Why This Was Safe

Manifest snapshot byte-match semantics are a small schema-backed helper:
compute the manifest hash, persist `manifest.snapshot.json`, read it back, and
reject hash mismatches through the `ManifestSnapshot` schema.

The move did not change runner bootstrap, resume ownership, checkpoint
behavior, or v2 manifest snapshot behavior. Retained runner callers can keep
using the old runtime path while CLI handoff and status projection import the
shared helper directly.

## Deletion Status

Old runtime deletion remains out of scope.

`src/runtime/manifest-snapshot-writer.ts` is now a compatibility wrapper. Keep
it until retained runner imports and old snapshot tests stop using the old path
or the wrapper is explicitly retained by policy.

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
- `npx vitest run tests/unit/runtime/event-log-round-trip.test.ts tests/runner/run-status-projection.test.ts tests/runner/fresh-run-root.test.ts tests/runner/handoff-hook-adapters.test.ts` passed.
- `npm run build` passed.
- `npm run test:fast` passed.
- `npm run check-flow-drift` passed.
- `npm run verify` passed.
