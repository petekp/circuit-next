# Circuit v2 Trace, Progress, And Checkpoint Boundary Plan

Phase 4.31 is a planning checkpoint. It does not move trace, progress,
reducer, snapshot, checkpoint resume, runner, or step-handler code.

The run-status public boundary has been narrowed into neutral modules:

```text
src/run-status/project-run-folder.ts
src/run-status/projection-common.ts
src/run-status/v1-run-folder.ts
src/run-status/v2-run-folder.ts
```

The next remaining boundary is lower risk only if it is planned first. The
remaining runtime files below are still product infrastructure, not simple
namespace cleanup.

## Current Responsibilities

| Responsibility | Current owner | Why it remains there |
|---|---|---|
| checkpoint resume | `src/runtime/runner.ts`, `src/runtime/step-handlers/checkpoint.ts`, `src/runtime/snapshot-writer.ts`, `src/runtime/trace-reader.ts`, `src/runtime/trace-writer.ts` | CLI `resume` is still retained-runtime-owned. Resume validates manifest identity, current snapshot state, checkpoint request files, allowed choices, and checkpoint report hashes. |
| checkpoint waiting status | `src/run-status/v1-run-folder.ts` plus retained reducer/checkpoint registry helpers | Status projection moved neutral, but it still validates retained checkpoint request/report contracts through retained helpers. |
| v1 trace append/read | `src/runtime/trace-writer.ts`, `src/runtime/trace-reader.ts` | Retained runner and direct handler tests still append/read schema-validated v1 trace entries. |
| v1 state snapshot | `src/runtime/reducer.ts`, `src/runtime/snapshot-writer.ts`, `src/runtime/append-and-derive.ts` | Retained runner, checkpoint handling, handoff, and event-log round-trip tests still use `state.json`. |
| retained progress projection | `src/runtime/progress-projector.ts` | Retained runner emits progress from v1 trace entries through this projector. |
| v2 progress projection | `src/core-v2/projections/progress.ts` | v2 graph runner owns v2 trace-to-progress projection. |
| public run status | `src/run-status/project-run-folder.ts` and child modules | Neutral-owned as of Phases 4.27-4.30.1. |

## What Remains Because Of Checkpoint Resume

Checkpoint resume still requires retained runtime ownership for:

- reading the existing v1 trace through `readRunTrace(...)`;
- deriving the current snapshot through `writeDerivedSnapshot(...)`;
- confirming the run is not closed;
- confirming the current step is a checkpoint step;
- finding unresolved `checkpoint.requested` entries;
- rejecting stale, missing, tampered, or disallowed checkpoint request files;
- validating checkpoint report hashes through registered checkpoint builders;
- appending `checkpoint.resolved` and continuing retained execution.

Until v2 owns this full flow, these files are not move/delete candidates:

```text
src/runtime/runner.ts
src/runtime/step-handlers/checkpoint.ts
src/runtime/reducer.ts
src/runtime/snapshot-writer.ts
src/runtime/append-and-derive.ts
src/runtime/trace-reader.ts
src/runtime/trace-writer.ts
```

## What Remains Because Of Trace And Snapshot Contracts

The retained v1 trace/state contract is still tested as an event-log round trip:

```text
trace.ndjson -> readRunTrace(...) -> reduce(...) -> state.json
```

It supports:

- schema-validated trace append/read;
- pure snapshot derivation from trace;
- persisted `state.json` equality with `reduce(readRunTrace(...))`;
- malformed trace rejection;
- handoff snapshot reads;
- retained runner close and checkpoint behavior.

This contract should not be moved mechanically. A future move would need to
decide whether v1 trace/state becomes:

```text
retained runtime infrastructure
neutral v1 event-log infrastructure
obsolete after v2 checkpoint resume
```

Today it remains retained runtime infrastructure.

## What Remains Because Of V1 Progress Projection

`src/runtime/progress-projector.ts` still owns retained v1 trace-to-progress
projection. It is not just a formatting helper. It maps retained trace entries
into public `ProgressEvent` objects and still supports retained progress
behavior.

Already-neutral helper ownership:

```text
src/shared/progress-output.ts
```

Not yet neutral:

```text
src/runtime/progress-projector.ts
```

Do not move it until the retained progress contract is classified:

- retained runtime only;
- neutral v1 progress projector;
- replaced by v2 progress for all default-routed paths while retained fallback
  keeps the old file.

## Safe Facade Or Wrapper Candidates

