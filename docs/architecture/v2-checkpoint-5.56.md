# Core-v2 Checkpoint 5.56: Registry Wrapper Import Cleanup

Date: 2026-05-06

## Summary

Phase 5.56 removes the remaining retained runtime implementation imports of old
`src/runtime/registries/**` wrapper paths. Retained runtime code now imports the
neutral `src/flows/registries/**` owners directly.

This does not delete, deprecate, or change any old public import path. The old
runtime registry paths remain compatibility re-exports.

## What Changed

Retained implementation imports moved from `src/runtime/registries/**` wrappers
to neutral flow-owned registries in:

- `src/runtime/runner.ts`;
- `src/runtime/checkpoint-resume.ts`;
- `src/runtime/step-handlers/checkpoint.ts`;
- `src/runtime/step-handlers/verification.ts`;
- `src/runtime/step-handlers/relay.ts`;
- `src/runtime/step-handlers/fanout.ts`.

`tests/runner/retained-compat-facade.test.ts` now derives wrapper import guards
from `src/compat/public-runtime-paths.ts` instead of hand-maintained regular
expressions. The guard now catches both old absolute runtime import paths and
relative imports inside `src/runtime/**`.

`src/compat/public-runtime-paths.ts` keeps registry wrapper entries, but no
longer claims retained internal imports still depend on the catalog derivation
wrapper.

## Proof

```bash
npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/public-runtime-paths.test.ts
npx vitest run tests/runner/catalog-derivations.test.ts tests/runner/build-checkpoint-exec.test.ts tests/runner/checkpoint-handler-direct.test.ts tests/runner/verification-handler-direct.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/fanout-handler-direct.test.ts tests/runner/runtime-smoke.test.ts tests/runner/retained-compat-facade.test.ts tests/runner/public-runtime-paths.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.56 does not approve:

- deleting old `src/runtime/registries/**` wrappers;
- retiring old public import paths;
- changing package exports;
- adding deprecation warnings;
- changing registry behavior;
- changing retained fallback behavior;
- changing `composeWriter`;
- changing rollback;
- routing arbitrary fixtures or custom roots through v2 by default;
- changing retained/v1 checkpoint folder behavior;
- moving retained trace/reducer/snapshot/progress/checkpoint implementations;
- deleting retained runner/handler oracle tests;
- old runtime deletion.

## Next

Continue behavior-preserving compatibility packaging and guard consolidation
autonomously. A review is still required before any old public import-path
retirement, wrapper deletion, public compatibility behavior change, saved-folder
policy change, or old runtime deletion.
