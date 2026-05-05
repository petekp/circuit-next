# Circuit v2 Checkpoint 4.5

## Summary

Phase 4.5 prepares the default-routing proposal for matrix-supported fresh-run
modes only.

This slice does not switch the production default runtime. It tightens the
candidate selector and status/progress compatibility so the next review can
evaluate a default switch proposal rather than a broad runtime rewrite.

Old runtime deletion is still not approved or attempted.

## Proposed Default Selector

The proposed default behavior is a selector, not an unconditional v2 route:

```text
matrix-supported fresh run -> core-v2
checkpoint resume -> retained runtime
checkpoint-waiting mode -> retained runtime
unsupported flow/mode/depth -> retained runtime
arbitrary explicit fixture -> retained runtime unless strict opt-in is set
```

The current supported matrix remains:

- `review` default at standard depth;
- `fix` lite at lite depth;
- `build` default at standard depth;
- `build` lite at lite depth;
- `explore` default at standard depth;
- `migrate` default at standard depth;
- `sweep` default at standard depth.

Strict opt-in still means "force v2 or fail closed":

```text
CIRCUIT_V2_RUNTIME=1
```

Candidate mode means "try v2 only where the matrix and fixture policy allow it,
otherwise use the retained runtime":

```text
CIRCUIT_V2_RUNTIME_CANDIDATE=1
```

## Trace Marker

v2 bootstrap trace entries now include an explicit marker:

```json
"engine": "core-v2"
```

`runs show` v2 detection now requires that marker instead of relying on the
absence of `schema_version`.

Tests cover:

- marked v2 traces project through `runs show`;
- malformed v1 traces missing `schema_version` are not mistaken for v2;
- marked v2 traces with manifest identity mismatch project as invalid.

## Retry-Aware Open Status

`runs show` v2 open-run projection now tracks completed work by:

```text
step_id + attempt
```

instead of step id alone.

This preserves current-step projection for recovery attempts where:

```text
step.entered attempt 1
step.completed attempt 1
step.entered attempt 2
```

## Fixture Routing Policy

Candidate routing keeps arbitrary explicit fixture inputs on the retained
runtime.

Generated fixtures under `generated/flows` can still route through v2 when the
flow/mode/depth matrix matches. Arbitrary fixture experiments can use strict
opt-in:

```text
CIRCUIT_V2_RUNTIME=1
```

This prevents `--fixture` from widening the default support matrix by accident
while preserving a deliberate v2 test escape hatch.

## Fanout Progress Semantics

Fanout branch progress now carries:

```text
branch_kind: relay | sub-run
```

`child_run_id` and `worktree_path` are optional in the host-facing progress
schema. Current v2 fanout still provides them when available, but the progress
contract no longer implies every fanout branch is semantically a child run with
a worktree.

## Still Retained By The Old Runtime

- default production routing;
- checkpoint pause/resume;
- checkpoint-waiting depths;
- unsupported flow/mode/depth combinations;
- arbitrary fixture default/candidate routing;
- old runtime code and tests.

## Validation

- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
