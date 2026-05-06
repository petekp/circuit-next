# Core-v2 Checkpoint 5.39: Recovery Route Shared Helper

Date: 2026-05-06

## Summary

Phase 5.39 moves recovery route priority to neutral shared ownership.

No behavior changed. Retained relay/verification and core-v2 production
relay/verification now use the same shared route-priority helper. The old
retained runtime path remains a compatibility re-export.

## What Changed

`src/shared/recovery-route.ts` now owns `RECOVERY_ROUTE_PRIORITY`,
`RecoveryRoute`, and `recoveryRouteForStep(...)`.

`src/runtime/step-handlers/recovery-route.ts` re-exports the shared helper for
old retained import compatibility.

`src/runtime/step-handlers/relay.ts` and
`src/runtime/step-handlers/verification.ts` now import the helper from the
shared owner.

`src/core-v2/run/v1-compat.ts` keeps its `recoveryRouteForExecutableStep(...)`
adapter but delegates to the shared helper.

`tests/runner/recovery-route-compat.test.ts` proves the old retained path
points at the shared helper and that retained/core-v2 route selection preserve
the same priority.

`tests/runner/retained-compat-facade.test.ts` guards production code against
reintroducing imports from the old retained recovery-route wrapper path.

## Proof

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/runner/recovery-route-compat.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/verification-handler-direct.test.ts tests/core-v2/control-loop-v2.test.ts tests/runner/retained-compat-facade.test.ts
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.39 does not approve:

- deleting `src/runtime/step-handlers/recovery-route.ts`;
- changing recovery route priority;
- changing relay or verification recovery behavior;
- changing public compatibility behavior;
- changing retained/v1 saved-folder behavior;
- deleting retained runner or handler tests;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, or old runtime deletion.
