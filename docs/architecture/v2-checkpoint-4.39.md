# Circuit v2 Checkpoint 4.39

## Summary

Phase 4.39 refreshes the old runner and handler test/inventory docs after the
Phase 4.37 checkpoint resume extraction and the Phase 4.38 retained runner
boundary plan.

No code moved. No old runtime files were deleted. Selector behavior did not
change.

## What Changed

Updated:

- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-runner-handler-current-import-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Decision

The runner and handler test map remains live.

`tests/runner/build-checkpoint-exec.test.ts` now explicitly includes the
resume manifest/trace identity failures added with the extraction. The direct
handler tests, retained runner tests, flow wiring tests, trace/snapshot tests,
and connector/materializer-adjacent tests are still product fallback or oracle
evidence.

No old runner or handler test is deletion-ready.

## Next Boundary

No deep review is needed for this docs refresh.

A deep review is warranted before any proposal to:

- move close/result finalization out of `src/runtime/runner.ts`;
- move `executeCompiledFlow(...)`;
- move trace/progress/reducer/snapshot/checkpoint handler internals;
- route checkpoint resume through `core-v2`;
- delete old runner or handler files.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/terminology-active-surface.test.ts`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
