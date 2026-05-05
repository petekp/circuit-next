# Circuit v2 Worklog

## 2026-05-02 - Phase 0

Goal: audit current runtime strictness, classify what v2 should keep or
simplify, and produce the Checkpoint 1 architecture packet without changing
runtime behavior.

Files inspected:

- `package.json`
- `package-lock.json`
- `AGENTS.md`
- `UBIQUITOUS_LANGUAGE.md`
- `docs/generated-surfaces.md`
- `docs/contracts/`
- `src/runtime/`
- `src/runtime/connectors/`
- `src/runtime/step-handlers/`
- `src/cli/`
- `src/schemas/`
- `src/flows/`
- `specs/behavioral/`
- `specs/invariants.json`
- `specs/reports.json`
- `tests/`
- `commands/`
- `.claude-plugin/`
- `plugins/circuit/`
- `generated/flows/`
- `scripts/emit-flows.mjs`

Files changed:

- `docs/architecture/v2-principles.md`
- `docs/architecture/v2-rigor-audit.md`
- `docs/architecture/v2-migration-plan.md`
- `docs/architecture/v2-checkpoint-1.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: failed only on
  `tests/contracts/terminology-active-surface.test.ts`, because the required
  Phase 0 architecture docs use currently banned terms and the required file
  name `v2-rigor-audit.md`.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.

Behavior changed? No.

Concerns:

- The Phase 0 deliverable names and required language include terms currently
  banned by the active terminology test. This needs a review decision rather
  than a silent test weakening.
- Several specs still refer to `docs/contracts/compiled-flow.md`; the current contract
  file is `docs/contracts/compiled-flow.md`.
- Fanout behavior is load-bearing but currently spread across a large handler
  plus helpers. v2 should preserve behavior while splitting ownership.
- Build checkpoint behavior is product-relevant, but some policy shape still
  lives in generic schema/runtime surfaces.

Next recommended action: review Checkpoint 1, decide how to handle
architecture-transition terminology, then approve or revise the Phase 1 runtime
substrate spike.

## 2026-05-02 - Phase 0.5

Goal: apply the conditional Checkpoint 1 correction before Phase 1.

Files inspected:

- `tests/contracts/terminology-active-surface.test.ts`
- `docs/architecture/v2-principles.md`
- `docs/architecture/v2-rigor-audit.md`
- `docs/architecture/v2-migration-plan.md`
- `docs/architecture/v2-checkpoint-1.md`

Files changed:

- `tests/contracts/terminology-active-surface.test.ts`
- `docs/architecture/v2-principles.md`
- `docs/architecture/v2-rigor-audit.md`
- `docs/architecture/v2-migration-plan.md`
- `docs/architecture/v2-checkpoint-1.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.
- `npm run verify`: passed.

Behavior changed? No runtime behavior changed.

Concerns: the active terminology exception is intentionally narrow:
`docs/architecture/v2-*` only. Source code, tests other than the existing
terminology test self-exemption, commands, generated outputs, and
product-facing prose remain checked.

Next recommended action: if validation is green, start Phase 1 with a plain
TypeScript baseline and no global Effect adoption.

## 2026-05-02 - Phase 1

Goal: build a minimal v2 runtime substrate beside the existing runtime using a
plain TypeScript baseline.

Files inspected:

- `tsconfig.json`
- `tsconfig.build.json`
- representative test files under `tests/`
- Phase 0 and Phase 0.5 architecture docs

Files changed:

- `src/core-v2/domain/flow.ts`
- `src/core-v2/domain/step.ts`
- `src/core-v2/domain/route.ts`
- `src/core-v2/domain/report.ts`
- `src/core-v2/domain/run-file.ts`
- `src/core-v2/domain/run.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/domain/connector.ts`
- `src/core-v2/domain/selection.ts`
- `src/core-v2/manifest/executable-flow.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/core-v2/trace/trace-store.ts`
- `src/core-v2/run-files/paths.ts`
- `src/core-v2/run-files/run-file-store.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/executors/index.ts`
- `src/core-v2/executors/compose.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/projections/status.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `docs/architecture/v2-checkpoint-2.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2/core-v2-baseline.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: initially failed on formatting/import order.
- `npx biome check --write src/core-v2 tests/core-v2`: passed and fixed the
  new files.
- `npm run lint`: passed after formatting.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run test`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. v2 exists only as new
opt-in source and tests.

Concerns:

- Checkpoint-like pause is deferred until v1 checkpoint semantics can be
  adapted instead of guessed.
- Non-baseline step kinds fail closed in the executor registry.
- Phase 2 must keep v1 quirks explicit when adapting compiled flows.

Next recommended action: after Checkpoint 2 review, start Phase 2 with the
compiled-flow to executable-manifest adapter.

## 2026-05-02 - Phase 1.5

Goal: fix early v2 contract drift before Phase 2.

Files inspected:

- `src/schemas/compiled-flow.ts`
- `src/schemas/trace-entry.ts`
- `src/runtime/result-writer.ts`
- `src/core-v2/`
- `tests/core-v2/core-v2-baseline.test.ts`

Files changed:

- `src/core-v2/domain/route.ts`
- `src/core-v2/domain/run.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/trace/trace-store.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/projections/status.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `docs/architecture/v2-checkpoint-2.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: initially failed on one formatting issue in the updated
  core-v2 test file.
- `npx biome check --write tests/core-v2/core-v2-baseline.test.ts`: passed and
  fixed the formatting issue.
- `npm run check`: passed after formatting.
- `npm run lint`: passed after formatting.
- `npm run build`: passed.
- `npx vitest run tests/core-v2/core-v2-baseline.test.ts`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.

Behavior changed? No production behavior changed. The v2 baseline now aligns
its terminal targets, run close outcomes, trace names, trace field names, and
result path with current runtime contracts.

Concerns:

- v2 still has only baseline executors. Verification, checkpoint, sub-run, and
  fanout remain intentionally unsupported in execution.
- Manifest validation is still a Phase 1 baseline. Phase 2 should add or plan
  terminal reachability, dead-step detection, stage membership consistency, and
  checkpoint choice validation.

Next recommended action: after validation and review, start Phase 2 with the
compiled-flow to executable-manifest adapter.

## 2026-05-02 - Phase 2

Goal: build the `CompiledFlow` v1 to `ExecutableFlowV2` adapter without
changing flow authoring, generated manifests, production CLI behavior, or old
runtime code.

Files inspected:

- `src/schemas/compiled-flow.ts`
- `src/schemas/step.ts`
- `src/schemas/stage.ts`
- `src/schemas/selection-policy.ts`
- representative generated flows under `generated/flows/`
- current `src/core-v2/` manifest, domain, and validation files

Files changed:

- `src/core-v2/domain/flow.ts`
- `src/core-v2/domain/selection.ts`
- `src/core-v2/manifest/executable-flow.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`
- `docs/architecture/v2-phase-2-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2/from-compiled-flow-v1.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: initially failed on formatting/import order in new files.
- `npx biome check --write src/core-v2 tests/core-v2`: passed and fixed the
  new files.
- `npm run check`: passed after formatting.
- `npm run lint`: passed after formatting.
- `npx vitest run tests/core-v2`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run test`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. Phase 2 adds adapter parity
tests only.

Concerns:

- v2 manifest validation now covers adapter-level structural safety, but not
  full graph liveness.
- v2 still represents unsupported step kinds without executing them.
- Checkpoint choices and route names are intentionally separate because v1 uses
  both concepts differently.

Next recommended action: after review, begin simple-flow v2 execution parity
only when the unsupported executor boundaries are explicitly planned.

## 2026-05-02 - Phase 2.5

Goal: correct v2 stage membership before simple-flow parity.

Files inspected:

- `src/core-v2/manifest/executable-flow.ts`
- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/runtime/selection-resolver.ts`
- `src/schemas/compiled-flow.ts`
- `src/schemas/selection-policy.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`

Files changed:

- `src/core-v2/manifest/executable-flow.ts`
- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`
- `docs/architecture/v2-phase-2-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.

