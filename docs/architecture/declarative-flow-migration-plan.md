---
name: declarative-flow-migration-plan
description: Source-grounded migration plan for moving built-in flows to typed FlowDefinition definitions.
type: migration-plan
status: proposed
---

# Declarative Flow Migration Plan

This is a planning document only. It does not start the migration.

The target architecture is the typed `FlowDefinition` compiler chosen in
`docs/architecture/declarative-flow-architecture.md`. The migration should
move every built-in flow to that model while preserving current runtime
behavior, public CLI behavior, report schemas, generated host surfaces,
engine-to-flow import boundaries, connector security policy, and custom writer
logic where that logic is semantic.

## Non-Negotiables

- Current runtime behavior must stay byte-for-byte or behavior-for-behavior
  equivalent.
- Public CLI behavior and generated host plugin surfaces must not change unless
  a separate versioned migration is accepted.
- Existing report schema names and Zod schema shapes remain the compatibility
  contract.
- The engine continues to import through the catalog boundary. It must not
  import individual flow definitions directly.
- Connector security policy is out of scope. The migration must not loosen
  command execution, timeout, output cap, environment, or tool-list behavior.
- Direct command ownership remains direct where it is direct today:
  `migrate` and `sweep` use `src/commands/<id>.md`, not flow-owned
  `command.md` files.
- `reports.ts`, genuinely semantic writers, and custom validators are source.
  The migration may move or reference them, but must not flatten them into
  brittle config.

## Source Evidence

| Evidence | Current source |
|---|---|
| The ADR chooses typed `FlowDefinition` as the source model and a pure compiler into today's artifacts. | `docs/architecture/declarative-flow-architecture.md:143`, `docs/architecture/declarative-flow-architecture.md:226`, `docs/architecture/declarative-flow-architecture.md:239` |
| Flow packages are manually imported and ordered in the catalog today. | `src/flows/catalog.ts:8`, `src/flows/catalog.ts:17` |
| The package shape currently owns schematic path, routing, relay reports, report schemas, runtime surface, writers, structural hints, and engine flags. | `src/flows/types.ts:147` |
| Registries already derive from `flowPackages`, which is the boundary to keep. | `src/flows/catalog-derivations.ts:41`, `src/flows/catalog-derivations.ts:68`, `src/flows/catalog-derivations.ts:106`, `src/flows/catalog-derivations.ts:142` |
| Cross-report validators are registry-resolved from package-owned relay reports. | `src/flows/registries/cross-report-validators.ts:24`, `src/flows/catalog-derivations.ts:106` |
| Runtime surface lookup is catalog-derived. | `src/flows/runtime-surface.ts:1`, `src/flows/runtime-surface.ts:5` |
| Generated host surfaces are already drift-checked and must remain generated outputs. | `docs/generated-surfaces.md:21`, `docs/generated-surfaces.md:23`, `docs/generated-surfaces.md:56` |
| Public and internal visibility is already tested. | `tests/contracts/catalog-completeness.test.ts:90` |
| Runtime surface modes and progress metadata are already parity-tested against schematics. | `tests/contracts/catalog-completeness.test.ts:99`, `tests/contracts/catalog-completeness.test.ts:164` |
| Report schema ownership and writer registration are already tested through the catalog. | `tests/contracts/catalog-completeness.test.ts:352`, `tests/contracts/catalog-completeness.test.ts:456`, `tests/runner/catalog-derivations.test.ts:458` |
| Progress copy must remain independent from prose step titles. | `tests/runtime/progress-projection.test.ts:31` |
| Final verification commands are defined in package scripts. | `package.json:14`, `package.json:22`, `package.json:42` |

## Current Inventory Summary

Current flow package inventory:

- 7 flow packages: `build`, `explore`, `fix`, `migrate`, `review`,
  `runtime-proof`, `sweep`.
- 6 public flows: `build`, `explore`, `fix`, `migrate`, `review`, `sweep`.
- 1 internal flow: `runtime-proof`.
- 7 authored schematics under `src/flows/<id>/schematic.json`.
- 30 package-owned output report schema registrations.
- 15 relay report descriptors.
- 27 registered writer builders.
- 6 runtime surfaces with public entry-mode and progress metadata.
- 1 structural relay hint list: `review`.
- 1 cross-report validator: `sweep.batch@v1`.
- 9 canonical generated flow manifests under `generated/flows/**`.
- 16 generated host flow JSON mirrors across Claude and Codex plugin packages.
- 27 generated command or skill mirror files across Claude and Codex plugin
  packages.
- 4 flow-owned command sources: `build`, `explore`, `fix`, `review`.
- 2 direct command sources for public flows: `migrate`, `sweep`.

The largest manual redirection is not only line count. It is that one flow is
currently described across `schematic.json`, `index.ts`, report registration,
runtime surface metadata, writer registration, relay hints, generated manifests,
and generated host mirrors. The migration should collapse those authored
surfaces into one typed definition plus semantic source files.

## Flow Inventory

