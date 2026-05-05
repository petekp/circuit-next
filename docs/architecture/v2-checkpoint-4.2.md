# Circuit v2 Checkpoint 4.2

## Summary

Phase 4.2 adds an explicitly opt-in v2 CLI execution path for fresh runs.

The default CLI runtime remains the old runtime. Old runtime deletion is not
approved or attempted.

## Opt-in Switch

Set:

```text
CIRCUIT_V2_RUNTIME=1
```

This routes only supported fresh runs through `runCompiledFlowV2(...)`.

## Current Scope

Supported through the opt-in CLI path:

- `review`: generated Review fixture, default v2 executors, stub relayer in
  tests.
- `fix`: fresh Fix fixture path, default v2 compose executors.
- `build`: generated Build `lite` mode, safe checkpoint auto-resolution,
  default v2 executors, stub relayer in tests.

Not routed through v2 yet:

- checkpoint resume;
- checkpoint-waiting `deep` / `tournament` modes;
- `explore`, `migrate`, and `sweep` through the CLI opt-in path.

The complex flows still have direct v2 runtime/parity coverage, but the CLI
opt-in allowlist intentionally starts narrow. Expanding it should happen with
dedicated smoke coverage for each flow.

## Context Threaded

The opt-in path passes raw generated manifest bytes into `runCompiledFlowV2`.
It also threads:

- run folder;
- run id;
- goal;
- project root;
- selected entry mode;
- selected depth;
- discovered config layers;
- injected relayer, when present;
- child flow resolver;
- review evidence policy for untracked file content.

## Safety Behavior

- Resume stays on the old runtime path.
- Checkpoint-waiting depths fail closed before v2 writes a run folder.
- Unsupported opt-in flows fail closed before v2 writes a run folder.
- Connector/config safety remains enforced inside v2 relay execution.

## Tests

Added:

- `tests/runner/cli-v2-runtime.test.ts`

The tests prove:

- Review can complete through the opt-in v2 CLI path.
- Fix can complete through the opt-in v2 CLI path with a fresh fixture.
- Build `lite` can complete through the opt-in v2 CLI path with safe checkpoint
  resolution.
- codex as an implementer connector aborts before relayer invocation.
- checkpoint-waiting depths are rejected before v2 starts.
- complex flows outside the current allowlist are rejected before v2 starts.

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

## Ready for Default CLI Routing?

No. This slice is only an opt-in routing proof. Default CLI routing should wait
until opt-in coverage expands and checkpoint/resume policy is reviewed again.