Behavior changed? No production behavior changed. The v2 manifest shape now
preserves overlapping stage membership for future selection parity.

Concerns:

- Exact v1 trace and result schemas are still deferred to execution parity.
- v2 still represents unsupported step kinds without executing them.

Next recommended action: after review, begin Phase 3 simple-flow parity.

## 2026-05-02 - Phase 2 adversarial review fixes

Goal: address all adversarial review findings before Phase 3.

Files inspected:

- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/core-v2/run-files/paths.ts`
- `src/core-v2/domain/selection.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`
- `src/runtime/runner.ts`
- `src/schemas/scalars.ts`

Files changed:

- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/core-v2/run-files/paths.ts`
- `src/core-v2/domain/selection.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`
- `docs/architecture/v2-phase-2-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2`: initially failed because the new synthetic
  adapter test referenced a non-existent review step; corrected the fixture.
- `npx vitest run tests/core-v2`: passed after correction.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. The v2-only baseline now
matches v1 default-entry behavior more closely, keeps trace lifecycle cleaner
on undeclared routes, validates run-file paths before execution, and preserves
v1 selection field names at the adapter boundary.

Concerns:

- v2 result and trace schemas are still intentionally minimal.
- Verification, checkpoint, sub-run, and fanout execution remain unsupported.

Next recommended action: after validation and review, begin Phase 3 simple-flow
parity.

## 2026-05-02 - Phase 3

Goal: prove simple-flow v2 execution parity for review, fix, and build using
the v1 compiled-flow adapter.

Files inspected:

- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/result-writer.ts`
- `src/runtime/step-handlers/`
- `src/schemas/compiled-flow.ts`
- `src/schemas/result.ts`
- `src/schemas/trace-entry.ts`
- `src/schemas/verification.ts`
- `src/flows/review/reports.ts`
- `src/flows/fix/reports.ts`
- `src/flows/build/reports.ts`
- `generated/flows/review/circuit.json`
- `generated/flows/fix/circuit.json`
- `generated/flows/build/circuit.json`
- `tests/runner/review-runtime-wiring.test.ts`
- `tests/runner/fix-runtime-wiring.test.ts`
- `tests/runner/build-runtime-wiring.test.ts`
- existing `src/core-v2/` files

Files changed:

- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/review-v2.test.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/parity/build-v2.test.ts`
- `docs/architecture/v2-checkpoint-3.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: initially failed on one TypeScript branded id mismatch in
  the new parity helper.
- `npm run check`: passed after correction.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run lint`: initially failed on formatting/import order in new Phase 3
  files.
- `npx biome check --write src/core-v2/run/compiled-flow-runner.ts tests/parity`:
  passed and fixed the new files.
- `npm run check`: passed after formatting.
- `npx vitest run tests/core-v2 tests/parity`: passed after formatting.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. Phase 3 adds an opt-in v2
compiled-flow execution path and tests it against generated review, fix, and
build flows. The production CLI remains on the old runtime.

Concerns:

- v2 trace entries still use a minimal schema.
- v2 result shape is closer to v1 but not the complete current result schema.
- Phase 3 test executors support verification and checkpoint only inside tests.
- Production v2 execution still does not support sub-run, fanout, connector
  subprocess behavior, checkpoint resume, or worktree behavior.

Next recommended action: stop at Checkpoint 3 for review. If approved, begin
Phase 4 complex-flow parity.

## 2026-05-02 - Phase 3 adversarial review fixes

Goal: address adversarial review findings before Phase 4.

Files inspected:

- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/schemas/result.ts`
- `src/schemas/manifest.ts`
- `src/runtime/runner.ts`
- `tests/parity/`

Files changed:

- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/review-v2.test.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/parity/build-v2.test.ts`
- `docs/architecture/v2-checkpoint-3.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npx vitest run tests/core-v2 tests/parity`: initially failed because parity
  run ids were not UUIDs for `RunResult` parsing and one nested matcher was too
  strict.
- `npx vitest run tests/core-v2 tests/parity`: passed after correction.
- `npm run lint`: initially failed on formatting in the route guard and parity
  helper.
- `npx biome check --write src/core-v2/run/graph-runner.ts tests/parity/core-v2-parity-helpers.ts tests/parity/fix-v2.test.ts tests/parity/build-v2.test.ts tests/parity/review-v2.test.ts`:
  passed and fixed formatting.

Behavior changed? No production behavior changed. The v2-only path now writes
result files that parse with the current `RunResult` schema, computes manifest
hashes from raw compiled-flow bytes, and aborts route re-entry before recording
misleading completion.

Concerns:

- The v2 trace shape is still minimal.
- Full recovery-route attempt semantics are still old-runtime behavior; v2 now
  fails closed on re-entry until that behavior is intentionally migrated.

Next recommended action: run full validation again, then stop for Phase 4
review approval.

## 2026-05-02 - Phase 3.5

Goal: correct Phase 3 recovery-route, compiled-flow input, and selected
entry/depth behavior before Phase 4.

Files inspected:

- `src/runtime/runner.ts`
- `src/schemas/step.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/domain/trace.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/parity/build-v2.test.ts`

Files changed:

- `src/core-v2/domain/trace.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/review-v2.test.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/parity/build-v2.test.ts`
- `docs/architecture/v2-checkpoint-3.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run check`: passed.
- `npm run lint`: initially failed on import ordering, then passed after
  correction.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed after import ordering.
- `npm run test:fast`: passed, 57 test files and 811 tests.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed, including 110 test files, 1231 tests passed, and
  6 skipped.

Behavior changed? No production behavior changed. The opt-in v2 path now allows
bounded `retry` and `revise` recovery re-entry, binds compiled-flow execution
to raw manifest bytes, and records selected entry mode/depth in bootstrap
trace data.

Concerns:

- v2 trace entries still do not claim full v1 trace schema parity.
- Manifest snapshot writing remains a Phase 4 prerequisite before sub-run and
  resume parity.
- Production v2 execution still does not support connector subprocess,
  checkpoint resume, sub-run, fanout, or worktree behavior.

Next recommended action: stop for review. If approved, start Phase 4 with
manifest snapshot support before sub-run and fanout parity.

## 2026-05-02 - Phase 4 Preflight and Manifest Snapshot Slice

Goal: apply the approved Phase 4 preflight recovery cleanup, then start Phase
4 with raw-byte manifest snapshot support before sub-run or fanout work.

Files inspected:

- `src/runtime/runner.ts`
- `src/runtime/manifest-snapshot-writer.ts`
- `src/schemas/manifest.ts`
- `src/schemas/run.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/review-v2.test.ts`
- `tests/parity/fix-v2.test.ts`

Files changed:

- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/review-v2.test.ts`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run check`: passed.
- `npm run lint`: initially failed on import ordering in
  `tests/parity/review-v2.test.ts`, then passed after correction.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. The opt-in v2 compiled-flow
path now writes `manifest.snapshot.json` from raw compiled-flow bytes and binds
that snapshot hash to `run.bootstrapped` and `reports/result.json`.

Concerns:

- Manifest snapshot writing is implemented for the v2 compiled-flow path only.
- Sub-run, fanout, connector safety, checkpoint resume, and worktree parity are
  still pending.
- v2 trace schema convergence remains incremental.

Next recommended action: continue Phase 4 with sub-run parity before fanout.

## 2026-05-04 - Phase 4.7 Retained Runtime Inventory

Goal: move from default-selector stabilization to the next heavy review
boundary by refreshing the old-runtime deletion plan from actual repo ownership.

