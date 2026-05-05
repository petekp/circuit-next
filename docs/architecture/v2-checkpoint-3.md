# Circuit v2 Checkpoint 3

## 1. Review Parity Status

Review now runs through the opt-in v2 compiled-flow path:

```text
generated/flows/review/circuit.json
-> CompiledFlow parse
-> fromCompiledFlowV1
-> runCompiledFlowV2
-> executeExecutableFlowV2
```

The parity test verifies:

- v2 follows the same pass-route step order from the generated manifest.
- v2 closes with `outcome: complete` and terminal target `@complete`.
- v2 writes `reports/result.json`.
- v2 writes the expected review intake, relay result, and final review report
  paths.
- Review report bodies parse against the flow-owned schemas.
- Status is projected from trace, not stored separately.

Exact v1 trace entry schema parity is not claimed yet. Phase 3 compares the
lifecycle semantics and step order.

## 2. Fix Parity Status

Fix now runs through the opt-in v2 compiled-flow path for the default pass
route.

The parity test verifies:

- v2 follows the same generated pass-route step order.
- The no-repro checkpoint remains off the default pass route.
- v2 writes the expected fix brief, context, diagnosis, change, verification,
  review, and close reports.
- Fix report bodies parse against the flow-owned schemas.
- v2 writes a v1-like `reports/result.json` with snake_case fields.
- A forced verification failure records `step.aborted`, avoids a contradictory
  `step.completed`, and closes with `outcome: aborted`.

Checkpoint pause/resume behavior is not claimed here; the no-repro checkpoint
is represented and remains available for later parity work.

## 3. Build Parity Status

Build now runs through the opt-in v2 compiled-flow path for the default pass
route and for a named entry mode that starts at a different step.

The parity test verifies:

- v2 follows the same generated pass-route step order.
- The frame checkpoint writes request and response files.
- The checkpoint selection route is `continue`, matching the generated safe
  default.
- v2 writes the expected build brief, plan, implementation, verification,
  review, and close reports.
- Build report bodies parse against the flow-owned schemas.
- v2 writes `reports/result.json` with `outcome: complete`.
- A named entry mode can be selected without routing production CLI behavior
  through v2.
- The selected entry mode and depth are recorded in the bootstrap trace data.

Build-specific checkpoint brief behavior is represented in test-only executor
logic. The generic v2 runtime still does not own Build-specific schema policy.

## 4. Product Behaviors Preserved

- Generated compiled flows remain the oracle.
- Flow package report schemas validate the reports written during parity tests.
- Terminal target vocabulary remains v1-compatible:
  `@complete`, `@stop`, `@handoff`, `@escalate`.
- Run close outcomes remain v1-compatible:
  `complete`, `aborted`, `handoff`, `stopped`, `escalated`.
- Trace remains the source of run truth for lifecycle and status projection.
- Result output is written to `reports/result.json`.
- Run-file paths are preserved from generated manifests.
- Entry mode selection is opt-in and does not change production CLI behavior.
- Failure closes as `aborted`.

## 5. Differences Found

- v2 trace entries are still minimal. They use v1-aligned event names but do
  not yet include the full v1 trace schema fields.
- v2 result shape is closer to v1 now, but still not the full current runtime
  result schema.
- Phase 3 uses test-only executors for compose, relay, verification, and
  checkpoint. The production v2 executor set still intentionally fails closed
  for unsupported step kinds.
- Relay request/receipt content is not byte-for-byte parity. The tests assert
  behavior and report/schema validity, not incidental bytes.

## 6. Differences Intentionally Accepted

- Exact trace schema parity is deferred until complex behavior and resume are
  in scope.
- Exact relay subprocess behavior is deferred until connector safety parity.
- Exact checkpoint pause/resume semantics are deferred until checkpoint parity
  can be tested directly.
- Report bodies in Phase 3 are deterministic fixtures. They are validated by
  flow-owned schemas but are not meant to reproduce old runtime prose.

## 7. Old-Runtime Dependencies Remaining

