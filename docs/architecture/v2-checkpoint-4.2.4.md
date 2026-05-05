# Circuit v2 Checkpoint 4.2.4

## Summary

Phase 4.2.4 expands the internal opt-in v2 CLI path to Migrate default fresh
runs.

The default CLI runtime remains unchanged. Old runtime deletion is not approved
or attempted.

## What Changed

The opt-in v2 CLI allowlist now includes:

- `review`
- `fix`
- `build`
- `explore`
- `migrate`

Migrate coverage is intentionally limited to the generated default flow.

## Migrate CLI Smoke

The new CLI smoke runs:

```text
CIRCUIT_V2_RUNTIME=1 circuit-next run migrate --goal ...
```

It uses the generated `generated/flows/migrate/circuit.json` manifest, default
v2 executors, a stub relayer, and the real v2 sub-run path to launch a generated
Build child run.

The test proves:

- bootstrap records `flow_id: migrate` and `depth: standard`;
- the parent run emits `sub_run.started` and `sub_run.completed`;
- the child run resolves to `flow_id: build`;
- the child run writes its own `manifest.snapshot.json`;
- the child `reports/result.json` parses through `RunResult`;
- the parent `migrate.batch@v1` report parses as the copied child result;
- `migrate.inventory@v1`, `migrate.verification@v1`, `migrate.review@v1`, and
  `migrate.result@v1` parse successfully;
- the parent `reports/result.json` parses through `RunResult`.

The test uses a temporary project root with a minimal `check` script so parent
and child verification steps exercise the command runner without invoking the
repository's full check command recursively.

## Still Rejected

Sweep remains outside the opt-in v2 CLI allowlist and fails closed before v2
creates a run folder.

## Still Deferred

- default CLI routing through v2;
- old runtime deletion;
- checkpoint pause/resume through v2;
- v2 runtime progress/status projection;
- opt-in CLI routing for Sweep;
- Explore tournament mode through v2 CLI;
- broader Migrate modes beyond generated default.

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
