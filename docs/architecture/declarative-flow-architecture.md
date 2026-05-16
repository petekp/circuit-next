---
name: declarative-flow-architecture
description: Architecture decision record for the next declarative flow authoring model.
type: architecture-decision
date: 2026-05-16
status: proposed
---

# Declarative Flow Architecture

## Decision

Adopt a typed `FlowDefinition` architecture as the next source of truth for
flow authoring.

A flow should be declared once as plain TypeScript data plus explicit semantic
hooks. The compiler should derive the current package, schematic, runtime
surface, registries, generated host artifacts, and drift-check outputs from
that definition.

This is a design decision only. It does not change runtime behavior yet.

## Decision Frame

Goal: make Circuit flow authoring elegant, supple, and data-driven. Adding a
new flow or block should mutate the fewest possible files.

Problem: current flow facts are package-owned, but still spread across
schematic JSON, package `index.ts`, report schemas, relay hints, writer
registries, runtime surfaces, and the central catalog.

Invariants:

- Preserve public CLI behavior.
- Preserve existing report schemas and generated host surfaces.
- Preserve engine-to-flow import boundaries.
- Preserve connector security policy.
- Keep custom writer logic available when the logic is genuinely semantic.
- Keep runtime execution flow-agnostic.

Non-goals:

- Do not migrate runtime execution to Effect as part of the initial
  `FlowDefinition` migration. The follow-on functional direction is captured in
  `docs/architecture/data-first-functional-flow-architecture.md`.
- Do not implement the migration in this ADR.
- Do not remove custom writer hooks that encode real product semantics.
- Do not make flow authors write a stringly JSON language when TypeScript can
  provide better names and type checking.

Decision horizon: one year. This should support built-in flow evolution first
and later user-authored flows without reopening the core model.

## Current System Map

| Area | Current Owner | Inputs | Outputs | Pain |
| --- | --- | --- | --- | --- |
| Flow package | `src/flows/<id>/index.ts`, shaped by `src/flows/types.ts` | report schemas, writers, routing, paths, runtime surface | `CompiledFlowPackage` | One file still repeats graph-derived facts and manual registration. |
| Catalog | `src/flows/catalog.ts` | imported flow packages | `flowPackages`, id lookup | Adding a flow still mutates a central list. |
| Registry derivation | `src/flows/catalog-derivations.ts` | `flowPackages` | writer, report, hint, routing, runtime-surface registries | Good direction, but each registry still starts from package-shaped duplication. |
| Reports | `src/flows/<id>/reports.ts`, then package arrays | Zod schemas, schema names, result pointer helpers | parseable typed reports | Schemas are real source, but schema registration and some result-pointer validation are repeated elsewhere. |
| Writers | `src/flows/<id>/writers/*`, then package writer arrays | custom builder objects keyed by result schema name | compose, close, verification, checkpoint outputs | Every writer looks registry-shaped even when the behavior is a small projection. |
| Schematic | `src/flows/<id>/schematic.json`, parsed by `src/schemas/flow-schematic.ts` | authored steps, routes, mode overrides, protocol, writes, checks | `FlowSchematic` | Active schematics are complete but verbose. They force authors to spell out mechanics blocks could derive. |
| Block catalog | `docs/flows/block-catalog.json`, `src/schemas/flow-blocks.ts` | block inventory | validation facts | Block meaning is split between JSON rows and TS policy helpers. |
| Block policy | `src/schemas/flow-schematic-policy.ts` | block catalog rows | allowed execution kinds and stages | Policy is not fully owned by block definitions. |
| Compiler | `src/flows/compile-schematic-to-flow.ts` | `FlowSchematic` | one or more `CompiledFlow` values | Strong pure compiler, but it compiles a lower-level authoring shape. |
| Runtime | `src/runtime/run/graph-runner.ts` | executable graph, runtime package index, executors | trace, reports, result | Runtime is already mostly flow-agnostic. This should stay. |
| Runtime package index | `src/runtime/manifest/runtime-package-index.ts` | executable flow | closed step/report lookup | Good target boundary; the new compiler should feed it directly. |
| CLI and router | `src/cli/circuit.ts`, `src/flows/router.ts` | user args, task text, runtime support metadata | selected flow and runtime invocation | CLI should consume derived flow surfaces, not own flow support facts. |
| Generated surfaces | `scripts/emit-flows.ts`, `docs/generated-surfaces.md` | catalog, schematics, commands | generated manifests and host package mirrors | Good drift model; source side should become simpler. |
| Tests | `tests/contracts/catalog-completeness.test.ts`, `tests/contracts/flow-schematic.test.ts` | catalog, schematics, block catalog | structural guarantees | Existing tests show exactly which facts should become compiler-derived. |

