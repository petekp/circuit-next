# Core-v2 Checkpoint 5.51: Fanout Abort Policy And Sub-Run Preflight Twins

Date: 2026-05-06

## Summary

Phase 5.51 adds test-only core-v2 twins for remaining low-risk fanout and
sub-run executor edges:

- aggregate-only fanout succeeds when branches complete with parseable result
  bodies, even if one branch verdict is not admitted;
- abort-all fanout with bounded concurrency stops scheduling pending branches
  after the first failed branch;
- sub-run steps fail before `sub_run.started` when the child runner is missing.

No production code changed.

## What Changed

`tests/core-v2/fanout-v2.test.ts` now proves the v2 fanout executor carries
retained/shared join-policy decisions through aggregate reports, trace evidence,
and final outcomes for aggregate-only success and abort-all short-circuiting.

`tests/core-v2/sub-run-v2.test.ts` now proves the v2 sub-run executor emits
`check.evaluated` failure evidence and avoids child start when a resolver is
available but no child runner is supplied.

## Proof

```bash
npx vitest run tests/core-v2/fanout-v2.test.ts
npx vitest run tests/core-v2/sub-run-v2.test.ts
npx vitest run tests/runner/fanout-handler-direct.test.ts
npx vitest run tests/runner/sub-run-handler-direct.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.51 does not approve:

- changing fanout join-policy semantics;
- changing fanout abort policy;
- changing sub-run child execution semantics;
- changing retained fanout or sub-run behavior;
- deleting retained fanout/sub-run oracle tests;
- deleting old wrappers;
- retiring old public import paths;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, retained trace/checkpoint ownership
moves, or old runtime deletion.
