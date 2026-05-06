# Core-v2 Checkpoint 5.38: Fanout Join Policy Shared Helper

Date: 2026-05-06

## Summary

Phase 5.38 moves pure fanout join-policy evaluation to neutral shared
ownership.

No public behavior changed. Retained fanout and core-v2 fanout now call the
same shared helper, and the old retained runtime path remains a compatibility
re-export.

## What Changed

`src/shared/fanout-join-policy.ts` now owns `evaluateFanoutJoinPolicy(...)` and
its input/result types.

`src/runtime/step-handlers/fanout/join-policy.ts` re-exports the shared helper
for retained old-path compatibility.

`src/runtime/step-handlers/fanout.ts` imports the helper from the shared owner.

`src/core-v2/fanout/join-policy.ts` now adapts the v2 type names to the shared
helper instead of duplicating the join-policy decision logic.

`tests/properties/visible/fanout-join-policy.test.ts` now drives the shared
helper directly and asserts the old retained fanout export points at the same
function.

`tests/runner/retained-compat-facade.test.ts` guards production code against
reintroducing imports from the old retained fanout join-policy wrapper path.

## Proof

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/properties/visible/fanout-join-policy.test.ts tests/runner/fanout-handler-direct.test.ts tests/core-v2/fanout-v2.test.ts tests/runner/retained-compat-facade.test.ts
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.38 does not approve:

- deleting `src/runtime/step-handlers/fanout/join-policy.ts`;
- deleting retained fanout handler or runner tests;
- changing fanout join-policy semantics;
- changing fanout routing, worktree, or merge behavior;
- changing public compatibility behavior;
- changing retained/v1 saved-folder behavior;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, or old runtime deletion.