The only low-risk candidates left are facades, not implementation moves:

| Candidate | Safe shape | Risk |
|---|---|---|
| public progress output facade | keep `src/shared/progress-output.ts` as-is; no need to move now | Low, but little value because helper is already neutral |
| v1 progress import facade | `src/progress/v1-trace-projector.ts` re-exporting from `src/runtime/progress-projector.ts` | Medium; public progress wording is operator-facing, so only useful with tests and a clear reason |
| v1 trace import facade | neutral wrapper re-exporting `readRunTrace` / `appendTraceEntry` | Medium-high; can make ownership look safer than it is while checkpoint resume still depends on retained runtime |

None of these should be the next move unless there is a concrete consumer that
benefits. Moving facades without reducing product ownership adds wrappers, not
clarity.

## Not Movable Until Product Ownership Changes

Do not move these implementation files without a new review gate:

```text
src/runtime/runner.ts
src/runtime/step-handlers/checkpoint.ts
src/runtime/step-handlers/**
src/runtime/reducer.ts
src/runtime/snapshot-writer.ts
src/runtime/append-and-derive.ts
src/runtime/trace-reader.ts
src/runtime/trace-writer.ts
src/runtime/progress-projector.ts
```

The blocker is not import direction. The blocker is product ownership:

- checkpoint resume is retained-runtime-owned;
- unsupported modes still fall back to retained runtime;
- rollback can force retained runtime;
- arbitrary fixtures and `composeWriter` remain retained;
- old runner/handler tests still serve as oracle coverage.

## Proof Required Before Any Move

### Checkpoint Waiting And Resume

Required tests:

```text
npx vitest run tests/runner/build-checkpoint-exec.test.ts
npx vitest run tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/runner/run-status-projection.test.ts
npx vitest run tests/unit/runtime/event-log-round-trip.test.ts
```

Evidence needed:

- waiting checkpoint projects through `runs show`;
- CLI resume stays retained-runtime-owned;
- invalid choices are rejected;
- tampered checkpoint brief/request files are rejected;
- checkpoint report hashes are validated;
- post-checkpoint relay and verification resume with original context;
- deep checkpoint-waiting modes remain retained.

### Retained Progress

Required tests:

```text
npx vitest run tests/unit/runtime/progress-projector.test.ts
npx vitest run tests/contracts/progress-event-schema.test.ts
npx vitest run tests/runner/cli-v2-runtime.test.ts
```

Evidence needed:

- retained progress events still parse as `ProgressEvent`;
- v2 progress events still parse as `ProgressEvent`;
- progress callback failures cannot corrupt the run;
- checkpoint progress remains retained unless v2 pause/resume owns it.

### Trace And Snapshot

Required tests:

```text
npx vitest run tests/unit/runtime/event-log-round-trip.test.ts
npx vitest run tests/runner/fresh-run-root.test.ts
npx vitest run tests/runner/build-runtime-wiring.test.ts
npm run verify
```

Evidence needed:

- trace append/read round trips;
- malformed trace fails closed;
- derived snapshot equals reduced trace;
- `state.json` stays path-distinct from `trace.ndjson`;
- retained runner close still writes final result and snapshot.

## Smallest Next Safe Move

No lower-level implementation move is currently the safest next step.

The next useful slice should be one of these planning/classification tasks:

1. **Checkpoint resume ownership decision.**
   Decide whether v2 will implement pause/resume parity or whether checkpoint
   resume remains permanently retained behind a smaller retained module.

2. **Old runner/handler test classification.**
   Classify each old runner and direct handler test as:
   `retained product fallback`, `oracle until v2 parity`, `migrate to v2`, or
   `delete only after behavior is obsolete`.

3. **Retained progress contract classification.**
   Decide whether v1 progress projection stays retained-only or gets a neutral
   v1 projector namespace.

Phase 4.32 completed the checkpoint resume ownership decision. It recommends
not implementing v2 checkpoint resume next and not shrinking checkpoint resume
into a smaller retained module yet. The next useful slice is old runner/handler
test classification, because checkpoint resume is entangled with old runner
coverage and direct handler oracle tests.

## Non-Goals

This plan does not approve:

- old runtime deletion;
- moving checkpoint resume through v2;
- moving trace reader/writer;
- moving reducer or snapshot writer;
- moving progress projector internals;
- moving old runner or step handlers;
- removing retained fallback, rollback, arbitrary fixture, or `composeWriter`
  behavior.
