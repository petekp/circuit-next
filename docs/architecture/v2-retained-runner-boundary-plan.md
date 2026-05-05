# Circuit v2 Retained Runner Boundary Plan

Phase 4.38 maps the responsibilities still inside `src/runtime/runner.ts`
after the retained checkpoint resume preparation extraction.

This is a planning slice. It does not move code. It does not delete old runtime
files. It does not route checkpoint resume through core-v2.

## Current State

`src/runtime/checkpoint-resume.ts` now owns retained resume preparation:

- manifest byte verification and flow parsing;
- manifest/trace identity checks;
- waiting checkpoint discovery;
- checkpoint request validation;
- checkpoint report resume validation;
- original project root and selection config restoration data.

`src/runtime/runner.ts` still owns the retained execution path:

- `runCompiledFlow(...)`;
- `resumeCompiledFlowCheckpoint(...)` as the public resume wrapper;
- `executeCompiledFlow(...)`;
- fresh run bootstrap;
- trace sequence assignment;
- step dispatch;
- route walking;
- checkpoint waiting return;
- result writing and close progress;
- recursive child-run defaults.

## Responsibility Map

| Responsibility | Current owner | Product behavior | Dependencies | Tests proving behavior | Can move now? | Risk | Recommended action |
|---|---|---|---|---|---|---|---|
| Fresh run folder claim | `runner.ts` (`claimFreshRunFolder`, `releaseFreshRunFolderClaim`) | Rejects reused/non-empty/symlink run folders before bootstrap writes. | `fs`, `traceEntryLogPath` | `tests/runner/fresh-run-root.test.ts`, full CLI tests | Not yet | High | Keep. It is part of fresh-run safety and retry behavior. |
| Run folder initialization | `runner.ts` (`initRunFolder`) | Creates run folder and trace directory for retained runs and tests. | `traceEntryLogPath` | event-log round-trip tests, connector roundtrip tests | Maybe later | Low-medium | Move only with a broader trace IO helper plan. |
| Manifest snapshot writing | `runner.ts` (`bootstrapRun`) plus shared manifest helper | Writes retained manifest snapshot and initial trace. | `writeManifestSnapshot`, `appendTraceEntry`, `writeDerivedSnapshot` | event-log round-trip tests, fresh-run-root tests, run-status tests | Not now | High | Keep. It sits on the same boundary as v1 trace bootstrap and state derivation. |
| Bootstrap trace construction | `executeCompiledFlow(...)` | Creates `run.bootstrapped` for fresh retained runs and computes manifest hash from raw flow bytes. | `computeManifestHash`, `TraceEntry`, `CompiledFlow` | runtrace schema tests, runtime smoke, CLI fallback tests | Not now | High | Keep. Bootstrap and trace identity are sensitive. |
| Entry mode and depth selection | `runner.ts` (`selectEntryMode`) | Chooses retained entry mode and effective depth. | `CompiledFlow` | CLI router tests, runtime wiring tests | Maybe later | Medium | Keep until retained fallback mode ownership changes. |
| Depth-bound relay selection | `executeCompiledFlow(...)` | Adds execution depth to relay selection for flows that opt into it. | `relay-selection.ts`, config layers | config-loader tests, build runtime wiring, relay provenance tests | Not now | High | Keep. This is retained relay decision behavior. |
| Run-start progress | `executeCompiledFlow(...)` | Emits retained `run.started` and initial task-list progress. | `progress-projector.ts`, shared disclosure helper | progress projector tests, progress schema tests, CLI v2 progress tests | Not now | High | Keep. Retained progress remains a separate boundary. |
| Trace sequence authority | `executeCompiledFlow(...)` local `push(...)` | Assigns sequence numbers, appends trace entries, derives snapshots, and projects progress from each trace entry. | `appendAndDerive`, `projectTraceEntryToProgress`, `RunState` | push-sequence tests, runtrace schema tests, event-log round-trip tests | No | Very high | Keep. Do not split sequence assignment from the execution loop casually. |
| Step dispatch | `executeCompiledFlow(...)` calls `runStepHandler(...)` | Delegates retained step execution to old handlers. | `step-handlers/index.ts`, handler support types | direct handler tests, runtime wiring tests | No | High | Keep until handler ownership changes. |
| Route handling | `executeCompiledFlow(...)` | Advances routes, detects cycles, limits recovery attempts, admits terminal routes. | route constants, step completion counts | terminal outcome tests, pass-route cycle tests, check-evaluation tests | No | High | Keep. This is the retained graph execution loop. |
| Recovery route handling | `executeCompiledFlow(...)` | Allows bounded retry/revise and aborts exhausted or cyclic routes. | `RECOVERY_ROUTE_LABELS`, `maxAttemptsForRoute` | check-evaluation tests, handler throw recovery tests | No | High | Keep with route handling. |
| Handler exception normalization | `executeCompiledFlow(...)` | Converts unexpected handler throws into `step.aborted`, `run.closed`, and `result.json` except path-escape errors. | `isRunRelativePathError`, `push(...)`, result writer | handler-throw-recovery tests, run-relative path tests | Not now | High | Keep. It depends on trace sequence and close behavior. |
| Checkpoint waiting return | `executeCompiledFlow(...)` | Emits checkpoint progress, user-input progress, derives snapshot, and returns `checkpoint_waiting` without `run.closed`. | progress projector, `writeDerivedSnapshot`, checkpoint UI helpers | build checkpoint tests, run-status tests, progress tests | Not now | High | Keep. It is still retained checkpoint product behavior. |
| Checkpoint resume wrapper | `resumeCompiledFlowCheckpoint(...)` in `runner.ts` | Calls `prepareCheckpointResume(...)` and resumes through the retained execution loop. | `checkpoint-resume.ts`, `executeCompiledFlow(...)` | build checkpoint resume tests | Not now | Medium-high | Keep. The wrapper is the stable public API. |
| Sub-run/fanout child runner default | `executeCompiledFlow(...)` passes `childRunner: ctx.childRunner ?? runCompiledFlow` | Retained sub-run/fanout recursion uses real retained runner when no stub is injected. | `runCompiledFlow`, sub-run/fanout handlers | sub-run real recursion, fanout real recursion | No | High | Keep until child execution ownership changes. |
| Compose writer fallback | `runner.ts` (`writeComposeReport`, `writePrototypeComposeReport`) | Retained compose/report writing and test hook. | compose/close registries, report writers | report writer tests, registry tests, release proof script | Maybe later | Medium | Do not move in runner loop slice. It needs a report-writer ownership slice. |
| Close/result finalization | `executeCompiledFlow(...)` tail | Appends `run.closed`, derives terminal verdict, writes retained `reports/result.json`, emits close progress, derives final snapshot. | `writeResult`, `resultPath`, `deriveTerminalVerdict`, progress helpers, `writeDerivedSnapshot` | terminal verdict tests, terminal outcome tests, result writer tests, runtime wiring tests | Maybe, with plan | Medium-high | Keep. Phase 4.40 approved C0 for the close tail. |
| Terminal verdict derivation | `src/runtime/terminal-verdict.ts` (`deriveTerminalVerdict`) | Surfaces latest admitted result verdict into `result.json`. | trace entries, check evaluation entries | terminal-verdict helper and derivation tests, migrate runtime wiring | Done | Low | Phase 4.41 extracted only this pure helper. |

