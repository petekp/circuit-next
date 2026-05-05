# Circuit v2 Retained Progress Contract Plan

Phase 4.35 classifies retained progress ownership before moving
`src/runtime/progress-projector.ts` or adding another facade.

No code moves are approved by this plan.

## Current Ownership

Progress has three owners today:

| Surface | Owner | Responsibility |
|---|---|---|
| shared output helpers | `src/shared/progress-output.ts` | `progressDisplay(...)` and `reportProgress(...)`; swallows callback failures so progress cannot corrupt execution. |
| retained v1 trace projection | `src/runtime/progress-projector.ts` | Maps retained v1 `TraceEntry` objects into public `ProgressEvent` objects for step, relay, evidence, and task-list updates. |
| retained run-loop progress | `src/runtime/runner.ts` | Emits retained `run.started`, `checkpoint.waiting`, `user_input.requested`, `run.completed`, and `run.aborted` events around the execution loop. |
| core-v2 progress | `src/core-v2/projections/progress.ts` | Maps core-v2 trace entries into public `ProgressEvent` objects for default-routed v2 runs. |
| public schema | `src/schemas/progress-event.ts` | Defines the host-facing progress contract shared by retained and v2 paths. |

This means `src/runtime/progress-projector.ts` is not the whole retained
progress system. It is the retained v1 trace-entry projector.

## Current Import Evidence

Current product imports:

```text
src/runtime/runner.ts
  -> progressDisplay
  -> projectTraceEntryToProgress
  -> reportProgress
  -> reportTaskListProgress
  -> taskStatusesFromTrace
```

Current tests:

```text
tests/unit/runtime/progress-projector.test.ts
tests/contracts/progress-event-schema.test.ts
tests/runner/cli-v2-runtime.test.ts
```

Current v2 imports:

```text
src/core-v2/projections/progress.ts
  -> src/shared/progress-output.ts
```

core-v2 no longer imports `src/runtime/progress-projector.ts`.

## Retained Progress Events

Retained runtime still emits:

| Event | Current owner | Notes |
|---|---|---|
| `route.selected` | `src/cli/circuit.ts` | CLI routing progress, outside runner. |
| `run.started` | `src/runtime/runner.ts` | Emitted at fresh start or resume. |
| `task_list.updated` | `src/runtime/progress-projector.ts` and runner setup/close code | Initialized by runner, updated by trace projection and close behavior. |
| `step.started` | `src/runtime/progress-projector.ts` | From `step.entered`. |
| `relay.started` | `src/runtime/progress-projector.ts` | From `relay.started`. |
| `relay.completed` | `src/runtime/progress-projector.ts` | From `relay.completed`. |
| `evidence.collected` | `src/runtime/progress-projector.ts` | From `step.report_written` and report body inspection. |
| `evidence.warning` | `src/runtime/progress-projector.ts` | From report body `evidence_warnings`. |
| `step.completed` | `src/runtime/progress-projector.ts` | From `step.completed`. |
| `step.aborted` | `src/runtime/progress-projector.ts` | From `step.aborted`. |
| `checkpoint.waiting` | `src/runtime/runner.ts` | Emitted when retained checkpoint pauses. |
| `user_input.requested` | `src/runtime/runner.ts` | Emitted with resume command and checkpoint choices. |
| `run.completed` | `src/runtime/runner.ts` | Emitted at retained close. |
| `run.aborted` | `src/runtime/runner.ts` | Emitted at retained close. |

Fanout progress events are v2-owned today for the proven v2 fixture path.
Retained fanout still uses retained trace/runner behavior and old tests as
oracle coverage.

## Ownership Options

### Option A: Keep Retained Progress Projection In `src/runtime`

This is the current state.

Pros:

- no behavior risk;
- matches retained runner ownership;
- avoids adding facades that do not reduce product ownership;
- keeps checkpoint progress tied to retained resume ownership.

Cons:

- `src/runtime/progress-projector.ts` remains an old runtime namespace file;
- future reviewers must remember that shared output helpers already moved.

### Option B: Add A Neutral V1 Progress Facade

Possible shape:

```text
src/progress/v1-trace-projector.ts
  re-exports projectTraceEntryToProgress, reportTaskListProgress,
  taskStatusesFromTrace from src/runtime/progress-projector.ts
```

Pros:

- moves public import direction away from `src/runtime`;
- may make later runner shrink work easier.

Cons:

- no current non-runtime consumer needs the facade;
- creates wrapper churn without reducing checkpoint resume ownership;
- risks making retained progress look safer to move than it is.

### Option C: Move Retained V1 Progress Projector Internals

This would move `projectTraceEntryToProgress(...)` and related helpers into a
neutral module.

Pros:

- removes another implementation file from `src/runtime`;
- separates v1 progress projection from retained execution.

Cons:

- public operator-facing wording and event shape are behavior;
- retained runner still owns checkpoint/user-input/run lifecycle progress;
- the move would not reduce checkpoint resume or old runner ownership;
- test coverage would need to include retained progress and CLI progress
  together.

## Recommendation

Choose Option A for now.

Do not add a neutral v1 progress facade yet.

Do not move `src/runtime/progress-projector.ts` internals yet.

Reason:

Retained progress projection is still coupled to retained runner execution and
checkpoint pause/resume. The shared helper layer has already moved. A facade
would add indirection without reducing product ownership.

Revisit only after one of these happens:

```text
checkpoint resume ownership changes
retained runner shrinks behind a smaller module
progress consumers outside retained runtime need a neutral v1 projector import
```

## Required Proof Before Any Future Progress Move

```text
npx vitest run tests/unit/runtime/progress-projector.test.ts
npx vitest run tests/contracts/progress-event-schema.test.ts
npx vitest run tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/runner/build-checkpoint-exec.test.ts
npm run verify
```

Evidence needed:

- retained trace-to-progress events still parse as `ProgressEvent`;
- v2 progress events still parse as `ProgressEvent`;
- progress callback failures still cannot corrupt execution;
- checkpoint waiting and user-input progress remain correct;
- retained and v2 progress differences are documented as intentional.

## Non-Goals

This plan does not approve:

- moving `src/runtime/progress-projector.ts`;
- changing `ProgressEvent`;
- changing retained checkpoint progress;
- routing checkpoint resume through v2;
- deleting retained progress tests.
