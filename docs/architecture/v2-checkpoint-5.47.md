# Core-v2 Checkpoint 5.47: Disjoint-Merge Conflict Twin

Date: 2026-05-06

## Summary

Phase 5.47 adds a core-v2 executor-level twin for disjoint-merge file conflict
handling.

No production code changed. The shared join-policy helper already owned the
file-conflict rule; this slice proves the core-v2 fanout executor gathers
per-branch changed-file evidence, fails the join when completed branches touch
the same file, and still cleans up branch worktrees.

## What Changed

`tests/core-v2/fanout-v2.test.ts` now runs a two-branch sub-run fanout where
both child runs complete and both branch worktrees report `src/shared.ts` as
changed.

The test asserts:

- both branches complete;
- `fanout.joined` reports `policy: "disjoint-merge"`;
- `check.evaluated` fails with the file-conflict reason;
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

Phase 5.47 does not approve:

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