## Public Export Surface

`src/runtime/runner.ts` still exports:

- `runCompiledFlow(...)`;
- `resumeCompiledFlowCheckpoint(...)`;
- `writeComposeReport(...)`;
- `writePrototypeComposeReport(...)`;
- `bootstrapRun(...)`;
- `initRunFolder(...)`;
- `claimFreshRunFolder(...)`;
- `releaseFreshRunFolderClaim(...)`;
- `appendAndDerive` as a compatibility re-export;
- retained runtime types from `runner-types.ts`.

Current direct consumers include:

- `src/cli/circuit.ts` for retained fallback and checkpoint resume;
- `scripts/release/capture-golden-run-proofs.mjs` for `writeComposeReport`;
- connector roundtrip tests for `bootstrapRun` / `appendAndDerive`;
- event-log tests for `initRunFolder`, `bootstrapRun`, and `appendAndDerive`;
- many retained runner and handler tests for `runCompiledFlow`;
- checkpoint tests for `resumeCompiledFlowCheckpoint`;
- type-only imports in CLI and contract tests.

## Further Shrink Options

### A. Stop shrinking runner for now

This keeps the retained execution loop intact after the useful checkpoint resume
preparation extraction.

Pros:

- avoids splitting trace sequence authority;
- avoids moving progress side effects;
- avoids changing close/result semantics;
- avoids destabilizing retained fallback behavior while v2 remains the default
  only for matrix-supported fresh runs.

