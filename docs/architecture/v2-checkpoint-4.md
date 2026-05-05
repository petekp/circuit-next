# Circuit v2 Checkpoint 4

## 1. Full Migration Status

Phase 0 through Phase 6 are complete for the in-place v2 reconstruction.

The v2 core now contains:

- a v1 `CompiledFlow` to `ExecutableFlowV2` adapter;
- executable manifest validation;
- trace sequence authority;
- run-file path safety;
- graph execution with v1 terminal/recovery vocabulary;
- schema-compatible `reports/result.json` output;
- manifest snapshot writing and validation;
- simple-flow parity for Review, Fix, and Build;
- complex-flow parity for Explore, Migrate, and Sweep;
- sub-run and fanout execution slices;
- connector safety checks for role capability, connector identity, provider,
  model, effort, and custom connector argv shape;
- generated-surface ownership documentation and drift checks.

Production CLI execution still uses the old runtime. No old runtime code has
been deleted.

## 2. Old Files Proposed for Deletion

After approval and after switching production CLI execution to v2:

- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/step-handlers/checkpoint.ts`
- `src/runtime/step-handlers/compose.ts`
- `src/runtime/step-handlers/relay.ts`
- `src/runtime/step-handlers/sub-run.ts`
- `src/runtime/step-handlers/fanout.ts`
- `src/runtime/step-handlers/fanout/aggregate.ts`
- `src/runtime/step-handlers/fanout/branch-resolution.ts`
- `src/runtime/step-handlers/fanout/join-policy.ts`
- `src/runtime/step-handlers/fanout/types.ts`
- `src/runtime/step-handlers/verification.ts`
- `src/runtime/step-handlers/recovery-route.ts`
- `src/runtime/step-handlers/shared.ts`
- `src/runtime/step-handlers/types.ts`

The deletion should be a narrow approved slice, not a whole-tree `src/runtime/`
removal.

## 3. Old Files Proposed for Retention

Retain temporarily or move before deletion:

- `src/runtime/compile-schematic-to-flow.ts`
- `src/runtime/catalog-derivations.ts`
- `src/runtime/registries/**`
- `src/runtime/connectors/**`
- `src/runtime/config-loader.ts`
- `src/runtime/router.ts`
- `src/runtime/manifest-snapshot-writer.ts`
- `src/runtime/snapshot-writer.ts`
- `src/runtime/operator-summary-writer.ts`
- `src/runtime/progress-projector.ts`
- `src/runtime/run-status-projection.ts`
- `src/runtime/reducer.ts`
- `src/runtime/trace-reader.ts`
- `src/runtime/trace-writer.ts`
- `src/runtime/append-and-derive.ts`
- `src/runtime/policy/flow-kind-policy.ts`
- `src/runtime/write-capable-worker-disclosure.ts`
- `src/runtime/run-relative-path.ts`

These files still support authoring, generated surfaces, flow-owned writer
types, connector subprocess behavior, config loading, router behavior,
handoff/status behavior, or release proof generation.

## 4. Remaining Old Imports

Reference search found these old import groups:

| Import group | Remaining consumers | Deletion decision |
|---|---|---|
| `runtime/runner` | production CLI, release proof script, old runner tests, a few contract tests | replace with v2 before deleting runner |
| `runtime/step-handlers` | direct handler tests and property tests | delete or rewrite after v2 executor coverage is accepted |
| `runtime/registries` | flow packages, writer types, report schema helpers, catalog tests | retain or move before whole-runtime cleanup |
| `runtime/catalog-derivations` | catalog and router tests | retain or move |
| `runtime/compile-schematic-to-flow` | emit script and compiler tests | retain until compiler replacement |
| `runtime/relay-selection` | old relay provenance tests | replace with v2 connector/config tests |
| `runtime/selection-resolver` | flow model/effort contract test | replace with v2 config precedence tests |
| `CompiledFlow` and `flow-schematic` schemas | generated fixture oracle, v2 adapter, compiler, tests | retain |

Search commands used:

```text
rg -n "runCompiledFlow|executeCompiledFlow|compileSchematicToFlow|CompiledFlow|flow-schematic|runtime/runner|runtime/step-handlers|runtime/catalog-derivations|runtime/registries|relay-selection|selection-resolver" src tests docs specs scripts commands plugins .claude-plugin generated README.md package.json
rg -n "from ['\"].*runtime/(runner|step-handlers|catalog-derivations|registries|relay-selection|selection-resolver)|from ['\"].*runtime/(compile-schematic-to-flow)" src tests scripts
rg -l "from ['\"].*runtime/runner" src tests scripts
rg -l "from ['\"].*runtime/step-handlers" src tests scripts
rg -l "from ['\"].*runtime/registries" src tests scripts
rg -l "from ['\"].*runtime/(catalog-derivations|relay-selection|selection-resolver|compile-schematic-to-flow)" src tests scripts
```

## 5. Test Evidence

The current v2 behavior is covered by:

- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/core-v2/sub-run-v2.test.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/parity/review-v2.test.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/parity/build-v2.test.ts`
- `tests/parity/explore-v2.test.ts`
- `tests/parity/migrate-v2.test.ts`
- `tests/parity/sweep-v2.test.ts`

The old runner tests remain in place as oracle coverage until deletion is
approved.

Commands run for this checkpoint:

| Command | Result | Notes |
|---|---|---|
| `npm run check` | passed | `tsc --noEmit` |
| `npm run lint` | passed | Biome checked 396 files. |
| `npm run build` | passed | `tsc -p tsconfig.build.json` |
| `npx vitest run tests/core-v2 tests/parity` | passed | 11 files, 63 tests. |
| `npm run test:fast` | passed | 63 files, 842 tests. |
| `npm run test` | passed | 116 files, 1262 passed, 6 skipped. |
| `npm run check-flow-drift` | passed | Generated flow/plugin/command surfaces and `docs/generated-surfaces.md` are in sync. |
| `npm run verify` | passed | Includes check, lint, build, full test, generated drift check, and release infra checks. |
| `git diff --check` | passed | No whitespace errors. |

No command failures occurred in the final Checkpoint 4 validation pass.

## 6. Fanout/Sub-run Parity Evidence

Sub-run evidence:

- child run ids are fresh and separate from parent run ids;
- child run folders are sibling folders;
- child flows are resolved from raw compiled-flow bytes;
- parent trace records sub-run start/completion;
- child result files are copied to parent writes;
- child verdict admission affects parent result verdict.

Fanout evidence:

- static and dynamic branch expansion is tested;
- relay and sub-run branches are represented;
- branch lifecycle trace records start and completion, including preflight
  aborts;
- aggregate reports are written and schema-checked;
- partial failure behavior is tested;
- disjoint-merge validates changed-file overlap before cleanup;
- worktree cleanup is tested.

Representative tests:

- `tests/core-v2/sub-run-v2.test.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/parity/explore-v2.test.ts`
- `tests/parity/migrate-v2.test.ts`
- `tests/parity/sweep-v2.test.ts`

## 7. Connector Safety Evidence

v2 connector safety currently covers:

- read-only connector rejection for implementer relay roles;
- explicit connector identity preservation;
- connector name/resolved connector mismatch rejection;
- custom connector capability and argv validation;
- provider/model compatibility;
- effort allowlist compatibility;
- normal relay and relay fanout branch enforcement before callback invocation.

Representative tests:

- `tests/core-v2/connectors-v2.test.ts`
- connector-focused cases inside `tests/core-v2/fanout-v2.test.ts`

Remaining connector work before production deletion:

- thread production config layers into v2 relay execution;
- invoke real connector subprocess implementations through the v2 safety
  boundary instead of injected test connectors.

## 8. Generated-Surface Evidence

Phase 6 produced `docs/generated-surfaces.md` from `scripts/emit-flows.mjs`.
The generated map now lists each generated surface, source of truth, generator,
human-editability, destinations, drift check, and notes.

Evidence:

- `tests/contracts/catalog-completeness.test.ts`
- `tests/unit/emit-flows-drift.test.ts`
- `npm run check-flow-drift`
- `npm run verify`

No generated command/plugin/compiled-flow outputs were manually edited.
`npm run check-flow-drift` confirmed all generated flow manifests, host mirrors,
command mirrors, skill mirrors, and `docs/generated-surfaces.md` are in sync.

## 9. Risks

- Deleting all of `src/runtime/` would remove live compiler/catalog/report/config
  infrastructure.
- The production CLI still imports the old runner.
- v2 checkpoint resume is not yet the production route.
- v2 connector safety is strong in tests, but real subprocess execution still
  needs to be routed through it.
- Trace schema convergence is partial, though lifecycle and parity tests pass.
- Some old runner tests should be rewritten against v2 before deletion rather
  than removed blindly.

## 10. Rollback Plan

- Keep old runtime files until deletion is explicitly approved.
- Perform the CLI switch and deletion as a separate, reversible slice.
- If validation fails after the switch, revert the CLI import/path change first.
- If deletion fails after approval, restore deleted files from git and rerun
  `npm run verify`.
- Regenerate surfaces with `npm run emit-flows` instead of hand-editing outputs.

## 11. Recommendation

Do not delete old runtime files yet.

Approve a final narrow pre-deletion implementation slice first:

1. route production CLI run execution through `runCompiledFlowV2`;
2. thread config layers and real connector subprocess calls through v2 relay
   safety;
3. decide whether checkpoint resume is required before old runner deletion or
   should remain as an explicitly retained old path;
4. rewrite old runner tests that cover behavior v2 now owns;
5. run full `npm run verify`;
6. then delete the approved old runner and step-handler files.
