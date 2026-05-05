# Circuit v2 Checkpoint 4.41

## Summary

Phase 4.41 implements the only code move approved by the Phase 4.40 review:
extract pure terminal verdict derivation out of `src/runtime/runner.ts`.

Close/result finalization stays in `runner.ts`. No old runtime files were
deleted. `executeCompiledFlow(...)` did not move. Trace/progress/reducer/
snapshot/checkpoint handler internals did not move. Selector behavior did not
change.

## What Changed

Added:

- `src/runtime/terminal-verdict.ts`
- `tests/runner/terminal-verdict-helper.test.ts`
- `docs/architecture/v2-checkpoint-4.41.md`

Updated:

- `src/runtime/runner.ts`
- `docs/architecture/v2-close-result-finalization-proposal.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-retained-runner-boundary-plan.md`
- `docs/architecture/v2-runner-handler-current-import-inventory.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Decision

The retained close/result tail stays in `runner.ts`.

`src/runtime/terminal-verdict.ts` owns only the pure rule for deriving the
latest admitted result verdict from retained trace entries. `runner.ts` still
owns `run.closed`, retained `reports/result.json`, close progress, task-list
failure marking, and final snapshot derivation.

## Review Boundary

No additional heavy review is needed for this C1 helper extraction. The Phase
4.40 review explicitly allowed it.

Review before implementing any option that moves:

- close/result finalization;
- `executeCompiledFlow(...)`;
- retained progress close behavior;
- trace/snapshot/reducer internals;
- old runner or handler files.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/terminal-verdict-helper.test.ts tests/runner/terminal-verdict-derivation.test.ts tests/runner/terminal-outcome-mapping.test.ts`: passed.
- `npx vitest run tests/runner/handler-throw-recovery.test.ts tests/runner/fresh-run-root.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/fanout-runtime.test.ts tests/runner/migrate-runtime-wiring.test.ts tests/runner/run-status-projection.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