Files inspected:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-4.6.md`
- `docs/architecture/v2-checkpoint-4.6.1.md`
- `src/cli/circuit.ts`
- `src/runtime/**`
- current imports referencing `src/runtime/`

Files changed:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-4.7.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This checkpoint updates the
review boundary and retained-runtime ownership map.

Concerns:

- Old runtime deletion is still not approved.
- `src/runtime/runner.ts` remains live for retained fallback, rollback,
  arbitrary fixtures, programmatic `composeWriter`, unsupported modes, and
  checkpoint resume.
- Several `src/runtime/` modules are shared infrastructure and should be moved
  or retained, not deleted with old execution files.

Next recommended action: run validation, package Phase 4.7, and request a
deletion-readiness review before any runtime file deletion.

## 2026-05-04 - Phase 4.8 Retained Runtime Narrowing Prep

Goal: answer Phase 4.7 review corrections, attach a full import inventory, and
propose the first behavior-preserving runtime namespace narrowing candidates.

Files inspected:

- `src/runtime/relay-selection.ts`
- `src/runtime/selection-resolver.ts`
- `src/core-v2/projections/progress.ts`
- `src/runtime/runner-types.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.8.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed.

Concerns:

- Old runtime deletion is still not approved.
- `selection-resolver.ts` is live selection infrastructure through
  `relay-selection.ts`, not just a test oracle.
- `progress-projector.ts` still provides helpers used directly by core-v2.

Next recommended action: run validation, then package Phase 4.8 for a
retained-runtime narrowing review.

## 2026-05-04 - Phase 4.9 Shared Type Extraction

Goal: reduce core-v2's dependency on the retained runtime namespace by moving
shared relay/progress callback types out of `src/runtime/runner-types.ts`.

Files inspected:

- `src/runtime/runner-types.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/run-context.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/relay-runtime-types.ts`
- `src/runtime/runner-types.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/run-context.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.9.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `src/runtime/runner-types.ts`
remains a compatibility re-export for the moved shared types, while core-v2 now
imports those types from `src/shared/relay-runtime-types.ts`.

Concerns:

- Old runtime deletion is still not approved.
- `runner-types.ts` still owns retained-runtime invocation/result types and
  remains live for old runtime callers and tests.

Next recommended action: run validation, then continue with progress helper
extraction if this slice remains green.

## 2026-05-04 - Phase 4.10 Progress Helper Extraction

Goal: reduce core-v2's dependency on old runtime progress projection by moving
the shared progress output helpers out of `src/runtime/progress-projector.ts`.

Files inspected:

- `src/runtime/progress-projector.ts`
- `src/core-v2/projections/progress.ts`
- `src/shared/relay-runtime-types.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/progress-output.ts`
- `src/runtime/progress-projector.ts`
- `src/core-v2/projections/progress.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.10.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed after rerunning serially; the first
  attempt overlapped with stale-file drift tests in `test:fast`.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `progressDisplay` and
`reportProgress` now live in `src/shared/progress-output.ts`; the old runtime
progress projector re-exports them and still owns trace-to-progress projection.

Concerns:

- Old runtime deletion is still not approved.
- `src/runtime/progress-projector.ts` remains live for retained runtime and old
  progress projection tests.

Next recommended action: run validation, then continue with a careful relay
selection support move if this slice remains green.

## 2026-05-04 - Phase 4.11 Selection Resolver Extraction

Goal: reduce old runtime namespace ownership by moving the pure relay selection
precedence resolver out of `src/runtime/selection-resolver.ts`.

Files inspected:

- `src/runtime/selection-resolver.ts`
- `src/runtime/relay-selection.ts`
- `src/core-v2/executors/relay.ts`
- `tests/contracts/flow-model-effort.test.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/selection-resolver.ts`
- `src/runtime/selection-resolver.ts`
- `src/runtime/relay-selection.ts`
- `tests/contracts/flow-model-effort.test.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.11.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/flow-model-effort.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/config-loader.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/contracts/terminology-active-surface.test.ts`: passed
  after folding in `docs/positioning-and-strategy.md`.
- `npm run test:fast`: passed after folding in
  `docs/positioning-and-strategy.md`.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed after folding in
  `docs/positioning-and-strategy.md`.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `resolveSelectionForRelay` now
lives in `src/shared/selection-resolver.ts`; the old runtime
`selection-resolver.ts` file re-exports it for compatibility.

Concerns:

- Old runtime deletion is still not approved.
- `src/runtime/relay-selection.ts` remains live for retained relay decision
  behavior and core-v2 compatibility.

Next recommended action: continue with the selection-depth helper extraction,
leaving retained relayer resolution in `runtime/relay-selection.ts`.

## 2026-05-04 - Phase 4.12 Relay Selection Helper Extraction

Goal: reduce core-v2's dependency on `src/runtime/relay-selection.ts` by moving
selection-depth helper behavior into a shared module while leaving retained
relayer resolution in the runtime bridge.

Files inspected:

- `src/runtime/relay-selection.ts`
- `src/runtime/runner.ts`
- `src/runtime/step-handlers/relay.ts`
- `src/core-v2/executors/relay.ts`
- `tests/runner/runner-relay-provenance.test.ts`
- `tests/runner/build-runtime-wiring.test.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/relay-selection.ts`
- `src/runtime/relay-selection.ts`
- `src/core-v2/executors/relay.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.12.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/flow-model-effort.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/build-runtime-wiring.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `deriveResolvedSelection`,
`selectionConfigLayersWithExecutionDepth`, and
`bindsExecutionDepthToRelaySelection` now live in
`src/shared/relay-selection.ts`; `src/runtime/relay-selection.ts` re-exports
them for retained runtime compatibility.

Concerns:

- Old runtime deletion is still not approved.
- `src/runtime/relay-selection.ts` remains live for retained relayer resolution,
  connector bridge behavior, old relay handler imports, and relay provenance
  tests.

Next recommended action: continue with relay-support helper extraction, still
without moving retained connector/registry/path infrastructure.

## 2026-05-04 - Phase 4.13 Relay Support Helper Extraction

Goal: reduce core-v2's dependency on `src/runtime/relay-support.ts` by moving
relay prompt composition and check evaluation helpers into a shared module.

Files inspected:

- `src/runtime/relay-support.ts`
- `src/runtime/step-handlers/relay.ts`
- `src/runtime/step-handlers/fanout.ts`
- `src/core-v2/executors/relay.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/relay-support.ts`
- `src/runtime/relay-support.ts`
- `src/core-v2/executors/relay.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.13.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/relay-handler-direct.test.ts tests/runner/materializer-schema-parse.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `composeRelayPrompt`,
`evaluateRelayCheck`, `RelayStep`, `CheckEvaluation`, and
`NO_VERDICT_SENTINEL` now live in `src/shared/relay-support.ts`;
`src/runtime/relay-support.ts` re-exports them for retained runtime
compatibility.

Concerns:

- Old runtime deletion is still not approved.
- The shared helper still imports retained shape-hint registry and run-relative
  path helpers; those moves are deferred.

Next recommended action: extract the write-capable worker disclosure helper,
which core-v2 progress still imports from the runtime namespace.

## 2026-05-04 - Phase 4.14 Write-Capable Worker Disclosure Extraction

Goal: reduce core-v2's dependency on `src/runtime/write-capable-worker-disclosure.ts`
by moving the disclosure helper into a shared module.

Files inspected:

- `src/runtime/write-capable-worker-disclosure.ts`
- `src/core-v2/projections/progress.ts`
- `src/runtime/runner.ts`
- `src/runtime/operator-summary-writer.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/write-capable-worker-disclosure.ts`
- `src/runtime/write-capable-worker-disclosure.ts`
- `src/core-v2/projections/progress.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.14.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/progress-event-schema.test.ts tests/runner/cli-v2-runtime.test.ts tests/runner/operator-summary-writer.test.ts tests/contracts/terminology-active-surface.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. The disclosure constant and
flow helpers now live in `src/shared/write-capable-worker-disclosure.ts`;
`src/runtime/write-capable-worker-disclosure.ts` re-exports them for retained
runtime compatibility.

Concerns:

- Old runtime deletion is still not approved.
- Retained runtime and operator summary code still import the old wrapper path.

Next recommended action: inspect `src/runtime/run-relative-path.ts` as the next
possible behavior-preserving shared helper move. Stop for review if the move
would affect path safety semantics instead of only import ownership.

## 2026-05-04 - Phase 4.15 Run-Relative Path Helper Extraction

Goal: reduce shared flow writer and core-v2 support dependencies on
`src/runtime/run-relative-path.ts` without changing path safety semantics.

Files inspected:

- `src/runtime/run-relative-path.ts`
- `src/shared/relay-support.ts`
- flow-owned report writers under `src/flows/*/writers/`
- `tests/runner/run-relative-path.test.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/run-relative-path.ts`
- `src/runtime/run-relative-path.ts`
- `src/shared/relay-support.ts`
- flow-owned report writers under `src/flows/*/writers/`
- `tests/runner/run-relative-path.test.ts`
- `docs/contracts/step.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.15.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-relative-path.test.ts tests/runner/materializer-schema-parse.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/build-report-writer.test.ts tests/runner/fix-report-writer.test.ts tests/runner/explore-report-writer.test.ts tests/runner/sweep-runtime-wiring.test.ts tests/runner/migrate-runtime-wiring.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `resolveRunRelative` now lives
in `src/shared/run-relative-path.ts`; `src/runtime/run-relative-path.ts`
re-exports it for retained runtime compatibility.

Concerns:

- Old runtime deletion is still not approved.
- The shared helper remains load-bearing path safety code; future semantic
  edits to containment or symlink behavior should be reviewed separately.

Next recommended action: stop for a heavier review before moving connector
subprocess/shared modules or registries. Those are production safety and
catalog-discovery boundaries, not just wrapper ownership cleanup.

## 2026-05-04 - Phase 4.16 Connector Relay Data and Hash Extraction

Goal: reduce core-v2 and shared type dependencies on
`src/runtime/connectors/shared.ts` without moving connector subprocess modules
or registries.

Files inspected:

- `src/runtime/connectors/shared.ts`
- `src/shared/relay-runtime-types.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/flows/build/writers/checkpoint-brief.ts`
- connector smoke fingerprint source lists
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/connector-relay.ts`
- `src/runtime/connectors/shared.ts`
- `src/shared/relay-runtime-types.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/flows/build/writers/checkpoint-brief.ts`
- `tests/runner/connector-shared-compat.test.ts`
- `tests/runner/codex-relay-roundtrip.test.ts`
- `tests/runner/explore-e2e-parity.test.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.16.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/connector-shared-compat.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/materializer-schema-parse.test.ts tests/runner/config-loader.test.ts tests/runner/extract-json-object.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/explore-e2e-parity.test.ts tests/core-v2/connectors-v2.test.ts tests/core-v2/default-executors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `ConnectorRelayInput`,
`RelayResult`, and `sha256Hex` now live in `src/shared/connector-relay.ts`;
`src/runtime/connectors/shared.ts` re-exports them for retained runtime and
connector compatibility.

Concerns:

- Old runtime deletion is still not approved.
- Connector subprocess modules, relay materialization, and registries remain
  production safety and catalog-discovery boundaries.

Next recommended action: stop for review before moving subprocess connector
modules, connector-only parsing/model helpers, relay materialization, or
registries.

## 2026-05-04 - Phase 4.17 Connector Helper Extraction

Goal: reduce runtime connector namespace ownership by moving connector parsing
and model-selection helper functions to a shared module without moving
subprocess connector modules or relay materialization.

Files inspected:

- `src/runtime/connectors/shared.ts`
- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/codex.ts`
- `src/runtime/connectors/custom.ts`
- `tests/runner/extract-json-object.test.ts`
- connector smoke fingerprint source lists
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/connector-helpers.ts`
- `src/runtime/connectors/shared.ts`
- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/codex.ts`
- `src/runtime/connectors/custom.ts`
- `tests/runner/connector-shared-compat.test.ts`
- `tests/runner/extract-json-object.test.ts`
- `tests/runner/codex-relay-roundtrip.test.ts`
- `tests/runner/explore-e2e-parity.test.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.17.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: initially failed on a readonly test fixture type in
  `tests/runner/connector-shared-compat.test.ts`, then passed after typing the
  fixture as `ResolvedSelection`.
- `npx vitest run tests/runner/connector-shared-compat.test.ts tests/runner/extract-json-object.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/agent-connector-smoke.test.ts tests/runner/codex-connector-smoke.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/materializer-schema-parse.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: initially failed once with unrelated full-suite
  cross-talk symptoms; isolated reruns of the affected suites passed, and the
  final `npm run verify` rerun passed.

Behavior changed? No runtime behavior changed. `selectedModelForProvider` and
`extractJsonObject` now live in `src/shared/connector-helpers.ts`;
`src/runtime/connectors/shared.ts` re-exports them for retained runtime and old
import compatibility.

Concerns:

- Old runtime deletion is still not approved.
- Connector subprocess modules and relay materialization remain production
  safety boundaries.
- Registries remain catalog/report/writer discovery infrastructure.

Next recommended action: stop for review before moving subprocess connector
modules, relay materialization, or registries.

## 2026-05-04 - Phase 4.18 Connector, Materializer, And Registry Ownership Plans

Goal: prepare the next retained-runtime narrowing strategy without moving
production-sensitive connector subprocess modules, relay materialization, or
registries.

Files inspected:

- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/codex.ts`
- `src/runtime/connectors/custom.ts`
- `src/runtime/connectors/relay-materializer.ts`
- `src/runtime/connectors/shared.ts`
- `src/runtime/registries/**`
- `src/runtime/catalog-derivations.ts`
- `src/flows/catalog.ts`
- `src/flows/types.ts`
- connector smoke fingerprint source lists
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`

Files changed:

- `docs/architecture/v2-connector-materializer-plan.md`
- `docs/architecture/v2-registry-ownership-plan.md`
- `docs/architecture/v2-checkpoint-4.18.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`
- `tests/runner/codex-relay-roundtrip.test.ts`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/connector-shared-compat.test.ts tests/runner/extract-json-object.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/explore-e2e-parity.test.ts`:
  passed.
- `npx vitest run tests/runner/catalog-derivations.test.ts tests/contracts/catalog-completeness.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/close-builder-registry.test.ts tests/runner/relay-shape-hint-registry.test.ts tests/runner/cross-report-validators.test.ts tests/properties/visible/cross-report-validator.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: initially failed when run concurrently with
  `test:fast` because the emit-flows drift test temporarily created stale
  `never-a-mode` fixtures; the files were gone after the test completed, and a
  serial rerun passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This slice adds ownership plans
and fixes a stale connector smoke comment that still said "three" source files
after the connector fingerprint list grew in Phases 4.16 and 4.17.

Concerns:

- Old runtime deletion is still not approved.
- Connector subprocess modules and relay materialization remain production
  safety boundaries.
- Registries remain catalog/report/writer discovery infrastructure.

Next recommended action: run validation, then stop for heavy review before
moving connector subprocess modules, relay materialization, or registries.

## 2026-05-04 - Phase 4.26 Trace, Status, And Progress Ownership Plan

Goal: plan trace/status/progress ownership before moving operator-facing
projection code.

Files inspected:

- `src/runtime/run-status-projection.ts`
- `src/runtime/progress-projector.ts`
- `src/runtime/reducer.ts`
- `src/runtime/append-and-derive.ts`
- `src/runtime/snapshot-writer.ts`
- `src/runtime/trace-reader.ts`
- `src/runtime/trace-writer.ts`
- `src/core-v2/projections/status.ts`
- `src/core-v2/projections/progress.ts`
- `src/cli/runs.ts`
- `src/shared/progress-output.ts`

Files changed:

- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-checkpoint-4.26.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. No trace, status, progress,
snapshot, reducer, runner, handler, or checkpoint code moved.

Concerns:

- This is a real operator-facing boundary. `runs show`, progress JSONL,
  v1 trace/reducer/snapshot state, and v2 projection compatibility should be
  reviewed before moving projection internals.
- The next safe implementation slice is only a neutral public import surface
  for `projectRunStatusFromRunFolder(...)`, not a rewrite of status/progress
  behavior.

Next recommended action: validate this packet and stop for review before moving
`run-status-projection.ts`, `progress-projector.ts`, trace reader/writer,
reducer, snapshot writer, or checkpoint-resume-adjacent code.

## 2026-05-04 - Phase 4.25 Result Path Helper Move

Goal: implement the path-only result helper extraction recommended by Phase
4.24 without merging retained and v2 result writers.

Files inspected:

- `src/runtime/result-writer.ts`
- `src/core-v2/run/result-writer.ts`
- `src/runtime/runner.ts`
- `src/core-v2/projections/progress.ts`
- `src/shared/operator-summary-writer.ts`
- `src/cli/circuit.ts`

Files changed:

- `src/shared/result-path.ts`
- `src/runtime/result-writer.ts`
- `src/core-v2/run/result-writer.ts`
- `src/runtime/runner.ts`
- `src/core-v2/projections/progress.ts`
- `src/shared/operator-summary-writer.ts`
- `src/cli/circuit.ts`
- `tests/runner/result-path-compat.test.ts`
- `docs/architecture/v2-checkpoint-4.25.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-result-writer-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/result-path-compat.test.ts tests/runner/runtime-smoke.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/run-status-projection.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/fanout-runtime.test.ts tests/core-v2 tests/parity tests/runner/cli-v2-runtime.test.ts`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No intended behavior change. The shared helper owns the
`reports/result.json` path, while retained and v2 result writers remain
separate.

Concerns:

- `src/runtime/result-writer.ts` is still live and not deletable.
- The result writers still have different lifecycle ownership; do not merge
  them without a trace/status/progress ownership review.

Next recommended action: after validation, continue with a trace/status/progress
ownership plan if more narrowing is needed. Do not move those projection
modules without a plan.

## 2026-05-04 - Phase 4.24 Result Writer Plan

Goal: decide whether result writing can be narrowed safely before moving any
code across the retained/v2 result boundary.

Files inspected:

- `src/runtime/result-writer.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/schemas/result.ts`
- `src/runtime/runner.ts`
- `src/runtime/run-status-projection.ts`
- `src/runtime/step-handlers/sub-run.ts`
- `src/runtime/step-handlers/fanout.ts`
- `tests/runner/runtime-smoke.test.ts`
- `tests/runner/terminal-outcome-mapping.test.ts`
- `tests/runner/run-status-projection.test.ts`

Files changed:

- `docs/architecture/v2-result-writer-plan.md`
- `docs/architecture/v2-checkpoint-4.24.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No runtime behavior changed. This is a planning slice only.

Concerns:

- The retained and v2 result writers both write `reports/result.json`, but
  their lifecycle ownership differs enough that merging them now would be too
  broad.
- `checkpoint_waiting` remains retained-only and intentionally has no
  `reports/result.json`.

Next recommended action: after validation, implement only a path-helper
extraction for `reports/result.json` if the team wants a low-risk next code
slice. Do not merge retained and v2 writers yet.

## 2026-05-04 - Phase 4.23 Heavy Boundary Plan

Goal: stop the mechanical helper-extraction lane at the real architecture
boundary and classify the remaining runtime clusters before any risky move.

Files inspected:

- `docs/architecture/v2-connector-materializer-plan.md`
- `docs/architecture/v2-registry-ownership-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `scripts/release/emit-current-capabilities.mjs`
- `generated/release/current-capabilities.json`

Files changed:

- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-checkpoint-4.23.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`
- `scripts/release/emit-current-capabilities.mjs`
- `generated/release/current-capabilities.json`

Tests run:

- `npm run check`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`
- `npm run lint`
- `npm run build`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`

Behavior changed? No runtime behavior changed. This is a planning and evidence
correction slice. Release evidence for write-capable worker disclosure now
includes both the shared implementation and runtime compatibility wrapper.

Concerns:

- Old runtime deletion is still not approved.
- Remaining runtime namespace work crosses real product/safety boundaries.

Next recommended action: review the heavy-boundary plan before implementing any
move involving connectors, relay materialization, registries, router/catalog,
trace/status/progress, checkpoint resume, the old runner, or old handlers.

## 2026-05-04 - Phase 4.22 Config Loader Move

Goal: continue retained-runtime narrowing without changing config precedence or
connector selection by moving schema-backed config discovery out of the runtime
namespace.

Files inspected:

- `src/runtime/config-loader.ts`
- `tests/runner/config-loader.test.ts`
- `src/cli/circuit.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/config-loader.ts`
- `src/runtime/config-loader.ts`
- `src/cli/circuit.ts`
- `tests/runner/config-loader.test.ts`
- `docs/architecture/v2-checkpoint-4.22.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`
- `npx vitest run tests/runner/config-loader.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/contracts/flow-model-effort.test.ts tests/runner/runner-relay-provenance.test.ts`
- `npm run lint`
- `npm run build`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`

Behavior changed? No runtime behavior changed. Config discovery now lives in
`src/shared/config-loader.ts`; `src/runtime/config-loader.ts` re-exports it for
compatibility. User-global, project, and invocation layer ordering is unchanged.

Concerns:

- Old runtime deletion is still not approved.
- Connector subprocess modules, relay materialization, registries, router,
  trace/status projection, and checkpoint resume remain heavy-review
  boundaries.

Next recommended action: run validation, then stop. The obvious remaining
runtime namespace moves are no longer small helper extractions.

## 2026-05-04 - Phase 4.21 Operator Summary Writer Move

Goal: continue retained-runtime narrowing without changing user-visible summary
behavior by moving shared operator summary output infrastructure out of the
runtime namespace.

Files inspected:

- `src/runtime/operator-summary-writer.ts`
- `tests/runner/operator-summary-writer.test.ts`
- `scripts/release/emit-current-capabilities.mjs`
- `src/cli/circuit.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/operator-summary-writer.ts`
- `src/runtime/operator-summary-writer.ts`
- `src/cli/circuit.ts`
- `scripts/release/emit-current-capabilities.mjs`
- `tests/runner/operator-summary-writer.test.ts`
- `docs/architecture/v2-checkpoint-4.21.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`
- `npx vitest run tests/runner/operator-summary-writer.test.ts tests/runner/cli-v2-runtime.test.ts tests/contracts/progress-event-schema.test.ts tests/contracts/terminology-active-surface.test.ts`
- `npm run lint`
- `npm run build`
- `npm run check-release-infra`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`

Behavior changed? No runtime behavior changed. Operator summary writing now
lives in `src/shared/operator-summary-writer.ts`; `src/runtime/operator-summary-writer.ts`
re-exports it for compatibility. The CLI imports the shared writer directly.

Concerns:

- Old runtime deletion is still not approved.
- User-visible summary wording did not intentionally change.
- Connector subprocess modules, relay materialization, and registries remain
  heavy-review boundaries.

Next recommended action: run validation, then stop if the next remaining move
would touch connector subprocess modules, relay materialization, registries,
checkpoint resume ownership, selector behavior, or old runtime deletion.

## 2026-05-04 - Phase 4.20 Manifest Snapshot Helper Move

Goal: continue retained-runtime narrowing without changing resume/checkpoint
ownership by moving the old manifest snapshot byte-match helper out of the
runtime namespace.

Files inspected:

- `src/runtime/manifest-snapshot-writer.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `src/runtime/run-status-projection.ts`
- `src/cli/handoff.ts`
- `tests/unit/runtime/event-log-round-trip.test.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/manifest-snapshot.ts`
- `src/runtime/manifest-snapshot-writer.ts`
- `src/runtime/run-status-projection.ts`
- `src/cli/handoff.ts`
- `tests/unit/runtime/event-log-round-trip.test.ts`
- `docs/architecture/v2-checkpoint-4.20.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`
- `npm run lint`
- `npx vitest run tests/unit/runtime/event-log-round-trip.test.ts tests/runner/run-status-projection.test.ts tests/runner/fresh-run-root.test.ts tests/runner/handoff-hook-adapters.test.ts`
- `npm run build`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`

Behavior changed? No runtime behavior changed. The old manifest snapshot
read/write/hash helper now lives in `src/shared/manifest-snapshot.ts`;
`src/runtime/manifest-snapshot-writer.ts` re-exports it for compatibility.
The v2 raw-byte manifest snapshot implementation remains separate in
`src/core-v2/run/manifest-snapshot.ts`.

Concerns:

- Old runtime deletion is still not approved.
- Checkpoint resume ownership did not change.
- Connector subprocess modules, relay materialization, and registries remain
  heavy-review boundaries.

Next recommended action: run validation, then stop if the next remaining move
would touch connector subprocess modules, relay materialization, registries,
checkpoint resume ownership, selector behavior, or old runtime deletion.

## 2026-05-04 - Phase 4.19 Flow-Kind Policy Wrapper Move

Goal: continue retained-runtime narrowing without crossing a production-sensitive
boundary by moving generated-surface/fixture flow-kind policy ownership out of
the runtime namespace.

Files inspected:

- `src/runtime/policy/flow-kind-policy.ts`
- `scripts/policy/flow-kind-policy.mjs`
- `scripts/policy/flow-kind-policy.d.mts`
- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `tests/contracts/flow-kind-policy.test.ts`
- `tests/runner/explore-e2e-parity.test.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/flow-kind-policy.ts`
- `src/runtime/policy/flow-kind-policy.ts`
- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `scripts/policy/flow-kind-policy.mjs`
- `scripts/policy/flow-kind-policy.d.mts`
- `tests/contracts/flow-kind-policy.test.ts`
- `tests/runner/explore-e2e-parity.test.ts`
- `docs/architecture/v2-checkpoint-4.19.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/contracts/flow-kind-policy.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/cli-v2-runtime.test.ts`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`

Behavior changed? No runtime behavior changed. `validateCompiledFlowKindPolicy`
now lives in `src/shared/flow-kind-policy.ts`; `src/runtime/policy/flow-kind-policy.ts`
re-exports it for compatibility. The underlying canonical policy table remains
in `scripts/policy/flow-kind-policy.mjs`.

Concerns:

- Old runtime deletion is still not approved.
- Connector subprocess modules, relay materialization, and registries remain
  heavy-review boundaries.

Next recommended action: run validation, then continue only if the next slice
does not move connector subprocess modules, relay materialization, registries,
checkpoint resume, or old runtime deletion.

## 2026-05-04 - Phase 4.4 Default-Routing Candidate

Goal: begin a default-routing candidate slice without switching the production
default runtime or deleting old runtime code.

Files inspected:

- `src/cli/circuit.ts`
- `src/cli/runs.ts`
- `src/runtime/run-status-projection.ts`
- `src/schemas/run-status.ts`
- `src/schemas/progress-event.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `tests/runner/cli-v2-runtime.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `src/runtime/run-status-projection.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/projections/progress.ts`
- `src/schemas/progress-event.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.4.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Normal CLI default behavior is unchanged. The internal v2
path now has a matrix-based candidate selector behind
`CIRCUIT_V2_RUNTIME_CANDIDATE=1`, v2 run folders work with `runs show --json`,
and v2 progress includes nested child-run and fanout lifecycle evidence.

Concerns:

- Default routing is still not switched.
- Old runtime deletion is still not approved.
- Checkpoint pause/resume remains old-runtime-owned.
- Modes outside the matrix intentionally stay on the retained runtime.

Next recommended action: review the Phase 4.4 packet, then prepare a default
switch proposal only for matrix-supported fresh-run modes.

## 2026-05-04 - Phase 4.5 Default-Switch Proposal Hardening

Goal: prepare the default-routing proposal for matrix-supported fresh-run modes
without switching the production default runtime.

Files inspected:

- `src/cli/circuit.ts`
- `src/runtime/run-status-projection.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/core-v2/projections/progress.ts`
- `src/schemas/progress-event.ts`
- `tests/runner/run-status-projection.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/contracts/progress-event-schema.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `src/runtime/run-status-projection.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/core-v2/projections/progress.ts`
- `src/schemas/progress-event.ts`
- `tests/runner/run-status-projection.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/contracts/progress-event-schema.test.ts`
- `docs/architecture/v2-checkpoint-4.5.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Normal CLI default behavior is unchanged. The candidate path
is stricter around arbitrary fixtures, v2 traces now carry an explicit
`engine: "core-v2"` marker, v2 open status projection is retry-aware, and
fanout progress branch events carry `branch_kind` without requiring every
branch to expose child-run/worktree semantics.

Concerns:

- Default routing is still not switched.
- Old runtime deletion is still not approved.
- Checkpoint pause/resume remains old-runtime-owned.
- The next review should decide whether the selector can become the normal
  default for matrix-supported fresh-run modes.

Next recommended action: package Phase 4.5 for review as the default-switch
proposal gate.

## 2026-05-04 - Phase 4.6 Default-Switch Proposal

Goal: implement the default selector for matrix-supported fresh-run modes while
keeping rollback, strict opt-in, retained runtime fallback, and old runtime
code intact.

Files inspected:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.5.md`
- `docs/architecture/v2-worklog.md`

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.6.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed after rerunning without concurrent stale-file tests.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Normal fresh-run routing now uses the matrix-supported v2
selector by default. Unsupported modes, checkpoint resume, checkpoint-waiting
depths, and arbitrary explicit fixtures still use the retained runtime.
`CIRCUIT_DISABLE_V2_RUNTIME=1` rolls normal routing back to the retained
runtime. Strict `CIRCUIT_V2_RUNTIME=1` still force-tests v2 and fails closed for
unsupported invocations.

Concerns:

- Old runtime deletion is still not approved.
- Checkpoint pause/resume remains old-runtime-owned.
- Candidate mode is now primarily diagnostic and should be removed or
  reclassified after the default selector is reviewed.

Next recommended action: run full validation, then package Phase 4.6 for review
as the actual default-switch proposal gate.

## 2026-05-04 - Phase 4.6.1 Default Selector Stabilization

Goal: address the post-Phase-4.6 review note that exported
`main(..., { composeWriter })` behavior must not be silently ignored by the
default v2 selector.

Files inspected:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.6.md`
- `docs/architecture/v2-worklog.md`

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.6.md`
- `docs/architecture/v2-checkpoint-4.6.1.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Programmatic `composeWriter` injections now keep normal and
candidate routing on the retained runtime. Strict v2 opt-in fails closed when
`composeWriter` is supplied, because core-v2 does not yet expose an equivalent
compose writer hook.

Concerns:

- Old runtime deletion is still not approved.
- Candidate diagnostics should be removed or renamed after one release soak.

Next recommended action: run focused validation, then full validation.

## 2026-05-03 - Phase 4.1.1 Production Readiness Corrections

Goal: address the remaining review blockers before any opt-in v2 CLI routing.

Files inspected:

- `src/core-v2/executors/relay.ts`
- `src/core-v2/run-files/run-file-store.ts`
- `src/runtime/step-handlers/relay.ts`
- `src/runtime/runner-types.ts`
- `docs/architecture/v2-deletion-plan.md`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/core-v2/core-v2-baseline.test.ts`

Files changed:

- `src/core-v2/executors/relay.ts`
- `src/core-v2/run-files/run-file-store.ts`
- `src/runtime/relay-support.ts`
- `src/runtime/step-handlers/relay.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/default-executors-v2.test.ts`
- `docs/architecture/v2-checkpoint-4.1.1.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No production CLI behavior changed. The opt-in v2 relay path
now treats manifest connector identity as authoritative, blocks accidental
schema-tagged text writes, and proves one generated Review flow can run through
default v2 executors without parity helper executors.

Concerns:

- `RelayFn` still lives in `src/runtime/runner-types.ts` and should move to a
  neutral connector type module before old runtime deletion.
- Checkpoint resume remains intentionally retained on the old runtime path.

Next recommended action: run validation and request review before starting
opt-in v2 CLI routing.

## 2026-05-03 - Phase 4.1.2 Connector Precedence Preflight

Goal: fix the reviewer-identified custom connector descriptor precedence issue
before adding any opt-in v2 CLI routing.

Files inspected:

- `src/core-v2/connectors/resolver.ts`
- `src/core-v2/executors/relay.ts`
- `tests/core-v2/connectors-v2.test.ts`

Files changed:

- `src/core-v2/executors/relay.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2/connectors-v2.test.ts`: passed.
- Full validation pending.

Behavior changed? No production CLI behavior changed. The opt-in v2 relay
resolution bridge now resolves custom step connectors with the same effective
layer precedence used by the connector resolver: later config layers override
earlier connector descriptors.

Concerns:

- This is still a preflight for opt-in CLI routing. It does not switch the CLI
  or change old runtime deletion status.

Next recommended action: run validation, then start the opt-in v2 CLI routing
slice if the preflight remains green.

## 2026-05-04 - Phase 4.2.5 Sweep Opt-in CLI Routing

Goal: expand the internal v2 CLI opt-in path to generated Sweep default fresh
runs.

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.5.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Default CLI behavior did not change. With
`CIRCUIT_V2_RUNTIME=1`, fresh Sweep default runs can now route through the v2
CLI path. The opt-in allowlist now covers the current public generated flows:
Review, Fix, Build, Explore, Migrate, and Sweep.

Concerns:

- The generated Sweep default manifest currently has no fanout step, so this is
  not fanout CLI parity.
- v2 runtime progress/status projection is still incomplete.
- Old runtime deletion remains out of scope.

Next recommended action: run validation. If green, pause before default-routing
work, because the next gate is progress/status parity and default-route
readiness rather than another small allowlist expansion.

## 2026-05-04 - Phase 4.3 Progress/Status Projection

Goal: close the biggest default-routing blocker left after public-flow opt-in
coverage by adding CLI-visible v2 runtime progress.

Files changed:

- `src/core-v2/domain/trace.ts`
- `src/core-v2/trace/trace-store.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/projections/status.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/executors/sub-run.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/cli/circuit.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.3.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Default CLI behavior did not change. With
`CIRCUIT_V2_RUNTIME=1` and `--progress jsonl`, v2 fresh runs now emit runtime
progress in addition to `route.selected`.

Concerns:

- v2 still does not implement checkpoint waiting or resume progress; those
  modes remain fail-closed or old-runtime-owned.
- Progress parity should get one more review before v2 becomes the default CLI
  runtime.

Next recommended action: run full validation. If green, prepare a heavyweight
review packet before default-routing work.

## 2026-05-04 - Phase 4.2.4 Migrate Opt-in CLI Routing

Goal: expand the internal v2 CLI opt-in path to generated Migrate default fresh
runs and prove child Build sub-run execution through the CLI path.

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.4.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Default CLI behavior did not change. With
`CIRCUIT_V2_RUNTIME=1`, fresh Migrate default runs can now route through the v2
CLI path and launch a generated Build child run. Sweep remains rejected by the
opt-in allowlist.

Concerns:

- Migrate deep/autonomous behavior beyond the generated default smoke is not
  claimed here.
- v2 runtime progress/status projection is still incomplete.
- Old runtime deletion remains out of scope.

Next recommended action: run validation, then continue to Sweep only if this
checkpoint remains green.

## 2026-05-04 - Phase 4.2.3 Explore Opt-in CLI Routing

Goal: expand the internal v2 CLI opt-in path by one flow, starting with
generated Explore default fresh runs.

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.3.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Default CLI behavior did not change. With
`CIRCUIT_V2_RUNTIME=1`, fresh Explore default runs can now route through the v2
CLI path. Migrate and Sweep remain rejected by the opt-in allowlist.

Concerns:

- Explore tournament mode still contains a checkpoint-waiting path and remains
  blocked by the checkpoint-depth guard.
- v2 runtime progress/status projection is still incomplete.
- Old runtime deletion remains out of scope.

Next recommended action: run validation, then continue one-flow-at-a-time with
Migrate only if the checkpoint remains green.

## 2026-05-03 - Phase 4.2.2 Opt-in CLI Evidence Completion

Goal: finish the reviewer-requested evidence before expanding the v2 CLI
allowlist.

Files changed:

- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.2.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No default CLI behavior changed. `CIRCUIT_V2_RUNTIME=1`
remains explicit and opt-in. The CLI evidence now proves normal generated Fix
lite resolution, real custom connector execution without an injected relayer,
and fail-closed rejection for Explore, Migrate, and Sweep.

Concerns:

- v2 runtime progress/status projection is still incomplete.
- Explore, Migrate, and Sweep remain outside the opt-in v2 CLI allowlist.
- Old runtime deletion remains out of scope.

Next recommended action: run validation, then proceed to one-flow-at-a-time
opt-in expansion only after this checkpoint is green.

## 2026-05-03 - Phase 4.2.1 Opt-in CLI Evidence Hardening

Goal: close the reviewer gap around the Phase 4.2 opt-in CLI allowlist before
expanding v2 routing.

Files changed:

- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.1.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No default CLI behavior changed. `CIRCUIT_V2_RUNTIME=1`
remains explicit and opt-in. The test evidence now includes generated Fix lite,
generated Build default, route-only progress behavior, and CLI-level custom
connector descriptor precedence.

Concerns:

- v2 runtime progress is still not threaded into the old progress projection
  surface. The opt-in CLI path currently emits `route.selected` only.
- Explore, Migrate, and Sweep remain outside the opt-in v2 CLI allowlist.

Next recommended action: run validation, package Phase 4.2.1 for review, and
wait for reviewer approval before expanding opt-in routing.

## 2026-05-03 - Phase 4.2 Opt-in v2 CLI Routing

Goal: add an explicitly opt-in v2 CLI execution path for fresh runs without
changing the production default runtime.

Files inspected:

- `src/cli/circuit.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/executors/checkpoint.ts`
- `tests/runner/cli-router.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/executors/compose.ts`
- `src/core-v2/executors/sub-run.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Production default behavior did not change. When
`CIRCUIT_V2_RUNTIME=1` is set, fresh Review/Fix/Build runs can use the v2
runtime through the CLI. Resume, checkpoint-waiting depths, and complex flows
outside the current opt-in allowlist fail closed before v2 writes a run folder.

Concerns:

- The opt-in allowlist is intentionally narrow. Explore, Migrate, and Sweep
  should be added only with dedicated CLI smoke coverage.
- Default routing and old runtime deletion remain out of scope.

Next recommended action: run validation and request review before expanding
the opt-in allowlist or considering any default routing.

## 2026-05-03 - Phase 4.1 Production Runtime Readiness

Goal: address Checkpoint 4 review findings without deleting old runtime code.

Files changed:

- `src/flows/types.ts`
- `src/flows/*/index.ts`
- `src/runtime/catalog-derivations.ts`
- `src/core-v2/run-files/report-validator.ts`
- `src/core-v2/run-files/run-file-store.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/run/v1-compat.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/executors/compose.ts`
- `src/core-v2/executors/verification.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/executors/index.ts`
- `src/core-v2/executors/fanout.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/core-v2/sub-run-v2.test.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/explore-v2.test.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-4.1.md`
- `docs/architecture/v2-worklog.md`

Behavior changed? No production CLI behavior changed. The opt-in v2 path now
has production-capable bridges for compose, verification, checkpoint safe
choices, and relay execution. Report validation is enforced at schema-tagged
run-file writes through the catalog-derived report schema registry.

Checkpoint decision: old runner/checkpoint resume remains retained. v2 supports
fresh-run safe checkpoint choices, but deep/tournament pause/resume is not yet a
v2 production path.

Tests run so far:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2/core-v2-baseline.test.ts tests/core-v2/connectors-v2.test.ts tests/core-v2/sub-run-v2.test.ts tests/core-v2/fanout-v2.test.ts tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: initially failed when run in parallel with
  `npm run test:fast` because the emit-flow drift tests temporarily created
  stale sibling fixtures; passed when rerun serially after the tests cleaned up.
- `npm run verify`: passed.
- `git diff --check`: passed.

Next recommended action: package Phase 4.1 for review. Do not delete old runtime
files yet.

## 2026-05-03 - Phase 7 Pre-Deletion Analysis

Goal: prepare Checkpoint 4 without deleting old runtime files.

Files inspected:

- `src/runtime/`
- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/step-handlers/`
- `src/runtime/compile-schematic-to-flow.ts`
- `src/runtime/catalog-derivations.ts`
- `src/runtime/selection-resolver.ts`
- `src/runtime/relay-selection.ts`
- `src/runtime/registries/`
- `src/cli/circuit.ts`
- `src/core-v2/`
- `tests/runner/`
- `tests/core-v2/`
- `tests/parity/`
- `scripts/emit-flows.mjs`
- `scripts/release/capture-golden-run-proofs.mjs`