## Source Evidence

- `src/flows/types.ts:1-11` says a flow package describes paths, routing,
  reports, writers, and hints, and adding a flow means creating a package and
  appending it to the catalog.
- `src/flows/types.ts:147-169` confirms `CompiledFlowPackage` owns id,
  visibility, paths, routing, relay reports, report schemas, writers,
  structural hints, runtime surface, and engine flags.
- `src/flows/catalog.ts:1-6` says router, registries, report schemas, shape
  hints, and emit script derive from `flowPackages`, but `src/flows/catalog.ts:17-25`
  still hand-lists every package.
- `src/flows/catalog-derivations.ts:19-63` already turns package writer arrays
  into registries; `src/flows/catalog-derivations.ts:68-153` derives report,
  hint, validator, structural hint, and runtime-surface indexes.
- `src/schemas/flow-schematic.ts:169-193` shows each schematic item currently
  declares block, stage, input, output, evidence, execution, routes, protocol,
  writes, check, checkpoint policy, and fanout metadata.
- `src/schemas/flow-schematic.ts:644-694` requires active schematics to carry
  compiler-required metadata at parse time. This is good for safety, but it
  also makes the authored shape noisy.
- `src/schemas/flow-blocks.ts:105-124` gives blocks stable inputs, outputs,
  action surface, evidence, check kind, routes, human interaction, and host
  capabilities.
- `src/schemas/flow-schematic-policy.ts:5-23` and `src/schemas/flow-schematic-policy.ts:26-56`
  keep execution-kind and stage policy outside the block catalog.
- `src/flows/compile-schematic-to-flow.ts:1-26` already has the right compiler
  posture: pure projection, per-mode compilation, clear failures.
- `src/flows/compile-schematic-to-flow.ts:114-180` computes reachability and
  typed read paths from routes and contracts.
- `src/runtime/run/graph-runner.ts:1-6` says the runtime should interpret the
  executable graph and keep flow-specific behavior in flow registries.
- `src/runtime/manifest/runtime-package-index.ts:69-105` builds the closed
  runtime step/report index the runtime now wants.
- `docs/flows/authoring-model.md:44-56` defines today's layers as block,
  schematic step, report schema, and route policy.
- `docs/flows/authoring-model.md:215-226` says adding a flow requires a
  schematic, report schemas, contract aliases, writer/hint ownership, catalog
  registration, emit, and verify.
- `docs/generated-surfaces.md:21-27` lists the generated surfaces that should
  remain generated after this migration.
- `tests/contracts/catalog-completeness.test.ts` already verifies catalog,
  runtime surface, schematic, progress, and file-layout invariants across
  real packages.
- `tests/contracts/flow-schematic.test.ts` already verifies active schematic,
  block-catalog compatibility, route targets, route overrides, evidence
  requirements, stage bindings, execution bindings, and Lite close behavior.

## Options Considered

### Option A: Extend The Current Package-Owned Model

Keep `CompiledFlowPackage` as the source of truth. Add more helpers so package
indexes derive more data from the existing schematic and package fields.

What gets simpler:

- Lower migration risk.
- The current refactor continues naturally.
- Existing tests need fewer changes.

What stays hard:

- Authors still touch `schematic.json`, `index.ts`, writer files, relay-hints
  files, and `catalog.ts`.
- Blocks remain advisory rows plus sidecar policy.
- The package remains an assembly of already-duplicated facts.

Disqualifier: this does not satisfy the "fewest files mutated to add a
flow/block" criterion strongly enough.

### Option B: Typed Flow Definition Compiler

Create a typed `defineFlow()` source model. A flow definition owns graph,
modes, reports, routes, routing, docs, and special hooks. A compiler projects
that definition into today's package, schematic, runtime surface, registries,
and generated host artifacts.

