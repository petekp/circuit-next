---
plan: compiled-recipe-runtime-bridge
status: challenger-pending
revision: 02
opened_at: 2026-04-25
opened_in_session: compiled-recipe-runtime-bridge-arc-open
base_commit: 1dda1c8f9a859e2fd02b4119b4f8afcb6469b063
target: runtime
authority:
  - specs/methodology/decision.md
  - specs/adrs/ADR-0003-authority-graph-gate.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - specs/adrs/ADR-0012-two-mode-methodology.md
  - specs/adrs/ADR-0013-primitive-backed-workflow-recipes.md
  - specs/contracts/workflow.md
  - specs/workflow-recipe-composition.md
  - src/schemas/workflow-recipe.ts
  - src/schemas/workflow.ts
  - src/schemas/workflow-primitives.ts
  - src/schemas/selection-policy.ts
  - src/schemas/phase.ts
  - src/schemas/step.ts
  - src/schemas/artifacts/fix.ts
  - src/runtime/runner.ts
  - specs/workflow-recipes/fix-candidate.recipe.json
  - specs/workflow-recipes/fix-candidate.projection.json
  - specs/workflow-primitive-catalog.json
  - specs/artifacts.json
  - scripts/audit.mjs
artifact_ids:
  - workflow.recipe_definition
  - workflow.definition
  - workflow.primitive_catalog
  - run.projection
  - run.log
