# Phase 5.27 - Compose Writer Compatibility Policy Hardening

Date: 2026-05-06

## Summary

Phase 5.27 formalizes public `composeWriter` as retained-runtime-only
compatibility without changing runtime behavior.

The live runtime reason already kept `composeWriter` on retained compatibility
and pointed core-v2 customization to executor injection or generated reports.
This slice makes that decision harder to regress by adding an explicit policy
constant and tests that prove v2 executor injection cannot override a supplied
`composeWriter`.

It does not deprecate `composeWriter`, add a core-v2 `composeWriter` hook,
change rollback, change arbitrary fixture or custom-root routing, change
retained/v1 checkpoint folders, move ownership boundaries, or approve old
runtime deletion.

## Files Changed

- `src/cli/runtime-compatibility-policy.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-5.27.md`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`src/cli/runtime-compatibility-policy.ts` now exports
`COMPOSE_WRITER_COMPATIBILITY_POLICY`, which records the current public status:

```text
status: retained-runtime-only
runtime: retained
v2Hook: not-planned
v2Customization: executor-injection-or-generated-reports
```

`tests/runner/cli-v2-runtime.test.ts` now proves:

- the explicit policy points to the same live runtime reason used by the
  selector;
- the reason mentions executor injection and generated reports;
- the reason does not imply an equivalent v2 compose writer hook;
- a normal generated fresh run with both `composeWriter` and `v2Executors`
  remains on retained compatibility;
- strict v2 plus both `composeWriter` and `v2Executors` still fails closed before
  writing a run folder.

The existing release guard remains the proof that the golden Fix proof uses v2
executor injection and does not reintroduce public `composeWriter`.

## Validation

Passed:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak/v2-runtime-surface.test.ts`
- `npx vitest run tests/release/release-infrastructure.test.ts`
- `npx vitest run tests/runner/fix-report-writer.test.ts`
- `npx vitest run tests/runner/retained-compat-facade.test.ts`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.27 does not approve:

- `composeWriter` deprecation or removal;
- a core-v2 `composeWriter` hook;
- strict-v2 plus `composeWriter` behavior changes;
- rollback behavior changes;
- arbitrary fixture or custom-root v2 default routing;
- retained/v1 checkpoint folder behavior changes;
- connector/materializer movement;
- router/compiler movement;
- old runtime deletion;
- old oracle test deletion.

## Next

Continue autonomously only with behavior-preserving import/test cleanup or
v2/shared oracle twins.

Stop for review before changing public compatibility behavior, saved-folder
semantics, ownership boundaries, or deletion status.