What gets simpler:

- One authored source can replace manual schematic JSON plus most package
  `index.ts` boilerplate.
- Blocks can own defaults for execution kind, stage, writes, checks, evidence,
  and progress text.
- Reports can own schema, path, label, relay guidance, primary-result status,
  and writer strategy.
- Custom behavior becomes explicit hooks instead of every writer looking like a
  registry entry.

What gets harder:

- The compiler becomes more important.
- Early migration needs parity tests against today's emitted artifacts.
- The public authoring API must avoid cute DSL tricks that hide facts.

Disqualifier: if an Explore parity spike cannot generate the same schematic,
compiled flow, runtime surface, and package registry entries without special
cases, this option is not ready.

### Option C: JSON-Only Declarative Flow Manifest

Move all flow metadata into a single JSON or YAML manifest. Keep TypeScript
only for schemas and custom hooks referenced by name.

What gets simpler:

- Clear data files.
- Easier future non-TypeScript authoring.
- Schematics remain inspectable without building.

What gets harder:

- Custom hooks become string references.
- Type checking gets weaker.
- Report schemas and hook functions still live elsewhere, so the "single
  source of truth" claim is partial.
- Refactors become more fragile because names are strings.

Disqualifier: built-in flow development should be pleasant for this repo
first. JSON-only optimizes too early for external authoring.

### Option D: Runtime Consumes Flow Definitions Directly

Skip schematic and compiled-flow compatibility and teach the runtime to consume
`FlowDefinition` directly.

What gets simpler:

- Fewer intermediate artifacts in the long run.
- Strongest possible deletion story.

What gets harder:

- Highest migration risk.
- Generated host surfaces and existing compiled-flow contracts would need
  versioned migration.
- Runtime behavior could drift while the authoring model is still being
  tested.

Disqualifier: this violates the constraint to preserve current runtime
behavior and generated host surfaces unless a later versioned migration is
explicitly approved.

## Tradeoff Matrix

| Dimension | Option A: Extend Current | Option B: Typed Definition | Option C: JSON Manifest | Option D: Runtime Direct |
| --- | --- | --- | --- | --- |
| Simplicity | Medium. Small local improvements. | High after migration. One authoring unit. | Medium. Simple data, awkward hooks. | High eventually, low during migration. |
| Migration difficulty | Low. | Medium. Can run in parallel. | Medium. Needs string hook resolution. | High. Touches runtime contract. |
| Cleanup burden | Medium. Old shape remains. | Low if parity gates force deletion. | Medium. Can leave data plus TS glue. | High. Likely leaves compatibility layers. |
| Operability | High. Existing artifacts stay. | High. Existing artifacts stay during migration. | High. Existing artifacts stay. | Medium. Runtime contract changes. |
| Testability | Medium. More invariant tests. | High. Projection tests can compare generated outputs. | Medium. Needs reference resolution tests. | Medium. Runtime tests carry more load. |
| Long-term flexibility | Medium. | High. Blocks/reports/flows become real primitives. | Medium. External authoring improves, built-in authoring weakens. | Medium-high, but expensive. |

## Recommendation

Choose Option B: typed `FlowDefinition` compiler.

This best matches Circuit's direction: a small number of strong primitives
rather than many accreted registries. It preserves today's runtime and host
surfaces while creating a clean source model above them.

The author-facing concepts should be:

- `defineBlock()`: reusable block defaults and validation rules.
- `defineReport()`: schema, default path, label, relay guidance, and writer
  strategy.
- `defineFlow()`: graph-specific choices: modes, routing, steps, routes,
  report use, and special hooks.
- `compileFlowDefinition()`: pure projection into current artifacts.
- `hooks`: named custom functions for semantic behavior only.

The compiler should derive:

- active `FlowSchematic`;
- `CompiledFlowPackage`;
- `CompiledFlowRuntimeSurface`;
- writer registries;
- report schema registries;
- relay shape hints;
- block compatibility checks;
- generated flow manifests;
- generated host flow mirrors and commands;
- generated docs or drift ledgers where useful.

## Target Interface Sketch

The API should be plain TypeScript data with small helpers. Avoid a clever
fluent DSL as the primary shape; it is harder to inspect and generate from.

