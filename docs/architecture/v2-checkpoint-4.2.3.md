# Circuit v2 Checkpoint 4.2.3

## Summary

Phase 4.2.3 expands the internal opt-in v2 CLI path to Explore default fresh
runs.

The default CLI runtime remains unchanged. Old runtime deletion is not approved
or attempted.

## What Changed

The opt-in v2 CLI allowlist now includes:

- `review`
- `fix`
- `build`
- `explore`

Explore coverage is intentionally limited to the generated default flow.
Tournament Explore still contains a checkpoint-waiting path and remains blocked
by the existing checkpoint-depth guard.

## Explore CLI Smoke

The new CLI smoke runs:

```text
CIRCUIT_V2_RUNTIME=1 circuit-next run explore --goal ...
```

It uses the generated `generated/flows/explore/circuit.json` manifest, default
v2 executors, and a stub relayer for the two relay steps.

The test proves:

- bootstrap records `flow_id: explore` and `depth: standard`;
- both relay steps run in order: `synthesize-step`, then `review-step`;
- `explore.compose@v1` parses;
- `explore.review-verdict@v1` parses;
- `explore.result@v1` parses;
- `reports/result.json` parses through `RunResult`.

## Still Rejected

Migrate and Sweep remain outside the opt-in v2 CLI allowlist. The tests assert
both fail closed before v2 creates a run folder.

## Still Deferred

- default CLI routing through v2;
- old runtime deletion;
- checkpoint pause/resume through v2;
- v2 runtime progress/status projection;
- opt-in CLI routing for Migrate and Sweep;
- Explore tournament mode through v2 CLI.

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
