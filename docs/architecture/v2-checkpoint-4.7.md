# Circuit v2 Checkpoint 4.7

## Summary

Phase 4.7 is a retained-runtime inventory checkpoint.

The default selector is now enabled for matrix-supported fresh-run modes, but
old runtime deletion is still not approved. This checkpoint updates the
deletion plan from the actual repo imports and records which runtime files are
still product infrastructure, fallback behavior, shared support, or test oracle.

## Current State

Normal CLI routing is a selector:

```text
matrix-supported fresh run -> core-v2
checkpoint resume -> retained runtime
checkpoint-waiting mode -> retained runtime
unsupported flow/mode/depth -> retained runtime
arbitrary explicit fixture -> retained runtime unless strict opt-in is set
programmatic composeWriter injection -> retained runtime
```

Rollback remains available:

```text
CIRCUIT_DISABLE_V2_RUNTIME=1
```

Strict v2 opt-in remains available for force-testing supported v2 invocations:

```text
CIRCUIT_V2_RUNTIME=1
```

## Inventory Result

The retained runtime is still live for:

- checkpoint resume;
- checkpoint-waiting depths;
- unsupported public modes;
- arbitrary fixtures outside `generated/flows`;
- programmatic `composeWriter` injection;
- rollback behavior;
- old runner and handler oracle tests.

Several files under `src/runtime/` are not old execution code and should be
kept or moved instead of deleted:

- compiler and catalog derivation modules;
- registries and flow writer types;
- connector subprocess implementations;
- config loading and router support;
- run status and progress projection helpers;
- operator summary and continuity helpers.

## Files Changed

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-4.7.md`
- `docs/architecture/v2-worklog.md`

## Behavior Changed?

No runtime behavior changed in this checkpoint. This is a documentation and
review-boundary update.

## Heavy Review Boundary

The next heavy review should be a deletion-readiness review, not another
default-selector review.

Review question:

```text
Which retained runtime responsibilities are still product-owned, and which old
execution files can be deleted, moved, or narrowed without losing fallback,
resume, fixture, programmatic hook, connector, registry, status, or test
coverage?
```

Old runtime deletion remains out of scope until that review approves a narrow
deletion slice.

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