| Flow | Visibility | Modes | Schematic shape | Package metadata | Reports | Writers and hooks | Generated artifacts |
|---|---:|---|---|---|---|---|
| `runtime-proof` | internal | `runtime-proof` / `standard` | 2 items: 1 compose, 1 relay. Source: `src/flows/runtime-proof/schematic.json`. | `src/flows/runtime-proof/index.ts:6` declares internal visibility and only a schematic path. No runtime surface. | `runtime-proof.compose@v1` output schema registration. | `src/flows/runtime-proof/writers/compose.ts` writes `plan.strategy@v1`, which is intentionally odd and should become a compiler disqualifier check or explicit adapter. | `generated/flows/runtime-proof/circuit.json`; no host mirrors. |
| `review` | public | `default` / `standard` | 3 items: 2 compose, 1 relay. Source: `src/flows/review/schematic.json`. | `src/flows/review/index.ts:39` declares paths, routing, runtime surface, writers, and structural hint registration. | `review.intake@v1`, `review.result@v1`; no package `relayReports`. | `src/flows/review/writers/intake.ts`, `src/flows/review/writers/result.ts`; `src/flows/review/relay-hints.ts:12` owns `reviewRelayShapeHint`; `src/flows/review/writers/result.ts:90` records a custom relay-result read. | `generated/flows/review/circuit.json`; Claude and Codex host mirrors; flow-owned command and contract. |
| `build` | public | `default`, `lite`, `deep`, `autonomous` | 6 items: 2 compose, 2 relay, 1 checkpoint, 1 verification. Source: `src/flows/build/schematic.json`. | `src/flows/build/index.ts:42` declares public visibility; `src/flows/build/index.ts:76` runtime modes; `src/flows/build/index.ts:87` progress; `src/flows/build/index.ts:114` engine flag. | Relay reports: `build.implementation@v1`, `build.review@v1`. Output reports: `build.brief@v1`, `build.plan@v1`, `build.verification@v1`, `build.result@v1`. | `buildBriefCheckpointBuilder`, `buildPlanComposeBuilder`, `buildVerificationWriter`, `buildCloseBuilder`; relay hints in `src/flows/build/relay-hints.ts:5` and `src/flows/build/relay-hints.ts:17`. | `generated/flows/build/circuit.json`; Claude and Codex host mirrors; flow-owned command and contract. |
| `migrate` | public | `default`, `deep`, `autonomous` | 8 items: 3 compose, 2 relay, 1 checkpoint, 1 verification, 1 sub-run. Source: `src/flows/migrate/schematic.json`. | `src/flows/migrate/index.ts:37` declares public visibility and intentionally has no flow-owned command source. | Relay reports: `migrate.inventory@v1`, `migrate.review@v1`. Output reports: `migrate.brief@v1`, `migrate.coexistence@v1`, `migrate.batch@v1`, `migrate.verification@v1`, `migrate.result@v1`. | `migrateBriefComposeBuilder`, `migrateCoexistenceComposeBuilder`, `migrateVerificationWriter`, `migrateCloseBuilder`; relay hints in `src/flows/migrate/relay-hints.ts:5` and `src/flows/migrate/relay-hints.ts:17`. | `generated/flows/migrate/circuit.json`; Claude and Codex host mirrors; direct command source `src/commands/migrate.md`. |
| `sweep` | public | `default`, `lite`, `deep`, `autonomous` | 8 items: 3 compose, 3 relay, 1 checkpoint, 1 verification. Source: `src/flows/sweep/schematic.json`. | `src/flows/sweep/index.ts:39` declares public visibility and intentionally has no flow-owned command source. | Relay reports: `sweep.analysis@v1`, `sweep.batch@v1`, `sweep.review@v1`. Output reports: `sweep.brief@v1`, `sweep.queue@v1`, `sweep.verification@v1`, `sweep.result@v1`. | `sweepBriefComposeBuilder`, `sweepQueueComposeBuilder`, `sweepVerificationWriter`, `sweepCloseBuilder`; relay hints in `src/flows/sweep/relay-hints.ts`; `src/flows/sweep/index.ts:61` attaches `validateSweepBatchAgainstQueue`; implementation at `src/flows/sweep/cross-report-validators.ts:24`. | `generated/flows/sweep/circuit.json`; Claude and Codex host mirrors; direct command source `src/commands/sweep.md`. |
| `explore` | public | `default`, `lite`, `deep`, `tournament`, `autonomous` | 11 items: 6 compose, 3 relay, 1 fanout, 1 checkpoint. Source: `src/flows/explore/schematic.json`. | `src/flows/explore/index.ts:29` declares public visibility; `src/flows/explore/index.ts:77` includes tournament mode; `src/flows/explore/index.ts:88` progress. | Relay reports: `explore.compose@v1`, `explore.review-verdict@v1`, `explore.tournament-proposal@v1`, `explore.tournament-review@v1`. Output reports: `explore.brief@v1`, `explore.analysis@v1`, `explore.decision-options@v1`, `explore.tournament-aggregate@v1`, `explore.decision@v1`, `explore.result@v1`. | Five compose/close writers; relay hints in `src/flows/explore/relay-hints.ts`; result normalization and tournament aggregation must remain semantic code where present. | `generated/flows/explore/circuit.json`, `generated/flows/explore/tournament.json`; Claude and Codex host mirrors; flow-owned command and contract. |
| `fix` | public | `default`, `lite`, `deep`, `autonomous` | 14 items: 4 compose, 4 relay, 1 checkpoint, 5 verification. Source: `src/flows/fix/schematic.json`. | `src/flows/fix/index.ts:48` declares public visibility; `src/flows/fix/index.ts:96` runtime modes; `src/flows/fix/index.ts:107` progress. | Relay reports: `fix.context@v1`, `fix.diagnosis@v1`, `fix.change@v1`, `fix.review@v1`. Output reports: `fix.brief@v1`, `fix.no-repro-decision@v1`, `fix.regression-proof@v1`, `fix.baseline-snapshot@v1`, `fix.verification@v1`, `fix.regression-rerun@v1`, `fix.change-set@v1`, `fix.result@v1`. | Seven writers plus helpers: `fixBriefComposeBuilder`, `fixBaselineSnapshotWriter`, `fixRegressionBaselineWriter`, `fixRegressionRerunWriter`, `fixVerificationWriter`, `fixChangeSetWriter`, `fixCloseBuilder`, `projectFixResult`, and the sidecar `git-state.mjs`. Source anchors: `src/flows/fix/writers/baseline-snapshot.ts:8`, `src/flows/fix/writers/change-set.ts:5`, `src/flows/fix/writers/result-projection.ts:38`. | `generated/flows/fix/circuit.json`, `generated/flows/fix/lite.json`; Claude and Codex host mirrors; flow-owned command and contract. |