Files changed:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-4.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed, Biome checked 396 files.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed, 11 files and 63 tests.
- `npm run test:fast`: passed, 63 files and 842 tests.
- `npm run test`: passed, 116 files, 1262 passed, 6 skipped.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No. This is a documentation-only pre-deletion checkpoint.

Concerns:

- The old graph runner and step handlers have v2 replacements, but production
  CLI execution still imports `runCompiledFlow`.
- Some files under `src/runtime/` are still live compiler, catalog, registry,
  connector, config, projection, or handoff infrastructure and should not be
  deleted as part of a broad tree removal.
- Real connector subprocess execution and config-layer threading should be
  routed through v2 before old relay deletion.
- Checkpoint resume remains the largest unresolved production behavior before
  removing the old runner entirely.

Next recommended action: stop for Checkpoint 4 review before deleting old
runtime code.

## 2026-05-03 - Phase 4 Manifest Snapshot Binding Hardening

Goal: make the v2 manifest snapshot useful as a future resume/sub-run trust
boundary, not just a self-consistent JSON file.

Files inspected:

- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/review-v2.test.ts`

Files changed:

- `src/core-v2/run/manifest-snapshot.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `docs/architecture/v2-phase-4-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2/core-v2-baseline.test.ts tests/parity/review-v2.test.ts`:
  passed.

