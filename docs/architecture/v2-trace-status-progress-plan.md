# Circuit v2 Trace, Status, And Progress Plan

Phase 4.26 is a planning checkpoint. It does not move trace, status, progress,
snapshot, reducer, runner, or checkpoint code.

This boundary is operator-facing. It decides what hosts and users can recover
from after a run starts: live progress, `runs show`, `state.json`, trace
round-trips, checkpoint waiting state, and malformed-folder diagnostics.

## Current Ownership

| Cluster | Current files | Current consumers | Current role | Disposition |
|---|---|---|---|---|
| v1 trace writer/reader | `src/runtime/trace-writer.ts`, `src/runtime/trace-reader.ts` | retained runner, checkpoint handler, event-log tests, relay roundtrip tests, many runner tests | Append/read `trace.ndjson` as schema-validated v1 `TraceEntry` / `RunTrace`. | Keep with retained runtime until checkpoint resume and retained fallback shrink. |
| v1 reducer/snapshot | `src/runtime/reducer.ts`, `src/runtime/snapshot-writer.ts`, `src/runtime/append-and-derive.ts` | retained runner, checkpoint handler, handoff CLI, event-log tests, fresh-run-root tests | Derive and write `state.json` from v1 trace. | Keep with retained runtime. Do not move before checkpoint resume decision. |
| status projection dispatcher | `src/runtime/run-status-projection.ts` | `src/cli/runs.ts`, run-status tests, v2 CLI tests | Projects both retained v1 and marked core-v2 run folders into `RunStatusProjectionV1`. | Keep for now, but it is a future neutralization candidate. |
| v1 progress projection | `src/runtime/progress-projector.ts` | retained runner, old progress tests | Converts v1 `TraceEntry` stream into `ProgressEvent`; still owns evidence progress for v1 trace. | Keep as v1 projection until retained runner shrinks. |
| shared progress output helpers | `src/shared/progress-output.ts` | retained progress projector, v2 progress projector | Safe progress callback wrapper and display truncation. | Already neutral. |
| v2 status projection | `src/core-v2/projections/status.ts` plus v2 branch inside `run-status-projection.ts` | v2 tests, `runs show` for v2 folders | Projects v2 trace state; run-folder projection currently lives in runtime compatibility dispatcher. | Keep split for now; plan a v2 run-folder projector before moving. |
| v2 progress projection | `src/core-v2/projections/progress.ts` | v2 graph runner, CLI progress tests | Converts v2 trace entries into `ProgressEvent`. | Keep v2-owned. |
| status/progress schemas | `src/schemas/run-status.ts`, `src/schemas/progress-event.ts` | CLI, tests, generated/release checks, hosts | Public contract. | Keep in schemas. |

## Current Product Contracts

### `runs show`

CLI path:

```text
src/cli/runs.ts -> projectRunStatusFromRunFolder(...)
```

Current behavior:

- missing/unreadable folder returns `EngineErrorV1`;
- malformed manifest returns invalid `RunStatusProjectionV1`;
- v1 trace is attempted first through `readRunTrace(...)`;
- if v1 trace parsing fails, v2 projection is attempted only for marked
  `engine: "core-v2"` traces;
- v1 open, checkpoint-waiting, completed, aborted, and invalid states project
  through one public schema;
- v2 completed, aborted, open, child-run, malformed, and identity-mismatch
  cases are covered by tests.

### `--progress jsonl`

CLI path:

```text
src/cli/circuit.ts progressReporter(...) -> ProgressEvent.parse(...)
```

Current behavior:

- route selection is emitted by the CLI before runtime routing;
- retained runtime progress comes from `src/runtime/progress-projector.ts`;
- v2 progress comes from `src/core-v2/projections/progress.ts`;
- both emit the shared `ProgressEvent` schema;
- progress callback failures are swallowed by shared `reportProgress(...)` so a
  host renderer cannot corrupt the run.

### `state.json`

Current retained path:

```text
trace.ndjson -> readRunTrace(...) -> reduce(...) -> writeDerivedSnapshot(...)
```

Current v2 path:

```text
no v2 state.json owner
```

The default selector does not require v2 `state.json` because `runs show` for
v2 reads trace and manifest snapshot directly. Retained checkpoint resume still
requires v1 trace/snapshot behavior.

## Why This Is Not A Mechanical Move

The status/progress boundary has several coupled contracts:

- `runs show` is host recovery. If progress is missed, status must still recover
  what happened.
- checkpoint waiting state is still retained-runtime-owned and depends on
  v1 trace, manifest snapshot, checkpoint request files, flow bytes, and
  derived `state.json`;
- v2 traces are not full v1 `TraceEntry` entries, so a neutral projection layer
  must dispatch by positive runtime marker rather than pretending one trace
  schema exists;
