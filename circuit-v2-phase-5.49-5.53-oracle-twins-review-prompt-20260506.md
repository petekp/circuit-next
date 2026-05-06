# Review Request: Circuit Core-v2 Phase 5.49-5.53 Oracle Twins

Please review the included Phase 5.49-5.53 slice for correctness and migration
boundary safety.

## Context

The current generated public fresh-run matrix is already routed through
core-v2 by default for the current catalog:

- Review default
- Fix default/lite/deep/autonomous
- Build default/lite/deep/autonomous
- Explore default/lite/deep/autonomous/tournament
- Migrate default/deep/autonomous
- Sweep default/lite/deep/autonomous

Old runtime deletion remains blocked by retained/v1 checkpoint folders,
arbitrary fixtures, custom flow roots, rollback, public `composeWriter`,
retained trace/progress/checkpoint/status behavior, old public import paths, and
retained oracle tests.

The approved autonomous lane was: continue v2/shared oracle twins and import
guards only. Do not change public compatibility behavior, saved-state semantics,
wrapper deletion status, retained trace/checkpoint ownership, or old runtime
deletion status.

## What Changed

### Phase 5.49: fanout join-policy executor twins

`tests/core-v2/fanout-v2.test.ts` adds core-v2 executor-level tests for:

- pick-winner success by admit order, not branch order;
- pick-winner failure when no branch has an admitted verdict;
- aggregate-only failure when a branch fails before result evidence;
- sub-run branch resolver throws.

These tests prove shared join-policy decisions are carried through trace
evidence, aggregate reports, `check.evaluated`, and final outcomes.

### Phase 5.50: sub-run report-path guard twin

`tests/core-v2/sub-run-v2.test.ts` adds a core-v2 test proving divergent
`writes.report` and `writes.result` paths abort before child start, emit
`check.evaluated` failure evidence, and do not invoke the child runner.

### Phase 5.51: fanout abort policy and sub-run preflight twins

`tests/core-v2/fanout-v2.test.ts` adds tests for:

- aggregate-only success with parseable non-admitted branch verdicts;
- abort-all short-circuiting under bounded fanout concurrency.

`tests/core-v2/sub-run-v2.test.ts` adds a missing-child-runner preflight test
that aborts before `sub_run.started`.

### Phase 5.52: relay transcript sequence twins

`tests/core-v2/control-loop-v2.test.ts` adds ordered production relay transcript
tests for:

- admitted relay checks;
- failed relay checks;
- connector throws.

These tests pin durable relay evidence ordering and file creation without
changing relay behavior.

### Phase 5.53: fanout trace sequence twin

`tests/core-v2/fanout-v2.test.ts` adds a deterministic bounded-concurrency
sub-run fanout trace sequence proof.

## Validation Reported

The following passed after the slice:

```bash
npx vitest run tests/core-v2/fanout-v2.test.ts
npx vitest run tests/core-v2/sub-run-v2.test.ts
npx vitest run tests/core-v2/control-loop-v2.test.ts
npx vitest run tests/runner/fanout-handler-direct.test.ts
npx vitest run tests/runner/sub-run-handler-direct.test.ts
npx vitest run tests/runner/relay-handler-direct.test.ts tests/runner/check-evaluation.test.ts tests/runner/relay-invocation-failure.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Latest full verify result: 131 test files passed, 1468 tests passed, 6 skipped.

## Files Included

Primary changed files:

- `tests/core-v2/fanout-v2.test.ts`
- `tests/core-v2/sub-run-v2.test.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.49.md`
- `docs/architecture/v2-checkpoint-5.50.md`
- `docs/architecture/v2-checkpoint-5.51.md`
- `docs/architecture/v2-checkpoint-5.52.md`
- `docs/architecture/v2-checkpoint-5.53.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Reference/source files:

- `src/core-v2/executors/fanout.ts`
- `src/core-v2/executors/sub-run.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/shared/fanout-join-policy.ts`
- `src/shared/fanout-aggregate-report.ts`
- `src/shared/relay-support.ts`
- `tests/runner/fanout-handler-direct.test.ts`
- `tests/runner/sub-run-handler-direct.test.ts`
- `tests/runner/relay-handler-direct.test.ts`
- `tests/runner/check-evaluation.test.ts`
- `tests/runner/relay-invocation-failure.test.ts`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-retained-runtime-boundary.md`

## Questions

1. Are there any blocking correctness findings in Phase 5.49-5.53?
2. Are these legitimate behavior-preserving v2/shared oracle twins?
3. Did this slice accidentally change or imply any change to public
   compatibility behavior, retained/v1 saved-folder semantics, wrapper
   deletion status, retained trace/checkpoint ownership, or old runtime
   deletion status?
4. Are any old retained runner/handler tests obsolete because of this slice?
5. Is the autonomous v2/shared oracle-twin lane now at diminishing returns?
6. What is the next highest-leverage checkpoint?
7. Which next steps can proceed autonomously with tests, and which require
   review before implementation?

Please answer with:

- executive verdict;
- blocking findings first, if any, with file/line references;
- non-blocking notes;
- direct answers to the seven questions;
- recommended next checkpoint;
- explicit list of what still requires review.

Important: do not recommend a review for routine docs, import guards, or tiny
test-only proof. We only want review when the next step changes public behavior,
saved-state semantics, ownership boundaries, wrapper support, or deletion
status.
