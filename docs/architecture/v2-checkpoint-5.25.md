# Phase 5.25 - Sub-Run Failure Evidence V2 Twin

Date: 2026-05-06

## Summary

Phase 5.25 adds core-v2 coverage for sub-run failure evidence that retained
direct-handler tests already pin.

This is a test-only v2 oracle twin. The core-v2 sub-run executor already had the
behavior; this slice proves it for the failure paths most likely to matter when
shrinking old runner/handler oracle reliance.

It does not change public runtime routing, retained/v1 checkpoint folders,
rollback, `composeWriter`, arbitrary fixture or custom-root policy, ownership
boundaries, or deletion status.

## Files Changed

- `tests/core-v2/sub-run-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.25.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/core-v2/sub-run-v2.test.ts` now proves that core-v2 sub-runs:

- fail before `sub_run.started` when the child resolver is missing;
- fail before `sub_run.started` when the resolver returns the wrong flow id;
- emit `sub_run.started`, then fail without `sub_run.completed` when the child
  runner throws;
- copy child result evidence but reject a missing child verdict with
  `sub_run.completed.data.admitted: false`.

The old retained oracle remains live in
`tests/runner/sub-run-handler-direct.test.ts`. This v2 twin reduces oracle risk
but does not make the retained test obsolete while retained fallback and
retained/v1 folders remain supported.

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

Phase 5.25 does not approve:

- public compatibility behavior changes;
- saved-folder behavior changes;
- retained/v1 checkpoint folder migration or expiry;
- status or handoff fallback widening;
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
