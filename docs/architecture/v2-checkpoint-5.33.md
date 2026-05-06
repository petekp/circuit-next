# Core-v2 Checkpoint 5.33: Router And Compiler Neutral Ownership

## Summary

Phase 5.33 moves flow routing and schematic compilation out of
`src/runtime/**` into neutral `src/flows/**` ownership:

- `src/flows/router.ts` now owns natural-language flow classification,
  routable package derivation, and entry-mode inference.
- `src/flows/compile-schematic-to-flow.ts` now owns schematic to compiled-flow
  projection.
- `src/runtime/router.ts` and `src/runtime/compile-schematic-to-flow.ts`
  remain compatibility re-exports.

This is a behavior-preserving ownership move. It does not change classifier
signals, route reasons, generated flow JSON, selector behavior, rollback,
`composeWriter`, arbitrary fixture/custom-root routing, retained/v1 checkpoint
folders, connector/materializer behavior, or old runtime deletion status.

## Review

This slice had a focused review before implementation because router/compiler
ownership touches flow selection and generated-flow source-of-truth behavior.

Verdict from the review: approved for behavior-preserving neutral move. Blocking
findings: none.

Required implementation conditions from the review:

- move the real implementation owner paths to `src/flows/**`;
- keep old runtime paths as compatibility re-exports;
- update production and release loaders to neutral paths;
- update release evidence to point at neutral owner files;
- move primary tests to neutral imports;
- keep explicit old-path compatibility proof;
- add a guard preventing new production imports of old router/compiler owner
  paths.

## Implementation

Production ownership now follows the neutral paths:

- `src/cli/circuit.ts` imports `classifyCompiledFlowTask` from
  `src/flows/router.ts`.
- `scripts/emit-flows.mjs` loads
  `dist/flows/compile-schematic-to-flow.js`.
- `scripts/release/lib.mjs` loads `dist/flows/router.js`.
- `scripts/release/emit-current-capabilities.mjs` uses
  `src/flows/router.ts` and `src/flows/compile-schematic-to-flow.ts` as release
  evidence.

Compatibility stays intact:

- `src/runtime/router.ts` re-exports `../flows/router.js`.
- `src/runtime/compile-schematic-to-flow.ts` re-exports
  `../flows/compile-schematic-to-flow.js`.
- `tests/runner/retained-compat-facade.test.ts` asserts old runtime exports are
  identical to neutral exports.

## Proof

Focused tests:

```bash
npx vitest run tests/contracts/flow-router.test.ts tests/runner/router-routing-invariants.test.ts tests/properties/visible/flow-router-tiebreak.test.ts tests/contracts/compile-schematic-to-flow.test.ts tests/contracts/orphan-blocks.test.ts tests/unit/compile-schematic-per-mode.test.ts tests/runner/catalog-derivations.test.ts tests/runner/retained-compat-facade.test.ts tests/unit/emit-flows-drift.test.ts tests/release/release-infrastructure.test.ts
```

Passed before the final generated-output refresh.

Full validation for the completed slice is recorded in the worklog.

## Non-Approvals

Phase 5.33 does not approve:

- routing behavior or classifier signal changes;
- generated flow JSON shape changes;
- `circuit-next run` selector behavior changes;
- public `composeWriter` behavior changes;
- rollback behavior changes;
- arbitrary fixture or custom-root routing changes;
- retained/v1 checkpoint folder changes;
- connector/materializer behavior changes;
- old runtime wrapper deletion;
- old oracle test deletion;
- old runtime deletion.

## Remaining Deletion Blockers

This move reduces the router/compiler ownership blocker. Old runtime deletion is
still blocked by retained/v1 folders, arbitrary fixtures, custom roots,
rollback, public `composeWriter`, retained trace/progress/checkpoint/status
behavior, old public wrappers, and old oracle tests.

The next high-leverage review checkpoint is retained trace/status/progress and
checkpoint-state ownership, because it touches saved operator state and run
inspection semantics.
