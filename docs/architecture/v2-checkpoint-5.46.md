# Core-v2 Checkpoint 5.46: Fanout Branch Failure Twins

Date: 2026-05-06

## Summary

Phase 5.46 adds core-v2 oracle twins for sub-run fanout branch-level failure
paths.

No production code changed. The new tests prove core-v2 records branch-level
failures, lets sibling branches finish under `continue-others`, and aborts the
parent fanout at the disjoint-merge join with the expected failure evidence.

## What Changed

`tests/core-v2/fanout-v2.test.ts` now covers two retained direct-handler oracle
cases in the v2 graph runner:

- worktree provisioning throws for one sub-run branch;
- child runner invocation throws for one sub-run branch.

Both cases assert:

- the failed branch records `fanout.branch_completed` with
  `child_outcome: "aborted"` and `verdict: "<no-verdict>"`;
- the sibling branch can still complete with an admitted verdict;
- the fanout emits `check.evaluated` with a disjoint-merge failure reason;
- the parent run aborts cleanly.

## Proof

```bash
npx vitest run tests/core-v2/fanout-v2.test.ts
npx vitest run tests/runner/fanout-handler-direct.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.46 does not approve:

- changing fanout join semantics;
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
