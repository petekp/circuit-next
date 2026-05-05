# Circuit v2 Checkpoint Resume Ownership Plan

Phase 4.32 decides what to do with checkpoint pause/resume ownership before
moving lower-level trace, progress, reducer, snapshot, runner, or handler code.

No code moves are approved by this plan.

## Current Ownership

Checkpoint resume is retained-runtime-owned today.

Current live path:

```text
src/cli/circuit.ts
  resume command
    -> resumeCompiledFlowCheckpoint(...)

src/runtime/runner.ts
  verifyManifestSnapshotBytes(runFolder)
  flowFromManifestBytes(...)
  findWaitingCheckpoint(...)
    -> readRunTrace(runFolder)
    -> writeDerivedSnapshot(runFolder)
       -> readRunTrace(runFolder)
       -> reduce(log)
    -> reject closed runs
    -> require current snapshot step to be a checkpoint
    -> find latest unresolved checkpoint.requested
    -> reject already resolved checkpoint attempts
    -> reject operator selections outside step.check.allow
    -> read and hash checkpoint request file
    -> parse request execution_context
    -> restore original project_root and selection_config_layers
    -> validate checkpoint report hash through checkpoint writer registry
  executeCompiledFlow(...)
    -> re-enter old execution loop at checkpoint step
    -> runCheckpointStep(..., isResumedCheckpoint=true)
    -> append checkpoint.resolved
    -> continue post-checkpoint route
    -> write result.json / state.json / progress / operator summary
```

The retained status path also projects waiting checkpoints through:

```text
src/run-status/v1-run-folder.ts
  -> read retained v1 trace
  -> reduce retained v1 trace
  -> validate checkpoint request/report shape
  -> expose legal_next_actions: inspect, resume
```

That status path is neutral-owned now, but it still depends on retained v1
trace/reducer/checkpoint registry behavior by design.

## Behavior That Must Be Preserved

| Behavior | Current owner | Required for v2 parity? | Can remain retained? | Current proof |
|---|---|---:|---:|---|
| deep checkpoint pause returns `checkpoint_waiting` without `run.closed` or `reports/result.json` | `runner.ts`, `step-handlers/checkpoint.ts` | Yes, if v2 owns checkpoint modes | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| `runs show` projects waiting checkpoints and legal resume actions | `src/run-status/v1-run-folder.ts` plus retained reducer/checkpoint registry | Yes, if v2 creates waiting checkpoint folders | Yes | `tests/runner/run-status-projection.test.ts` |
| CLI `resume --checkpoint-choice` routes retained | `src/cli/circuit.ts`, `runner.ts` | Yes, if v2 owns resume | Yes | `tests/runner/cli-v2-runtime.test.ts` |
| invalid checkpoint choice rejection | `findWaitingCheckpoint(...)` | Yes | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| closed run rejection | `findWaitingCheckpoint(...)` | Yes | Yes | covered by retained resume path tests and run-status invalid projections |
| missing checkpoint request rejection | `findWaitingCheckpoint(...)`, `readCheckpointRequestContext(...)` | Yes | Yes | `tests/runner/build-checkpoint-exec.test.ts`, `tests/runner/run-status-projection.test.ts` |
| tampered checkpoint request hash rejection | `readCheckpointRequestContext(...)` | Yes | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| missing checkpoint report rejection | checkpoint writer `validateResumeContext` | Yes for checkpoint reports | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| tampered checkpoint report hash rejection | checkpoint writer `validateResumeContext` | Yes for checkpoint reports | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| request and report replaced together still rejected | trace request hash plus report hash validation | Yes | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| original selection/config layers restored after resume | checkpoint request execution context | Yes | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| original project root restored after resume | checkpoint request execution context | Yes | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| resume does not borrow resume-time project root when original run had none | checkpoint request execution context | Yes | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| post-checkpoint relay continuation | retained execution loop and relay handler | Yes | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| post-checkpoint verification continuation | retained execution loop and verification handler | Yes | Yes | `tests/runner/build-checkpoint-exec.test.ts` |
| progress on resumed runs | retained runner progress hooks | Yes, if v2 owns resume | Yes | partially covered through CLI progress and progress projector tests |
| result/operator summary after resume | retained result writer and shared operator summary writer | Yes | Yes | `tests/runner/build-checkpoint-exec.test.ts`, CLI resume path |