## Runtime Surface Inventory

| Flow | Runtime surface | Primary result | Progress coverage |
|---|---|---|---|
| `runtime-proof` | none; internal flow | none | none |
| `review` | 1 mode: `default` / `standard` | `review.result@v1` at `reports/result.json` | 3 schematic items |
| `build` | 4 modes: `default`, `lite`, `deep`, `autonomous` | `build.result@v1` at `reports/result.json` | 6 schematic items |
| `migrate` | 3 modes: `default`, `deep`, `autonomous` | `migrate.result@v1` at `reports/result.json` | 8 schematic items |
| `sweep` | 4 modes: `default`, `lite`, `deep`, `autonomous` | `sweep.result@v1` at `reports/result.json` | 8 schematic items |
| `explore` | 5 modes: `default`, `lite`, `deep`, `tournament`, `autonomous` | `explore.result@v1` at `reports/result.json` | 11 schematic items |
| `fix` | 4 modes: `default`, `lite`, `deep`, `autonomous` | `fix.result@v1` at `reports/result.json` | 14 schematic items |

Public-flow runtime surfaces are source-owned today in each package's
`runtimeSurface` block. In the target architecture they should be derived from
definition `modes`, `primaryResult`, and `progress` declarations.

## Writer Inventory

| Flow | Slot | Result schema | Source |
|---|---|---|---|
| `runtime-proof` | compose | `plan.strategy@v1` | `src/flows/runtime-proof/writers/compose.ts` |
| `review` | compose | `review.intake@v1` | `src/flows/review/writers/intake.ts` |
| `review` | compose | `review.result@v1` | `src/flows/review/writers/result.ts` |
| `build` | checkpoint | `build.brief@v1` | `src/flows/build/writers/checkpoint-brief.ts` |
| `build` | compose | `build.plan@v1` | `src/flows/build/writers/plan.ts` |
| `build` | verification | `build.verification@v1` | `src/flows/build/writers/verification.ts` |
| `build` | close | `build.result@v1` | `src/flows/build/writers/close.ts` |
| `migrate` | compose | `migrate.brief@v1` | `src/flows/migrate/writers/brief.ts` |
| `migrate` | compose | `migrate.coexistence@v1` | `src/flows/migrate/writers/coexistence.ts` |
| `migrate` | verification | `migrate.verification@v1` | `src/flows/migrate/writers/verification.ts` |
| `migrate` | close | `migrate.result@v1` | `src/flows/migrate/writers/close.ts` |
| `sweep` | compose | `sweep.brief@v1` | `src/flows/sweep/writers/brief.ts` |
| `sweep` | compose | `sweep.queue@v1` | `src/flows/sweep/writers/queue.ts` |
| `sweep` | verification | `sweep.verification@v1` | `src/flows/sweep/writers/verification.ts` |
| `sweep` | close | `sweep.result@v1` | `src/flows/sweep/writers/close.ts` |
| `explore` | compose | `explore.brief@v1` | `src/flows/explore/writers/brief.ts` |
| `explore` | compose | `explore.analysis@v1` | `src/flows/explore/writers/analysis.ts` |
| `explore` | compose | `explore.decision-options@v1` | `src/flows/explore/writers/decision-options.ts` |
| `explore` | compose | `explore.decision@v1` | `src/flows/explore/writers/decision.ts` |
| `explore` | close | `explore.result@v1` | `src/flows/explore/writers/close.ts` |
| `fix` | compose | `fix.brief@v1` | `src/flows/fix/writers/brief.ts` |
| `fix` | verification | `fix.baseline-snapshot@v1` | `src/flows/fix/writers/baseline-snapshot.ts` |
| `fix` | verification | `fix.regression-proof@v1` | `src/flows/fix/writers/regression-baseline.ts` |
| `fix` | verification | `fix.regression-rerun@v1` | `src/flows/fix/writers/regression-rerun.ts` |
| `fix` | verification | `fix.verification@v1` | `src/flows/fix/writers/verification.ts` |
| `fix` | verification | `fix.change-set@v1` | `src/flows/fix/writers/change-set.ts` |
| `fix` | close | `fix.result@v1` | `src/flows/fix/writers/close.ts` |

## Relay Hint And Validator Inventory

| Flow | Report or shape | Hook | Source |
|---|---|---|---|
| `review` | structural shape | `reviewRelayShapeHint` | `src/flows/review/relay-hints.ts` |
| `build` | `build.implementation@v1` | `buildImplementationShapeHint` | `src/flows/build/relay-hints.ts` |
| `build` | `build.review@v1` | `buildReviewShapeHint` | `src/flows/build/relay-hints.ts` |
| `migrate` | `migrate.inventory@v1` | `migrateInventoryShapeHint` | `src/flows/migrate/relay-hints.ts` |
| `migrate` | `migrate.review@v1` | `migrateReviewShapeHint` | `src/flows/migrate/relay-hints.ts` |
| `sweep` | `sweep.analysis@v1` | `sweepAnalysisShapeHint` | `src/flows/sweep/relay-hints.ts` |
| `sweep` | `sweep.batch@v1` | `sweepBatchShapeHint` plus `validateSweepBatchAgainstQueue` | `src/flows/sweep/relay-hints.ts`, `src/flows/sweep/cross-report-validators.ts` |
| `sweep` | `sweep.review@v1` | `sweepReviewShapeHint` | `src/flows/sweep/relay-hints.ts` |
| `explore` | `explore.compose@v1` | `exploreComposeShapeHint` | `src/flows/explore/relay-hints.ts` |
| `explore` | `explore.review-verdict@v1` | `exploreReviewVerdictShapeHint` | `src/flows/explore/relay-hints.ts` |
| `explore` | `explore.tournament-proposal@v1` | `exploreTournamentProposalShapeHint` | `src/flows/explore/relay-hints.ts` |
| `explore` | `explore.tournament-review@v1` | `exploreTournamentReviewShapeHint` | `src/flows/explore/relay-hints.ts` |
| `fix` | `fix.context@v1` | `fixContextShapeHint` | `src/flows/fix/relay-hints.ts` |
| `fix` | `fix.diagnosis@v1` | `fixDiagnosisShapeHint` | `src/flows/fix/relay-hints.ts` |
| `fix` | `fix.change@v1` | `fixChangeShapeHint` | `src/flows/fix/relay-hints.ts` |
| `fix` | `fix.review@v1` | `fixReviewShapeHint` | `src/flows/fix/relay-hints.ts` |

