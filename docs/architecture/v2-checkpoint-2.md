# Circuit v2 Checkpoint 2

## 1. Files Created

Core v2 source:

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

Tests:

- `tests/core-v2/core-v2-baseline.test.ts`

Docs:

- `docs/architecture/v2-checkpoint-2.md`

## 2. Runtime Slice Walkthrough

The Phase 1 slice is a plain TypeScript runtime baseline beside the existing
runtime. No production CLI path uses it.

The slice can:

- Validate an executable manifest for unique steps, valid entry step, stage
  references, route targets, terminal targets, and required routes.
- Create a run directory and append trace entries through one sequence authority.
- Write and read JSON through a path-safe `RunFileStore`.
- Execute a small graph by following declared routes.
- Run `compose` and `relay` steps.
- Use a stub relay connector for tests.
- Record executor failure, close the run with outcome `aborted`, and write
  `reports/result.json`.
- Derive run status from v1-aligned trace entries.

The graph runner does not own connector safety, progress wording, fanout
internals, or flow authoring. Unsupported step kinds fail closed in the baseline
executor registry.

Phase 1.5 corrected early contract drift:

- Terminal route targets now match v1: `@complete`, `@stop`, `@handoff`,
  `@escalate`.
- Run close outcomes now use v1 labels: `complete`, `aborted`, `handoff`,
  `stopped`, `escalated`.
- Minimal trace names now match the current trace contract:
  `run.bootstrapped`, `step.entered`, `step.completed`, `step.aborted`,
  `run.closed`.
- Trace entries use `kind`, `run_id`, and `step_id` field names.
- The result path is `reports/result.json`.
- The graph runner rejects non-empty existing trace files instead of appending
  blindly.
- Trace append writes to disk before mutating in-memory state.

## 3. Plain TypeScript vs Effect Assessment

The implemented baseline used plain TypeScript only.

Does Effect make runtime dependencies clearer? Not proven in this slice. The
plain `RunContextV2` made dependencies visible enough for the baseline.

Does Effect make cleanup safer? Not proven in this slice. Cleanup pressure will
be more meaningful during connector and fanout work.

Does Effect make errors clearer? Not proven. Current validation and executor
errors are direct and readable.

Does Effect make simple control flow harder? Likely yes for this slice. The
runner is easier to explain as plain route-following code.

Would a future coding agent understand this path? Yes. The current path uses
plain objects, small stores, and direct functions.

## 4. Recommendation on Effect

Use plain TypeScript for v2.

Do not adopt Effect globally. Revisit only if later connector cleanup, fanout
cancellation, or resource-scoping work shows a concrete benefit that plain
TypeScript cannot express cleanly.

## 5. Tests Added

`tests/core-v2/core-v2-baseline.test.ts` covers:

- Valid executable flow runs to terminal result.
- Invalid route target fails validation.
- Trace sequence numbers are monotonic.
- Run-file store rejects path traversal.
- Failure path records failure and closes correctly.
- Status projection derives from trace.
- Stub relay executor writes expected run files.
- v1 terminal target labels.
- v1-aligned minimal trace names.
- Result writing to `reports/result.json`.
- Non-empty trace rejection for fresh-run-only baseline behavior.
- Persistence-first trace append memory behavior when the write fails.

## 6. Commands Run

- `npx vitest run tests/core-v2/core-v2-baseline.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: initially failed on formatting/import order in new
  `src/core-v2` and `tests/core-v2` files.
- `npx biome check --write src/core-v2 tests/core-v2`: passed and fixed the
  mechanical formatting/import issues.
- `npm run lint`: passed after formatting.
- `npm run build`: passed.
- `npm run test:fast`: passed, 53 test files and 785 tests.
- `npm run test`: passed, 106 test files, 1205 tests passed, 6 skipped.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Phase 1.5 correction commands:

- `npm run check`: passed.
- `npm run lint`: initially failed on one formatting issue in
  `tests/core-v2/core-v2-baseline.test.ts`.
- `npx biome check --write tests/core-v2/core-v2-baseline.test.ts`: passed and
  fixed the formatting issue.
- `npm run check`: passed after formatting.
- `npm run lint`: passed after formatting.
- `npm run build`: passed.
- `npx vitest run tests/core-v2/core-v2-baseline.test.ts`: passed, 9 tests.
- `npm run test:fast`: passed, 53 test files and 788 tests.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

## 7. Failures/Warnings

The only failure was the first `npm run lint`, which reported formatting/import
order issues in newly added Phase 1 files. Biome fixed those mechanically, and
the subsequent lint plus full verification passed.

In Phase 1.5, `npm run lint` again found one formatting issue in the updated
core-v2 test file. Biome fixed it mechanically, and subsequent validation
passed.

## 8. Architecture Regrets

Checkpoint-like pause is not implemented in this slice. I deferred it because
pause/resume behavior depends on the current checkpoint semantics and should be
adapted from v1 rather than invented in a minimal baseline.

The executor registry contains fail-closed placeholders for verification,
checkpoint, sub-run, and fanout. That is intentional for Phase 1, but Phase 2
and Phase 3 should avoid letting those placeholders turn into hidden runtime
behavior.

## 9. Changes Intentionally Not Made

- Existing runtime behavior was not modified.
- Production CLI behavior was not routed through v2.
- Flow authoring schemas were not changed.
- Generated flow manifests were not modified.
- Zod was not replaced.
- Effect was not adopted.
- Old runtime code was not deleted.

## 10. Proposed Phase 2 Plan

Build `src/core-v2/manifest/from-compiled-flow-v1.ts` and tests that convert
current compiled flows into `ExecutableFlowV2`.

Phase 2 should map or preserve:

- Flow id and version.
- Entry modes.
- Stages and steps.
- Step kinds.
- Routes and terminal targets.
- Explicit run-file paths.
- Reads and writes.
- Checks.
- Report schema refs.
- Selection data.
- Checkpoint policy.
- Sub-run config.
- Fanout config.

The adapter should validate the produced manifest with
`validateExecutableFlowV2` and document v1 quirks explicitly.
