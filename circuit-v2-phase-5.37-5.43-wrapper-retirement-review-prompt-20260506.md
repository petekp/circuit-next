# Circuit v2 Phase 5.37-5.43 Review: Wrapper Retirement Boundary

You are reviewing the current `circuit-next` migration state after a behavior-preserving cleanup run. Please be strict about correctness and compatibility.

## Context

Generated public fresh runs are already routed through core-v2 by default for the current catalog. Old runtime deletion remains blocked by retained/v1 folders, public compatibility surfaces, retained fallback behavior, old public import paths, and retained oracle tests.

This packet covers the newest implementation-only slice:

- Phase 5.37: moved terminal verdict derivation to `src/shared/terminal-verdict.ts`; old `src/runtime/terminal-verdict.ts` is a compatibility re-export.
- Phase 5.38: moved fanout join-policy evaluation to `src/shared/fanout-join-policy.ts`; retained/core-v2 fanout use it; old retained path remains a wrapper.
- Phase 5.39: moved recovery route priority to `src/shared/recovery-route.ts`; retained/core-v2 use it; old retained path remains a wrapper.
- Phase 5.40: moved path-safe JSON report writing to `src/shared/json-report.ts`; retained handlers use it; old retained handler helper path remains a wrapper.
- Phase 5.41: moved fanout aggregate report body construction to `src/shared/fanout-aggregate-report.ts`; retained/core-v2 use it; old retained aggregate path remains a wrapper.
- Phase 5.42: centralized the `<no-verdict>` sentinel on `src/shared/relay-support.ts`.
- Phase 5.43: moved pure fanout dotted-path and `$item` template expansion helpers to `src/shared/fanout-branch-template.ts`; retained/core-v2 branch expansion keep their own output shapes.

These phases intentionally did **not** change public behavior, saved-state semantics, wrapper/public import compatibility, or retained fallback routing.

## Validation already run

The following passed after Phase 5.43:

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/runner/fanout-branch-template.test.ts tests/runner/fanout-handler-direct.test.ts tests/runner/fanout-runtime.test.ts tests/core-v2/fanout-v2.test.ts
npm run verify
git diff --check
```

Earlier focused checks for Phases 5.37-5.42 also passed, and the final `npm run verify` covers the full suite.

## Review goals

Please answer with:

1. Blocking findings, if any, in the Phase 5.37-5.43 implementation.
2. Whether any old `src/runtime/**` compatibility wrapper is now safe to delete.
3. If wrapper deletion is not safe, whether the next implementation should instead be:
   - old public import-path deprecation/retirement policy;
   - retained fallback package boundary;
   - retained/v1 saved-state policy;
   - more behavior-preserving shared helper cleanup;
   - v2/shared oracle twins;
   - or something else.
4. Which exact next implementation slice can proceed without another review.
5. Which exact next implementation slice requires review before coding.
6. Updated old-runtime deletion readiness and remaining blockers.

## Important constraints

Do not approve these unless you mean it explicitly:

- deleting old `src/runtime/**` wrapper files;
- retiring old public import paths;
- deprecating/removing `composeWriter`;
- adding a v2 `composeWriter` hook;
- changing rollback semantics;
- routing arbitrary fixtures or custom roots through v2 by default;
- failing closed arbitrary fixtures/custom roots;
- changing retained/v1 checkpoint folder resume/status/progress behavior;
- moving retained trace reader/writer, reducer, snapshot, progress projector, checkpoint resume, or checkpoint handler implementations;
- deleting retained runner/handler oracle tests;
- starting old runtime deletion.

If you approve more autonomous implementation, please name a concrete chunk large enough to be worth doing and list the files/tests/proof expected.

## Files to inspect first

- `HANDOFF.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-checkpoint-5.37.md`
- `docs/architecture/v2-checkpoint-5.38.md`
- `docs/architecture/v2-checkpoint-5.39.md`
- `docs/architecture/v2-checkpoint-5.40.md`
- `docs/architecture/v2-checkpoint-5.41.md`
- `docs/architecture/v2-checkpoint-5.42.md`
- `docs/architecture/v2-checkpoint-5.43.md`
- `tests/runner/retained-compat-facade.test.ts`

Then inspect the source/test files in the packet as needed.