## Custom Semantic Hook Inventory

| Flow | Hook | Why it stays code |
|---|---|---|
| `review` | `reviewResultComposeBuilder` reads a relay result body rather than declarative report reads. | It encodes how review output is recovered from the relay path. |
| `build` | `bindsExecutionDepthToRelaySelection` engine flag. | It is an explicit flow-owned opt-in that the engine branches on. |
| `sweep` | `validateSweepBatchAgainstQueue`. | It validates one relay report against another report path from the live flow graph. |
| `fix` | `fixGitStateCommand` and `git-state.mjs`. | It shells out through the existing verification-command path and is covered by plugin runtime packaging. |
| `fix` | `projectFixResult`. | It owns close-result outcome and pillar-status semantics. |
| `fix` | `fixChangeSetWriter`. | It computes changed files from real git state observations. |

## Generated Surface Inventory

Canonical generated flow manifests:

- `generated/flows/build/circuit.json`
- `generated/flows/explore/circuit.json`
- `generated/flows/explore/tournament.json`
- `generated/flows/fix/circuit.json`
- `generated/flows/fix/lite.json`
- `generated/flows/migrate/circuit.json`
- `generated/flows/review/circuit.json`
- `generated/flows/runtime-proof/circuit.json`
- `generated/flows/sweep/circuit.json`
- `generated/release/current-capabilities.json`
- `docs/generated-surfaces.md`

Generated host mirrors:

Claude host JSON mirrors:

- `plugins/claude/skills/build/circuit.json`
- `plugins/claude/skills/explore/circuit.json`
- `plugins/claude/skills/explore/tournament.json`
- `plugins/claude/skills/fix/circuit.json`
- `plugins/claude/skills/fix/lite.json`
- `plugins/claude/skills/migrate/circuit.json`
- `plugins/claude/skills/review/circuit.json`
- `plugins/claude/skills/sweep/circuit.json`

Codex host JSON mirrors:

- `plugins/circuit/flows/build/circuit.json`
- `plugins/circuit/flows/explore/circuit.json`
- `plugins/circuit/flows/explore/tournament.json`
- `plugins/circuit/flows/fix/circuit.json`
- `plugins/circuit/flows/fix/lite.json`
- `plugins/circuit/flows/migrate/circuit.json`
- `plugins/circuit/flows/review/circuit.json`
- `plugins/circuit/flows/sweep/circuit.json`

Internal: `runtime-proof` must not emit host mirrors.

Generated command and skill mirrors:

Claude command mirrors:

- `plugins/claude/commands/build.md`
- `plugins/claude/commands/create.md`
- `plugins/claude/commands/explore.md`
- `plugins/claude/commands/fix.md`
- `plugins/claude/commands/handoff.md`
- `plugins/claude/commands/migrate.md`
- `plugins/claude/commands/review.md`
- `plugins/claude/commands/run.md`
- `plugins/claude/commands/sweep.md`

Codex command mirrors:

- `plugins/circuit/commands/build.md`
- `plugins/circuit/commands/create.md`
- `plugins/circuit/commands/explore.md`
- `plugins/circuit/commands/fix.md`
- `plugins/circuit/commands/handoff.md`
- `plugins/circuit/commands/migrate.md`
- `plugins/circuit/commands/review.md`
- `plugins/circuit/commands/run.md`
- `plugins/circuit/commands/sweep.md`

Codex skill mirrors:

- `plugins/circuit/skills/build/SKILL.md`
- `plugins/circuit/skills/create/SKILL.md`
- `plugins/circuit/skills/explore/SKILL.md`
- `plugins/circuit/skills/fix/SKILL.md`
- `plugins/circuit/skills/handoff/SKILL.md`
- `plugins/circuit/skills/migrate/SKILL.md`
- `plugins/circuit/skills/review/SKILL.md`
- `plugins/circuit/skills/run/SKILL.md`
- `plugins/circuit/skills/sweep/SKILL.md`

Authored command sources that feed those mirrors:

- Flow-owned command sources:
  `src/flows/build/command.md`, `src/flows/explore/command.md`,
  `src/flows/fix/command.md`, `src/flows/review/command.md`.
- Direct command sources:
  `src/commands/migrate.md`, `src/commands/sweep.md`, plus non-flow direct
  commands `create`, `handoff`, and `run`.
- Host command and skill mirrors are generated. They remain non-source.

## Target Shape

Each migrated flow should expose a typed source module:

```ts
export const flowDefinition = defineFlow({
  id: 'explore',
  visibility: 'public',
  command: { source: 'src/flows/explore/command.md' },
  contract: { source: 'src/flows/explore/contract.md' },
  modes: [
    { name: 'default', depth: 'standard' },
    { name: 'lite', depth: 'lite' },
    { name: 'deep', depth: 'deep' },
    { name: 'tournament', depth: 'tournament' },
    { name: 'autonomous', depth: 'autonomous' },
  ],
  reports: reportsFrom('./reports.js'),
  steps: [
    // typed blocks with defaults, explicit overrides only where needed
  ],
  writers: {
    compose: [exploreBriefComposeBuilder],
    close: [exploreCloseBuilder],
  },
});
```

