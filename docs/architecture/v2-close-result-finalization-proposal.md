# Circuit v2 Close/Result Finalization Proposal

Phase 4.40 prepares the next possible retained runner shrink, but does not move
code.

The question is whether the tail of `executeCompiledFlow(...)` can be extracted
without changing retained run-close behavior.

## Current Owner

`src/runtime/runner.ts` owns retained close/result finalization today.

Phase 4.41 extracted only the pure terminal admitted verdict helper to
`src/runtime/terminal-verdict.ts`. The close tail still lives in
`runner.ts`.

The close tail starts after route walking has ended. It currently:

1. records `closedAt`;
2. creates and pushes `run.closed`;
3. derives the terminal admitted verdict;
4. writes retained `reports/result.json`;
5. emits failed checklist progress on abort;
6. emits `run.aborted` or `run.completed` progress;
7. derives the final retained snapshot;
8. returns `CompiledFlowRunResult`.

This is more than a result writer call. It is part of the retained execution
loop's trace/progress/snapshot contract.

## Current Dependencies

| Behavior | Current dependency | Why it matters |
|---|---|---|
| `run.closed` append | runner-local `push(...)` | `push(...)` is the retained trace sequence authority and also calls `appendAndDerive(...)` plus progress projection. |
| terminal verdict | `deriveTerminalVerdict(...)` from `src/runtime/terminal-verdict.ts` | Reads retained trace entries and admits only the latest passed `result_verdict` relay/sub-run verdict on complete runs. |
| universal result | `writeResult(...)` from `src/runtime/result-writer.ts` | Parses through `RunResult` and writes retained `reports/result.json`. |
| result path progress | `resultPath(...)` from `src/runtime/result-writer.ts` | Keeps old runtime compatibility while shared path ownership lives in `src/shared/result-path.ts`. |
| close progress | `reportProgress(...)`, `progressDisplay(...)`, task-list helpers | User-visible progress JSONL must match retained behavior. |
| final snapshot | `writeDerivedSnapshot(...)` | Re-derives retained state after close and returns the definitive snapshot. |

## User-Visible Contract

Retained close/result finalization must preserve:

- exactly one terminal `run.closed`;
- no trace entries after `run.closed`;
- `reports/result.json` exists for closed runs;
- `reports/result.json` does not exist for `checkpoint_waiting`;
- result `outcome` matches `run.closed.outcome`;
- result `reason` mirrors close reason when present;
- result `verdict` is omitted on aborted runs;
- result `verdict` is the latest admitted result verdict on complete runs;
- progress emits `run.completed` or `run.aborted` with the result path;
- abort close marks in-progress tasks failed before emitting close progress;
- final returned snapshot reflects the closed state.

## Options

| Option | Description | Risk | Recommendation |
|---|---|---|---|
| C0 | Stop. Keep close/result finalization in `runner.ts`. | Low | Good default while retained runner still owns fallback execution. |
| C1 | Extract only pure terminal verdict derivation to a retained helper module. | Low-medium | Implemented in Phase 4.41 without moving close/result finalization. |
| C2 | Extract the whole retained close/result finalization tail to `src/runtime/run-close.ts`. | Medium-high | Only after focused review. It touches trace sequence, progress, result, and snapshot behavior at once. |
| C3 | Merge retained and v2 result finalization. | High | Do not do this now. v2 and retained summaries, file-store semantics, and checkpoint ownership still differ. |

## Proposed Shape If C2 Is Approved Later

Do not move `executeCompiledFlow(...)`.

Create:

```text
src/runtime/run-close.ts
```

Export a narrow retained-only helper, for example:

```ts
finalizeRetainedRunClose(input): CompiledFlowRunResult
```

The helper would accept the runner-local state it needs, including:

- `runFolder`;
- `flow`;
- `runId`;
- `goal`;
- `manifestHash`;
- `runOutcome`;
- `closeReason`;
- `closedAt`;
- `trace_entries`;
- `relayResults`;
- `taskStatuses`;
- `progress`;
- the runner-local `push(...)` callback.

The helper should not import or call `executeCompiledFlow(...)`.

The helper should remain in `src/runtime/`. This is retained runtime behavior,
not a `core-v2` close implementation.

## Why C2 Needs Review

Passing `push(...)` across a module boundary is awkward but preserves sequence
authority. Recreating push-like logic inside a helper would be dangerous because
it could split:

- sequence assignment;
- disk append;
- retained snapshot derivation;
- retained progress projection.

The helper also needs task-list mutation and close progress behavior. A small
mistake could change operator-facing progress while leaving `result.json`
apparently correct.

## Tests Required Before Any C2 Move

Run at least:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/runner/runtime-smoke.test.ts
npx vitest run tests/runner/terminal-outcome-mapping.test.ts
npx vitest run tests/runner/terminal-verdict-derivation.test.ts
npx vitest run tests/runner/check-evaluation.test.ts
npx vitest run tests/runner/relay-invocation-failure.test.ts
npx vitest run tests/runner/handler-throw-recovery.test.ts
npx vitest run tests/runner/pass-route-cycle-guard.test.ts
npx vitest run tests/runner/push-sequence-authority.test.ts
npx vitest run tests/runner/build-runtime-wiring.test.ts
npx vitest run tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/unit/runtime/event-log-round-trip.test.ts
npx vitest run tests/unit/runtime/progress-projector.test.ts
npx vitest run tests/contracts/runtrace-schema.test.ts
npx vitest run tests/contracts/progress-event-schema.test.ts
npx vitest run tests/core-v2 tests/parity
npm run test:fast
npm run check-flow-drift
npm run verify
git diff --check
```

Add a focused compatibility test only if the move changes an import boundary
that is not already exercised through public runner tests.

## Non-Goals

Do not combine this with:

- moving `executeCompiledFlow(...)`;
- moving route walking;
- moving handler dispatch;
- moving checkpoint waiting behavior;
- moving retained progress projector internals;
- moving trace reader/writer, reducer, snapshot writer, or append-and-derive;
- routing checkpoint resume through `core-v2`;
- merging retained and v2 result writers;
- deleting old runner or handler tests.

## Recommendation

Choose C0 for now.

The checkpoint resume extraction already removed the clearest separable runner
responsibility. The remaining close/result tail is a real retained execution
boundary. If the team later wants more runner shrinkage, review C2 first and
keep the implementation narrowly retained-runtime-owned.

Phase 4.41 note: C1 is now complete. This does not change the C0 decision for
the close/result tail.
