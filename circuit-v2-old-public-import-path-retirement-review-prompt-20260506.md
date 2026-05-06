# Circuit v2 old public import-path / wrapper retirement review

You are reviewing the next deletion-adjacent checkpoint for `circuit-next`.

The generated public fresh-run matrix is already routed through `core-v2` by default. Public compatibility behavior was just reviewed and preserved: `composeWriter`, rollback, arbitrary fixtures, and custom roots remain retained compatibility surfaces. Phase 5.54 centralized that live policy code without changing behavior and passed full validation.

The next hard question is whether any old `src/runtime/**` compatibility wrapper paths can be retired, deprecated, moved behind a smaller compatibility package, or deleted. This is a public import-path decision. Do not treat one-line wrappers as dead code unless you explicitly approve old-path retirement and define the release/test plan.

## Current verified state

### What is v2-owned now

Matrix-supported fresh runs default to `core-v2`:

```text
Review default
Fix default/lite/deep/autonomous
Build default/lite/deep/autonomous
Explore default/lite/deep/autonomous/tournament
Migrate default/deep/autonomous
Sweep default/lite/deep/autonomous
```

### What remains retained compatibility

Current retained responsibilities include:

```text
retained/v1 checkpoint folder resume/status/progress
unsupported flow/mode/depth fallback outside the generated public catalog
arbitrary external --fixture fallback
custom --flow-root fallback
public composeWriter compatibility
rollback through CIRCUIT_DISABLE_V2_RUNTIME=1
retained trace/reducer/snapshot/progress/status/result/checkpoint behavior
old public runtime import paths and compatibility wrappers
retained runner/handler oracle tests
```

### Current wrapper inventory

One-line or tiny compatibility re-export paths currently include:

```text
src/runtime/catalog-derivations.ts
src/runtime/compile-schematic-to-flow.ts
src/runtime/config-loader.ts
src/runtime/connectors/claude-code.ts
src/runtime/connectors/codex.ts
src/runtime/connectors/custom.ts
src/runtime/connectors/relay-materializer.ts
src/runtime/connectors/shared.ts
src/runtime/manifest-snapshot-writer.ts
src/runtime/operator-summary-writer.ts
src/runtime/policy/flow-kind-policy.ts
src/runtime/registries/checkpoint-writers/registry.ts
src/runtime/registries/checkpoint-writers/types.ts
src/runtime/registries/close-writers/registry.ts
src/runtime/registries/close-writers/shared.ts
src/runtime/registries/close-writers/types.ts
src/runtime/registries/compose-writers/registry.ts
src/runtime/registries/compose-writers/types.ts
src/runtime/registries/cross-report-validators.ts
src/runtime/registries/report-schemas.ts
src/runtime/registries/shape-hints/registry.ts
src/runtime/registries/shape-hints/types.ts
src/runtime/registries/verification-writers/registry.ts
src/runtime/registries/verification-writers/types.ts
src/runtime/relay-support.ts
src/runtime/router.ts
src/runtime/run-relative-path.ts
src/runtime/run-status-projection.ts
src/runtime/selection-resolver.ts
src/runtime/step-handlers/fanout/aggregate.ts
src/runtime/step-handlers/fanout/join-policy.ts
src/runtime/step-handlers/recovery-route.ts
src/runtime/step-handlers/shared.ts
src/runtime/terminal-verdict.ts
src/runtime/write-capable-worker-disclosure.ts
```

These wrappers point at neutral owners under `src/flows/**`, `src/connectors/**`, `src/shared/**`, or `src/run-status/**`.

### Current retained-owned implementation files

These are not wrapper-retirement candidates in this review unless you explicitly say otherwise:

```text
src/runtime/runner.ts
src/runtime/runner-types.ts
src/runtime/checkpoint-resume.ts
src/runtime/trace-reader.ts
src/runtime/trace-writer.ts
src/runtime/reducer.ts
src/runtime/snapshot-writer.ts
src/runtime/append-and-derive.ts
src/runtime/progress-projector.ts
src/runtime/result-writer.ts
src/runtime/relay-selection.ts
src/runtime/step-handlers/checkpoint.ts
src/runtime/step-handlers/compose.ts
src/runtime/step-handlers/fanout.ts
src/runtime/step-handlers/fanout/branch-resolution.ts
src/runtime/step-handlers/fanout/types.ts
src/runtime/step-handlers/index.ts
src/runtime/step-handlers/relay.ts
src/runtime/step-handlers/sub-run.ts
src/runtime/step-handlers/types.ts
src/runtime/step-handlers/verification.ts
```