The compiler must project that source into today's compatibility artifacts:

- `FlowSchematic`
- `CompiledFlowPackage`
- `CompiledFlowRuntimeSurface`
- report schema registry entries
- writer registry entries
- relay shape hints and structural hints
- cross-report validator registry entries
- generated flow manifests
- generated host mirrors
- generated surface docs or drift ledgers where useful

During migration, old and new sources should coexist until projection parity is
proven. The first implementation slices should compare the definition projection
against the current source, not replace the source immediately.

## Migration Order

The order is intentionally conservative. It starts with a low-blast-radius
internal flow, then proves a representative public flow, then moves through
special cases, and leaves `fix` last because it is the largest and has the most
semantic writers.

### Slice 0: Freeze Evidence And Add Parity Harness

Purpose: make the current state executable as a reference.

Implementation boundaries:

- Add test helpers that load a legacy package, a definition projection, the
  authored schematic JSON, and generated manifests for the same flow.
- Do not change runtime code paths.
- Do not regenerate host surfaces unless the harness exposes real drift.

Proofs:

- Current `flowPackages` count and visibility still pass.
- Every current schematic parses strictly.
- Every generated manifest still matches `node scripts/emit-flows.ts --check`.
- Definition projection tests are skipped or fixture-only until Slice 1.

Rollback:

- Delete only the new test helpers.

Disqualifier:

- If current source cannot be made into a stable reference without changing
  behavior, stop and repair the current architecture first.

### Slice 1: Introduce `FlowDefinition` As A Parallel Type And Compiler

Purpose: create the typed interface and pure projection without moving a public
flow.

Implementation boundaries:

- Add `src/flows/definitions/types.ts` or equivalent.
- Add `compileFlowDefinition()` as a pure function.
- Add normalizers for function-valued fields so tests can compare stable
  identities by `resultSchemaName`, `schemaName`, and source references.
- Keep `src/flows/catalog.ts` as the engine boundary.

Proofs:

- Unit tests for compiler defaults: compose, relay, fanout, checkpoint,
  verification, sub-run, close, mode support, progress, report paths, and
  writer registration.
- Negative tests for duplicate flow ids, duplicate report schema names,
  duplicate writer result schema names, unknown report names, unknown writer
  names, and missing progress text.
- `npm run check`
- `npm run test:fast -- tests/runner/catalog-derivations.test.ts tests/contracts/catalog-completeness.test.ts`

Rollback:

- Remove the new definitions module and tests. Existing flow packages remain
  authoritative.

Disqualifier:

- If the compiler cannot preserve the current `CompiledFlowPackage` shape
  without runtime imports of individual flows, stop.

### Slice 2: Move `runtime-proof` To A Definition-Owned Fixture

Purpose: prove the definition pipeline on an internal flow with no host mirrors.

Implementation boundaries:

- Add `src/flows/runtime-proof/flow.ts`.
- Keep the old `index.ts` as a control until parity passes.
- Decide explicitly whether `plan.strategy@v1` as the writer result schema is
  intentional compatibility or should fail definition validation. If it stays,
  require an explicit override so the oddity is visible.

Parity tests:

- Generated package projection equals current `runtimeProofCompiledFlowPackage`.
- Generated schematic equals `src/flows/runtime-proof/schematic.json`.
- `generated/flows/runtime-proof/circuit.json` is unchanged.
- Existing runtime-proof tests remain green:
  `tests/runner/run-relative-path.test.ts`,
  `tests/runner/push-sequence-authority.test.ts`,
  `tests/unit/runtime/event-log-round-trip.test.ts`.

Verification:

- `npm run check`
- `npm run test:fast -- tests/runner/run-relative-path.test.ts tests/runner/push-sequence-authority.test.ts tests/unit/runtime/event-log-round-trip.test.ts`
- `node scripts/emit-flows.ts --check`

Rollback:

- Re-export the old package from `index.ts` and leave `flow.ts` unused or
  delete it.

### Slice 3: Move `explore` As The Representative Public Flow

Purpose: prove the architecture on the richest public flow before touching the
bug-fix path.

Why `explore` now:

- It is the ADR's representative flow.
- It has five modes, including `tournament`.
- It has fanout, checkpoint, relay hints, close composition, and multiple
  generated manifests.
- The default router currently expects `explore` to be the default package
  (`tests/runner/catalog-derivations.test.ts:437`).

Implementation boundaries:

- Add `src/flows/explore/flow.ts`.
- Project `explore` package metadata, runtime surface, relay reports, report
  schemas, writers, and generated manifests from the definition.
- Keep `reports.ts`, writers, `command.md`, and `contract.md` as source.
- Do not hand-edit generated host mirrors.

Parity tests:

- Definition projection equals current `exploreCompiledFlowPackage`.
- Generated schematic equals `src/flows/explore/schematic.json`.
- `generated/flows/explore/circuit.json` and
  `generated/flows/explore/tournament.json` are unchanged.
- Runtime surface includes all five modes and stable progress copy.
- Writer registry resolves the exact existing writer instances.

Focused tests:

- `tests/contracts/explore-report-schemas.test.ts`
- `tests/runner/explore-report-writer.test.ts`
- `tests/runner/explore-e2e-parity.test.ts`
- `tests/runner/explore-tournament-runtime.test.ts`
- `tests/parity/explore.test.ts`
- `tests/runtime/progress-projection.test.ts`
- `tests/runner/catalog-derivations.test.ts`

