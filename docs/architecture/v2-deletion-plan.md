# Circuit v2 Retained Runtime Plan

This is the post-default-selector deletion-readiness plan.

The default selector now routes matrix-supported fresh runs through core-v2.
That does not make the old runtime deletable. The retained runtime still owns
fallback behavior, checkpoint resume, checkpoint-waiting depths, arbitrary
fixtures, programmatic compose writer injection, and many oracle tests.

No old runtime files are approved for deletion in this phase.

## 1. Current Runtime Selector

Normal CLI routing is a selector:

```text
matrix-supported fresh run -> core-v2
checkpoint resume -> retained runtime
checkpoint-waiting mode -> retained runtime
unsupported flow/mode/depth -> retained runtime
arbitrary explicit fixture -> retained runtime unless strict opt-in is set
programmatic composeWriter injection -> retained runtime
```

The emergency rollback switch remains:

```text
CIRCUIT_DISABLE_V2_RUNTIME=1
```

Strict opt-in remains:

```text
CIRCUIT_V2_RUNTIME=1
```

Strict opt-in force-tests v2 and fails closed when an invocation is not safe for
v2. Candidate mode is diagnostic only after the default selector:

```text
CIRCUIT_V2_RUNTIME_CANDIDATE=1
```

## 2. Not Deletable Yet

These old execution files still have live product or test ownership.

| Path | Current owner | Why retain |
|---|---|---|
| `src/runtime/runner.ts` | retained execution path | The CLI still imports `runCompiledFlow` for unsupported modes, rollback, arbitrary fixtures, `composeWriter`, and checkpoint resume. Release proof scripts and many runner tests still use it. |
| `src/runtime/runner-types.ts` | compatibility re-export plus retained runtime types | core-v2 imports shared relay/progress/run callback types from `src/shared/relay-runtime-types.ts`. Keep this file until retained runtime and tests stop importing the old surface. |
| `src/runtime/step-handlers/checkpoint.ts` | checkpoint pause/resume and retained checkpoint modes | v2 handles fresh safe checkpoint choices, but checkpoint waiting and resume stay retained-runtime-owned. |
| `src/runtime/step-handlers/compose.ts` | retained fallback and programmatic compose writer hook | core-v2 uses catalog writers, but `main(..., { composeWriter })` intentionally falls back to retained runtime. |
| `src/runtime/step-handlers/relay.ts` | retained relay handler and oracle tests | core-v2 no longer imports this file directly, but retained runtime and handler tests still do. |
| `src/runtime/step-handlers/sub-run.ts` | retained fallback and oracle tests | core-v2 has sub-run coverage, but unsupported fallback paths and old tests still rely on the old handler. |
| `src/runtime/step-handlers/fanout.ts` and `src/runtime/step-handlers/fanout/*` | retained fallback and fanout oracle tests | core-v2 has fanout slices, but old fanout behavior remains the comparison oracle. |
| `src/runtime/step-handlers/verification.ts` | retained fallback and verification oracle tests | core-v2 can run flow-owned verification writers, but old verification tests remain useful until migration. |
| `src/runtime/step-handlers/recovery-route.ts` | retained runner recovery behavior | core-v2 has bounded recovery tests, but old runner tests still cover the retained path. |
| `src/runtime/step-handlers/shared.ts`, `src/runtime/step-handlers/types.ts`, `src/runtime/step-handlers/index.ts` | retained handler support | Delete only with the old handler cluster. |

The earliest possible deletion slice is a narrow one after a heavy review that
confirms each retained execution responsibility has either moved to core-v2 or
has been intentionally kept behind a smaller retained module.

## 3. Runtime Files To Keep Or Move

These files live under `src/runtime/`, but they are not simply old graph-runner
code. Most should move to neutral homes over time rather than be deleted.

