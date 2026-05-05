# Circuit v2 Checkpoint 4.3

## Summary

Phase 4.3 adds CLI-visible v2 runtime progress for the internal opt-in path.

The default CLI runtime remains unchanged. Old runtime deletion is not approved
or attempted.

## What Changed

The v2 trace store now records `recorded_at` when entries are appended and can
notify an append-side projector. The v2 graph runner wires that projector when
the CLI supplies a progress reporter.

The v2 progress projector emits the current progress contract for:

- `run.started`
- `task_list.updated`
- `step.started`
- `relay.started`
- `relay.completed`
- `step.completed`
- `step.aborted`
- `run.completed`
- `run.aborted`

Child sub-runs and fanout child runs inherit the same progress reporter so
nested v2 executions are not silently detached from the CLI side channel.

## CLI Progress Evidence

The CLI opt-in progress test now runs:

```text
CIRCUIT_V2_RUNTIME=1 circuit-next run review --progress jsonl ...
```

It proves the progress stream includes both routing and runtime progress:

- `route.selected`
- `run.started`
- `task_list.updated`
- `step.started`
- `relay.started`
- `relay.completed`
- `step.completed`
- `run.completed`

The connector-safety CLI test now also runs with `--progress jsonl` and proves
unsafe connector configuration emits:

- `step.aborted`
- `run.aborted`

before the injected relay callback is invoked.

## Status Projection

The v2 status projector now accepts the top-level `run.closed.outcome` field
while still supporting the older `data.outcome` shape. This keeps status
projection compatible with the trace-contract convergence work already in
progress.

## Still Deferred

- default CLI routing through v2;
- old runtime deletion;
- checkpoint pause/resume through v2;
- checkpoint waiting and `user_input.requested` progress from v2, because
  checkpoint-waiting depths still fail closed before v2 execution;
- product approval for any progress/status differences before default routing.

## Validation

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
