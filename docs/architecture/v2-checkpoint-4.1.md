# Circuit v2 Checkpoint 4.1

## Verdict

Checkpoint 4.1 is a production-runtime readiness checkpoint, not a deletion
checkpoint.

Do not delete the old runtime yet. Do not switch the production CLI to v2 by
default yet.

## What Changed

This slice closes the largest production-readiness gaps found during
Checkpoint 4 review:

- v2 default executors now include production-capable compose, relay,
  verification, and checkpoint bridges.
- Compose and close execution route through catalog-owned flow writers.
- Verification execution routes through catalog-owned verification writers and
  preserves project-root cwd safety.
- Checkpoint execution supports fresh-run safe default and autonomous choices.
- Relay execution resolves connector identity, threads config layers, validates
  selection compatibility, writes request/receipt/result/report surfaces, and
  can call the current connector subprocess implementations behind the v2 safety
  boundary.
- Run-file writes with schema refs now validate against the catalog-derived
  report schema registry before persisting JSON.
- Flow packages now declare non-relay report schemas through the catalog, so
  report validation stays flow-owned instead of hardcoded in v2.
- Sub-run child option typing now carries relay connector and selection config
  inputs.
- v2 status projection now covers complete, aborted, handoff, stopped, and
  escalated closed outcomes.

## Explicit Retentions

Old runtime deletion remains blocked until the production CLI switch and resume
decision are complete.

Retain for now:

- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/step-handlers/checkpoint.ts`
- `src/runtime/step-handlers/relay.ts`
- `src/runtime/step-handlers/verification.ts`
- `src/runtime/relay-selection.ts`
- `src/runtime/selection-resolver.ts`
- `src/runtime/result-writer.ts`
- old progress/status/trace projection helpers

The v2 checkpoint executor intentionally does not implement deep/tournament
pause/resume yet. Until that behavior is implemented in v2, the old
runner/checkpoint path remains the retained production path for resume.

## Evidence Added

- `tests/core-v2/core-v2-baseline.test.ts` covers schema-tagged run-file
  validation and status projection for all closed outcomes.
- `tests/core-v2/connectors-v2.test.ts` covers config-layer connector
  precedence through `resolveRelayExecutionV2`.
- `tests/core-v2/sub-run-v2.test.ts` covers relay connector/config propagation
  into child run options.
- `tests/core-v2/fanout-v2.test.ts` covers relay fanout connector safety and
  disjoint-merge preflight behavior.
- `tests/parity/*-v2.test.ts` continue to prove generated flow fixture
  conversion and simple/complex v2 graph paths.

## Commands Run

| Command | Result |
|---|---|
| `npm run check` | passed |
| `npm run lint` | passed |
| `npm run build` | passed |
| `npx vitest run tests/core-v2/core-v2-baseline.test.ts tests/core-v2/connectors-v2.test.ts tests/core-v2/sub-run-v2.test.ts tests/core-v2/fanout-v2.test.ts tests/parity` | passed |
| `npm run test:fast` | passed |
| `npm run check-flow-drift` | passed |
| `npm run verify` | passed |
| `git diff --check` | passed |

`npm run verify` covered full typecheck, lint, build, full test suite,
generated flow drift, and release infrastructure checks.

## Still Not Approved

Do not approve old runtime deletion from this checkpoint alone.

Still required before deletion:

1. Add an opt-in v2 production CLI path.
2. Run CLI smoke tests for Review, Fix, Build, Explore, Migrate, and Sweep.
3. Decide whether v2 implements checkpoint pause/resume or old checkpoint
   resume remains retained.
4. Prove CLI-visible progress and status parity.
5. Rewrite old runner/handler tests onto v2 where v2 owns the behavior.
6. Run full `npm run verify`.
7. Request deletion approval with a narrower delete list.