```ts
export default defineFlow({
  id: 'explore',
  visibility: 'public',
  version: '0.1.0',
  docs: {
    command: './command.md',
    contract: './contract.md',
  },
  routing: defaultRoute({
    reason: 'no routed flow signal matched; routed to explore as the conservative default',
  }),
  modes: [
    mode('default', 'standard'),
    mode('lite', 'lite'),
    mode('deep', 'deep'),
    mode('tournament', 'tournament'),
    mode('autonomous', 'autonomous'),
  ],
  stagePath: partialStagePath({
    omits: ['act', 'verify', 'review'],
    rationale:
      'Explore is investigation and decision work. Synthesis and critique live in plan/decision.',
  }),
  reports: {
    brief: report('explore.brief@v1', ExploreBrief).path('reports/brief.json'),
    analysis: report('explore.analysis@v1', ExploreAnalysis).path('reports/analysis.json'),
    compose: report('explore.compose@v1', ExploreCompose)
      .path('reports/compose.json')
      .relayGuidance(exploreComposeGuidance),
    review: report('explore.review-verdict@v1', ExploreReviewVerdict)
      .path('reports/review-verdict.json')
      .relayGuidance(exploreReviewGuidance),
    result: report('explore.result@v1', ExploreResult)
      .path('reports/explore-result.json')
      .primary('Explore result')
      .closeWith(exploreCloseResult),
  },
  steps: [
    step('frame-step', 'frame')
      .writes('brief')
      .composeWith(exploreBriefFromGoal)
      .routes({ continue: 'analyze-step', stop: '@stop' }),
    step('analyze-step', 'diagnose')
      .reads({ brief: 'brief' })
      .writes('analysis')
      .composeWith(exploreAnalysisFromBrief)
      .routes({ continue: 'synthesize-step', retry: 'analyze-step', stop: '@stop' })
      .overrides({ continue: { tournament: 'decision-options-step' } }),
    step('synthesize-step', 'plan')
      .reads({ brief: 'brief', analysis: 'analysis' })
      .writes('compose')
      .relay('implementer')
      .routes({ continue: 'review-step', retry: 'synthesize-step', stop: '@stop' }),
    step('review-step', 'review')
      .reads({ brief: 'brief', analysis: 'analysis', compose: 'compose' })
      .writes('review')
      .relay('reviewer')
      .routes({ continue: 'close-step', retry: 'synthesize-step', stop: '@stop' }),
    step('decision-options-step', 'plan')
      .reads({ brief: 'brief', analysis: 'analysis' })
      .writes('decisionOptions')
      .composeWith(exploreDecisionOptions)
      .routes({ continue: 'proposal-fanout-step', stop: '@stop' }),
    step('proposal-fanout-step', 'plan')
      .reads({ brief: 'brief', analysis: 'analysis', decisionOptions: 'decisionOptions' })
      .writes('tournamentAggregate')
      .fanout(exploreTournamentBranches)
      .routes({ continue: 'stress-proposals-step', stop: '@stop' }),
    step('stress-proposals-step', 'plan')
      .reads({ brief: 'brief', analysis: 'analysis', tournamentAggregate: 'tournamentAggregate' })
      .writes('tournamentReview')
      .relay('reviewer')
      .routes({ continue: 'tradeoff-checkpoint-step', retry: 'proposal-fanout-step', stop: '@stop' }),
    step('tradeoff-checkpoint-step', 'human-decision')
      .reads({ tournamentReview: 'tournamentReview', tournamentAggregate: 'tournamentAggregate' })
      .checkpoint(exploreTradeoffCheckpoint)
      .routes({ continue: 'decision-step', stop: '@stop', handoff: '@handoff' }),
    step('decision-step', 'plan')
      .reads({
        decisionOptions: 'decisionOptions',
        tournamentAggregate: 'tournamentAggregate',
        tournamentReview: 'tournamentReview',
      })
      .writes('decision')
      .composeWith(exploreDecisionFromCheckpoint)
      .routes({ continue: 'close-tournament-step', stop: '@stop' }),
    step('close-tournament-step', 'close-with-evidence')
      .reads({
        brief: 'brief',
        analysis: 'analysis',
        decisionOptions: 'decisionOptions',
        tournamentAggregate: 'tournamentAggregate',
        tournamentReview: 'tournamentReview',
        decision: 'decision',
      })
      .writes('result')
      .routes({ complete: '@complete' }),
    step('close-step', 'close-with-evidence')
      .reads({ brief: 'brief', analysis: 'analysis', compose: 'compose', review: 'review' })
      .writes('result')
      .routes({ complete: '@complete' }),
  ],
});
```