Behavior changed? No production behavior changed. The opt-in v2 snapshot reader
now rejects mismatched run id, flow id, hash, flow-id-in-bytes, and bytes that
do not parse through the current `CompiledFlow` schema.

Concerns:

- This still does not implement resume. It creates the validation boundary
  that resume and child-run snapshot checks can use.

Next recommended action: run validation, then proceed to Phase 5 authoring and
compiler simplification if Phase 4 remains green.

## 2026-05-03 - Phase 5 Authoring Schema First Slice

Goal: reduce authoring/compiler complexity after v2 parity by starting with
the smallest schema simplification that preserves generated output.

Files inspected:

- `src/schemas/flow-schematic.ts`
- `src/runtime/compile-schematic-to-flow.ts`
- `src/schemas/route-policy.ts`
- `tests/contracts/flow-schematic.test.ts`
- `tests/contracts/compile-schematic-to-flow.test.ts`

Files changed:

- `src/schemas/flow-schematic.ts`
- `src/schemas/flow-schematic-policy.ts`
- `tests/contracts/flow-schematic.test.ts`
- `docs/architecture/v2-phase-5-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/contracts/flow-schematic.test.ts tests/contracts/compile-schematic-to-flow.test.ts`:
  passed after updating expected invalid-execution error wording.
