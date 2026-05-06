# Core-v2 Checkpoint 5.48: Disjoint-Merge Discovery Failure Twin

Date: 2026-05-06

## Summary

Phase 5.48 adds a core-v2 executor-level twin for disjoint-merge changed-file
discovery failures.

No production code changed. The test proves that when every branch completes
but the changed-file backend fails, core-v2 reports the existing shared
join-policy failure reason and still cleans up branch worktrees.

## What Changed

`tests/core-v2/fanout-v2.test.ts` now runs a two-branch sub-run fanout where
both child runs complete, then `worktreeRunner.changedFiles(...)` throws.

The test asserts:

- both branch completions are recorded;
- `check.evaluated` fails with `file-disjoint validation failed`;
- the parent run aborts;
- branch worktrees are still removed.

## Proof

```bash
npx vitest run tests/core-v2/fanout-v2.test.ts
npx vitest run tests/runner/fanout-handler-direct.test.ts
npx vitest run tests/properties/visible/fanout-join-policy.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.48 does not approve:

- changing disjoint-merge semantics;
- changing retained fanout behavior;
- deleting retained fanout or old oracle tests;
- deleting old wrappers;
- retiring old public import paths;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, retained trace/checkpoint ownership
moves, or old runtime deletion.
