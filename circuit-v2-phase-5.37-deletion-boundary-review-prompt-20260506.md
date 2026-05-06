# Circuit core-v2 Phase 5.37 review: deletion boundary and next hard move

You are reviewing the `circuit-next` core-v2 migration after several
behavior-preserving ownership and proof slices.

Please read the attached zip before answering. The goal is to decide the next
hard-to-reverse implementation move, not to produce another broad inventory.

## Current state

Generated public fresh runs are core-v2-routed for the current catalog:

```text
Review default
Fix default/lite/deep/autonomous
Build default/lite/deep/autonomous
Explore default/lite/deep/autonomous/tournament
Migrate default/deep/autonomous
Sweep default/lite/deep/autonomous
```

Recent phases moved shared infrastructure out of `src/runtime/**` while keeping
old paths as compatibility wrappers:

- Phase 5.13: registries and catalog derivations moved to `src/flows/**`.
- Phase 5.21: retained/v1 saved-folder operations were isolated behind
  `src/compat/retained-checkpoint-folders.ts`.
- Phase 5.32: connector subprocess modules and relay materialization moved to
  `src/connectors/**`.
- Phase 5.33: router and schematic compiler moved to `src/flows/router.ts` and
  `src/flows/compile-schematic-to-flow.ts`.
- Phase 5.34: retained trace/status/progress/checkpoint-state ownership was
  reviewed; no implementation move was approved, only guard/test hardening.
- Phase 5.35: retained runtime imports of already-neutral shared helpers now
  use `src/shared/**` directly, and guard tests prevent production imports of
  old helper, registry, catalog, router/compiler, and connector wrapper paths.
- Phase 5.36: added a core-v2 twin proving final result selection uses the
  later admitted relay verdict when multiple relay verdicts are admitted.

Latest validation passed:

```bash
npm run verify
git diff --check
```

## Important boundaries

Do not approve old runtime deletion casually.

Retained runtime still owns or carries:

- retained/v1 checkpoint folder resume/status/progress;
- unsupported flow/mode/depth fallback outside the generated public catalog;
- arbitrary explicit fixture fallback;
- custom flow-root fallback;
- public `main(..., { composeWriter })` compatibility;
- rollback via `CIRCUIT_DISABLE_V2_RUNTIME=1`;
- old public runtime import paths and compatibility wrappers;
- retained trace/reducer/snapshot/progress/status/result/checkpoint behavior;
- old runner/handler oracle tests.

Also: the operator wants fewer reviews. Please separate what genuinely needs a
review from what can proceed with implementation plus tests.

## Questions to answer

1. Are any old `src/runtime/**` wrapper files now safe to delete?
   - Consider registry wrappers, connector wrappers, router/compiler wrappers,
     shared-helper wrappers, and old run-status wrappers.
   - If yes, name exact files, compatibility risks, tests, and release-note needs.
   - If no, say why and do not ask for another inventory.

2. What is the next highest-leverage implementation slice?
   - It must be concrete and testable.
   - Prefer a behavior-preserving implementation if one still exists.
   - If the next slice changes public behavior or old saved-state support, say
     that review is required before implementation.

3. What should happen to the remaining public compatibility surfaces?
   - `composeWriter`
   - rollback
   - arbitrary external fixtures
   - custom flow roots
   - retained/v1 checkpoint folders
   - old public runtime import paths

   For each, choose one:

```text
keep behind compatibility
support in core-v2 with a precise contract
deprecate with release notes and tests
fail closed after approved transition
```

4. Which retained tests, if any, are now obsolete?
   - If none, say none.
   - If some are obsolete, name exact test files and the v2/shared proof that
     replaces them.

5. What should be the next review checkpoint?
   - Only name one if it is actually important.
   - Do not recommend review for import-only cleanup, guard tests, or v2 twins
     that `npm run verify` can prove.

## Desired output

Please return:

1. Executive verdict.
2. Blocking findings, if any.
3. Exact next implementation slice.
4. Files likely touched.
5. Tests and validation commands.
6. What can proceed autonomously.
7. What requires review before implementation.
8. Old runtime deletion status.

Keep it direct. Cite concrete files, symbols, and tests.