- `npx vitest run tests/contracts/flow-schematic.test.ts tests/contracts/compile-schematic-to-flow.test.ts tests/contracts/flow-kind-policy.test.ts`:
  passed.

Behavior changed? No runtime or generated behavior changed. Authoring execution
validation now uses a discriminated union, so invalid execution objects report
strict variant errors instead of the old manual cross-field messages.

Concerns:

- Report-ref-first authoring and Build checkpoint policy ownership remain
  deferred because they can affect generated manifest parity.

Next recommended action: run full validation, then proceed to generated-surface
cleanup if Phase 5 remains green.

## 2026-05-03 - Phase 6 Generated-Surface Cleanup

Goal: make generated surface ownership explicit, drift-resistant, and free of
known stale contract references.

Files inspected:

- `docs/generated-surfaces.md`
- `scripts/emit-flows.mjs`
- `tests/unit/emit-flows-drift.test.ts`
- `tests/contracts/catalog-completeness.test.ts`
- `specs/invariants.json`
- `specs/reports.json`
- `specs/behavioral/prose-yaml-parity.md`

Files changed:

- `scripts/emit-flows.mjs`
- `docs/generated-surfaces.md`
- `tests/contracts/catalog-completeness.test.ts`
- `specs/invariants.json`
- `specs/reports.json`
- `specs/behavioral/prose-yaml-parity.md`
- `docs/architecture/v2-phase-6-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run build`: passed before regenerating surfaces.
- `node scripts/emit-flows.mjs`: regenerated surfaces.

