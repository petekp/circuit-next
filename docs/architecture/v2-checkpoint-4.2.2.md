# Circuit v2 Checkpoint 4.2.2

## Summary

Phase 4.2.2 strengthens the internal opt-in v2 CLI route before any allowlist
expansion.

The default CLI runtime remains unchanged. Old runtime deletion is not approved
or attempted.

## What Changed

The opt-in CLI tests now prove:

- `circuit-next run fix --mode lite` resolves `generated/flows/fix/lite.json`
  without `--fixture`;
- generated Fix lite runs through default v2 executors and writes schema-valid
  reports;
- Review can run through the real custom connector bridge without an injected
  relayer;
- Explore, Migrate, and Sweep all remain rejected by the v2 CLI allowlist.

## Normal Fix Path

The generated Fix smoke no longer passes `--fixture`.

The test compares the run's `manifest.snapshot.json` bytes with
`generated/flows/fix/lite.json`, proving the normal CLI fixture resolver chose
the generated lite manifest.

The temporary project root includes a minimal `verify` script so the smoke can
exercise the generated Fix verification step without recursively running the
repository's full verification command.

## Real Custom Connector Path

The new Review smoke writes a deterministic custom connector script into a
temporary project, registers it in project config, and runs the v2 CLI path
without `options.relayer`.

The test proves:

- v2 resolves the project custom connector descriptor;
- the custom connector bridge executes;
- relay request, receipt, raw result, close report, and result files are
  materialized;
- `review.relay` and `review.result` schemas parse successfully;
- `reports/result.json` parses through `RunResult`.

## Unsupported Flows

Explore, Migrate, and Sweep are still intentionally outside the opt-in v2 CLI
allowlist. The tests assert all three fail closed before v2 creates a run
folder.

## Still Deferred

- default CLI routing through v2;
- old runtime deletion;
- checkpoint pause/resume through v2;
- v2 runtime progress/status projection;
- opt-in CLI routing for Explore, Migrate, and Sweep.

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