- v2 still adapts from the current `CompiledFlow` schema.
- v2 still relies on generated `generated/flows/*/circuit.json` fixtures.
- v2 still imports flow-owned report schemas in tests.
- Production CLI execution still uses the old runtime.
- Connector subprocess execution, checkpoint resume, sub-run, fanout, and
  worktree behavior remain old-runtime territory.

## 8. Generated Output Changes

None. Generated manifests, commands, plugin output, and generated public
surfaces were not edited.

## 9. Tests Added

- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/review-v2.test.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/parity/build-v2.test.ts`

The tests cover:

- Review simple-flow parity.
- Fix simple-flow parity.
- Fix failure behavior.
- Build simple-flow parity.
- Build checkpoint request/response behavior on the default route.
- Build named entry mode selection.

## 10. Commands Run

- `npm run check`: initially failed on one TypeScript branded id mismatch in
  the new test helper, then passed after correction.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run lint`: initially failed on formatting/import order in new Phase 3
  files.
- `npx biome check --write src/core-v2/run/compiled-flow-runner.ts tests/parity`:
  passed and fixed the formatting/import order issues.
- `npm run check`: passed after formatting.
- `npx vitest run tests/core-v2 tests/parity`: passed after formatting.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed, 57 test files and 808 tests.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed, including full test run with 110 test files,
  1228 tests passed, and 6 skipped.

## 11. Architecture Regrets So Far

- `runCompiledFlowV2` lives in source as an opt-in internal path. That is useful
  for parity, but it must not become the default CLI route before approval.
- The Phase 3 test executors are intentionally more capable than the default v2
  executor registry. This is acceptable for parity tests, but production v2
  executor support still needs explicit implementation.
- Result schema parity improved in this phase, but full trace/result schema
  restoration remains unfinished.
- Build checkpoint behavior is still pressure-testing generic v2 boundaries.
  The test keeps Build policy in test-only report generation rather than
  embedding it in the core runtime.

## 12. Proposed Phase 4 Plan

Phase 4 should prove complex-flow parity without deleting the old runtime:

- Add v2 sub-run execution with child run identity, child run folder behavior,
  parent/child trace relationship, and result/report materialization.
- Split fanout into branch expansion, branch execution, worktree provisioning,
  join policy, aggregate report writing, and cleanup.
- Add connector safety coverage for resolution, write capability checks,
  sandbox behavior, argv enforcement, custom connector validation, and
  provider/model compatibility.
- Run migrate and sweep parity tests through v2.
- Preserve current generated outputs unless an intentional difference is
  reviewed.

## 13. Post-Review Fixes

An adversarial review after Checkpoint 3 found three issues. All three were
fixed before the first Phase 4 review attempt:

- Removed `terminal_target` from v2 `reports/result.json`; parity tests now
  parse that file with the current `RunResult` schema.
- Changed `runCompiledFlowV2` to compute `manifest_hash` from raw
  compiled-flow bytes instead of `JSON.stringify` of the parsed object.
- Added an initial v2 route re-entry guard so self-routes and routes to already
  completed steps did not write a misleading `step.completed` entry.

Additional regression coverage was added for raw-byte manifest hash parity,
schema-valid result output, and route-cycle failure behavior.

## 14. Phase 3.5 Corrections

A later review found that the initial route re-entry guard was too broad: it
blocked v1-compatible bounded `retry` and `revise` recovery routes.

Phase 3.5 corrected that before Phase 4:

- `retry` and `revise` can re-enter a step until the attempt budget is
  exhausted.
- Recovery routes default to two attempts; non-recovery routes default to one
  attempt; `budgets.max_attempts` overrides the default.
- `pass` self-routes and non-recovery routes to completed steps still abort
  before writing `step.completed`.
- Step trace entries now include attempt numbers.
- `runCompiledFlowV2` now accepts raw compiled-flow bytes only, parses the
  flow internally, hashes those same bytes, and executes the parsed flow.
- Bootstrap trace data now records selected entry mode and depth for the v2
  compiled-flow path.
