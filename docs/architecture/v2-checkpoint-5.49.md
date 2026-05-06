# Core-v2 Checkpoint 5.49: Fanout Join-Policy Executor Twins

Date: 2026-05-06

## Summary

Phase 5.49 adds core-v2 executor-level twins for fanout join-policy behavior.

No production code changed. The shared fanout join-policy helper already has
property coverage; this slice proves core-v2 fanout wiring carries those
decisions into trace evidence, aggregate reports, and final run outcomes.

## What Changed

`tests/core-v2/fanout-v2.test.ts` now covers:

- `pick-winner` success, including admit-order priority over branch order;
- `pick-winner` failure when no completed branch has an admitted verdict;
- `aggregate-only` failure when one branch fails before producing parseable
  result evidence;
- child flow resolver throws inside fanout sub-run branches.

The tests assert fanout join traces, `check.evaluated` evidence, aggregate
report contents, and final run outcomes.

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

Phase 5.49 does not approve:

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
