# Circuit v2 Retained Checkpoint Resume Shrink Proposal

Phase 4.36 proposes the first possible retained checkpoint resume code move.

This document does **not** implement the move. It names the exact future slice
that should be reviewed before code changes.

## Goal

Shrink `src/runtime/runner.ts` without changing product behavior by moving
checkpoint resume discovery and validation into a smaller retained module.

The future implementation should keep:

```text
src/runtime/runner.ts
  exports resumeCompiledFlowCheckpoint(...)
  owns executeCompiledFlow(...)
  owns runCompiledFlow(...)
```

and add:

```text
src/runtime/checkpoint-resume.ts
  owns manifest/trace/snapshot/request/report validation for resume
```

This is retained runtime work, not core-v2 checkpoint resume.

## Non-Goals

Do not:

- route checkpoint resume through core-v2;
- move `executeCompiledFlow(...)`;
- move `runCompiledFlow(...)`;
- move `runCheckpointStep(...)`;
- move trace reader/writer, reducer, snapshot writer, or progress projector;
- delete old runner or handler tests;
- change CLI resume output;
- change default selector behavior.

## Proposed Future File

Create:

```text
src/runtime/checkpoint-resume.ts
```

Proposed exports:

```ts
export interface PreparedCheckpointResume {
  readonly flow: CompiledFlow;
  readonly flowBytes: Buffer;
  readonly bootstrap: Extract<TraceEntry, { kind: 'run.bootstrapped' }>;
  readonly traceEntries: readonly TraceEntry[];
  readonly stepId: string;
  readonly attempt: number;
  readonly requestContext: CheckpointRequestContext;
}

export interface CheckpointRequestContext {
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly LayeredConfigValue[];
  readonly checkpointReportSha256?: string;
}

export function prepareCheckpointResume(input: {
  readonly runFolder: string;
  readonly selection: string;
}): PreparedCheckpointResume;
```

Internal helpers moved from `src/runtime/runner.ts`:

```text
flowFromManifestBytes(...)
CheckpointRequestContext
CheckpointCompiledFlowStep
readCheckpointRequestContext(...)
readCheckpointResumeReport(...)
findWaitingCheckpoint(...)
```

The new module would import retained infrastructure directly:

```text
src/runtime/manifest-snapshot-writer.ts
src/runtime/trace-reader.ts
src/runtime/snapshot-writer.ts
src/runtime/registries/checkpoint-writers/registry.ts
src/shared/run-relative-path.ts or src/runtime/run-relative-path.ts
src/shared/connector-relay.ts or src/runtime/connectors/shared.ts for sha256Hex
```

Prefer shared helper homes for already-moved helpers:

```text
src/shared/run-relative-path.ts
src/shared/connector-relay.ts
```

Retained-only dependencies remain acceptable:

```text
readRunTrace(...)
writeDerivedSnapshot(...)
findCheckpointBriefBuilder(...)
```

## Runner Changes In The Future Slice

`src/runtime/runner.ts` should keep the public export:

```ts
export async function resumeCompiledFlowCheckpoint(
  inv: CheckpointResumeInvocation,
): Promise<CompiledFlowRunResult>
```

but replace inline resume validation with:

```ts
const prepared = prepareCheckpointResume({
  runFolder: inv.runFolder,
  selection: inv.selection,
});

return executeCompiledFlow({
  runFolder: inv.runFolder,
  flow: prepared.flow,
  flowBytes: prepared.flowBytes,
  runId: prepared.bootstrap.run_id,
  goal: prepared.bootstrap.goal,
  depth: prepared.bootstrap.depth,
  change_kind: prepared.bootstrap.change_kind,
  now: inv.now,
  ...
  selectionConfigLayers: prepared.requestContext.selectionConfigLayers,
  projectRoot: prepared.requestContext.projectRoot,
  initialTraceEntries: prepared.traceEntries,
  startStepId: prepared.stepId,
  resumeCheckpoint: {
    stepId: prepared.stepId,
    attempt: prepared.attempt,
    selection: inv.selection,
  },
});
```

This preserves the current execution loop and only moves the resume
preparation boundary.

## Behavior That Must Not Change

| Behavior | Proof |
|---|---|
| manifest flow id must match saved flow bytes | `tests/runner/build-checkpoint-exec.test.ts`, run-status tests |
| manifest run id / flow id / hash must match bootstrap trace | `resumeCompiledFlowCheckpoint(...)` tests |
| run already closed is rejected | checkpoint resume tests |
| run not paused at checkpoint is rejected | checkpoint resume tests |
| missing checkpoint request is rejected | checkpoint resume tests |
| already-resolved checkpoint attempt is rejected | checkpoint resume tests |
| invalid operator choice is rejected | checkpoint resume tests |
| request hash tampering is rejected | checkpoint resume tests |
| request/report replacement together is rejected | checkpoint resume tests |
| checkpoint report hash tampering is rejected | checkpoint resume tests |
| original selection config layers are restored | checkpoint resume tests |
| original project root is restored | checkpoint resume tests |
| resume-time project root is not borrowed | checkpoint resume tests |
| post-checkpoint relay continues | checkpoint resume tests |
| post-checkpoint verification continues | checkpoint resume tests |
| CLI resume output remains retained | CLI v2 runtime tests |

## Why This Is The Smallest Useful Code Move

It removes resume validation from `runner.ts` without touching:

- the route-walking execution loop;
- old step handlers;
- checkpoint request creation;
- progress projection;
- trace append/read/reduce/snapshot;
- result writing;
- public CLI resume output.

It creates a smaller retained ownership unit but does not pretend checkpoint
resume is v2-owned.

## Risks

Risk is medium-high because checkpoint resume is crash-recovery-adjacent.

The future code slice could accidentally:

- change error messages used by tests/operators;
- lose manifest identity checks;
- validate request/report hashes in the wrong order;
- borrow resume-time config/project root;
- create a circular dependency between runner and resume helper;
- make `writeDerivedSnapshot(...)` less obviously tied to v1 trace state.

## Required Tests For The Future Code Move

Before calling the future code move done:

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

Add a focused unit test only if the extracted module exports behavior that is
not already covered through `resumeCompiledFlowCheckpoint(...)`. Prefer keeping
behavioral proof at the public resume boundary.

## Review Gate

This proposal is the point where a review is useful.

The review should answer:

```text
Is it safe to implement the first retained checkpoint resume shrink by
extracting resume discovery/validation to src/runtime/checkpoint-resume.ts
while leaving executeCompiledFlow and resumeCompiledFlowCheckpoint in runner.ts?
```

Approval of this proposal would not approve:

- old runtime deletion;
- v2 checkpoint resume;
- handler movement;
- trace/progress/reducer/snapshot movement.
