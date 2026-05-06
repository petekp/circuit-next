# Phase 5.28 - Relay Result Shape Edge-Case V2 Twins

Date: 2026-05-06

## Summary

Phase 5.28 adds core-v2 tests for relay result shape edge cases already pinned
by retained direct-handler tests.

This is a test-only v2 oracle twin. The shared relay result parser already had
the behavior; this slice proves core-v2 rejects array bodies, `null` bodies, and
empty verdict strings without admitting a verdict into the final result.

It does not change public runtime routing, retained/v1 checkpoint folders,
rollback, `composeWriter`, arbitrary fixture or custom-root policy, ownership
boundaries, or deletion status.

## Files Changed

- `tests/core-v2/control-loop-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.28.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/core-v2/control-loop-v2.test.ts` now proves rejected relay shape cases:

- JSON arrays;
- JSON `null`;
- empty string verdicts.

For each case core-v2:

- emits `relay.completed` with the no-verdict sentinel and
  `data.admitted: false`;
- emits `check.evaluated` with `outcome: "fail"`;
- emits `step.aborted`;
- writes a parseable aborted final result with no final verdict;
- does not emit `step.completed`.

The old retained oracle remains live in `tests/runner/relay-handler-direct.test.ts`.
This v2 twin reduces oracle risk but does not make the retained test obsolete
while retained fallback remains supported.

## Validation

Passed:

- `npx vitest run tests/core-v2/control-loop-v2.test.ts`
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/runner/relay-handler-direct.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.28 does not approve:

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
