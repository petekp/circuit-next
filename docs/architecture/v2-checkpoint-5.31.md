# Phase 5.31 - Fanout Dynamic Expansion Failure V2 Twin

Date: 2026-05-06

## Summary

Phase 5.31 adds a core-v2 twin for retained fanout direct-handler branch
resolution failures without changing source behavior.

The retained direct handler proves that dynamic fanout aborts before branch
execution when the source report shape is wrong or resolves to zero branches.
Core-v2 already had the same behavior. This slice pins it with focused tests and
extends the proof to duplicate branch ids and `max_branches` overflow.

It does not change public runtime routing, retained/v1 checkpoint folders,
rollback, `composeWriter`, arbitrary fixture or custom-root policy, ownership
boundaries, or deletion status.

## Files Changed

- `tests/core-v2/fanout-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.31.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/core-v2/fanout-v2.test.ts` now proves dynamic fanout expansion failures:

- abort the run before `fanout.started`;
- do not call relay branches;
- do not write the fanout aggregate;
- write a `step.aborted` entry for the fanout step.

Covered expansion failures:

- `items_path` resolves to a non-array value;
- dynamic branch source resolves to an empty array;
- dynamic expansion produces a duplicate `branch_id`;
- dynamic expansion exceeds `max_branches`.

The retained fanout direct-handler test remains live in
`tests/runner/fanout-handler-direct.test.ts`. This v2 twin reduces oracle risk
but does not make the retained test obsolete while retained fallback remains
supported.

## Validation

Passed:

- `npx vitest run tests/core-v2/fanout-v2.test.ts -t "aborts before fanout start"`
- `npx vitest run tests/core-v2/fanout-v2.test.ts tests/runner/fanout-handler-direct.test.ts tests/runner/fanout-runtime.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.31 does not approve:

- public compatibility behavior changes;
- saved-folder behavior changes;
- rollback behavior changes;
- `composeWriter` behavior changes;
- arbitrary fixture or custom-root v2 default routing;
- connector/materializer movement;
- router/compiler movement;
- old runtime deletion;
- old oracle test deletion.
