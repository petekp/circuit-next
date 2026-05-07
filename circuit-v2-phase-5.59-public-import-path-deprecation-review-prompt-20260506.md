# Circuit v2 Phase 5.59 Review: Public Import-Path Deprecation Stage

Please review the included Circuit v2 migration packet.

## Review Goal

Decide whether the Phase 5.58 metadata-only soft-deprecation stage can become a
public release-note deprecation stage for the same low-risk old
`src/runtime/**` wrapper paths.

This review is not asking for wrapper deletion.

## Current State

Phase 5.55 added `src/compat/public-runtime-paths.ts` as a manifest for every
`src/runtime/**/*.ts` path.

Phase 5.58 added:

- `deprecationStage: 'soft-deprecated' | 'none'`;
- `PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS`;
- tests that lock the exact approved low-risk path list;
- tests that sensitive categories remain non-deprecated;
- tests that no import-time warning scaffolding was added;
- `docs/architecture/v2-public-runtime-import-path-policy.md` with replacement
  owner paths and draft release-note wording.

Reported Phase 5.58 validation passed:

```bash
npx vitest run tests/runner/public-runtime-paths.test.ts
npx vitest run tests/runner/retained-compat-facade.test.ts
npx vitest run tests/runner/shared-helper-compat.test.ts
npx vitest run tests/runner/catalog-derivations.test.ts
npx vitest run tests/runner/connector-shared-compat.test.ts
npx vitest run tests/runner/run-status-facade.test.ts
npx vitest run tests/runner/result-path-compat.test.ts
npx vitest run tests/runner/fanout-aggregate-compat.test.ts
npx vitest run tests/runner/json-report-compat.test.ts
npx vitest run tests/runner/recovery-route-compat.test.ts
npx vitest run tests/runner/terminal-verdict-helper.test.ts
npx vitest run tests/properties/visible/fanout-join-policy.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

## Paths Currently Soft-Deprecated

Only these old import paths are currently marked `soft-deprecated`:

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
src/runtime/compile-schematic-to-flow.ts
src/runtime/router.ts
```

These are shared-helper wrappers or flow-authoring wrappers with neutral owners
under `src/shared/**` or `src/flows/**`.

## Not in Scope for Deprecation

These categories remain non-deprecated:

```text
connector wrappers
catalog and registry wrappers
run-status wrapper
result-writer
public runner surface
retained handlers
retained trace/reducer/snapshot/progress/checkpoint files
retained/v1 saved-state support
```

## Proposed Next Slice

If approved, Phase 5.59 should make the soft-deprecated path list public in a
release-note/deprecation artifact while keeping runtime behavior unchanged.

Likely implementation shape:

- keep all wrapper files;
- keep old paths import-compatible;
- keep package exports unchanged;
- keep no-warning behavior;
- add or update a release-note/deprecation artifact that says new code should
  prefer the listed neutral owner paths;
- add tests that the release-note artifact covers exactly
  `PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS`;
- keep tests proving connector, registry, run-status, result-writer, public
  runner, retained handler, and retained saved-state paths are not deprecated.

Possible manifest wording options:

```text
Option A: keep deprecationStage: 'soft-deprecated' and add release-note proof.
Option B: add deprecationStage: 'release-note-deprecated' for the same 15 paths.
```

Please recommend which is clearer and safer.

## Direct Review Questions

1. Are there any blocking correctness or compatibility findings in the Phase
   5.58 manifest, policy note, or tests?
2. Is it safe to promote the existing 15 `soft-deprecated` paths to a public
   release-note deprecation stage without changing runtime behavior?
3. Should the implementation keep the existing `soft-deprecated` stage name or
   add a new `release-note-deprecated` stage?
4. Should import-time or runtime deprecation warnings remain prohibited for this
   next slice?
5. Should package exports remain unchanged?
6. Are any additional old `src/runtime/**` paths safe to deprecate now, or
   should the exact list remain fixed?
7. Are any old wrapper files safe to delete now?
8. What exact implementation slice is approved next, and what tests/validation
   are required?
9. What still requires review before coding?
10. How close is old runtime deletion after this stage?

## Guardrails

Do not approve any of these unless you explicitly intend a larger public
compatibility change:

```text
No wrapper deletion.
No old public import-path retirement.
No package exports change unless explicitly approved.
No import-time/runtime warnings unless explicitly approved.
No connector wrapper deprecation.
No registry/catalog wrapper deprecation.
No run-status wrapper deprecation.
No result-writer deprecation.
No public runner surface deprecation.
No retained handler/trace/checkpoint/saved-state deprecation.
No composeWriter behavior change.
No rollback behavior change.
No arbitrary fixture or custom-root routing change.
No retained/v1 checkpoint folder behavior change.
No retained trace/reducer/snapshot/progress/checkpoint implementation move.
No retained runner/handler oracle-test deletion.
No old runtime deletion.
```

## Files Included

The packet includes the manifest, relevant tests, policy docs, deletion docs,
handoff, build/package visibility files, and representative old wrapper/owner
files for the currently soft-deprecated paths.