prior_challenger_passes:
  - specs/reviews/compiled-recipe-runtime-bridge-codex-challenger-01.md
    (verdict REJECT-PENDING-FOLD-INS vs revision 01 — 2 CRITICAL,
    3 HIGH, 1 MED; revision 02 reframes the arc as option (a) "widen
    the compiler so its output is runtime-ready, then bridge", drops
    the live Fix execution claim, fixes the §5 default_selection.start_at
    mismapping, fixes the ADR-0013 citation path, aligns §6 to the
    greenfield rows in specs/artifacts.json, picks a single-rigor
    binding rule, names explicit ARC_CLOSE_GATES wiring in Slice D,
    and grounds Slice A's golden in independent authorities)
---

# Compiled Recipe → Runtime Bridge Plan

A small Heavy effort that connects `compileWorkflowRecipeDraft` to the
runtime `Workflow` shape used today. The compiler currently emits a
planning-only `WorkflowRecipeDraft` whose payload is structurally
narrower than `Workflow.parse` requires; the runtime parses
hand-authored `.workflow.json` manifests and has no compiler entry
point. The bridge is option (a) of the revision-01 reframe: **widen
the compiler so its output carries the data the runtime needs, then
materialize.** Four slices land it: a compiler-widening slice that
introduces a runtime-ready compiled-recipe shape, a typed materializer
slice with field-level assertions grounded in independent authorities,
a runner compile path proven against a synthetic dispatch loop, and an
arc-close composition review wired into `ARC_CLOSE_GATES`.

A live Fix execution proof is explicitly **not** in this arc. Fix is
policy-only today (`specs/contracts/fix.md` and the runner's
Build/Explore/Review-only writers), and committing to live Fix
substrate widening is a separate operator-direction call.

## §Evidence census

Authoritative artifacts touched, in their current shape:

| Id | Statement | Status | Citation |
|---|---|---|---|
| E1 | `compileWorkflowRecipeDraft(projection, rigor)` returns `WorkflowRecipeDraft` carrying `recipe_id`, `rigor`, `starts_at`, `phases[]`, `omitted_phases[]`, `items[]`. Each item exposes `id`, `uses`, `phase`, `execution`, `output`, `edges[]`. Per-item `title`, `input`, `evidence_requirements`, `selection` are dropped, and the recipe-level `title`, `purpose`, `initial_contracts`, `contract_aliases` are dropped. | verified | `src/schemas/workflow-recipe.ts` |
| E2 | `Workflow` requires `schema_version: '2'`, `version`, `purpose`, `entry: {signals, intent_prefixes}`, `entry_modes: EntryMode[].min(1)`, `phases: Phase[].min(1)`, `steps: Step[].min(1)`, `spine_policy: SpinePolicy`, optional `default_selection: SelectionOverride`. | verified | `src/schemas/workflow.ts` |
| E3 | `SelectionOverride` exposes `{model?, effort?, skills, rigor?, invocation_options}` and has **no `start_at` field**. The runtime home for `start_at` is `EntryMode.start_at` (`StepId`). Revision 01 §5 mismapped `draft.starts_at` to `default_selection.start_at`; revision 02 corrects this. | verified | `src/schemas/selection-policy.ts`, `src/schemas/workflow.ts` |
| E4 | `Phase` is `{id: PhaseId, title, canonical?, steps[], selection?}`. The compiler projection groups items by `CanonicalPhase` (`frame|analyze|plan|act|verify|review|close`) but does not emit phase titles. | verified | `src/schemas/phase.ts` |
| E5 | `Step` is a discriminated union over `SynthesisStep`, `VerificationStep`, `CheckpointStep`, `DispatchStep`. Synthesis/verification require `writes.artifact: ArtifactRef` and `SchemaSectionsGate`. Checkpoint requires `policy: CheckpointPolicy`, `writes.{request, response, artifact?}`, `CheckpointSelectionGate`. Dispatch requires `role: DispatchRole`, `writes.{artifact?, request, receipt, result}`, `ResultVerdictGate`. | verified | `src/schemas/step.ts` |
| E6 | `workflowFromManifestBytes(bytes)` parses `.workflow.json` into `Workflow`. The runner has no compiler entry point today. | verified | `src/runtime/runner.ts` |
| E7 | The Fix recipe fixture declares 12 items across `frame`, `analyze`, `act`, `verify`, `review`, `close`; the canonical `plan` phase is omitted by design. | verified | `specs/workflow-recipes/fix-candidate.recipe.json`, `specs/workflow-recipes/fix-candidate.projection.json` |
| E8 | `FIX_RESULT_PATH_BY_ARTIFACT_ID` and `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` cover `fix.brief`, `fix.context`, `fix.diagnosis`, `fix.no-repro-decision`, `fix.change`, `fix.verification`, `fix.review`. Slice A's field-level test reads these as independent authorities. | verified | `src/schemas/artifacts/fix.ts` |
| E9 | All five touched authority rows are classified `surface_class: greenfield`: `workflow.definition` (line 5), `workflow.primitive_catalog` (32), `workflow.recipe_definition` (71), `run.log` (185), `run.projection` (216). Revision 01 §6 incorrectly declared three of these as successor-to-live; revision 02 aligns to ground truth. | verified | `specs/artifacts.json` |
| E10 | `tests/contracts/workflow-recipe.test.ts` covers the recipe schema and compiler. There is no round-trip test against `Workflow` today. | verified | `tests/contracts/workflow-recipe.test.ts` |
| E11 | `specs/contracts/workflow.md` is the runtime workflow contract; `specs/workflow-recipe-composition.md` is the design note for recipe composition. | verified | `specs/contracts/workflow.md`, `specs/workflow-recipe-composition.md` |
| E12 | `ARC_CLOSE_GATES` is the frozen array enforcing arc-close composition reviews. Entries are `{arc_id, description, ceremony_slice, plan_path, review_file_regex}`. Slice 126 (Build Workflow Parity) is the most recent entry; the bridge ceremony adds the next one in Slice D. | verified | `scripts/audit.mjs` |
| E13 | The `WorkflowPrimitiveCatalog` exposes per-primitive `id`, `protocol_id`, `input_contracts`, `output_contract`, `produces_evidence`, `allowed_routes`, `action_surface`. Slice A0 reads these to populate the runtime `Step` fields the current draft drops. | verified | `src/schemas/workflow-primitives.ts`, `specs/workflow-primitive-catalog.json` |
| E14 | `PROJECT_STATE.md` `current_slice: 154`. Phase 2 first-workflow product spine closed; broader parity expansion planning is open. The compile-to-runtime bridge is not yet recorded in `specs/parity-map.md`. | verified | `PROJECT_STATE.md`, `specs/parity-map.md` |
| E15 | Each `WorkflowRecipeDraftItem` maps to one runtime `Step` whose variant is determined by `execution.kind` (`synthesis|dispatch|verification|checkpoint`). The primitive catalog supplies the `protocol` and evidence-producing data the current compiler drops; Slice A0 widens the compiler to read it. | inferred | derived from E1, E5, E13 |
| E16 | `entry: {signals, intent_prefixes}` is a workflow-level surface that no recipe field encodes; the materializer takes it as a caller-supplied option, like `Workflow.version`. | inferred | derived from E1, E2 |
| E17 | Unknown-blocking: none. The seam shape, the single-rigor binding rule, and the `ARC_CLOSE_GATES` wiring are concrete in revision 02. | unknown-blocking | revision-02 fold-ins close all six revision-01 findings |

## §2 — Why this plan exists

Slices 149–153 brought the recipe compiler from idea to a planning
artifact. Slice 154 (revision 01) tried to bridge it directly to
`Workflow.parse` with a thin options bag and was rejected: the
compiler output drops information the runtime needs, the live-Fix
proof in revision 01's Slice C assumed substrate that does not exist,
and the lane/authority/rigor/ceremony framing was internally
inconsistent. Revision 02 picks the smaller honest path. It widens
the compiler so its output is runtime-ready, materializes it, and
proves the path through a synthetic dispatch loop without claiming
live Fix runtime work the operator has not directed. The result is a
compiler whose output is a runnable workflow shape, validated end to
end by a synthetic execution proof.

## §3 — Scope

In scope:

- A widened compiler output type (working name
  `RuntimeReadyRecipeCompilation`) that carries everything the
  materializer needs to produce a `Workflow` that passes
  `Workflow.parse` without further enrichment beyond a small
  caller-supplied options bag (workflow `version`, `entry.signals`,
  `entry.intent_prefixes`, `default_selection?`, optional
  per-phase/per-step selection).
- A typed materializer
  `materializeWorkflowFromCompiledRecipe(compiled, opts): Workflow`
  that produces a single-rigor `Workflow`. The materializer is a
  pure assembly function; all data joins happen in the widened
  compiler.
- A round-trip contract test under `tests/contracts/` driving the
  Fix recipe fixture through the widened compiler + materializer,
  asserting the result parses through `Workflow.parse` and matches
  field-level assertions grounded in independent authorities (Fix
  canonical phase set per ADR-0013, omitted phases per the Fix
  recipe, route topology preserved per the compiled edges, step
  `writes.artifact.{path,schema}` for every step whose output is in
  `FIX_RESULT_PATH_BY_ARTIFACT_ID` / `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID`,
  and `Workflow.parse` invariants WF-I8/I9/I10/I11).
- An optional runner compile path: given a recipe + projection +
  rigor + opts, materialize a `Workflow` and run it through the
  existing dispatch loop instead of reading a static manifest. The
  static-manifest path remains the default and is unchanged.
- A synthetic-fixture execution proof: a recipe whose dispatch
  primitives the runner can already execute (synthesis-only or
  dispatch with adapters the runner already handles), driven through
  the compile path, asserting the same event sequence as the
  manifest path on an equivalent fixture.
- A two-prong arc-close composition review wired into
  `ARC_CLOSE_GATES` so the audit gate fires deterministically.

Out of scope:

- **Live Fix execution.** Per `specs/contracts/fix.md` and the
  runner's Build/Explore/Review-only writers, executing the Fix
  recipe live would require Fix protocol naming, runtime writers,
  checkpoint behavior, verification execution, and close artifact
  generation — work not covered here. Slice B's proof is a
  synthetic fixture, not Fix.
- Replacement of static manifests in production for Build, Explore,
  or Review. The bridge is purely additive.
- Generation of new recipes or primitives. The bridge consumes the
  existing Fix recipe fixture and primitive catalog.
- Multi-rigor workflows. The materializer produces a single-rigor
  Workflow per call; per-rigor execution paths come from compiling
  multiple drafts, not from one draft with multiple entry modes.
- Adapter registry rework, persistent caching of compiled
  workflows, and per-rigor selection logic at runtime beyond what
  the compiler resolves.

## §4 — Non-goals

- The static-manifest path is preserved unchanged. The compiler
  path is purely additive.
- Compile-on-bootstrap is not the default; the compile path is
  opt-in throughout this work.
- The existing `WorkflowRecipeDraft` type is preserved as the
  rigor-resolved planning artifact. The new
  `RuntimeReadyRecipeCompilation` is the materialization-ready
  superset; the draft survives as the smaller planning surface for
  callers that do not need runtime data.
- The CLI surface (`/circuit:fix`, `--entry-mode`, etc.) is
  untouched. CLI selectors for compiled recipes are a follow-up
  question once the runtime path is proven.
- No live Fix run proof is claimed in this arc. A future arc may
  open Fix runtime substrate widening; this plan does not.

## §5 — Target seam shape

The compiler is widened to emit `RuntimeReadyRecipeCompilation`,
which carries everything `Workflow.parse` requires from the recipe
+ primitive catalog plus a small caller-supplied options bag for
workflow-level surfaces no recipe field encodes today.

```
compileRuntimeReadyRecipe(
  projection: WorkflowRecipeCompilerProjection,
  recipe: WorkflowRecipe,
  catalog: WorkflowPrimitiveCatalog,
  rigor: Rigor,
): RuntimeReadyRecipeCompilation

materializeWorkflowFromCompiledRecipe(
  compiled: RuntimeReadyRecipeCompilation,
  opts: {
    workflow_id: WorkflowId;
    version: string;
    entry: { signals: EntrySignals; intent_prefixes?: string[] };
    entry_mode_name: string;     // becomes the single EntryMode.name
    entry_mode_description: string;
    default_selection?: SelectionOverride;
    phase_titles?: Record<CanonicalPhase, string>;
  },
): Workflow
```

`RuntimeReadyRecipeCompilation` (informative — final field set
authored in Slice A0) carries:

- `recipe_id`, `rigor`, `starts_at` (the StepId the operative
  `EntryMode.start_at` is set to — see binding rule below);
- `purpose: string` (from `recipe.purpose`);
- `phases: { canonical: CanonicalPhase, items: StepId[] }[]`
  (already present in the projection);
- `omitted_phases: CanonicalPhase[]` (already present);
- `items: CompiledStep[]` where `CompiledStep` carries the runtime
  step's `id`, `title` (from `recipe.items[*].title`), `protocol`
  (resolved from `primitive.protocol_id`), `phase`, `kind` (from
  `execution.kind`), `reads` (resolved from
  `primitive.input_contracts` through the artifact registry to
  `RunRelativePath[]`), `writes` (resolved from `item.output`
  through the artifact registry to `ArtifactRef`), `gate`
  (constructed from the primitive's verdict surface for the
  step's kind), `routes: Record<string, StepId | TerminalTarget>`
  (already in the draft as `edges[]`, reshaped to the runtime
  route map), and optional `dispatch_role` (for dispatch
  variants), `checkpoint_policy` (for checkpoint variants).

Mapping rules (final shapes confirmed in Slice A0):

- `draft.recipe_id` is a recipe-domain id, not a workflow-domain
  id; the workflow id comes from `opts.workflow_id`.
- `compiled.items[*]` maps to `Workflow.steps[*]` 1:1; each item
  resolves to the step variant matching its `kind`.
- `compiled.phases[*]` expands to `Workflow.phases[*]` (one per
  canonical phase present in the compilation); titles come from
  `opts.phase_titles[canonical]` if provided, else a deterministic
  default of the canonical name with a leading uppercase.
- `compiled.items[*].routes` becomes `Workflow.steps[*].routes`,
  preserving outcome → target mapping. Terminal targets are
  passed through unchanged (`@complete`, `@stop`, `@escalate`,
  `@handoff`).
- **Rigor binding rule (single-rigor materialization).**
  `compiled.rigor` is the rigor of the produced workflow's single
  `EntryMode`. Materialization produces `Workflow.entry_modes`
  with exactly **one** `EntryMode` whose `name =
  opts.entry_mode_name`, `start_at = compiled.starts_at`, `rigor
  = compiled.rigor`, `description = opts.entry_mode_description`.
  Multi-rigor workflows require multiple compilations — one per
  rigor — and are out of scope for this arc.
- **`start_at` mapping (revision-01 fix).** `compiled.starts_at`
  (a `StepId`) feeds `EntryMode.start_at`, **not**
  `default_selection.start_at`. `SelectionOverride`
  (`src/schemas/selection-policy.ts:70–79`) has no `start_at`
  field; the revision-01 mapping was a structural error.
- `compiled.omitted_phases` expands to `Workflow.spine_policy`:
  if `omitted_phases.length === 0`, `spine_policy = {mode:
  'strict'}`; otherwise `spine_policy = {mode: 'partial', omits:
  omitted_phases, rationale: ${recipe.title} omits ${list}; recipe
  authority at ${recipe.id}}`. Rationale must satisfy the
  schema's min-20-chars rule.
- `compiled.purpose` populates `Workflow.purpose`.
- `opts.entry`, `opts.version`, optional `opts.default_selection`
  pass through unchanged.

Failure modes the materializer rejects:

- `compiled.items[*].uses`-derived primitive entry missing from
  the catalog (caught earlier in Slice A0; defense-in-depth here).
- Edges naming an outcome the primitive does not declare (caught
  by existing `WorkflowRecipeItem` parse; defense-in-depth here).
- Phase references outside `CANONICAL_PHASES`.
- A compiled `start_at` not present in `compiled.items[*].id`
  (mirrors `WorkflowRecipe`'s `starts_at` invariant).
- Any output of materialization that fails `Workflow.parse` —
  the materializer always parses its own output before returning.

## §6 — Authority graph classification (ADR-0003)

Per ADR-0003, every touched artifact is classified before contract
authorship moves further. **All five rows are greenfield in
`specs/artifacts.json` today**, and revision 02 aligns this section
to that ground truth (revision-01 incorrectly declared
`workflow.definition`, `run.projection`, and `run.log` as
successor-to-live):

- `workflow.recipe_definition` — greenfield
  (`specs/artifacts.json:71`). Slices 135–136 originated it; the
  bridge does not extend the recipe schema, only its compiler
  output type.
- `workflow.definition` — greenfield (`specs/artifacts.json:5`).
  No characterization slice is required. The materializer must
  produce a `Workflow` that passes `Workflow.parse` without any
  schema change; the existing
  `tests/contracts/workflow-policy.test.ts` and adjacent tests
  remain authoritative.
- `workflow.primitive_catalog` — greenfield
  (`specs/artifacts.json:32`). Slice 135 originated it. The
  widened compiler reads the catalog through the existing
  `validateWorkflowRecipeCatalogCompatibility` lookup; no schema
  change.
- `run.projection` — greenfield (`specs/artifacts.json:216`).
  Existing reducer-derived projection is honored unchanged.
- `run.log` — greenfield (`specs/artifacts.json:185`). Existing
  event-log shape is honored unchanged. The synthetic-fixture
  execution proof in Slice B asserts event-sequence equality
  between the compile path and the manifest path on the same
  fixture; that assertion is over the existing (greenfield) log
  shape, not a successor surface.

Clean break is not invoked. The bridge is purely additive over the
existing `Workflow` schema and the existing run.log / run.projection
shapes.

## §7 — Verification substrate

The bridge rides the existing Tier-0 verification commands. No new
substrate slice is required:

- `npm run check` — `tsc --noEmit` enforces the materializer
  signature, the new `RuntimeReadyRecipeCompilation` type, and the
  `Workflow` shape at the boundary.
- `npm run lint` — `biome check`.
- `npm run test` — `vitest`. The new round-trip test joins
  `tests/contracts/`; the Slice B synthetic-execution test joins
  `tests/runtime/`.
- `npm run verify` — composite gate.
- `npm run audit` — drift visibility.

Per AGENTS.md Tier-0, `check`, `lint`, `test`, `verify` must all be
green before any commit in a Ratchet-Advance or Equivalence Refactor
lane. Each slice in the bridge honors that gate.

## §8 — Slices

### 8.1 Slice A0 — Compiler widening (Heavy, Ratchet-Advance)

**Failure mode addressed.** The current `WorkflowRecipeDraft` drops
recipe-level `purpose`, per-item `title` / `input` /
`evidence_requirements`, and the primitive-catalog-derived
`protocol` / `reads` / `writes` / `gate` data the runtime requires.
A direct draft → `Workflow` materialization cannot recover what was
discarded. This slice is the prior seam-definition step Codex
challenger pass 01 named (CRITICAL #1, "either widen the compiler
boundary to a runtime-ready intermediate, or change the seam so it
compiles from the full recipe + authoritative registries").

**Acceptance evidence.**

- A new exported type `RuntimeReadyRecipeCompilation` and a new
  exported function
  `compileRuntimeReadyRecipe(projection, recipe, catalog, rigor):
  RuntimeReadyRecipeCompilation` exist under
  `src/schemas/workflow-recipe.ts` (or a sibling module if
  preferred for separation).
- The widened compiler reads from the recipe (for `purpose`,
  per-item `title`), from the primitive catalog (for `protocol`,
  `evidence-producing` data shaping `reads`, `writes`, `gate`), and
  from the existing projection (for `phases`, `omitted_phases`,
  `items[].edges`).
- A new contract test under `tests/contracts/` drives the Fix
  recipe + projection + catalog through the widened compiler at
  each rigor (`lite`, `standard`) and asserts: every emitted
  `CompiledStep` carries non-empty `title`, `protocol`, `writes`,
  `gate`; every step's `phase` is in `CANONICAL_PHASES`; routes
  preserve the draft's edges; and rigor matches the input rigor.
- Existing `compileWorkflowRecipeDraft` is preserved unchanged
  (planning callers that do not need runtime data continue to use
  it).
- `npm run verify` green.

**Why this not adjacent.** Folding compiler widening into Slice A
mixes the data-shaping layer with the assembly layer; any test
failure at Slice A then cannot distinguish "compiler emitted the
wrong shape" from "materializer assembled it wrong." Splitting the
layers gives both slices a single failure axis.

**Lane.** Ratchet-Advance. Schema/test ratchet strictly advances by
one new exported type, one new exported function, and one new
contract test file or test suite.

### 8.2 Slice A — Materializer + field-level assertions (Heavy, Ratchet-Advance)

**Failure mode addressed.** Even with a runtime-ready compiler
output, no module assembles it into a `Workflow` and proves the
result is runtime-valid. The recipe direction has no executable
target without it.

**Acceptance evidence.**

- A new module exporting
  `materializeWorkflowFromCompiledRecipe(compiled, opts): Workflow`
  exists; `tsc --strict` is green.
- A new contract test under `tests/contracts/` drives the Fix
  recipe projection through `compileRuntimeReadyRecipe` and then
  through the materializer at `rigor: 'standard'` and `rigor:
  'lite'` and asserts:
  - The result parses through `Workflow.parse` (this catches
    WF-I8, WF-I9, WF-I10, WF-I11, PHASE-I4, PHASE-I5, and the
    spine-policy / entry-mode invariants automatically).
  - Canonical phase set matches the Fix recipe's canonical phase
    set (`frame`, `analyze`, `act`, `verify`, `review`, `close`)
    per ADR-0013 and the recipe fixture; canonical `plan` is
    omitted via `spine_policy.mode === 'partial'` with `omits ⊇
    ['plan']`.
  - `entry_modes` has exactly one entry whose `name` matches
    `opts.entry_mode_name`, `start_at` matches
    `compiled.starts_at`, `rigor` matches the input rigor, and
    `description` matches `opts.entry_mode_description`.
  - For every recipe item whose `output` is registered in
    `FIX_RESULT_PATH_BY_ARTIFACT_ID` /
    `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` (independent authority,
    `src/schemas/artifacts/fix.ts`), the corresponding Workflow
    step's `writes.artifact.{path, schema}` matches the
    registered values exactly.
  - Route topology preserved: for every compiled item edge `(id,
    outcome, target)`, the Workflow step `id` has
    `routes[outcome] === target` (terminal targets passed
    through unchanged).
- The test does **not** depend on a curated full
  `fix-candidate.workflow.json` golden fixture. Field-level
  assertions against the registries above are independent of the
  materializer's output, closing Codex MED #6.
- `npm run verify` green.

**Why this not adjacent.** A pure round-trip test without a real
materializer is a tautology over the compiler's output. Folding
this into Slice A0 mixes data-shaping with assembly. Folding it
into Slice B mixes a pure mapping function with runtime-loop
changes; the materializer earns its own slice as a tested unit.

**Lane.** Ratchet-Advance. Contract-test ratchet strictly advances
by one new test file or test case.

### 8.3 Slice B — Runner compile path + synthetic execution proof (Heavy, Ratchet-Advance, privileged runtime)

**Failure mode addressed.** Even with a working materializer, the
runner has no entry point that takes a recipe instead of a
manifest, so the materializer remains untested against the live
execution loop.

**Acceptance evidence.**

- The runner exposes an alternate bootstrap that accepts
  `(projection, recipe, catalog, rigor, opts)` and feeds the
  materializer's output through the same dispatch loop the
  manifest path uses.
- A new runtime test under `tests/runtime/` drives a
  synthesis-only synthetic fixture (a tiny recipe whose primitives
  the runner already executes, **not** Fix) through the compile
  path. It asserts:
  - The same event sequence is emitted as the manifest path on
    an equivalent hand-authored fixture (a per-event structural
    equivalence, ignoring fields whose values legitimately differ
    such as timestamps and run ids).
  - No schema-parse failures occur for any emitted artifact.
  - The run terminates at `@complete` and writes a parseable
    `run.result`.
- The static-manifest path remains the default; the compile path
  is opt-in via an explicit constructor parameter or factory.
- The synthetic fixture is added under `tests/fixtures/` and is
  documented as "synthetic — not Fix; Fix live execution requires
  substrate not built here."
- `npm run verify` green.

**Why this not adjacent.** Folding this into Slice A mixes a pure
mapping function with runtime-loop changes; any regression hides
between the two. Driving Fix live (revision-01's Slice C) would
require Fix protocol naming, runtime writers, checkpoint behavior,
verification execution, and close artifact generation — all out of
scope. The synthetic fixture is the smallest evidence the compile
path actually runs end to end.

**Lane.** Ratchet-Advance.

**Privileged runtime note.** The runner's bootstrap contract is
modified here. Per AGENTS.md cross-slice composition review
cadence, the bridge includes an arc-close composition review (Slice
D) before any further privileged runtime work.

### 8.4 Slice D — Arc-close composition review (Heavy, Ratchet-Advance, ceremony + gate wiring)

**Failure mode addressed.** Per-slice challenger passes do not
surface boundary-seam drift across an arc; the bridge spans three
implementation slices and modifies the runtime bootstrap, so
AGENTS.md cross-slice composition review cadence applies.
Revision-01 left the arc-close gate as an "unbound promise" (Codex
HIGH #5); revision 02 makes it mechanically enforceable by adding
the explicit `ARC_CLOSE_GATES` entry in the same commit as the two
prong reviews.

**Acceptance evidence.**

- Two prong reviews land under `specs/reviews/`:
  - `compiled-recipe-runtime-bridge-arc-close-codex-composition-adversary.md`
  - `compiled-recipe-runtime-bridge-arc-close-codex-cross-model-challenger.md`
- Both prongs return ACCEPT or ACCEPT-WITH-FOLD-INS; any fold-ins
  are merged before the next privileged runtime slice begins.
- A new exported constant in `scripts/audit.mjs` named
  `COMPILED_RECIPE_RUNTIME_BRIDGE_ARC_CEREMONY_SLICE` is set to
  the numeric ceremony slice id (the same slice id that lands this
  ceremony commit).
- A new `Object.freeze({...})` entry is appended to the
  `ARC_CLOSE_GATES` array (`scripts/audit.mjs:4015–4144`) with:
  - `arc_id: 'compiled-recipe-runtime-bridge'`,
  - `description: 'Compiled Recipe → Runtime Bridge Arc (Slices A0, A, B, D)'`,
  - `ceremony_slice: COMPILED_RECIPE_RUNTIME_BRIDGE_ARC_CEREMONY_SLICE`,
  - `plan_path: 'specs/plans/compiled-recipe-runtime-bridge.md'`,
  - `review_file_regex: /compiled-recipe-runtime-bridge-arc-close-codex-(composition-adversary|cross-model-challenger)/i`.
- `tests/audit.test.ts` (or the audit-checks test sibling that
  covers `ARC_CLOSE_GATES`) gains assertions covering the new
  entry: gate fires at the ceremony slice marker, regex matches
  both prong files, regex does not match per-slice review records.
- Same-commit staging discipline holds: the ceremony commit
  stages both prong files, the new constant, the new gate entry,
  the audit test updates, AND advances `current_slice` in
  `PROJECT_STATE.md` atomically. Check 26 audit posture matches
  prior gate-introducing slices (47d, 55, 62, 68, 75, 82, 88, 92,
  126).
- `npm run audit` green against the staged tree.

**Why this not adjacent.** Skipping the composition review and
relying on per-slice challenger passes alone is exactly the failure
mode AGENTS.md calls out. Deferring it to a later arc is rejected:
the next privileged runtime slice cannot begin until this review is
in. Folding the gate-wiring into Slice B mixes runtime work with
ceremony machinery and breaks the same-commit-staging precedent
that prior arcs (47d, 55, 62, 68, 75, 82, 88, 92, 126) have
established.

**Lane.** Ratchet-Advance. The `ARC_CLOSE_GATES` array gains a new
frozen entry; the audit-test surface gains assertions covering it.
Both ratchets strictly advance.

## §9 — Ratchets

- **Contract test count.** Strictly advances by ≥1 new test file or
  test case in Slice A0 (widened compiler), Slice A
  (materializer), and Slice B (runner compile path).
- **Runtime workflow source count.** Strictly advances from 1 (only
  the static-manifest path supported) to 2 (manifest path +
  compile path). The static manifest path is preserved unchanged.
- **`Workflow.parse`-passing outputs from compiler+materializer.**
  Strictly advances from 0 (the compiler has no materialization
  target today) to ≥1 (the Fix recipe's compilation parses, in
  Slice A's test), and to ≥2 with both rigor levels covered.
  Measured by counting test-case passes against
  `Workflow.parse` in the Slice A test file.
- **`ARC_CLOSE_GATES` length.** Strictly advances by 1 in Slice D.
- No ratchet regresses. AGENTS.md hard invariant 8 (no aggregate
  scoring across ratchets) is honored: each dimension tracked
  independently in slice closes.

## §10 — Rollback

- Slice A0 is rollback-safe by `git revert` of the slice commit;
  the new compiler function and type are new and have no callers
  outside their own test. The existing
  `compileWorkflowRecipeDraft` is preserved.
- Slice A is rollback-safe by `git revert`; the materializer
  module is new and has no callers outside its own test.
- Slice B is rollback-safe by `git revert`; the runner change is
  gated by an explicit constructor parameter and the manifest
  path is unchanged.
- Slice D's gate-entry rollback is mechanical: revert the commit
  removes the `ARC_CLOSE_GATES` entry, the constant, the audit
  test assertions, and the `current_slice` advance together. Prong
  review files revert with the commit.
- The bridge never modifies the static-manifest contract, the
  recipe schema, the primitive-catalog schema, the run.log shape,
  or the run.projection shape. Reverting any slice does not
  require schema or contract changes.

## §11 — Close criteria

The bridge is closed when:

1. Slices A0, A, and B have each closed under Tier-0 gates.
2. Slice D's two-prong composition review is committed with ACCEPT
   or ACCEPT-WITH-FOLD-INS verdicts on both prongs and any fold-ins
   are merged.
3. The ceremony commit has, atomically:
   - both prong review files staged under `specs/reviews/`;
   - the new `COMPILED_RECIPE_RUNTIME_BRIDGE_ARC_CEREMONY_SLICE`
     constant in `scripts/audit.mjs`;
   - the new `ARC_CLOSE_GATES` entry in the same file;
   - the audit-test assertions covering the new entry;
   - `current_slice` advanced in `PROJECT_STATE.md` to the
     ceremony slice id.
   This matches the same-commit-staging discipline established by
   slices 47d / 55 / 62 / 68 / 75 / 82 / 88 / 92 / 126.
4. `npm run audit` is green on the closing commit. Check 26 (or
   the active arc-close composition-review presence check) sees
   the new gate firing at the ceremony slice marker and the regex
   matching both prong files.
5. The plan's `status:` is updated to `closed` with `closed_at`
   and `closed_in_slice` set.