The same shape should make a simple new flow small:

```ts
export default defineFlow({
  id: 'triage',
  visibility: 'public',
  version: '0.1.0',
  routing: signals({
    order: 25,
    include: [/^\s*triage\s*:/i],
    reason: 'matched triage prefix; routed to Triage flow',
  }),
  modes: [mode('default', 'standard'), mode('lite', 'lite')],
  reports: {
    brief: report('triage.brief@v1', TriageBrief).path('reports/brief.json'),
    assessment: report('triage.assessment@v1', TriageAssessment)
      .path('reports/assessment.json')
      .relayGuidance(triageAssessmentGuidance),
    result: report('triage.result@v1', TriageResult)
      .path('reports/triage-result.json')
      .primary('Triage result')
      .closeWith(closeTriageResult),
  },
  steps: [
    step('triage-frame', 'frame')
      .writes('brief')
      .composeWith(briefFromGoal)
      .routes({ continue: 'triage-assess', stop: '@stop' }),
    step('triage-assess', 'review')
      .reads({ brief: 'brief' })
      .writes('assessment')
      .relay('reviewer')
      .routes({ continue: 'triage-close', retry: 'triage-assess', stop: '@stop' }),
    step('triage-close', 'close-with-evidence')
      .reads({ brief: 'brief', assessment: 'assessment' })
      .writes('result')
      .routes({ complete: '@complete' }),
  ],
});
```

Adding that simple flow should require only:

1. `src/flows/triage/flow.ts`
2. `src/flows/triage/reports.ts`
3. optional `src/flows/triage/command.md`
4. optional `src/flows/triage/contract.md`

It should not require hand edits to catalog, registry, runtime, progress,
generated surfaces, host plugin packages, or release ledgers.

## What Becomes Deletable Or Generated

Generated or removed per flow:

- `src/flows/<id>/index.ts`: replace with generated package projection or
  delete after `defineFlow()` can supply `CompiledFlowPackage`.
- `src/flows/<id>/schematic.json`: generate from the flow definition during
  the compatibility phase, then stop treating it as authored source.
- `src/flows/<id>/relay-hints.ts`: fold real guidance into report
  declarations; generate boilerplate such as "raw JSON object, no markdown,
  validated against schema".
- Manual `runtimeSurface` blocks: derive from modes, primary report, step
  reports, and block progress defaults.
- Manual package writer arrays: derive from report writer strategies and
  step declarations.
- Manual report schema arrays: derive from report declarations.
- Repeated result pointer enums and schema maps: derive from declared reports
  and close result modes where possible.
- Central `src/flows/catalog.ts` hand imports/list: replace with a generated
  catalog module or build-time discovery manifest.

Kept as authored source:

- Zod report schemas.
- Custom semantic hooks such as option extraction, close result projection,
  git-state evidence interpretation, checkpoint report assembly, and unusual
  relay-result reads.
- Command and contract docs until their source format is separately revisited.
- Runtime graph execution, connector policy, and generated host surfaces.

## Migration Plan

### Phase 0: Guardrails

Add a design-only compiler test harness. No production behavior changes.

Checks:

- `npm run check`
- focused tests for catalog completeness and schematic parsing
- no generated output changes

### Phase 1: Introduce `FlowDefinition` As A Parallel Projection

Add `defineFlow()`, `defineReport()`, `defineBlock()`, and
`compileFlowDefinition()` behind tests. Convert Explore into a parallel
definition without using it at runtime.

Checks:

- generated Explore `CompiledFlowPackage` equals today's package surface;
- generated Explore schematic equals today's schematic;
- generated Explore runtime surface equals today's runtime surface;
- `node scripts/emit-flows.ts --check` stays clean.

### Phase 2: Make One Flow Definition-Owned

Flip Explore so `flow.ts` is the source and legacy package/schematic outputs
are generated or derived.

Checks:

- `npm run check`
- `npm run test:fast`
- `node scripts/emit-flows.ts --check`
- `npm run check-plugin-runtime`

### Phase 3: Prove The "New Flow" Experience

Add a tiny internal fixture flow using only `flow.ts` plus `reports.ts`.
Assert that no catalog, registry, progress, runtime, or generated host source
file needs hand mutation.

Checks:

- a structural test that discovers the fixture definition;
- a projection test for package, schematic, and runtime surface;
- a drift test proving generated outputs are derived.

### Phase 4: Move Blocks To Definitions

Replace the split block catalog plus `flow-schematic-policy.ts` with
`defineBlock()` records that own allowed routes, stage defaults, execution
defaults, evidence requirements, host interaction, and progress defaults.
Keep `docs/flows/block-catalog.json` generated for docs and compatibility.

Checks:

- block catalog generated output matches current catalog;
- block compatibility tests still pass;
- active schematics still reject invalid block/stage/execution combinations.

### Phase 5: Retire Legacy Authored Surfaces

Delete manual package `index.ts` files and authored schematic JSON once all
built-in flows are definition-owned. Keep generated compatibility artifacts
until a later versioned runtime migration removes them.

Checks:

- `npm run test`
- `node scripts/emit-flows.ts --check`
- `npm run check-plugin-runtime`
- `npm run check-release-infra`
- `npm run verify`

## Must-Be-True Assumptions

| Assumption | Why It Matters | How To Verify | Fastest Disproof |
| --- | --- | --- | --- |
| A typed definition can generate today's Explore artifacts without special cases. | Explore is the representative proof. | Parity test against current schematic, package, runtime surface, and emitted manifests. | Explore needs custom compiler branches for ordinary steps. |
| Block defaults can derive most `execution`, `writes`, `check`, `evidence_requirements`, and progress metadata. | This is the main simplification. | Compare generated schematic to current Explore and Fix. | Most steps require manual overrides. |
| Custom hooks can stay explicit without recreating registry boilerplate. | Writers are where real semantics live. | Convert Explore close and decision hooks. | Hook registration becomes as verbose as today's writer registration. |
| Generated surfaces can remain byte-stable. | Public host behavior must not regress. | `node scripts/emit-flows.ts --check`, plugin runtime checks. | Host mirrors drift after definition projection. |

## Risks And Pre-Mortem

| Risk | Warning Signal | Prevention |
| --- | --- | --- |
| The DSL becomes cute and hides facts. | Authors need to inspect helper internals to know what a step does. | Prefer plain object data and small helper constructors. |
| The compiler becomes a second runtime. | Runtime behavior decisions move into projection code. | Compiler only normalizes facts; runtime still executes the normalized graph. |
| Custom hooks leak everywhere. | Every report uses `.custom()` with opaque code. | Provide declarative defaults for common compose, relay, verification, checkpoint, and close cases. |
| Generated files obscure review. | Diffs are mostly generated churn. | Keep source diff first, generated drift checks second. |
| Compatibility artifacts outlive usefulness. | Both old and new authoring paths stay active indefinitely. | Set deletion milestones for manual package and schematic sources. |

## Final Disqualifiers

Do not adopt this architecture if:

- one representative built-in flow cannot be projected without flow-specific
  compiler branches;
- generated host surfaces cannot stay stable;
- adding a simple flow still requires central catalog or registry edits;
- the new source shape makes custom semantic writer logic harder to find;
- block defaults erase important flow-specific intent instead of reducing
  mechanical repetition.

## Verification Contract For The Migration

Each migration slice should prove one boundary and then broaden:

1. focused projection tests for the flow or block being migrated;
2. `tests/contracts/catalog-completeness.test.ts`;
3. `tests/contracts/flow-schematic.test.ts`;
4. `tests/runner/catalog-derivations.test.ts`;
5. `npm run check`;
6. `npm run test:fast`;
7. `node scripts/emit-flows.ts --check`;
8. `npm run check-plugin-runtime`;
9. final `npm run verify` before claiming a behavior-preserving migration is
   complete.

The north-star acceptance test:

> A simple new public flow can be added with one new flow folder and no hand
> edits to engine, registry, router, progress, report-schema registry, central
> catalog, generated host outputs, or release surfaces.
