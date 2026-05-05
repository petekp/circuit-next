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
| status projection dispatcher | `src/run-status/project-run-folder.ts` with compatibility re-export at `src/runtime/run-status-projection.ts` | `src/cli/runs.ts`, run-status tests, v2 CLI tests | Verifies the run folder and manifest, then delegates retained v1 and marked core-v2 run folders into `RunStatusProjectionV1`. | Neutral-owned as of Phase 4.28. |
| status projection common helpers | `src/run-status/projection-common.ts` | neutral dispatcher and v1/v2 run-folder projectors | Shared invalid projection, saved-flow decoding, report paths, and step metadata. Uses shared result path helpers, not retained result-writer wrappers. | Neutral-owned as of Phase 4.29; dependency direction cleaned up in Phase 4.30.1. |
| v1 run-folder status projection | `src/run-status/v1-run-folder.ts` | neutral dispatcher, run-status tests, checkpoint status tests | Projects retained v1 trace folders, including checkpoint-waiting status. Uses shared run-relative path helpers, not retained run-relative wrappers. | Neutral-owned as of Phase 4.30, while still depending on retained v1 trace/reducer/checkpoint helper modules. |
| v1 progress projection | `src/runtime/progress-projector.ts` | retained runner, old progress tests | Converts v1 `TraceEntry` stream into `ProgressEvent`; still owns evidence progress for v1 trace. | Keep as v1 projection until retained runner shrinks. |
| shared progress output helpers | `src/shared/progress-output.ts` | retained progress projector, v2 progress projector | Safe progress callback wrapper and display truncation. | Already neutral. |
| v2 status projection | `src/core-v2/projections/status.ts` plus `src/run-status/v2-run-folder.ts` | v2 tests, `runs show` for v2 folders | Projects v2 trace state; run-folder projection is split out from the dispatcher. | Neutral v2 run-folder ownership moved in Phase 4.29. Keep in-memory core-v2 projection separate. |
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
  projection-common.ts         # shared status projection helpers
  v1-run-folder.ts             # retained v1 run-folder projection
  v2-run-folder.ts             # marked core-v2 run-folder projection
  v2.ts                        # possible later in-memory v2 status projection home

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

## Implemented Status Surface Slices

Phase 4.27 implemented the first safe slice:

```text
Move only the public run-status dispatcher import surface to a neutral module.
```

```text
src/run-status/project-run-folder.ts
```

Phase 4.28 then moved the dispatcher implementation into that neutral module
and left `src/runtime/run-status-projection.ts` as a compatibility re-export.

Phase 4.29 split shared projection helpers and the marked core-v2 run-folder
projection out from the dispatcher into:

```text
src/run-status/projection-common.ts
src/run-status/v2-run-folder.ts
```

Phase 4.30 split the retained v1 run-folder projection out from the dispatcher
into:

```text
src/run-status/v1-run-folder.ts
```

The implemented slices:

- move only `projectRunStatusFromRunFolder` and `RunStatusFolderError` as the
  public surface;
- keep v1 trace/reducer/snapshot/checkpoint helper modules in `src/runtime`;
- keep retained v1 run-folder projection in `src/run-status/v1-run-folder.ts`;
- keep marked core-v2 run-folder projection in `src/run-status/v2-run-folder.ts`;
- update `src/cli/runs.ts` to import the neutral surface;
- keep `src/runtime/run-status-projection.ts` as a compatibility wrapper;
- not move reducer, trace reader/writer, snapshot writer, progress projector,
  or checkpoint logic.

Current shape:

```text
src/run-status/project-run-folder.ts owns the dispatcher implementation
src/run-status/v1-run-folder.ts owns retained v1 run-folder projection
src/run-status/v2-run-folder.ts owns marked core-v2 run-folder projection
src/run-status/projection-common.ts owns shared status projection helpers
src/runtime/run-status-projection.ts re-exports from src/run-status/project-run-folder.ts
src/cli/runs.ts imports from src/run-status/project-run-folder.ts
```

This changes dependency direction for the CLI and public status tests without
changing projection behavior. A later slice should not move retained trace,
reducer, snapshot, progress, or checkpoint-resume code without a separate
ownership decision.

## Phase 4.27 Implementation Note

Phase 4.27 implemented the conservative option at the time:

- `src/run-status/project-run-folder.ts` is the neutral public facade;
- `src/cli/runs.ts` imports the facade;
- `src/runtime/run-status-projection.ts` remained the implementation and old
  compatibility import surface during Phase 4.27;
- no projection internals moved.

Phase 4.28 superseded that implementation placement by moving the dispatcher
body into `src/run-status/project-run-folder.ts`.

## Phase 4.28 Implementation Note

Phase 4.28 moved the status dispatcher implementation into the neutral facade:

- `src/run-status/project-run-folder.ts` owns `projectRunStatusFromRunFolder(...)`
  and `RunStatusFolderError`;
- `src/runtime/run-status-projection.ts` is now only a compatibility re-export;
- public status behavior tests import the neutral module;
- v1 trace/reducer/snapshot/checkpoint helpers remain in `src/runtime`;
- progress projection did not move.

## Phase 4.29 Implementation Note

Phase 4.29 split the status dispatcher into smaller neutral modules:

- `src/run-status/projection-common.ts` owns shared projection helpers;
- `src/run-status/v2-run-folder.ts` owns marked core-v2 run-folder projection;
- `src/run-status/project-run-folder.ts` still owns the public dispatcher and
  retained v1/checkpoint projection path;
- v1 trace/reducer/snapshot/checkpoint helpers remain in `src/runtime`;
- progress projection did not move.

## Phase 4.30 Implementation Note

Phase 4.30 split retained v1 run-folder projection into a neutral module:

- `src/run-status/v1-run-folder.ts` owns retained v1 run-folder projection and
  checkpoint-waiting status projection;
- `src/run-status/project-run-folder.ts` delegates to the v1 and v2 modules;
- v1 trace/reducer/snapshot/checkpoint helper modules remain in `src/runtime`;
- progress projection did not move.

## Phase 4.30.1 Implementation Note

Phase 4.30.1 cleaned up dependency direction inside neutral status modules:

- `src/run-status/projection-common.ts` imports `runResultPath(...)` from
  `src/shared/result-path.ts`;
- `src/run-status/v1-run-folder.ts` imports `resolveRunRelative(...)` from
  `src/shared/run-relative-path.ts`;
- neutral status modules now depend on retained runtime only for retained v1
  trace reading, reduction, and checkpoint writer validation infrastructure;
- progress projection did not move.

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
