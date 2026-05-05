# Circuit v2 Checkpoint 4.4

## Summary

Phase 4.4 adds a default-routing candidate selector without flipping the
production default.

The old runtime remains the normal CLI runtime. Old runtime deletion is not
approved or attempted.

## Runtime Support Matrix

The candidate selector replaces the broad flow-level v2 allowlist with a
mode/depth matrix.

Currently v2-supported fresh-run combinations are:

- `review` default at standard depth;
- `fix` lite at lite depth;
- `build` default at standard depth;
- `build` lite at lite depth;
- `explore` default at standard depth;
- `migrate` default at standard depth;
- `sweep` default at standard depth.

Strict opt-in keeps fail-closed behavior:

```text
CIRCUIT_V2_RUNTIME=1
```

The candidate selector uses a separate flag:

```text
CIRCUIT_V2_RUNTIME_CANDIDATE=1
```

Candidate behavior:

- matrix-supported fresh runs route to v2;
- unproven modes fall back to the retained runtime;
- checkpoint-waiting depths fall back to the retained checkpoint runtime;
- checkpoint resume stays on the retained runtime.

CLI JSON output now includes `runtime` and `runtime_reason` when a v2 opt-in or
candidate selector was active.

## Status Compatibility

`runs show --run-folder <v2-run> --json` now recognizes v2 trace folders.

The projection still returns the existing `run-status-v1` surface, but it can
derive status from v2 traces when the old trace reader rejects the log shape.

Coverage proves status projection for:

- completed v2 parent runs;
- aborted v2 runs;
- v2 parent runs with child run folders;
- the child v2 run folder created by a Migrate child Build run.

## Progress Compatibility

The v2 progress projector now includes fanout lifecycle events:

- `fanout.started`
- `fanout.branch_started`
- `fanout.branch_completed`
- `fanout.joined`

CLI coverage proves:

- Migrate parent and child run progress share the JSONL stream;
- a dedicated CLI fanout fixture emits fanout progress, writes a schema-valid
  aggregate report, and closes successfully.

## Still Retained By The Old Runtime

- default CLI routing;
- checkpoint pause/resume ownership;
- checkpoint-waiting depths;
- any flow/mode/depth combination outside the matrix;
- old runtime code and old handler tests.

## Validation

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