| Path | Classification | Why retain or move |
|---|---|---|
| `src/runtime/compile-schematic-to-flow.ts` | keep / compiler infrastructure | `scripts/emit-flows.mjs`, compiler tests, and generated flow output still use it. |
| `src/runtime/catalog-derivations.ts` | keep / catalog infrastructure | Router, generated surfaces, and catalog tests depend on catalog-derived data. |
| `src/runtime/registries/**` | keep / later move | Flow packages, v2 report validation, writer discovery, cross-report validators, and shape hints depend on these registries. |
| `src/runtime/connectors/**` | keep / later move | core-v2 reuses real connector subprocesses, relay materialization, and argv validation. The relay data/hash surface moved to `src/shared/connector-relay.ts` in Phase 4.16, and connector parsing/model helpers moved to `src/shared/connector-helpers.ts` in Phase 4.17. Subprocess modules and materialization remain production safety infrastructure. |
| `src/runtime/relay-support.ts` | compatibility re-export | Relay prompt and check helpers moved to `src/shared/relay-support.ts` in Phase 4.13. Keep this wrapper until retained relay handler imports and old tests stop using the old path. |
| `src/runtime/config-loader.ts` | compatibility re-export | Config discovery moved to `src/shared/config-loader.ts` in Phase 4.22. Keep this wrapper until old-path tests and external imports stop using it. |
| `src/runtime/router.ts` | keep / later move | Natural-language flow selection still uses the current router. |
| `src/runtime/relay-selection.ts` | retained relay decision bridge | Selection-depth helpers moved to `src/shared/relay-selection.ts` in Phase 4.12. Keep this file for retained relayer resolution, connector bridge behavior, old relay handler imports, and relay provenance tests. |
| `src/runtime/selection-resolver.ts` | compatibility re-export | Selection precedence logic moved to `src/shared/selection-resolver.ts` in Phase 4.11. Keep this wrapper until retained runtime tests and external imports stop using the old path. |
| `src/runtime/result-writer.ts` | retain retained writer / compatibility path export | core-v2 has its own result writer, but retained runtime and old result tests still use this one. Phase 4.25 moved only the shared `reports/result.json` path helper to `src/shared/result-path.ts`; do not merge the writers yet. |
| `src/runtime/manifest-snapshot-writer.ts` | compatibility re-export | Manifest snapshot byte-match helper moved to `src/shared/manifest-snapshot.ts` in Phase 4.20. Keep this wrapper while retained runner and old snapshot tests use the old path. |
| `src/runtime/snapshot-writer.ts` | retain for state snapshots and continuity | Used by retained runner, checkpoint handler, `append-and-derive`, `cli/handoff`, event-log round-trip tests, fresh-run-root tests, release evidence, and state snapshot behavior. |
| `src/runtime/operator-summary-writer.ts` | compatibility re-export | Operator summary writing moved to `src/shared/operator-summary-writer.ts` in Phase 4.21. Keep this wrapper until old-path tests and release evidence stop using it. |
| `src/runtime/run-status-projection.ts` | keep | This is now the compatibility projector for both v1 and v2 run folders. |
| `src/runtime/progress-projector.ts` | retained trace-to-progress projection | core-v2 imports shared helpers from `src/shared/progress-output.ts`. Keep this file for old trace projection, retained runtime imports, and old progress tests. |
| `src/runtime/reducer.ts`, `src/runtime/append-and-derive.ts`, `src/runtime/trace-reader.ts`, `src/runtime/trace-writer.ts` | retain until trace/projection tests migrate | Old trace infrastructure remains the v1 oracle and status/progress source for retained runs. |
| `src/runtime/policy/flow-kind-policy.ts` | compatibility re-export | Flow-kind policy moved to `src/shared/flow-kind-policy.ts` in Phase 4.19. Keep this wrapper until old-path imports and documentation references stop using it. |
| `src/runtime/write-capable-worker-disclosure.ts` | compatibility re-export | Disclosure helper moved to `src/shared/write-capable-worker-disclosure.ts` in Phase 4.14. Keep this wrapper while release evidence, old-path compatibility tests/docs, or external old-path consumers still cite the wrapper. |
| `src/runtime/run-relative-path.ts` | compatibility re-export | Run-relative path helper moved to `src/shared/run-relative-path.ts` in Phase 4.15. Keep this wrapper while retained runtime, connector materialization, old handlers, projection, and operator summary imports use the old path. |

