# Circuit core-v2 migration review: Phase 5.44-5.48 and next deletion-boundary decision

You are reviewing the `circuit-next` migration away from the old retained runtime.

## Context

The operator wants fewer review stops. Do not ask for another review unless the
next step is genuinely hard to reverse. Behavior-preserving test additions,
compatibility assertions, and import guard hardening should proceed with normal
validation only.

Recent approved boundary:

- Do not delete old `src/runtime/**` compatibility wrappers without review.
- Do not retire old public import paths without review.
- Do not change `composeWriter`, rollback, arbitrary fixture/custom-root
  routing, or retained/v1 checkpoint folder semantics without review.
- Retained trace reader/writer, reducer, snapshot, progress projector,
  checkpoint resume, and checkpoint handler ownership moves still require
  review.

## What changed in this packet

Review Phase 5.44-5.48:

- Phase 5.44: core-v2 final results now omit admitted verdicts on non-complete
  outcomes, matching retained/shared terminal verdict semantics.
- Phase 5.45: direct old-path compatibility assertions were added for shared
  helper wrappers.
- Phase 5.46: core-v2 fanout branch-level failure twins were added for worktree
  provisioning throws and child runner throws.
- Phase 5.47: core-v2 disjoint-merge file-conflict twin was added.
- Phase 5.48: core-v2 disjoint-merge changed-file discovery failure twin was
  added.

Validation reported after Phase 5.48:

```bash
npx vitest run tests/core-v2/fanout-v2.test.ts
npx vitest run tests/runner/fanout-handler-direct.test.ts
npx vitest run tests/properties/visible/fanout-join-policy.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

All passed.

## Files to inspect first

- `HANDOFF.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-retained-runtime-boundary.md`
- `docs/architecture/v2-checkpoint-5.44.md`
- `docs/architecture/v2-checkpoint-5.45.md`
- `docs/architecture/v2-checkpoint-5.46.md`
- `docs/architecture/v2-checkpoint-5.47.md`
- `docs/architecture/v2-checkpoint-5.48.md`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/executors/fanout.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/shared/terminal-verdict.ts`
- `src/shared/fanout-join-policy.ts`
- `src/runtime/terminal-verdict.ts`
- `src/runtime/step-handlers/fanout/join-policy.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/shared-helper-compat.test.ts`
- `tests/properties/visible/fanout-join-policy.test.ts`

## Questions to answer

1. Are there any blocking correctness findings in Phase 5.44-5.48?

2. Did any change accidentally alter public compatibility behavior, retained/v1
   saved-folder semantics, `composeWriter`, rollback, arbitrary/custom-root
   routing, connector/materializer ownership, retained trace/checkpoint
   ownership, or old runtime deletion status?

3. Are the new core-v2 fanout and terminal verdict tests legitimate v2/shared
   oracle twins, without making retained runner/handler tests obsolete?

4. Are any old `src/runtime/**` compatibility wrappers now safe to delete?
   Be strict. If deletion still requires public import-path retirement, say so.

5. What is the next highest-leverage implementation checkpoint?

   Choose one:

   - A. old public import-path retirement / wrapper deletion policy;
   - B. public compatibility disposition for `composeWriter`, rollback,
     arbitrary fixtures, and custom roots;
   - C. retained/v1 checkpoint folder migration/expiry policy;
   - D. retained trace/status/progress/checkpoint ownership move;
   - E. continue autonomous v2/shared oracle twins and import guards;
   - F. old runtime deletion readiness packet.

6. For your chosen next checkpoint, state clearly:

   - whether review is required before implementation;
   - exact files likely touched;
   - required tests;
   - what must not change.

7. Estimate how many meaningful review checkpoints remain before old runtime
   deletion can begin. Avoid counting routine test/docs/import-guard slices.

## Expected output

Lead with blocking findings. If none, say "Blocking findings: none."

Then give an executive verdict and the recommended next checkpoint.

Be explicit about what can proceed autonomously and what requires review.
