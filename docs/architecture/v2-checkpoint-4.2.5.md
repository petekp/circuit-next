# Circuit v2 Checkpoint 4.2.5

## Summary

Phase 4.2.5 expands the internal opt-in v2 CLI path to Sweep default fresh
runs.

The default CLI runtime remains unchanged. Old runtime deletion is not approved
or attempted.

## What Changed

The opt-in v2 CLI allowlist now includes all current public generated flows:

- `review`
- `fix`
- `build`
- `explore`
- `migrate`
- `sweep`

This is still an internal opt-in route. It is not default routing.

## Sweep CLI Smoke

The new CLI smoke runs:

```text
CIRCUIT_V2_RUNTIME=1 circuit-next run sweep --goal ...
```

It uses the generated `generated/flows/sweep/circuit.json` manifest, default v2
executors, a stub relayer, and a temporary project root with a minimal `check`
script.

The test proves:

- bootstrap records `flow_id: sweep` and `depth: standard`;
- the checkpoint step resolves through the v2 safe-default path;
- default v2 verification executes the configured command runner;
- relay steps run in generated order: `survey-step`, `execute-step`,
  `review-step`;
- `sweep.brief@v1`, `sweep.analysis@v1`, `sweep.queue@v1`, `sweep.batch@v1`,
  `sweep.verification@v1`, `sweep.review@v1`, and `sweep.result@v1` parse
  successfully;
- `reports/result.json` parses through `RunResult`.

The generated Sweep default manifest currently has no fanout step. This
checkpoint does not claim fanout CLI parity.

## Still Rejected

The internal `runtime-proof` generated fixture remains outside the opt-in v2 CLI
allowlist and fails closed before v2 creates a run folder.

## Still Deferred

- default CLI routing through v2;
- old runtime deletion;
- checkpoint pause/resume through v2;
- v2 runtime progress/status projection;
- Explore tournament mode through v2 CLI;
- broader Migrate/Sweep modes beyond generated default fresh runs;
- fanout-oriented CLI parity, because the current generated Sweep default flow
  does not exercise fanout.

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