## Option A: Implement v2 Checkpoint Pause/Resume Parity

This would make checkpoint pause/resume a core-v2 product feature.

Affected areas:

- v2 graph runner checkpoint executor;
- v2 trace schema and v2 trace store;
- v2 run-file paths for request/response/report files;
- v2 status projection for waiting checkpoints;
- v2 progress projection for `checkpoint.waiting` and user input;
- CLI resume routing;
- manifest snapshot identity checks;
- selection/config context persistence;
- checkpoint report hash validation;
- post-resume route execution;
- result and operator summary writing after resume.

Benefits:

- eventually removes the largest reason old runner and v1 trace/snapshot stack
  must stay live;
- makes deep/tournament checkpoint modes eligible for v2 after proof;
- simplifies the default selector once parity is proven.

Risks:

- high product risk: checkpoint resume is crash-recovery-adjacent;
- high trace/status risk: v2 traces are intentionally not v1 trace entries;
- high progress risk: checkpoint and user-input progress semantics are
  operator-facing;
- high test migration cost: old runner/handler tests would need either v2
  equivalents or explicit retained-oracle status.

Required proof before routing any checkpoint resume through v2:

```text
npx vitest run tests/runner/build-checkpoint-exec.test.ts
npx vitest run tests/runner/run-status-projection.test.ts
npx vitest run tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/unit/runtime/event-log-round-trip.test.ts
npx vitest run tests/unit/runtime/progress-projector.test.ts
npx vitest run tests/contracts/progress-event-schema.test.ts
npx vitest run tests/core-v2 tests/parity
npm run verify
```

This option should not be implemented as cleanup. It is a new core-v2 feature
slice.

## Option B: Retain Checkpoint Resume Behind A Smaller Retained Module

This keeps checkpoint resume retained-runtime-owned, but stops treating the
entire old runner namespace as the long-term owner.

Possible shape:

```text
src/retained-runtime/checkpoint-resume.ts
  owns resumeCompiledFlowCheckpoint(...)
  owns waiting checkpoint discovery
  owns request/report validation
  delegates to a retained execution module for post-resume continuation

src/runtime/runner.ts
  remains compatibility surface during migration
```

Benefits:

- preserves current product behavior with less risk than a v2 resume port;
- makes old runtime retention explicit instead of accidental;
- creates a narrower target for deletion review;
- lets the default selector stay conservative for checkpoint modes.

Risks:

- old execution loop and handlers still remain live for post-resume
  continuation;
- this does not by itself delete reducer, trace reader/writer, snapshot writer,
  checkpoint handler, or old runner tests;
- a premature split could create more wrappers without reducing ownership.

Required proof before any shrink:

- exact old runner/handler test classification;
- current-only import inventory for old runner and checkpoint files;
- no behavior changes in checkpoint resume tests;
- CLI resume output compatibility;
- `runs show` waiting-checkpoint compatibility.

## Option C: Defer Ownership Finalization And Classify Old Runner/Handler Tests First

This is the recommended next action.

Reason:

Checkpoint resume is entangled with old runner behavior and old direct handler
tests. Before choosing Option A or B, the team needs to know which tests are:

```text
retained product fallback
checkpoint-resume product coverage
old-runtime oracle until v2 parity
migrate to core-v2
delete only after behavior is obsolete
```

Without that classification, Option A risks under-porting behavior and Option B
risks preserving too much old runtime by accident.

## Recommendation

Do **not** implement v2 checkpoint resume next.

Do **not** move checkpoint resume into a smaller retained module yet.

Proceed with Option C:

```text
Phase 4.33 - old runner / handler test classification
```

After that classification, choose between:

```text
B. retain and shrink checkpoint resume behind a smaller retained module
A. implement v2 checkpoint resume parity as a product feature
```

Current bias: Option B is likely safer for the next implementation phase, but
it should not begin until the old runner/handler test map is explicit.

## Files Not Approved For Movement

This plan does not approve moving:

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

## Validation For This Planning Slice

Required validation:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/runner/build-checkpoint-exec.test.ts
npx vitest run tests/runner/run-status-projection.test.ts
npx vitest run tests/unit/runtime/event-log-round-trip.test.ts
npx vitest run tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/core-v2 tests/parity
npm run test:fast
npm run check-flow-drift
npm run verify
git diff --check
```