- progress event wording is user-visible enough to affect hosts and release
  examples;
- evidence progress is currently v1-only because it reads report bodies from
  `step.report_written` entries;
- fanout/sub-run progress has v2-specific branch semantics.

## Recommended Ownership Target

Long term, split by product contract rather than by old namespace:

```text
src/run-status/
  project-run-folder.ts        # neutral public dispatcher for runs show
  v1.ts                        # v1 retained trace/status projection
  v2.ts                        # v2 trace/status projection

src/progress/
  output.ts                    # already src/shared/progress-output.ts
  v1-trace-projector.ts        # current runtime progress projector behavior
  v2-trace-projector.ts        # current core-v2 progress projector behavior, if moved later

src/runtime/
  trace-reader.ts
  trace-writer.ts
  reducer.ts
  snapshot-writer.ts
  append-and-derive.ts
```

Do not move the v1 trace/reducer/snapshot files first. They remain tied to
retained fallback and checkpoint resume.

## Recommended Next Code Slice

The safest next implementation slice is:

```text
Move only the public run-status dispatcher to a neutral module.
```

Suggested shape:

```text
src/shared/run-status-projection.ts
```

or, if the repo wants a dedicated namespace:

```text
src/run-status/project-run-folder.ts
```

The first slice should:

- move only `projectRunStatusFromRunFolder` and `RunStatusFolderError` as the
  public import surface;
- keep v1 internals delegated to the existing runtime module, or move the whole
  file only if the wrapper remains and tests prove identical behavior;
- update `src/cli/runs.ts` to import the neutral surface;
- keep `src/runtime/run-status-projection.ts` as a compatibility wrapper or
  retained implementation;
- not move reducer, trace reader/writer, snapshot writer, progress projector,
  or checkpoint logic.

Conservative implementation option:

```text
src/shared/run-status-projection.ts re-exports from src/runtime/run-status-projection.ts
src/cli/runs.ts imports from src/shared/run-status-projection.ts
```

That option changes dependency direction for the CLI without moving the
implementation. A later slice can split v1/v2 internals once the public import
surface is neutral.

## Required Tests For Any Status Move

Run at least:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/runner/run-status-projection.test.ts
npx vitest run tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/unit/runtime/event-log-round-trip.test.ts
npx vitest run tests/runner/fresh-run-root.test.ts
npx vitest run tests/runner/build-checkpoint-exec.test.ts
npx vitest run tests/core-v2 tests/parity
npm run test:fast
npm run check-flow-drift
npm run verify
git diff --check
```

## Required Tests Before Moving Progress Projection

Do not move progress projection in the same slice as status projection. A
progress move needs:

```text
tests/unit/runtime/progress-projector.test.ts
tests/contracts/progress-event-schema.test.ts
tests/runner/cli-v2-runtime.test.ts
tests/runner/cli-router.test.ts
tests/runner/review-runtime-wiring.test.ts
tests/release/release-infrastructure.test.ts
npm run verify
```

It should also explicitly compare or document retained/v2 differences for:

- evidence progress;
- checkpoint waiting progress;
- fanout branch progress;
- sub-run child progress;
- user input requested progress;
- route selection progress.

## Required Tests Before Moving Trace/Reducer/Snapshot

Do not move trace/reducer/snapshot code until checkpoint resume ownership is
settled. Any future move needs:

```text
tests/unit/runtime/event-log-round-trip.test.ts
tests/contracts/runtrace-schema.test.ts
tests/contracts/relay-transcript-schema.test.ts
tests/runner/runtime-smoke.test.ts
tests/runner/build-checkpoint-exec.test.ts
tests/runner/checkpoint-handler-direct.test.ts
tests/runner/fresh-run-root.test.ts
tests/runner/handler-throw-recovery.test.ts
tests/runner/agent-relay-roundtrip.test.ts
tests/runner/codex-relay-roundtrip.test.ts
npm run verify
```

## Non-Goals

Do not do any of these in the next code slice:

- route checkpoint resume through v2;
- delete or move `src/runtime/reducer.ts`;
- delete or move `src/runtime/trace-reader.ts`;
- delete or move `src/runtime/trace-writer.ts`;
- delete or move `src/runtime/snapshot-writer.ts`;
- delete or move `src/runtime/progress-projector.ts`;
- change `ProgressEvent`;
- change `RunStatusProjectionV1`;
- merge v1 and v2 trace schemas;
- remove the retained runtime fallback.

## Review Boundary

This plan is a real architecture checkpoint. It is safe to review before
touching projection modules because the next code move changes the public import
surface for `runs show`, and later moves would affect host recovery and progress
contracts.
