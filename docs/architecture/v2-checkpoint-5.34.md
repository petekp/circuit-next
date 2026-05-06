# Core-v2 Checkpoint 5.34: Retained Trace And Checkpoint Guardrails

Date: 2026-05-06

## Summary

Phase 5.34 does not move retained trace, status, progress, or checkpoint-state
implementations.

The review decision was explicit: these files remain retained-runtime-owned for
now because they are active retained/v1 saved-folder behavior, not neutral
helpers:

- `src/runtime/trace-reader.ts`
- `src/runtime/trace-writer.ts`
- `src/runtime/reducer.ts`
- `src/runtime/snapshot-writer.ts`
- `src/runtime/append-and-derive.ts`
- `src/runtime/progress-projector.ts`
- `src/runtime/checkpoint-resume.ts`
- `src/runtime/step-handlers/checkpoint.ts`

The safe slice was behavior-preserving guard/test hardening around the existing
facades.

## Review

This slice used a focused review because the candidate files affect saved run
folders, `runs show`, checkpoint resume, progress output, handoff fallback, and
retained trace recovery.

Verdict from the review: no safe implementation ownership move is approved now.
The existing neutral status dispatcher and retained checkpoint-folder facade are
the right boundaries for this phase.

Approved work:

- strengthen import guards so production code does not reach retained
  trace/status/checkpoint implementation files directly;
- keep `src/run-status/**` on the neutral dispatcher shape;
- keep retained/v1 saved-folder calls behind
  `src/compat/retained-checkpoint-folders.ts`;
- keep direct test imports of retained trace/status/checkpoint internals
  explicit and intentional.

## Implementation

No source implementation behavior changed.

Tests now guard more of the boundary:

- production code outside `src/compat/**` is blocked from importing retained
  execution and saved-state implementation modules directly;
- direct test imports of retained trace/status/checkpoint internals are
  allowlisted to the old-oracle and old-path proof tests that intentionally
  exercise those internals;
- several retained runner tests now read retained traces through
  `readRetainedRunTrace` from `src/compat/retained-checkpoint-folders.ts`
  instead of importing `src/runtime/trace-reader.ts` directly.

This keeps behavior unchanged while making accidental new coupling visible.

## Proof

Focused validation:

```bash
npx vitest run tests/runner/retained-compat-facade.test.ts
npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/pass-route-cycle-guard.test.ts tests/runner/runtime-smoke.test.ts tests/runner/handler-throw-recovery.test.ts tests/runner/relay-invocation-failure.test.ts tests/runner/push-sequence-authority.test.ts tests/runner/terminal-outcome-mapping.test.ts
npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/relay-transcript-schema.test.ts tests/runner/fresh-run-root.test.ts tests/runner/checkpoint-handler-direct.test.ts tests/runner/agent-relay-roundtrip.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/retained-compat-facade.test.ts
```

Full validation:

```bash
npm run check
npm run lint
npm run build
npm run verify:fast
npm run verify
git diff --check
```

All passed.

## Non-Approvals

Phase 5.34 does not approve:

- moving retained trace reader/writer, reducer, snapshot, append-and-derive,
  progress projector, checkpoint resume, or checkpoint handler implementations;
- adding a neutral `src/trace/**`, `src/run-state/**`, or v1 progress
  implementation namespace;
- changing retained/v1 folder support;
- routing unmarked retained folders through core-v2;
- changing status or handoff fallback behavior;
- changing progress wording or `ProgressEvent` schema;
- changing rollback or public `composeWriter` behavior;
- changing arbitrary fixture or custom-root routing;
- deleting old runtime files;
- deleting old oracle tests.

## Next

Continue autonomously only on behavior-preserving cleanup or v2/shared oracle
twins.

Require review before any saved-state semantic change, trace/status/checkpoint
implementation move, public compatibility change, wrapper deletion, or old
runtime deletion.