## 4. Live Import Evidence

The latest reference search covered:

```text
../runtime
../../runtime
runtime/
from "...runtime"
```

Current import groups:

| Reference group | Current consumers | Classification | Next action |
|---|---|---|---|
| `runtime/runner` | `src/cli/circuit.ts`, release proof script, many `tests/runner/*`, selected contract tests | retained execution | Keep until unsupported modes, rollback, `composeWriter`, fixtures, and checkpoint resume have explicit replacement or retained-module ownership. |
| `runtime/runner-types` | retained runtime, `src/cli/circuit.ts`, tests | compatibility re-export | core-v2 no longer imports this file. Keep until retained runtime and tests stop importing the old type surface. |
| `runtime/step-handlers` | direct handler tests and retained runner | retained execution oracle | Migrate tests only after v2 owns the behavior or the behavior stays retained by policy. |
| `runtime/registries` | flow packages, core-v2 report validation, tests | live infrastructure | Move to neutral flow-package infrastructure before deleting any runtime namespace. |
| `runtime/connectors` | core-v2 relay bridge, retained runtime, connector tests | live connector infrastructure | Keep. Shared relay data/hash ownership moved to `src/shared/connector-relay.ts`, and connector helper ownership moved to `src/shared/connector-helpers.ts`, but subprocess modules and materialization remain production safety infrastructure. |
| `runtime/relay-support` | old relay handler and compatibility imports | compatibility re-export | core-v2 no longer imports this file. Shared helper ownership now lives in `src/shared/relay-support.ts`. |
| `runtime/relay-selection` | retained relay handler, old runner, and old relay tests | retained relay decision bridge | core-v2 no longer imports this file. Keep until retained relayer resolution and connector bridge behavior move or stay behind an explicit retained module. |
| `runtime/selection-resolver` | retained tests and compatibility imports | compatibility re-export | Neutral ownership now lives in `src/shared/selection-resolver.ts`; keep wrapper until old-path imports migrate. |
| old trace/status/progress helpers | CLI status/progress, retained runtime, old tests | projection infrastructure | Keep. `run-status-projection.ts` is now intentionally cross-runtime. `progress-projector.ts` still owns old trace-to-progress projection while shared output helpers live in `src/shared/progress-output.ts`. |
| compiler/catalog modules | generator, router, catalog tests | authoring infrastructure | Keep. These are not old execution files. |

## 5. Replacement v2 Surfaces

Core-v2 now has real replacements for the supported fresh-run path:

- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `src/core-v2/manifest/executable-flow.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/core-v2/trace/trace-store.ts`
- `src/core-v2/run-files/run-file-store.ts`
- `src/core-v2/run-files/paths.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/executors/*`
- `src/core-v2/connectors/resolver.ts`
- `src/core-v2/fanout/*`
- `src/core-v2/projections/status.ts`
- `src/core-v2/projections/progress.ts`
- `src/shared/connector-relay.ts`
- `src/shared/connector-helpers.ts`
- `src/shared/relay-runtime-types.ts`
- `src/shared/progress-output.ts`
- `src/shared/selection-resolver.ts`
- `src/shared/relay-selection.ts`
- `src/shared/relay-support.ts`
- `src/shared/write-capable-worker-disclosure.ts`
- `src/shared/run-relative-path.ts`
- `src/shared/flow-kind-policy.ts`
- `src/shared/manifest-snapshot.ts`
- `src/shared/operator-summary-writer.ts`
- `src/shared/config-loader.ts`
- `src/shared/result-path.ts`

These are not enough by themselves to delete the retained runtime because the
selector still intentionally routes some invocations outside core-v2.

## 6. Evidence Already In Place

Current v2 evidence includes:

- core-v2 unit tests under `tests/core-v2/`;
- generated-flow parity tests under `tests/parity/`;
- CLI default-selector tests under `tests/runner/cli-v2-runtime.test.ts`;
- v2 run folder status tests under `tests/runner/run-status-projection.test.ts`;
- progress schema tests under `tests/contracts/progress-event-schema.test.ts`;
- generated-surface drift checks through `npm run check-flow-drift`;
- full validation through `npm run verify`.