Behavior changed? No runtime behavior changed. The generated source map now
documents surface ownership more explicitly, and stale contract links now point
to `docs/contracts/compiled-flow.md`.

Concerns:

- No `commands/README.md` exists today; Phase 6 documents that absence rather
  than creating a new generated surface.

Next recommended action: run full validation, then begin Phase 7 pre-deletion
analysis.

## 2026-05-03 - Phase 4 Complex-Flow Parity Slice

Goal: complete the approved Phase 4 runtime parity slice for complex flow
behavior: sub-run, fanout, connector safety, worktree cleanup, aggregate
reports, and representative Explore/Migrate/Sweep parity.

Files inspected:

- `src/runtime/step-handlers/sub-run.ts`
- `src/runtime/step-handlers/fanout.ts`
- `src/runtime/step-handlers/fanout/branch-resolution.ts`
- `src/runtime/step-handlers/fanout/join-policy.ts`
- `src/runtime/relay-selection.ts`
- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/codex.ts`
- `src/schemas/connector.ts`
- `src/schemas/step.ts`
- `generated/flows/explore/circuit.json`
- `generated/flows/explore/tournament.json`
- `generated/flows/migrate/circuit.json`
- `generated/flows/sweep/circuit.json`

Files changed:

- `src/core-v2/domain/trace.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/executors/index.ts`
- `src/core-v2/executors/sub-run.ts`
- `src/core-v2/executors/fanout.ts`
- `src/core-v2/fanout/aggregate-report.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/core-v2/fanout/branch-expansion.ts`
- `src/core-v2/fanout/join-policy.ts`
- `src/core-v2/fanout/types.ts`
- `src/core-v2/fanout/worktree.ts`
- `src/core-v2/connectors/connector.ts`
- `src/core-v2/connectors/resolver.ts`
- `tests/core-v2/sub-run-v2.test.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/explore-v2.test.ts`
- `tests/parity/migrate-v2.test.ts`
- `tests/parity/sweep-v2.test.ts`
- `docs/architecture/v2-phase-4-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed before docs update.
- `npx vitest run tests/core-v2 tests/parity`: initially failed because new
  parity tests used non-UUID run ids with manifest snapshots, then passed after
  switching those run ids to UUIDs.