Verification:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run test:fast -- tests/contracts/explore-report-schemas.test.ts tests/runner/explore-report-writer.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/explore-tournament-runtime.test.ts tests/parity/explore.test.ts tests/runtime/progress-projection.test.ts tests/runner/catalog-derivations.test.ts`
- `node scripts/emit-flows.ts --check`

Rollback:

- Restore `src/flows/explore/index.ts` to export the legacy package. Generated
  outputs should require no rollback if parity was enforced before generation.

Disqualifier:

- If `tournament` output cannot stay byte-identical, pause. Do not continue to
  other public flows.

### Slice 4: Move `review` And Preserve Structural Hint Semantics

Purpose: prove a small public flow with structural relay hints and a custom
relay-result read.

Implementation boundaries:

- Add `src/flows/review/flow.ts`.
- Keep `src/flows/review/relay-hints.ts` as semantic source or move its
  definition into `flow.ts` only if it remains typed and testable.
- Keep `reviewResultComposeBuilder` custom read behavior intact.

Parity tests:

- Definition projection equals current `reviewCompiledFlowPackage`.
- Generated schematic and `generated/flows/review/circuit.json` are unchanged.
- Structural hint registry includes `reviewRelayShapeHint`.
- Review result writer still reads the relay body as before.

Focused tests:

- `tests/contracts/review-flow-contract.test.ts`
- `tests/runner/review-runtime-wiring.test.ts`
- `tests/runner/relay-shape-hint-registry.test.ts`
- `tests/runner/catalog-derivations.test.ts`

Verification:

- `npm run check`
- `npm run test:fast -- tests/contracts/review-flow-contract.test.ts tests/runner/review-runtime-wiring.test.ts tests/runner/relay-shape-hint-registry.test.ts tests/runner/catalog-derivations.test.ts`
- `node scripts/emit-flows.ts --check`

Rollback:

- Restore the legacy `review` package export.

Disqualifier:

- If the definition model cannot express structural hints without hiding
  behavior in untyped escape hatches, stop and redesign the hint API.

### Slice 5: Move `build` And Preserve Engine Flags

Purpose: prove checkpoint, verification, relay selection, and flow-owned engine
flags.

Implementation boundaries:

- Add `src/flows/build/flow.ts`.
- Keep the `bindsExecutionDepthToRelaySelection` flag flow-owned and explicit.
- Keep `build` command and contract source-owned.
- Keep verification proof-plan behavior unchanged.

Parity tests:

- Definition projection equals current `buildCompiledFlowPackage`.
- Generated schematic and `generated/flows/build/circuit.json` are unchanged.
- Runtime surface includes all four modes.
- Engine flag is projected exactly once.
- Checkpoint brief and verification writer resolve through registries.

Focused tests:

- `tests/contracts/build-report-schemas.test.ts`
- `tests/runner/build-report-writer.test.ts`
- `tests/runner/build-runtime-wiring.test.ts`
- `tests/runner/build-verification-exec.test.ts`
- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/runner/verification-brief-writers.test.ts`
- `tests/unit/proof-plan.test.ts`

Verification:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run test:fast -- tests/contracts/build-report-schemas.test.ts tests/runner/build-report-writer.test.ts tests/runner/build-runtime-wiring.test.ts tests/runner/build-verification-exec.test.ts tests/runner/build-checkpoint-exec.test.ts tests/runner/verification-brief-writers.test.ts tests/unit/proof-plan.test.ts`
- `node scripts/emit-flows.ts --check`

Rollback:

- Restore the legacy `build` package export.

Disqualifier:

- If engine flags become global or runtime-owned as part of this migration,
  stop. That violates the package-owned behavior boundary.

### Slice 6: Move `migrate` And Preserve Direct Command Ownership

Purpose: prove sub-run support and direct command ownership.

Implementation boundaries:

- Add `src/flows/migrate/flow.ts`.
- Keep `src/commands/migrate.md` as the command source.
- Keep `migrate` relay hints and writer semantics source-owned.
- Preserve sub-run behavior exactly.

Parity tests:

- Definition projection equals current `migrateCompiledFlowPackage`.
- Generated schematic and `generated/flows/migrate/circuit.json` are unchanged.
- Generated host command mirrors still come from `src/commands/migrate.md`.
- Sub-run item projection remains executable.

Focused tests:

- `tests/runner/migrate-runtime-wiring.test.ts`
- `tests/runtime/sub-run.test.ts`
- `tests/runner/sub-run-runtime.test.ts`
- `tests/runner/sub-run-real-recursion.test.ts`
- `tests/contracts/catalog-completeness.test.ts`

Verification:

- `npm run check`
- `npm run test:fast -- tests/runner/migrate-runtime-wiring.test.ts tests/runtime/sub-run.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/sub-run-real-recursion.test.ts tests/contracts/catalog-completeness.test.ts`
- `node scripts/emit-flows.ts --check`

Rollback:

- Restore the legacy `migrate` package export. Do not touch direct command
  sources.

Disqualifier:

- If the definition design pressures `migrate` into a flow-owned command file,
  stop. The direct command boundary is intentional.

### Slice 7: Move `sweep` And Preserve Cross-Report Validation

Purpose: prove cross-report validators and direct command ownership.

Implementation boundaries:

- Add `src/flows/sweep/flow.ts`.
- Keep `src/commands/sweep.md` as the command source.
- Keep `validateSweepBatchAgainstQueue` attached to `sweep.batch@v1` through a
  typed validator hook.

Parity tests:

- Definition projection equals current `sweepCompiledFlowPackage`.
- Generated schematic and `generated/flows/sweep/circuit.json` are unchanged.
- Cross-report validator registry still resolves `sweep.batch@v1`.
- Validation still reads the queue report path from the live graph.

Focused tests:

- `tests/runner/sweep-runtime-wiring.test.ts`
- `tests/runner/cross-report-validators.test.ts`
- `tests/properties/visible/cross-report-validator.test.ts`
- `tests/runner/verification-brief-writers.test.ts`
- `tests/contracts/catalog-completeness.test.ts`

Verification:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run test:fast -- tests/runner/sweep-runtime-wiring.test.ts tests/runner/cross-report-validators.test.ts tests/properties/visible/cross-report-validator.test.ts tests/runner/verification-brief-writers.test.ts tests/contracts/catalog-completeness.test.ts`
- `node scripts/emit-flows.ts --check`

