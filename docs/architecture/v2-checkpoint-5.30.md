# Phase 5.30 - Sub-Run Non-Complete Verdict Admission

Date: 2026-05-06

## Summary

Phase 5.30 fixes two narrow core-v2 sub-run evidence/admission bugs and
hardens the final v2 result writer against older/custom sub-run trace entries
that do not carry admission metadata.

Before this slice, a child sub-run that returned an allowed verdict while
closing with a non-complete outcome could still mark `sub_run.completed` as
admitted. The parent run could then copy that child verdict into the final
`reports/result.json` even though the parent step aborted.

Core-v2 now admits a sub-run verdict only when the child verdict is allowed and
the child run outcome is `complete`. The final result writer also ignores
`sub_run.completed` verdicts whose `child_outcome` is not `complete`, even if
the trace entry lacks `data.admitted: false`. Core-v2 also catches invalid child
compiled-flow bytes from the resolver before `sub_run.started` and records them
as explicit check failures.

It does not change public runtime routing, retained/v1 checkpoint folders,
rollback, `composeWriter`, arbitrary fixture or custom-root policy, ownership
boundaries, or deletion status.

## Files Changed

- `src/core-v2/executors/sub-run.ts`
- `src/core-v2/run/graph-runner.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/sub-run-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.30.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Behavior

Core-v2 sub-run execution now:

- records invalid child compiled-flow bytes as `check.evaluated` failures before
  child start;
- preserves the observed child verdict in `sub_run.completed.verdict`;
- sets `sub_run.completed.data.admitted: false` when the child outcome is not
  `complete`;
- emits a failed `check.evaluated` entry for the non-complete child outcome;
- leaves the parent final result without the rejected child verdict;
- ignores non-complete sub-run verdict traces in final result selection even
  when older/custom traces do not include admission metadata.

## Proof

`tests/core-v2/sub-run-v2.test.ts` now covers:

- resolver-returned invalid child compiled-flow bytes;
- a child that returns an allowed verdict but closes as `aborted`.

`tests/core-v2/core-v2-baseline.test.ts` now covers final-result selection for
non-complete `sub_run.completed` trace entries without `data.admitted`.

The old retained sub-run oracle remains live in
`tests/runner/sub-run-handler-direct.test.ts`. This v2 twin reduces oracle risk
but does not make the retained test obsolete while retained fallback remains
supported.

## Validation

Passed:

- `npx vitest run tests/core-v2/sub-run-v2.test.ts -t "does not admit an allowed child verdict"`
- `npx vitest run tests/core-v2/sub-run-v2.test.ts -t "resolver returns invalid child flow bytes"`
- `npx vitest run tests/core-v2/sub-run-v2.test.ts`
- `npx vitest run tests/core-v2/sub-run-v2.test.ts tests/runner/sub-run-handler-direct.test.ts`
- `npx vitest run tests/core-v2/core-v2-baseline.test.ts -t "does not carry non-complete sub-run trace verdicts"`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.30 does not approve:

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
