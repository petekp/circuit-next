# Review Prompt: Phase 5.27 ComposeWriter Public Compatibility Decision

You are reviewing the next decision checkpoint in the `circuit-next` core-v2
migration.

## Context

Generated public fresh runs now default to core-v2 for the current catalog. Old
runtime deletion is still blocked by retained/v1 checkpoint folders, arbitrary
fixtures, custom flow roots, rollback, public `composeWriter`, old public runtime
paths, connector/materializer ownership, router/compiler ownership, and old
oracle tests.

Recent phases intentionally avoided public behavior changes:

- Phase 5.18 clarified public compatibility policy without changing defaults.
- Phase 5.20 kept `tests/runner/fix-report-writer.test.ts` as the explicit old
  public-path proof for `writeComposeReport`.
- Phase 5.22 centralized policy strings.
- Phase 5.24-5.26 added v2 oracle twins only.

The next meaningful step is deciding what to do with public
`main(..., { composeWriter })` and old compose report writer paths.

## Review Goal

Decide the safest implementation path for public `composeWriter` compatibility.

Do not give another broad migration status report. Focus on the public API and
release/deletion consequences.

## Questions To Answer

1. Is public `main(..., { composeWriter })` still intentionally supported, and
   should it remain retained-only behind `src/compat/retained-runtime.ts`?

2. Is it safe to make a behavior-preserving implementation that formalizes
   `composeWriter` as a retained compatibility surface, with no v2 equivalent
   planned?

3. Should the next implementation deprecate `composeWriter`, or should
   deprecation wait? If deprecation is recommended, specify the exact warnings,
   release notes, fail-closed behavior, and tests required.

4. Should `writeComposeReport` remain exported from `src/runtime/runner.ts` as
   an old public path for now, with
   `tests/runner/fix-report-writer.test.ts` as the explicit compatibility proof?

5. Can release proof continue to rely only on v2 executor injection, with tests
   forbidding public `composeWriter` and retained runner imports?

6. What exact code/test/doc changes are approved for the next slice, and what
   must remain unchanged?

7. Does any approved change require a zip/review follow-up after implementation,
   or can it proceed with normal tests only?

## Files Included

Primary code:

- `src/cli/circuit.ts`
- `src/cli/runtime-compatibility-policy.ts`
- `src/compat/retained-runtime.ts`
- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `scripts/release/capture-golden-run-proofs.mjs`
- `package.json`

Primary tests:

- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/release/release-infrastructure.test.ts`
- `tests/runner/fix-report-writer.test.ts`
- `tests/runner/retained-compat-facade.test.ts`

Policy and status docs:

- `HANDOFF.md`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-retained-runtime-boundary.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-checkpoint-5.18.md`
- `docs/architecture/v2-checkpoint-5.20.md`
- `docs/architecture/v2-checkpoint-5.22.md`
- `docs/architecture/v2-checkpoint-5.26.md`

## Current Validation State

Most recent validation after Phase 5.26:

- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/runner/checkpoint-handler-direct.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

All passed.

## Important Non-Goals

Do not approve in this review unless you explicitly call it out with a concrete
test/release plan:

- adding a v2 `composeWriter` hook;
- silently removing or deprecating public `composeWriter`;
- changing rollback behavior;
- routing arbitrary fixtures or custom flow roots through v2 by default;
- changing retained/v1 checkpoint folder support;
- moving connector/materializer ownership;
- moving router/compiler ownership;
- deleting old runtime files;
- deleting old oracle tests.

## Desired Output

Start with:

- `Verdict: approved`, `approved with conditions`, or `not approved`.

Then provide:

- blocking findings, if any;
- the recommended next implementation slice;
- exact files/tests likely touched;
- validation commands;
- whether another review is required after implementation.

Be concrete. Cite file paths and symbols.
