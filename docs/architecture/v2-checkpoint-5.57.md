# Core-v2 Checkpoint 5.57: Result Path Helper Import Cleanup

Date: 2026-05-06

## Summary

Phase 5.57 moves remaining retained handler and test imports of the pure
`reports/result.json` path helper to the shared `src/shared/result-path.ts`
owner.

This does not merge retained and core-v2 result writers. The retained
`src/runtime/result-writer.ts` module still owns retained result writing and
keeps its old `resultPath(...)` export as a compatibility surface.

## What Changed

`src/runtime/step-handlers/sub-run.ts` and
`src/runtime/step-handlers/fanout.ts` now import `runResultPath(...)` from
`src/shared/result-path.ts` for child result discovery.

Retained tests that only needed the path helper now import the shared helper:

- `tests/runner/fanout-handler-direct.test.ts`;
- `tests/runner/fanout-runtime.test.ts`;
- `tests/runner/fresh-run-root.test.ts`;
- `tests/runner/migrate-runtime-wiring.test.ts`;
- `tests/runner/sub-run-handler-direct.test.ts`;
- `tests/runner/sub-run-runtime.test.ts`.

`tests/runner/result-path-compat.test.ts` remains the old-path compatibility
proof for `src/runtime/result-writer.ts`.

`tests/runner/retained-compat-facade.test.ts` now guards against new direct
result-path helper imports from the retained result writer outside that
compatibility proof.

## Proof

```bash
npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/result-path-compat.test.ts tests/runner/sub-run-handler-direct.test.ts tests/runner/fanout-handler-direct.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/fanout-runtime.test.ts tests/runner/migrate-runtime-wiring.test.ts tests/runner/fresh-run-root.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.57 does not approve:

- merging retained and core-v2 result writers;
- deleting `src/runtime/result-writer.ts`;
- retiring the old `resultPath(...)` public import path;
- changing result JSON schema or close/finalization behavior;
- changing retained fallback behavior;
- changing `composeWriter`;
- changing rollback;
- routing arbitrary fixtures or custom roots through v2 by default;
- changing retained/v1 checkpoint folder behavior;
- deleting retained runner/handler oracle tests;
- old runtime deletion.

## Next

Continue behavior-preserving retained compatibility packaging and import guards.
Review is still required before any old public import-path retirement, wrapper
deletion, result-writer merge, public compatibility behavior change,
saved-folder policy change, or old runtime deletion.
