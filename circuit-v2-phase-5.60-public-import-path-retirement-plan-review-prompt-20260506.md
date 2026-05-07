# Circuit v2 Phase 5.60 Review: Public Import-Path Retirement Plan

Please review the included Circuit v2 migration packet.

## Review Goal

Decide the next public compatibility step after Phase 5.59.

Phase 5.59 made the existing low-risk old `src/runtime/**` helper paths public
release-note deprecations for new imports. The old paths still work. No wrapper
was deleted. No import-time/runtime warning was added. Package exports did not
change.

This review asks what, if anything, can happen next for those same paths.

## Current State

The repo now has a machine-checked public runtime path manifest:

```text
src/compat/public-runtime-paths.ts
```

The first deprecation category is exactly:

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

Those paths are old wrappers for neutral owners under `src/shared/**` or
`src/flows/**`.

The public release-note deprecation document is:

```text
docs/release/deprecations/public-runtime-import-paths.md
```

`tests/runner/public-runtime-paths.test.ts` proves:

- the release-note document exists;
- its deprecated table matches exactly `PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS`;
- every deprecated old path appears with its replacement owner;
- no non-soft-deprecated old runtime path appears in the deprecated table;
- old paths continue to work;
- no import-time/runtime warning is emitted;
- no wrapper deletion and no package export change is claimed;
- connector, registry/catalog, run-status, result-writer, public runner,
  retained handler, and retained saved-state categories are explicitly excluded.

Reported Phase 5.59 validation passed:

```bash
npx vitest run tests/runner/public-runtime-paths.test.ts
npx vitest run tests/runner/public-runtime-paths.test.ts tests/runner/retained-compat-facade.test.ts tests/runner/shared-helper-compat.test.ts tests/runner/catalog-derivations.test.ts tests/runner/connector-shared-compat.test.ts tests/runner/run-status-facade.test.ts tests/runner/result-path-compat.test.ts tests/runner/fanout-aggregate-compat.test.ts tests/runner/json-report-compat.test.ts tests/runner/recovery-route-compat.test.ts tests/runner/terminal-verdict-helper.test.ts tests/properties/visible/fanout-join-policy.test.ts
npm run check
npm run lint
npm run build
npx vitest run tests/contracts/terminology-active-surface.test.ts tests/runner/public-runtime-paths.test.ts
npm run verify
git diff --check
```

## Direct Review Questions

1. Are there any blocking correctness or compatibility findings in Phase 5.59?
2. Is the public release-note deprecation document enough for this stage, or is
   another communication surface required before a retirement clock can start?
3. Should the exact 15 paths get any import-time/runtime warnings in a future
   release, or should warnings remain prohibited?
4. Should package exports remain unchanged, or should the repo eventually add an
   explicit export map to control old runtime paths?
5. Is hard deletion of any of the 15 wrapper files safe in the next stage?
6. If deletion is not safe yet, what concrete evidence would make deletion safe?
7. Should the compatibility wrapper tests stay until hard deletion, or can any
   old-path tests be narrowed before deletion?
8. Are connector, registry/catalog, run-status, result-writer, public runner,
   retained handler, retained trace/checkpoint, or saved-state paths still
   correctly excluded from deprecation and retirement?
9. What exact implementation slice is approved next?
10. What still requires another review before coding?

## Candidate Outcomes

Please choose one:

### Option A: Hold After Release-Note Deprecation

Keep the current release-note-only deprecation as the latest approved stage.
Proceed only with behavior-preserving proof/guard cleanup. Prepare no deletion
or warning implementation yet.

### Option B: Add More Communication, Still No Runtime Change

Add another checked public communication surface, such as a generated
deprecation index or public-claims entry, but keep old paths, package exports,
and no-warning behavior unchanged.

### Option C: Start A Timed Retirement Plan, Still No Code Deletion

Record a future removal window and required proof for the same 15 paths, but
keep wrappers and imports working for now.

### Option D: Approve Warning Implementation

Add import-time/runtime warnings for the exact 15 paths. If choosing this,
please specify how to avoid noisy CLI/test loading and what tests must prove.

### Option E: Approve Wrapper Deletion

Delete one or more of the 15 wrapper files. If choosing this, please name exact
files, public compatibility consequences, release-note requirements, and tests
to remove or rewrite.

## Guardrails

Do not approve any of these unless you explicitly intend a larger public
compatibility change:

```text
No deletion of connector wrappers.
No deletion of registry/catalog wrappers.
No deletion of run-status wrapper.
No deletion of result-writer.
No deletion of public runner surface.
No deletion of retained handlers, trace, checkpoint, reducer, snapshot,
  progress, or saved-state paths.
No package exports change unless explicitly approved.
No import-time/runtime warnings unless explicitly approved.
No additional deprecated categories unless explicitly approved.
No composeWriter behavior change.
No rollback behavior change.
No arbitrary fixture or custom-root routing change.
No retained/v1 checkpoint folder behavior change.
No retained trace/reducer/snapshot/progress/checkpoint implementation move.
No retained runner/handler oracle-test deletion.
No old runtime deletion.
```

## Files Included

The packet includes the Phase 5.59 release-note document, manifest, tests,
policy docs, deletion docs, handoff, build/package visibility files, and
representative old wrapper/owner files.