Behavior changed? No production behavior changed. The opt-in v2 path now has
sub-run execution, fanout execution, connector safety checks, aggregate report
writing, worktree cleanup, and representative complex-flow parity tests.

Concerns:

- v2 trace is closer to the current trace contract but still not fully schema
  identical.
- Real connector subprocess execution remains old-runtime-owned; v2 tests use
  injected connectors.
- Disjoint-merge validates branch file disjointness and cleanup, but does not
  yet merge branch worktrees into the parent tree.
- Resume and nested checkpoint handling remain deferred.

Next recommended action: run full validation, then review Phase 4 before
starting authoring/compiler simplification.

## 2026-05-02 - Phase 4 Manifest Snapshot Review Fix

Goal: address adversarial review finding that v2 snapshot bootstrap could
reuse a non-empty run directory or leave a snapshot behind on manifest hash
mismatch.

Files inspected:

- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `src/core-v2/trace/trace-store.ts`
- `tests/core-v2/core-v2-baseline.test.ts`

Files changed:

- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. The opt-in v2 runner now
rejects non-empty run directories before bootstrap writes, computes and checks
manifest hash before snapshot writing, and uses exclusive snapshot creation.

Concerns:

- This still covers fresh-run bootstrap only. Explicit resume behavior remains
  future Phase 4 work.

Next recommended action: continue Phase 4 with sub-run parity before fanout.