Cons:

- `runner.ts` remains large;
- close/result behavior, progress behavior, and route walking stay colocated.

### B. Extract bootstrap / manifest setup

This would move fresh run bootstrap out of `runner.ts`.

Pros:

- could reduce some file-system setup code.

Cons:

- bootstrap writes manifest snapshot, trace entry, and derived snapshot together;
- fresh folder claim/release is sensitive;
- trace identity and reuse rejection are easy to regress.

Recommendation: do not do this next.

### C. Extract close / result finalization

This would move the tail of `executeCompiledFlow(...)` into a retained
close/finalization helper.

Pros:

- narrower than route walking;
- result writing is already a named boundary;
- terminal verdict derivation has focused tests.

Cons:

- close finalization still depends on `push(...)`, task status mutation,
  progress emission, result writing, and final snapshot derivation;
- moving it without a proof plan could change result/progress ordering.

Recommendation: possible next candidate, but only after a focused proposal.

### D. Extract progress projection side effects

This would move retained progress emission and task-list handling out of
`executeCompiledFlow(...)`.

Pros:

- could make the execution loop easier to read.

Cons:

- retained progress is still v1 trace-projection behavior;
- checkpoint waiting and close progress are operator-visible;
- progress side effects are interleaved with trace append and task state.

Recommendation: do not do this next.

### E. Defer until checkpoint resume ownership changes

This would stop retained runner narrowing until v2 owns checkpoint resume or the
team decides checkpoint resume is permanently retained.

Pros:

- avoids churn in old-runtime fallback code;
- keeps migration energy on product ownership decisions rather than file size.

Cons:

- leaves runner as the retained fallback hub longer.

Recommendation: acceptable if the next migration focus is v2 capability rather
than namespace cleanup.

## Decision

Choose **A for now**.

Do not move more code out of `src/runtime/runner.ts` immediately. Phase 4.37
already removed the clearest separable checkpoint resume preparation
responsibility. The remaining obvious candidates are riskier because they sit
inside the retained execution loop.

If the team wants one more shrink later, prepare a focused **close/result
finalization proposal** first. Do not implement that move in the same slice as
the proposal.

## Non-Goals

Do not:

- delete old runtime files;
- move `executeCompiledFlow(...)`;
- move trace reader/writer, reducer, snapshot writer, or append-and-derive;
- move progress projector internals;
- move checkpoint handler behavior;
- route checkpoint resume through core-v2;
- change default selector behavior;
- move connector subprocess modules, relay materializer, registries, router, or
  compiler infrastructure.

## Required Proof For Any Future Close/Result Move

Before moving close/result finalization, require at least:

- `tests/runner/terminal-outcome-mapping.test.ts`;
- `tests/runner/terminal-verdict-derivation.test.ts`;
- `tests/runner/handler-throw-recovery.test.ts`;
- `tests/runner/build-runtime-wiring.test.ts`;
- `tests/runner/migrate-runtime-wiring.test.ts`;
- `tests/runner/run-status-projection.test.ts`;
- `tests/unit/runtime/event-log-round-trip.test.ts`;
- `tests/unit/runtime/progress-projector.test.ts`;
- `tests/contracts/progress-event-schema.test.ts`;
- `tests/core-v2`;
- `tests/parity`;
- `npm run verify`.
