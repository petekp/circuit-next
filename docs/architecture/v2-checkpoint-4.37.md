# Circuit v2 Checkpoint 4.37

## Summary

Phase 4.37 extracts retained checkpoint resume preparation from
`src/runtime/runner.ts` into `src/runtime/checkpoint-resume.ts`.

Checkpoint resume remains retained-runtime-owned. No old runtime files were
deleted. Checkpoint resume did not move to core-v2. Selector behavior did not
change.

## What Changed

Added:

- `src/runtime/checkpoint-resume.ts`
- focused resume identity tests in `tests/runner/build-checkpoint-exec.test.ts`

Updated:

- `src/runtime/runner.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

## Boundary

`src/runtime/checkpoint-resume.ts` now owns:

- manifest byte verification and flow parsing;
- manifest/trace identity validation;
- waiting checkpoint discovery;
- checkpoint request path/hash/schema/context validation;
- checkpoint report resume validation;
- original project root and selection config restoration data.

`src/runtime/runner.ts` still owns:

- `resumeCompiledFlowCheckpoint(...)` as the public wrapper;
- `executeCompiledFlow(...)`;
- route walking, trace append after resume, result writing, and progress
  emission.

## Validation

Run for this checkpoint:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