Rollback:

- Restore the legacy `sweep` package export. Keep validator source untouched.

Disqualifier:

- If validators become registry-side string lookups instead of package-owned
  typed hooks, stop.

### Slice 8: Move `fix` Last

Purpose: migrate the largest flow after the compiler has absorbed the smaller
special cases.

Why last:

- Largest schematic: 14 items.
- Largest report surface: 4 relay reports and 8 output reports.
- Most writer behavior: seven writers plus `projectFixResult` and
  `git-state.mjs`.
- Highest user-facing risk: false-done prevention, regression proofs,
  checkpoint/resume, change-set calculation, and close-result projection.

Implementation boundaries:

- Add `src/flows/fix/flow.ts`.
- Keep `reports.ts`, writer files, `result-projection.ts`, and `git-state.mjs`
  as source.
- Do not change connector policy or helper execution policy.
- Do not change report schema names or paths.
- Treat `lite` generated output as a first-class parity target.

Parity tests:

- Definition projection equals current `fixCompiledFlowPackage`.
- Generated schematic equals `src/flows/fix/schematic.json`.
- `generated/flows/fix/circuit.json` and `generated/flows/fix/lite.json` are
  unchanged.
- Runtime surface includes all four modes and all 14 progress steps.
- All writer result schema names resolve to the same existing writer instances.
- `git-state.mjs` sidecar packaging remains covered by plugin runtime checks.

Focused tests:

- `tests/contracts/fix-report-schemas.test.ts`
- `tests/runner/fix-runtime-wiring.test.ts`
- `tests/runner/fix-result-projection.test.ts`
- `tests/runner/fix-change-set-writer.test.ts`
- `tests/runner/fix-regression-rerun-writer.test.ts`
- `tests/runner/fix-brief-writer.test.ts`
- `tests/integration/fix-false-done-bar.test.ts`
- `tests/integration/fix-false-done-bar-live.test.ts`
- `tests/parity/fix.test.ts`
- `tests/runtime/checkpoint-resume.test.ts`

Verification:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run test:fast -- tests/contracts/fix-report-schemas.test.ts tests/runner/fix-runtime-wiring.test.ts tests/runner/fix-result-projection.test.ts tests/runner/fix-change-set-writer.test.ts tests/runner/fix-regression-rerun-writer.test.ts tests/runner/fix-brief-writer.test.ts tests/integration/fix-false-done-bar.test.ts tests/integration/fix-false-done-bar-live.test.ts tests/parity/fix.test.ts tests/runtime/checkpoint-resume.test.ts`
- `node scripts/emit-flows.ts --check`
- `npm run check-plugin-runtime`

Rollback:

- Restore the legacy `fix` package export. Do not delete semantic helper files.

Disqualifier:

- If fix's semantic writers have to be rewritten to fit the definition model,
  stop. The compiler should reference real semantic code, not absorb it.

### Slice 9: Generate Catalog, Block Catalog, And Generated Surface Map

Purpose: remove the remaining authoring redirection once all flows are
definition-owned.

Implementation boundaries:

- Replace manual catalog imports with a generated or convention-derived
  definition index while preserving the exported `flowPackages` boundary.
- Generate `FlowSchematic` JSON from definitions.
- Generate or update `docs/flows/block-catalog.json` from typed block
  definitions, keeping the current file available for docs and compatibility.
- Update `docs/generated-surfaces.md` so it names `flow.ts` as the source for
  generated manifests once schematics are generated.
- Keep generated host package surfaces non-source.

Residue checks:

- `rg "CompiledFlowPackage =" src/flows/*/index.ts`
- `rg "runtimeSurface:" src/flows/*/index.ts`
- `rg "relayReports:" src/flows/*/index.ts`
- `rg "reportSchemas:" src/flows/*/index.ts`
- `rg "writers:" src/flows/*/index.ts`
- `rg "src/flows/.*/schematic.json" src scripts tests docs`
- `find src/flows -name relay-hints.ts`
- `rg "acceptedSchematicExecutionKindsForBlock|acceptedSchematicStagesForBlock" src tests`

Expected result:

- The only remaining authored per-flow files are:
  `flow.ts`, `reports.ts`, semantic writer/helper files, optional
  `command.md`, optional `contract.md`, and optional focused hook modules.
- `schematic.json` is generated or removed from source.
- `index.ts` is a small generated or mechanical compatibility export, or is no
  longer needed.
- Catalog source no longer needs one import and one array edit per flow.