Old runtime tests remain useful until each behavior is either v2-owned or
explicitly retained.

## 7. Full Import Inventory

The latest retained-runtime inventory packet includes full command output in:

- `docs/architecture/v2-runtime-import-inventory.md`

It includes:

```text
find src/runtime -type f | sort
rg -n "from ['\"].*runtime/|../runtime|../../runtime|runtime/" src tests scripts docs specs package.json
rg -n "runCompiledFlow|resumeCompiledFlowCheckpoint|RelayFn|ProgressReporter|deriveResolvedSelection|resolveSelection" src tests scripts docs
```

The `rg` commands exclude the generated inventory file itself so the artifact
does not cite its own contents.

## 8. First Narrowing Candidates

These are candidates for future move/narrowing slices. They are not deletion
approval.

| Candidate slice | Why it is small | Proof needed |
|---|---|---|
| Move shared relay/progress types out of `src/runtime/runner-types.ts` | Done in Phase 4.9 for `RelayFn`, `RelayInput`, `ProgressReporter`, and `RuntimeEvidencePolicy`. `runner-types.ts` remains as a compatibility re-export plus retained runtime invocation/result types. | Keep full validation green while retained runtime and tests continue importing the old surface. |
| Move progress helper functions out of `src/runtime/progress-projector.ts` | Done in Phase 4.10 for `progressDisplay` and `reportProgress`. `progress-projector.ts` re-exports them for compatibility and still owns old trace-to-progress projection. | Keep progress schema tests, old progress-projector tests, CLI v2 progress tests, and full validation green. |
| Move relay selection support to a neutral module | Mostly done in Phases 4.11 and 4.12 for selection ownership: `src/shared/selection-resolver.ts` owns `resolveSelectionForRelay`, and `src/shared/relay-selection.ts` owns depth-bound selection derivation. `src/runtime/relay-selection.ts` remains for retained relayer resolution and connector bridge behavior. | Config loader tests, selection contract tests, relay provenance tests, core-v2 connector tests, CLI custom connector precedence tests, full `npm run verify`. |
| Move run-relative path helper out of `src/runtime/run-relative-path.ts` | Done in Phase 4.15 for `resolveRunRelative`. Flow writers and shared relay support now import `src/shared/run-relative-path.ts`; the runtime file remains a compatibility re-export for retained runtime surfaces. | Keep run-relative path containment tests, materializer tests, report writer tests, CLI v2 tests, and full validation green. |
| Move connector relay data/hash helper out of `src/runtime/connectors/shared.ts` | Done in Phase 4.16 for `ConnectorRelayInput`, `RelayResult`, and `sha256Hex`. `src/runtime/connectors/shared.ts` remains for compatibility re-exports plus connector-only parsing/model helpers. | Keep connector wrapper compatibility tests, relay/materializer tests, connector selection tests, connector smoke source fingerprint lists, and full validation green. |
| Move connector-only helpers out of `src/runtime/connectors/shared.ts` | Done in Phase 4.17 for `selectedModelForProvider` and `extractJsonObject`. `src/runtime/connectors/shared.ts` remains as a compatibility re-export surface. | Keep connector helper compatibility tests, extraction tests, connector smoke source fingerprint lists, subprocess connector smoke tests, and full validation green. |
| Plan connector/materializer/registry ownership before risky moves | Done in Phase 4.18. `docs/architecture/v2-connector-materializer-plan.md` recommends keeping subprocess connector modules and relay materialization in place for now. `docs/architecture/v2-registry-ownership-plan.md` classifies registries as flow-package/report infrastructure, not old runner debris. | Review the plans before moving connector subprocess modules, relay materialization, or registries. |
| Move flow-kind policy wrapper out of `src/runtime/policy/flow-kind-policy.ts` | Done in Phase 4.19. The neutral wrapper lives in `src/shared/flow-kind-policy.ts`; the runtime path remains a compatibility re-export. | Keep flow-kind policy tests, CLI fixture policy tests, generated-surface drift checks, and full validation green. |
| Move manifest snapshot helper out of `src/runtime/manifest-snapshot-writer.ts` | Done in Phase 4.20. The byte-match implementation lives in `src/shared/manifest-snapshot.ts`; the runtime path remains a compatibility re-export. | Keep event-log round-trip tests, run-status projection tests, fresh-run-root tests, handoff tests, and full validation green. |
| Move operator summary writer out of `src/runtime/operator-summary-writer.ts` | Done in Phase 4.21. The implementation lives in `src/shared/operator-summary-writer.ts`; the runtime path remains a compatibility re-export. | Keep operator summary tests, CLI v2 runtime tests, release evidence checks, and full validation green. |
| Move config loader out of `src/runtime/config-loader.ts` | Done in Phase 4.22. The schema-backed config discovery implementation lives in `src/shared/config-loader.ts`; the runtime path remains a compatibility re-export. | Keep config-loader tests, CLI v2 runtime tests, connector selection tests, and full validation green. |
| Plan the remaining heavy boundaries before risky moves | Done in Phase 4.23. `docs/architecture/v2-heavy-boundary-plan.md` classifies connector subprocesses, relay materialization, registries, router/catalog, compiler, trace/status/progress, result writing, old runner/handlers, and checkpoint resume. | Review the plan before moving or deleting any remaining high-risk runtime cluster. |
| Plan result writer ownership before moving code | Done in Phase 4.24. `docs/architecture/v2-result-writer-plan.md` compares retained and v2 result semantics and recommends a path-only helper extraction before any writer merge. | Keep retained and v2 result writers separate unless a future trace/status/progress ownership review approves merging lifecycle semantics. |
| Move the shared run result path helper | Done in Phase 4.25. `src/shared/result-path.ts` owns `RUN_RESULT_RELATIVE_PATH` and `runResultPath(...)`; `src/runtime/result-writer.ts` keeps the compatibility `resultPath(...)` export. | Keep `src/runtime/result-writer.ts` as the retained writer; this move does not make it deletable. |
| Plan trace/status/progress ownership before moving projection code | Done in Phase 4.26. `docs/architecture/v2-trace-status-progress-plan.md` classifies `runs show`, progress JSONL, v1 trace/reducer/snapshot, and v2 projection ownership. | Review the plan before moving `run-status-projection.ts`, `progress-projector.ts`, trace reader/writer, reducer, snapshot writer, or checkpoint-resume-adjacent code. |

