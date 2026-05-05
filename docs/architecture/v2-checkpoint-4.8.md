# Circuit v2 Checkpoint 4.8

## Summary

Phase 4.8 is retained-runtime narrowing prep.

No runtime files are deleted. No selector behavior changes. This checkpoint
answers the retained-runtime inventory corrections from the Phase 4.7 review
and attaches a full runtime import inventory for the next deletion-readiness
review.

## Inventory Corrections

Two ownership corrections were made in `v2-deletion-plan.md`.

First, `src/runtime/selection-resolver.ts` is not just a test oracle. It is
selection precedence infrastructure used by retained runtime and transitively by
core-v2 relay through `src/runtime/relay-selection.ts`.

Second, `src/runtime/progress-projector.ts` is not only old runtime/test
infrastructure. core-v2 progress imports `progressDisplay` and `reportProgress`
from it.

## Full Import Inventory

The full inventory is checked in at:

- `docs/architecture/v2-runtime-import-inventory.md`

It records:

```text
find src/runtime -type f | sort
rg -n "from ['\"].*runtime/|../runtime|../../runtime|runtime/" src tests scripts docs specs package.json
rg -n "runCompiledFlow|resumeCompiledFlowCheckpoint|RelayFn|ProgressReporter|deriveResolvedSelection|resolveSelection" src tests scripts docs
```

The `rg` scans exclude the generated inventory file itself so the artifact does
not cite itself.

## First Narrowing Candidates

The next safe work is move/narrowing, not deletion.

Recommended order:

1. Move shared relay/progress types out of `src/runtime/runner-types.ts`.
2. Move shared progress helper functions out of `src/runtime/progress-projector.ts`.
3. Move relay selection support out of `src/runtime/relay-selection.ts` and
   `src/runtime/selection-resolver.ts`.

Each slice should be behavior-preserving and validated independently. Do not mix
these moves with old runner or step-handler deletion.

## Behavior Changed?

No runtime behavior changed.

## Deletion Status

Old runtime deletion remains out of scope.

The retained runtime still owns:

- checkpoint resume;
- checkpoint-waiting depths;
- unsupported public modes;
- arbitrary fixtures outside `generated/flows`;
- programmatic `composeWriter` injection;
- rollback behavior;
- old runner and handler oracle tests.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
