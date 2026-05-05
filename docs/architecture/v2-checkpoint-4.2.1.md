# Circuit v2 Checkpoint 4.2.1

## Summary

Phase 4.2.1 strengthens the opt-in v2 CLI routing evidence from Phase 4.2.

The default CLI runtime remains the retained runtime. No old runtime files were
deleted, and `CIRCUIT_V2_RUNTIME=1` remains the only v2 CLI switch.

## What Changed

The CLI opt-in tests now cover:

- generated Fix `lite` through the v2 CLI path, using the generated
  `generated/flows/fix/lite.json` manifest;
- generated Build default/standard mode through the v2 CLI path;
- the current `--progress jsonl` behavior for opt-in v2 runs;
- CLI-level custom connector descriptor precedence, where project config
  overrides user-global config for the same custom connector name.

## Fix Smoke Shape

Generated Fix is exercised with default v2 executors and a stub relayer.

The test uses a temporary project root with a minimal `package.json` whose
`verify` script exits successfully. This keeps the smoke focused on the v2 CLI,
generated manifest, report validation, and route behavior without recursively
running the repository's full verification command inside the test suite.

The generated Fix run completes in `lite` mode. Its final Fix report is
`partial` because lite mode skips review by design.

## Progress Behavior

The opt-in v2 CLI path currently emits only the routing progress event:

```text
route.selected
```

The v2 runtime itself is not yet threaded into the old progress projection
surface. This is now explicit test coverage and remains a known blocker before
default CLI routing.

## Connector Config Evidence

The CLI-level connector test writes both:

- a user-global `local-reviewer` custom connector descriptor;
- a project `local-reviewer` custom connector descriptor.

The v2 run records the project descriptor on `relay.started`, proving the CLI
path uses the effective later-layer descriptor through v2 connector resolution.

## Scope Still Excluded

The following remain outside this checkpoint:

- default CLI routing through v2;
- old runtime deletion;
- checkpoint pause/resume through v2;
- `explore`, `migrate`, and `sweep` opt-in CLI routing.

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