Avoid mixing these moves with old runner or handler deletion. A move slice should
prove that imports and behavior remain identical before any deletion proposal.

## 9. Deletion Readiness Criteria

Request a heavy deletion review only after the team decides which of these
paths should change:

1. checkpoint resume is implemented in v2, or retained permanently behind a
   smaller resume module;
2. unsupported flow/mode/depth combinations are either proven in v2 or
   intentionally retained;
3. arbitrary fixture behavior is either v2-owned or retained by policy;
4. `composeWriter` has either a v2 equivalent or remains retained by policy;
5. remaining retained-runtime-only types in `runner-types.ts` are moved or the
   file is explicitly retained as a compatibility module;
6. connector, registry, router, compiler, and projection helpers are moved to
   neutral modules or explicitly kept;
7. old runner/handler oracle tests are migrated, narrowed, or retained for the
   remaining old path.

Until then, the correct state is coexistence:

```text
core-v2 for matrix-supported fresh runs
retained runtime for everything not yet v2-owned
```

## 10. Next Heavy Review Scope

The next heavy review should not ask whether the default selector works in
general. That gate has been passed.

It should ask:

```text
Which retained runtime responsibilities are still product-owned, and which old
execution files can be deleted, moved, or narrowed without losing fallback,
resume, fixture, programmatic hook, connector, registry, status, or test
coverage?
```

Old runtime deletion remains explicitly out of scope until that review approves
a narrow deletion slice.