Verification:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run test:fast`
- `node scripts/emit-flows.ts --check`
- `npm run check-plugin-runtime`
- `npm run check-release-infra`

Rollback:

- Restore legacy `schematic.json` files and `index.ts` package definitions from
  the previous slice. Generated files can be regenerated from the restored
  legacy sources.

Disqualifier:

- If generated catalog discovery weakens engine-to-flow import boundaries, stop
  and keep an explicit generated catalog checked into source.

### Slice 10: Remove Legacy Compatibility And Run Final Verification

Purpose: delete only the redirection proven redundant by previous slices.

Expected deletions or generated replacements:

| Current source | Target state |
|---|---|
| `src/flows/<id>/schematic.json` | Generated from `src/flows/<id>/flow.ts`, or retained only as generated compatibility output. |
| Repeated `CompiledFlowPackage` literals in `src/flows/<id>/index.ts` | Generated package projection or tiny compatibility export. |
| Manual `runtimeSurface` blocks in each public flow package | Derived from definition modes, primary result, and progress metadata. |
| Manual `relayReports` arrays | Derived from typed relay steps and report schema references. |
| Manual `reportSchemas` arrays | Derived from typed report declarations in the definition, backed by `reports.ts`. |
| Manual writer arrays | Derived from typed writer declarations. |
| Manual central catalog imports and array entries | Generated or convention-derived catalog, preserving `flowPackages`. |
| Hand-maintained block compatibility maps | Derived from typed block definitions and projected into docs/tests. |
| `docs/flows/block-catalog.json` as hand-authored source | Generated docs artifact. |

Files that should not be deleted:

- `src/flows/<id>/reports.ts`
- Semantic writer/helper files
- `src/flows/fix/writers/git-state.mjs`
- `src/flows/fix/writers/result-projection.ts`
- `src/flows/sweep/cross-report-validators.ts` unless folded into a typed hook
  module with identical exports
- Flow-owned `command.md` and `contract.md`
- Direct command sources under `src/commands/`
- Runtime execution and connector policy modules

Final verification:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run test`
- `node scripts/emit-flows.ts --check`
- `npm run check-plugin-runtime`
- `npm run check-release-infra`
- `npm run verify`

Final review gate:

- Run an adversarial review against this migration's stated invariants.
- Resolve every medium, high, and critical finding.
- Run a second adversarial review.
- Complete only after two consecutive reviews have no medium-or-above findings.

## Risk Map

| Risk | Why it matters | Evidence | Mitigation | Rollback point |
|---|---|---|---|---|
| Generated host surfaces drift. | Host users see changed commands or compiled flow behavior. | `docs/generated-surfaces.md:21-27`, `docs/generated-surfaces.md:34-40` | Compare generated manifests and run `node scripts/emit-flows.ts --check` in every public-flow slice. | Restore legacy package export before regenerating. |
| Report schema ownership regresses. | Cross-flow schema references recreate old coupling. | `tests/contracts/catalog-completeness.test.ts:371` | Definition report declarations must reference local `reports.ts` exports; preserve referential identity tests. | Restore legacy package report arrays. |
| Writer registry drops semantic code. | Runtime silently uses a missing or wrong builder. | `tests/runner/catalog-derivations.test.ts:458` | Compare writer instance identity by registry lookup. Keep semantic writers as code. | Restore legacy `writers` arrays. |
| Runtime surface becomes optional again. | CLI support and progress display lose package-owned metadata. | `tests/contracts/catalog-completeness.test.ts:99`, `tests/contracts/catalog-completeness.test.ts:164` | Derive modes and progress from definitions; require public flows to declare them. | Restore legacy `runtimeSurface`. |
| Direct command ownership is blurred. | `migrate` and `sweep` host command source changes unintentionally. | `docs/generated-surfaces.md:35`, `docs/generated-surfaces.md:40`, `tests/contracts/catalog-completeness.test.ts:306` | Model command ownership explicitly as `flow-owned`, `direct`, or `none`. | Restore direct command source wiring. |
| Custom hooks become untyped escape hatches. | The new architecture hides complexity instead of simplifying it. | `src/flows/sweep/index.ts:61`, `src/flows/review/index.ts:84`, `src/flows/fix/writers/result-projection.ts:38` | Give hooks named typed slots: `validator`, `structuralHint`, `resultProjector`, `sidecarCommand`. | Stop and redesign hook API. |
| `fix` changes behavior while appearing structurally equivalent. | Its close result, regression proof, and change-set logic are semantic. | `src/flows/fix/writers/change-set.ts:5`, `src/flows/fix/writers/baseline-snapshot.ts:8` | Leave `fix` last; run integration tests and plugin runtime checks. | Restore legacy `fix` export. |
| Compiler defaulting becomes too clever. | Hidden defaults make new flows hard to reason about. | ADR disqualifier around custom hooks: `docs/architecture/declarative-flow-architecture.md:538` | Defaults must be testable, documented, and overridable. | Keep explicit per-flow definitions. |
| Generated catalog weakens import boundary. | Runtime starts reaching into flow internals. | `tests/contracts/engine-flow-boundary.test.ts` and `src/flows/catalog.ts` | Export the same `flowPackages` boundary from a generated catalog. | Keep manual catalog until generator is safe. |

## Fewest-Files-Mutated Check

Every slice must answer this before it merges:

- Did the slice reduce the number of files that must be edited to add or
  modify a flow?
- Did it preserve or improve the ability to prove parity with current generated
  artifacts?
- Did it leave semantic code in code, rather than converting it into opaque
  config?
- Did it avoid touching engine or connector code for a flow-only migration?

The target for a simple new flow after this migration is:

- Required: `src/flows/<id>/flow.ts`
- Required: `src/flows/<id>/reports.ts`
- Optional: `src/flows/<id>/command.md`
- Optional: `src/flows/<id>/contract.md`
- Optional: `src/flows/<id>/writers/*.ts` only when default writers are not
  semantically enough

No simple new flow should require manual edits to:

- central catalog arrays
- runtime support matrices
- progress projection code
- report schema registries
- writer registries
- generated host package outputs
- release surface docs

## Stop Conditions

Stop the migration and return to design if any of these happen:

- A public generated manifest changes and the change cannot be explained as a
  separately approved versioned migration.
- A generated host command or skill changes without an explicit host-surface
  migration.
- A report schema name, result path, or Zod shape changes.
- The engine imports a concrete flow definition or writer directly.
- A connector policy, timeout, cap, environment, or tool-list behavior changes.
- A semantic writer must be rewritten only to fit the declarative model.
- The compiler cannot produce strict parse-time failures equivalent to today's
  schematic validation.
- A migrated flow cannot be rolled back by restoring its legacy package export.
