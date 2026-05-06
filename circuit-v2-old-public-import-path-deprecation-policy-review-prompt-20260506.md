# Circuit v2 old public import-path deprecation policy review

You are reviewing `circuit-next` after Phase 5.55-5.57 of the v2 migration.

Please review the attached source/tests/docs and answer with blocking findings
first. Separate verified facts from inference and cite concrete files/symbols.

## Current migration state

Generated public fresh runs are already core-v2-routed for the current support
matrix. Retained compatibility remains live for retained/v1 checkpoint folders,
unsupported/arbitrary fixtures, custom flow roots, rollback,
`composeWriter`, old public import paths, and retained trace/progress/checkpoint
behavior.

Recent autonomous slices:

- Phase 5.55 added `src/compat/public-runtime-paths.ts`, a manifest for every
  `src/runtime/**/*.ts` path. It categorizes wrapper paths versus retained-owned
  files and marks every old path as requiring review before deletion.
- Phase 5.56 moved retained runtime internal registry imports to the neutral
  `src/flows/registries/**` owners and made wrapper import guards manifest-based.
  Old `src/runtime/registries/**` paths remain compatibility re-exports.
- Phase 5.57 moved retained handler/test imports of the pure result path helper
  to `src/shared/result-path.ts`. `src/runtime/result-writer.ts` remains the
  retained writer and the old `resultPath(...)` compatibility path.

Reported validation after Phase 5.57:

```bash
npm run verify
git diff --check
```

Both passed.

## Review goal

Decide the next real policy step for old public import paths.

Do **not** assume wrapper files are safe to delete because they are small.
The current repo intentionally proves both:

1. production code should use neutral owners; and
2. old `src/runtime/**` import paths remain compatibility surfaces.

The question is whether any category should now enter a staged deprecation or
retirement path, and if so, exactly how.

## Files to inspect first

```text
src/compat/public-runtime-paths.ts
tests/runner/public-runtime-paths.test.ts
tests/runner/retained-compat-facade.test.ts
docs/architecture/v2-checkpoint-5.55.md
docs/architecture/v2-checkpoint-5.56.md
docs/architecture/v2-checkpoint-5.57.md
docs/architecture/v2-deletion-readiness-inventory.md
docs/architecture/v2-deletion-plan.md
docs/architecture/v2-retained-runtime-boundary.md
HANDOFF.md
```

Then inspect representative wrappers and compatibility tests:

```text
src/runtime/config-loader.ts
src/runtime/manifest-snapshot-writer.ts
src/runtime/operator-summary-writer.ts
src/runtime/policy/flow-kind-policy.ts
src/runtime/relay-support.ts
src/runtime/run-relative-path.ts
src/runtime/selection-resolver.ts
src/runtime/write-capable-worker-disclosure.ts
src/runtime/terminal-verdict.ts
src/runtime/step-handlers/recovery-route.ts
src/runtime/step-handlers/shared.ts
src/runtime/step-handlers/fanout/aggregate.ts
src/runtime/step-handlers/fanout/join-policy.ts
src/runtime/connectors/*.ts
src/runtime/router.ts
src/runtime/compile-schematic-to-flow.ts
src/runtime/catalog-derivations.ts
src/runtime/registries/**/*.ts
src/runtime/run-status-projection.ts
src/runtime/result-writer.ts
tests/runner/shared-helper-compat.test.ts
tests/runner/connector-shared-compat.test.ts
tests/runner/catalog-derivations.test.ts
tests/runner/run-status-facade.test.ts
tests/runner/result-path-compat.test.ts
```

## Questions to answer

1. Are there any blocking correctness or compatibility findings in Phase
   5.55-5.57?

2. Is `src/compat/public-runtime-paths.ts` an acceptable machine-checkable
   source of truth for old runtime import-path compatibility?

3. Did Phase 5.56 correctly remove internal retained runtime dependency on old
   registry wrappers without changing behavior?

4. Did Phase 5.57 correctly keep result writer ownership unchanged while moving
   pure result-path helper imports to shared ownership?

5. Are any old `src/runtime/**` wrapper categories now ready for staged
   deprecation? If yes, name exact paths/categories and the required release
   behavior. If no, say that clearly.

6. Is runtime/import-time deprecation warning behavior appropriate for library
   wrapper modules, or should any deprecation be docs/release-note/test-only at
   first?

7. What exact next implementation slice is approved?

8. What still requires review before coding?

9. How close is old runtime deletion now, and what exact blockers remain?

## Guardrails

Unless you explicitly approve otherwise, assume the next implementation must
not change behavior.

Do not approve any of these accidentally:

```text
No wrapper deletion.
No old public import-path retirement.
No package exports change.
No import-time deprecation warnings unless explicitly approved.
No composeWriter behavior change.
No rollback behavior change.
No arbitrary fixture or custom-root routing change.
No retained/v1 checkpoint folder behavior change.
No retained trace/reducer/snapshot/progress/checkpoint implementation move.
No retained runner/handler oracle-test deletion.
No old runtime deletion.
```

## Useful answer shape

Please answer in this shape:

```text
Blocking findings
Executive verdict
Direct answers
Approved next implementation slice
What still requires review
Old runtime deletion status
```

