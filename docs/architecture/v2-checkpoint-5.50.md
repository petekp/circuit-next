# Core-v2 Checkpoint 5.50: Sub-Run Report Path Guard Twin

Date: 2026-05-06

## Summary

Phase 5.50 adds a core-v2 twin for the retained sub-run direct-handler guard
that rejects divergent report/result materialization paths.

No production code changed. Core-v2 already failed closed when a sub-run step
declared `writes.report` at a different path from `writes.result`; this slice
pins that behavior in the v2 executor tests.

## What Changed

`tests/core-v2/sub-run-v2.test.ts` now supports a parent fixture with an
optional `writes.report` path and adds a test proving that divergent
`writes.report` / `writes.result` paths:

- abort before `sub_run.started`;
- do not invoke the child runner;
- emit `check.evaluated` failure evidence;
- close the parent run as aborted.

## Proof

```bash
npx vitest run tests/core-v2/sub-run-v2.test.ts
npx vitest run tests/runner/sub-run-handler-direct.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.50 does not approve:

- changing sub-run materialization semantics;
- changing retained sub-run behavior;
- deleting retained sub-run or old oracle tests;
- deleting old wrappers;
- retiring old public import paths;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, retained trace/checkpoint ownership
moves, or old runtime deletion.