They still serve retained fallback, retained/v1 saved folders, retained progress/status/trace behavior, public `composeWriter`, rollback, or direct oracle tests.

### Existing guards and compatibility proofs

The packet includes tests that prove both sides of the current boundary:

```text
tests/runner/retained-compat-facade.test.ts
tests/runner/run-status-facade.test.ts
tests/runner/shared-helper-compat.test.ts
tests/runner/connector-shared-compat.test.ts
tests/runner/catalog-derivations.test.ts
tests/runner/fanout-aggregate-compat.test.ts
tests/runner/json-report-compat.test.ts
tests/runner/recovery-route-compat.test.ts
tests/runner/terminal-verdict-helper.test.ts
tests/properties/visible/fanout-join-policy.test.ts
```

Current guard style:

- production code is steered away from old wrapper paths when a neutral owner exists;
- old runtime wrapper paths remain import-compatible and have direct assertions;
- retained implementation files stay reachable only through `src/compat/**` boundaries where production callers need retained fallback or saved-folder support;
- tests that intentionally exercise retained fallback or old public paths still import retained/runtime paths.

### Latest validation

Phase 5.54 passed:

```bash
npx vitest run tests/runner/runtime-compatibility-policy.test.ts tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/soak/v2-runtime-surface.test.ts
npx vitest run tests/contracts/codex-host-plugin.test.ts tests/release/release-infrastructure.test.ts tests/runner/fix-report-writer.test.ts tests/runner/retained-compat-facade.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Full `npm run verify` passed with 132 test files, 1478 passed, 6 skipped.

## Review questions

Please answer directly and cite files/lines from the packet.

1. Are there any blocking correctness findings in the current wrapper/import-path boundary?

2. Are any old `src/runtime/**` compatibility wrapper files safe to delete now?
   If yes, name the exact files and the required test/release changes.
   If no, explain whether this is due to public compatibility, internal imports, tests, package exports, or missing release policy.

3. Should old wrapper paths be:
   - kept indefinitely as public compatibility;
   - deprecated with warnings/release notes;
   - moved behind a smaller compatibility package/module;
   - deleted in a staged release;
   - handled differently by category?

4. Which wrapper categories, if any, are low-risk to retire first?
   Consider:
   - shared helper wrappers;
   - connector wrappers;
   - router/compiler/catalog/registry wrappers;
   - run-status wrapper;
   - terminal/fanout/recovery/json-report helper wrappers.

5. Which wrapper categories must stay until broader retained compatibility changes?

6. What should happen to old-path compatibility tests?
   Should they remain, be narrowed to one explicit public-path proof per category, or be removed only with deprecation?

7. What should the next implementation checkpoint be if wrapper deletion is not approved?
   Examples:
   - produce package export/public API map;
   - add a deprecation-warning scaffold without enabling warnings;
   - consolidate wrapper compatibility tests;
   - create a smaller `src/compat/public-runtime-paths.ts` facade;
   - move retained fallback packaging forward;
   - prepare final deletion-readiness map.

8. What exact files should be changed in that next implementation checkpoint?

9. What validation commands are required?

10. Does the next implementation need another review after it lands, or can it proceed with normal tests if it follows your approved scope?

## Guardrails

Do not approve any of these unless you explicitly call it out and give a release/test plan:

```text
deleting old src/runtime wrappers
retiring old public import paths
changing package exports
removing old-path compatibility tests
deprecating composeWriter
changing rollback
routing arbitrary fixtures/custom roots through v2 by default
changing retained/v1 checkpoint folder behavior
moving retained trace/reducer/snapshot/progress/checkpoint implementations
deleting retained runner/handler oracle tests
starting old runtime deletion
```

## Desired output shape

Please return:

1. Executive verdict.
2. Blocking findings, if any.
3. Wrapper disposition table by category.
4. Exact next implementation checkpoint.
5. Review requirement for that checkpoint.
6. Updated old-runtime deletion status.

