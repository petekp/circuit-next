# Phase 5.29 - Sub-Run Child Result Failure Evidence

Date: 2026-05-06

## Summary

Phase 5.29 adds core-v2 tests for retained sub-run direct-handler failure
evidence and fixes the narrow core-v2 evidence gap those tests exposed.

Before this slice, a core-v2 child flow resolver throw surfaced as a generic
executor throw, and malformed child `result.json` files could abort before the
parent copied the child result evidence or emitted `sub_run.completed`. Core-v2
now records those failures as explicit check failures and preserves child result
evidence before aborting.

It does not change public runtime routing, retained/v1 checkpoint folders,
rollback, `composeWriter`, arbitrary fixture or custom-root policy, ownership
boundaries, or deletion status.

## Files Changed

- `src/core-v2/executors/sub-run.ts`
- `tests/core-v2/sub-run-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.29.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Behavior

Core-v2 sub-run execution now:

- catches child resolver throws before `sub_run.started`;
- emits `check.evaluated` with `outcome: "fail"` for resolver throws;
- copies the child `result.json` bytes to the parent run folder before parsing;
- emits `sub_run.completed` with `<no-verdict>` and `data.admitted: false` for
  malformed child result bodies;
- emits `check.evaluated` failure evidence for malformed child result bodies;
- leaves the parent final result without an admitted verdict.

## Proof

`tests/core-v2/sub-run-v2.test.ts` now covers:

- child resolver throws;
- invalid JSON child result bodies;
- array child result bodies.

The old retained oracle remains live in
`tests/runner/sub-run-handler-direct.test.ts`. This v2 twin reduces oracle risk
but does not make the retained test obsolete while retained fallback remains
supported.

## Validation

Passed:

- `npx vitest run tests/core-v2/sub-run-v2.test.ts`
- `npx vitest run tests/core-v2/sub-run-v2.test.ts tests/runner/sub-run-handler-direct.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.29 does not approve:

- public compatibility behavior changes;
- saved-folder behavior changes;
- rollback behavior changes;
- `composeWriter` behavior changes;
- arbitrary fixture or custom-root v2 default routing;
- connector/materializer movement;
- router/compiler movement;
- old runtime deletion;
- old oracle test deletion.

## Next

Continue autonomously only with behavior-preserving import/test cleanup or
v2/shared oracle twins.

Stop for review before changing public compatibility behavior, saved-folder
semantics, ownership boundaries, or deletion status.
