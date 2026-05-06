# Phase 5.26 - Checkpoint Auto-Resolution Failure V2 Twin

Date: 2026-05-06

## Summary

Phase 5.26 adds core-v2 coverage for checkpoint auto-resolution failures that
retained direct-handler tests already pin.

This is a test-only v2 oracle twin. The core-v2 checkpoint executor already had
the behavior; this slice proves that missing safe default and safe autonomous
choices fail with durable trace evidence and no `checkpoint.resolved` entry.

It does not change public runtime routing, retained/v1 checkpoint folders,
rollback, `composeWriter`, arbitrary fixture or custom-root policy, ownership
boundaries, or deletion status.

## Files Changed

- `tests/core-v2/control-loop-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.26.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/core-v2/control-loop-v2.test.ts` now proves that core-v2 checkpoint
auto-resolution failures:

- write the checkpoint request;
- emit `check.evaluated` with `outcome: "fail"`;
- emit `step.aborted`;
- close with a parseable aborted final result;
- do not emit `checkpoint.resolved`.

The old retained oracle remains live in
`tests/runner/checkpoint-handler-direct.test.ts`. This v2 twin reduces oracle
risk but does not make the retained test obsolete while retained fallback and
retained/v1 folders remain supported.

## Validation

Passed:

- `npx vitest run tests/core-v2/control-loop-v2.test.ts`
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/runner/checkpoint-handler-direct.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.26 does not approve:

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
