---
plan: recipe-runtime-substrate
status: challenger-pending
revision: 01
opened_at: 2026-04-26
opened_in_session: recipe-runtime-substrate-arc-open
base_commit: 25359fd30fede146ee4302a867a848d77e3b5e74
target: recipe-substrate
authority:
  - specs/methodology/decision.md
  - specs/adrs/ADR-0003-authority-graph-gate.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - specs/adrs/ADR-0013-primitive-backed-workflow-recipes.md
  - specs/contracts/workflow.md
  - specs/workflow-primitives.md
  - specs/workflow-recipe-composition.md
  - src/schemas/workflow-primitives.ts
  - src/schemas/workflow-recipe.ts
  - src/schemas/gate.ts
  - src/schemas/step.ts
  - src/schemas/artifacts/fix.ts
  - specs/workflow-primitive-catalog.json
  - specs/workflow-recipes/fix-candidate.recipe.json
  - specs/artifacts.json
  - scripts/audit.mjs
artifact_ids:
  - workflow.primitive_catalog
  - workflow.recipe_definition
prior_challenger_passes: []
---

# Recipe Runtime Substrate Plan

A prerequisite arc for the compiled-recipe-runtime-bridge. The bridge as
revised in revision 02 (challenger pass 02, REJECT) cannot resolve runtime
fields out of authorities that do not encode them: `protocol_id` is not
in any recipe-domain schema, the primitive-catalog `gate` field is a
description string instead of a structured runtime payload, recipe items
carry no checkpoint prompt / choices / safe-default-choice data, and
per-item `writes.artifact.{path, schema}` sources do not exist outside
the workflow-specific `FIX_RESULT_*` tables. This arc widens the
recipe-domain authorities so the bridge has real sources to compile
against. Three slices land it: a Heavy slice that adds the four runtime
payload fields to `WorkflowPrimitive` and atomically backfills the
catalog, a Heavy slice that adds per-item checkpoint customization to
`WorkflowRecipeItem`, and an arc-close composition review wired into
`ARC_CLOSE_GATES`.

The bridge plan (`specs/plans/compiled-recipe-runtime-bridge.md`) stays
at challenger-pending revision 02 until this arc closes; revision 03 of
the bridge then revisits its §5 grounded on the widened substrate.

## §Evidence census

Authoritative artifacts touched, in their current shape:

| Id | Statement | Status | Citation |
|---|---|---|---|
| E1 | `WorkflowPrimitive` is `{id, title, purpose, input_contracts, alternative_input_contracts, output_contract, action_surface, produces_evidence, gate: {kind, description}, allowed_routes, human_interaction, host_capabilities, notes?}`. The `gate` field is a `{kind, description}` pair where `kind` ∈ `schema|decision|command|review|risk|queue` and `description` is free-form prose. There is no structured runtime gate payload (`required[]`, `pass[]`, `allow[]`), no `protocol_id`, no checkpoint template, and no per-output write-slot table. | verified | `src/schemas/workflow-primitives.ts:107-128` |
| E2 | The runtime `Gate` discriminated union in `src/schemas/gate.ts` has three variants: `SchemaSectionsGate` (kind `schema_sections`, source `artifact`, `required: string[].min(1)`), `CheckpointSelectionGate` (kind `checkpoint_selection`, source `checkpoint_response`, `allow: string[].min(1)`), `ResultVerdictGate` (kind `result_verdict`, source `dispatch_result`, `pass: string[].min(1)`). Each variant's `source.kind` is structurally bound to its gate kind by Zod literals. | verified | `src/schemas/gate.ts:49-81` |
| E3 | `Step` is a discriminated union over `SynthesisStep`, `VerificationStep`, `CheckpointStep`, `DispatchStep` in `src/schemas/step.ts`. Synthesis and verification require `SchemaSectionsGate`. Checkpoint requires `CheckpointSelectionGate` and `policy: CheckpointPolicy` carrying `prompt`, `choices`, `safe_default_choice`. Dispatch requires `ResultVerdictGate` and `role: DispatchRole`. Each step's `writes` carries concrete artifact paths and schema refs. | verified | `src/schemas/step.ts` |
| E4 | `WorkflowRecipeItem` exposes `{id, uses, title, phase, input?, evidence_requirements?, execution: {kind: synthesis\|dispatch\|verification\|checkpoint, ...}, output, edges, selection?}`. There is no `prompt`, `choices`, `safe_default_choice`, or other checkpoint-customization slot on the item. Recipe items inherit data from the primitive they reference via `uses`. | verified | `src/schemas/workflow-recipe.ts` |
| E5 | The Fix recipe fixture (`specs/workflow-recipes/fix-candidate.recipe.json`) declares 12 items across `frame`, `analyze`, `act`, `verify`, `review`, `close`, with the canonical `plan` phase omitted by ADR-0013. Items reference primitives via `uses` and declare `output` as a contract ref string. | verified | `specs/workflow-recipes/fix-candidate.recipe.json`, `specs/workflow-recipes/fix-candidate.projection.json` |
| E6 | `FIX_RESULT_PATH_BY_ARTIFACT_ID` and `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` are file-local `const` declarations (no `export`) in `src/schemas/artifacts/fix.ts:4,14`. They cover `fix.brief`, `fix.context`, `fix.diagnosis`, `fix.no-repro-decision`, `fix.change`, `fix.verification`, `fix.review`. They are workflow-specific (Fix-only) and not reusable by other recipes today. | verified | `src/schemas/artifacts/fix.ts:4,14` |
| E7 | The primitive catalog (`specs/workflow-primitive-catalog.json`) carries 15 primitive entries matching `WORKFLOW_PRIMITIVE_IDS` in `src/schemas/workflow-primitives.ts:3-19`. Each entry has the same `gate: {kind, description}` shape as the schema. No catalog entry carries runtime gate payloads, protocol ids, checkpoint templates, or write slots today. | verified | `specs/workflow-primitive-catalog.json:1-80`, `src/schemas/workflow-primitives.ts:3-19` |
| E8 | `workflow.primitive_catalog` is row 32 in `specs/artifacts.json` with `surface_class: greenfield`. `workflow.recipe_definition` is row 71 with `surface_class: greenfield`. Both rows are the materialization targets of this arc. | verified | `specs/artifacts.json:32`, `specs/artifacts.json:71` |
| E9 | Codex challenger pass 02 against the bridge plan (`specs/reviews/compiled-recipe-runtime-bridge-codex-challenger-02.md`) returned REJECT-PENDING-FOLD-INS with two CRITICAL findings; finding 1 is the upstream-data shortfall this arc resolves. Pass 02's revision-03 path (a-3) names this prerequisite arc explicitly. | verified | `specs/reviews/compiled-recipe-runtime-bridge-codex-challenger-02.md:52-75,210-223` |
| E10 | `ARC_CLOSE_GATES` in `scripts/audit.mjs` is the frozen array enforcing arc-close composition reviews; entries are `{arc_id, description, ceremony_slice, plan_path, review_file_regex}`. Slice 40 fold-in requires the two-prong gate to distinguish a Claude-prong file (name-match `*Claude*` / `*claude*`) from a Codex-prong file (name-match `*Codex*` / `*codex*`); a single-prong satisfaction is rejected. | verified | `scripts/audit.mjs` (ARC_CLOSE_GATES array; Slice 40 prong-distinction block) |
| E11 | `PROJECT_STATE.md` `current_slice: 155` after the bridge revision-02 commit (`25359fd`). This arc opens at slice 156 or later, depending on operator dispatch. | verified | `PROJECT_STATE.md`, recent git log |
| E12 | `WorkflowPrimitiveRoute` in `src/schemas/workflow-primitives.ts:24-34` enumerates `continue, retry, revise, ask, split, stop, handoff, escalate, complete`. The runner outcome enum in `src/schemas/event.ts:56` is `{pass, fail}`. The recipe-outcome → runner-outcome lowering rule is a bridge-plan concern (revision 03 §5), not this arc's concern; this arc preserves the recipe-outcome vocabulary unchanged. | verified | `src/schemas/workflow-primitives.ts:24-34`, `src/schemas/event.ts:56` |
| E13 | `tests/contracts/workflow-primitive-catalog.test.ts` and `tests/contracts/workflow-recipe.test.ts` are the existing contract tests that will gain assertions when the schemas widen. The existing `validateWorkflowRecipeCatalogCompatibility` lookup in `src/schemas/workflow-recipe.ts` joins recipes to primitives. | verified | `tests/contracts/workflow-primitive-catalog.test.ts`, `tests/contracts/workflow-recipe.test.ts`, `src/schemas/workflow-recipe.ts` |
| E14 | The catalog widening cannot land schema and backfill in separate slices without breaking the parser between them: adding a required field to `WorkflowPrimitive` rejects the un-backfilled catalog. Atomic schema + backfill in one slice is the only ordering that keeps Tier-0 green at every commit. | inferred | derived from E1, E7 + Zod strict-mode parser semantics |
| E15 | Per-item checkpoint customization (Slice B) is required because the catalog has only one checkpoint-kind primitive (`human-decision`) but recipes can call it multiple times for different decisions. Templating prompts at the primitive level alone would force every checkpoint in every recipe to share one prompt, which is not the design intent of Fix's two distinct checkpoints. | inferred | derived from E5, E7 + the Fix recipe's checkpoint structure |
| E16 | Unknown-blocking: none. The four target fields and their placement (primitive-level vs recipe-item-level) are concrete in §5; the lowering of recipe outcomes to runner outcomes is explicitly out of scope and bound to the bridge plan revision 03. | unknown-blocking | §5 design decisions are committed |

## §2 — Why this plan exists

Slices 149–155 brought the recipe compiler from idea to a planning
artifact and tried twice to bridge that artifact to the runtime
`Workflow` shape. Both bridge revisions were rejected by Codex
challenger; pass 02's CRITICAL #1 named the structural cause directly:
the upstream recipe-domain authorities do not encode the data the
runtime needs. `protocol_id` is not in `WorkflowRecipe`,
`WorkflowRecipeItem`, or `WorkflowPrimitive`. The primitive catalog
`gate.description` is free-form prose, not a structured runtime gate
payload. Recipe items have no checkpoint-customization slot. Write-slot
data exists only as workflow-specific Fix-result tables that are not
even exported. No amount of compiler widening produces these fields
out of nothing.

This arc widens the upstream substrate so the bridge has real sources
to read. The data lives in two places in the recipe domain: per-primitive
fields that template a primitive's runtime contribution (protocol id,
gate shape, checkpoint shape, write slots), and per-item recipe fields
for the small set of values that legitimately vary across calls of the
same primitive (concrete checkpoint prompt and choices). Once the
substrate carries the data, the bridge becomes a mechanical join.

This is a planning-readiness arc by ADR-0010: a Heavy implementation
arc requires its substrate to encode the structural fields its
acceptance evidence depends on. The bridge plan stays at
challenger-pending revision 02 until this arc closes; bridge revision
03 takes the widened substrate as its base.

## §3 — Scope

In scope:

- **Per-primitive runtime payload widening** (Slice A). Add four fields
  to `WorkflowPrimitive`:
  - `protocol_id: WorkflowProtocolId` — a typed identifier for the
    protocol family the primitive belongs to (`orchestrator`, `fix`,
    `build`, `explore`, `review` is the candidate enum; final values
    locked in §5 below).
  - `runtime_gate_template` — a discriminated-union template that
    matches the runtime `Gate` shape minus the `source` field
    (which is structurally determined by the gate kind). Variants:
    `{kind: 'schema_sections', required: string[].min(1)}`,
    `{kind: 'result_verdict', pass: string[].min(1)}`,
    `{kind: 'checkpoint_selection', allow: string[].min(1)}`. The
    template kind is constrained against the primitive's
    `execution.kind` per the binding rules in §5.
  - `checkpoint_template` — optional, present only on checkpoint-kind
    primitives. Carries `{prompt_template: string.min(1), choices:
    string[].min(1).unique, safe_default_choice: string.min(1)}` with
    a refinement that `safe_default_choice ∈ choices`.
  - `write_slots` — a `Record<output_contract, {path: string.min(1),
    schema: string.min(1)}>` mapping each of the primitive's possible
    output contracts (the `output_contract` field plus any
    alternatives the recipe domain materializes through) to a concrete
    artifact path and schema reference. Replaces the workflow-specific
    `FIX_RESULT_*` tables for catalog-resident primitives.

- **Atomic catalog backfill** (Slice A). Populate the four new fields
  for all 15 primitives in `specs/workflow-primitive-catalog.json` in
  the same commit that lands the schema additions. The catalog passes
  `WorkflowPrimitiveCatalog.parse` at every commit on the slice.

- **Per-item checkpoint customization** (Slice B). Add an optional
  `checkpoint_overrides?: {prompt?: string.min(1), choices?:
  string[].min(1).unique, safe_default_choice?: string.min(1)}` slot
  to `WorkflowRecipeItem` for items whose primitive `execution.kind`
  is `checkpoint`. A schema refinement requires that overrides be
  absent on non-checkpoint items, and that `safe_default_choice`
  (when supplied) is a member of the effective choice set (override
  ∪ template).

- **Arc-close composition review** (Slice D). Two prong reviews under
  `specs/reviews/`, one Claude-labeled and one Codex-labeled per the
  Slice-40 fold-in convention, plus `ARC_CLOSE_GATES` wiring in
  `scripts/audit.mjs` and matching audit-test assertions.

- **Existing-recipe migration**. Update
  `specs/workflow-recipes/fix-candidate.recipe.json` (Fix candidate)
  to populate `checkpoint_overrides` for its checkpoint items in
  Slice B. The projection/test fixtures advance accordingly.

Out of scope:

- **The bridge itself.** Materialization of compiled recipes into
  `Workflow` is the bridge plan's revision 03 work, not this arc's.
  This arc only widens the substrate.
- **The recipe-outcome → runner-outcome lowering rule.** That belongs
  in the bridge plan revision 03 §5 (it's a compiler-side concern).
  This arc preserves `WorkflowPrimitiveRoute` and recipe-edge outcomes
  unchanged.
- **Live Fix execution.** Out of scope for the same reasons the bridge
  plan §3 names.
- **Removal of `FIX_RESULT_PATH_BY_ARTIFACT_ID` /
  `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID`.** Those tables stay as a
  Fix-protocol surface for callers that want a typed Fix-only view.
  Slice A's `write_slots` provides the catalog-resident equivalent.
  The bridge plan revision 03 chooses which surface its assertions
  bind through.
- **New primitive ids or new recipe shapes.** The 15 catalog
  primitive identifiers and the Fix recipe identity are unchanged;
  this arc widens their schemas, not the set of primitives or
  recipes.
- **`WorkflowPrimitive.gate.description` removal.** The free-form
  description stays as a human-facing rationale field alongside the
  new `runtime_gate_template`. Mechanical removal is a follow-up
  cleanup, not this arc's work.

## §4 — Non-goals

- The runtime `Gate`, `CheckpointPolicy`, `Step`, and `Workflow`
  schemas in `src/schemas/{gate,step,workflow,phase}.ts` are
  unchanged. This arc widens the recipe-domain authorities that feed
  those runtime shapes; the runtime shapes themselves are already
  capable of carrying what the bridge will produce.
- Aggregate ratchet scoring or single-knob composition is not
  introduced. AGENTS.md hard invariant 8 is preserved: each ratchet
  in §9 is tracked independently.
- Per-item write-slot overrides are not introduced. If a recipe item
  needs a non-default write slot, that is a primitive-design problem
  (the primitive should expose the slot in its `write_slots` map),
  not a per-item override slot.
- Multi-rigor templating on primitives is not introduced. Rigor
  remains an entry-mode concern, not a primitive-template concern.

## §5 — Target seam shape

`WorkflowPrimitive` gains four fields:

```
protocol_id: WorkflowProtocolId
runtime_gate_template: RuntimeGateTemplate
checkpoint_template?: CheckpointTemplate
write_slots: WriteSlotMap
```

Type definitions (final field set authored in Slice A):

```
WorkflowProtocolId = z.enum([
  'orchestrator',  // intake, route, frame, handoff
  'fix',           // gather-context, diagnose, plan-fix-style steps
  'build',         // plan, act-build-style steps
  'explore',       // gather-context-explore-style steps
  'review',        // review, run-verification, close-with-evidence
])

RuntimeGateTemplate = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('schema_sections'), required: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ kind: z.literal('result_verdict'),  pass:     z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ kind: z.literal('checkpoint_selection'), allow: z.array(z.string().min(1)).min(1) }).strict(),
])

CheckpointTemplate = z.object({
  prompt_template:      z.string().min(1),
  choices:              z.array(z.string().min(1)).min(1),  // unique
  safe_default_choice:  z.string().min(1),                  // ∈ choices
}).strict()

WriteSlotMap = z.record(
  WorkflowPrimitiveContractRef,
  z.object({
    path:   z.string().min(1),
    schema: z.string().min(1),
  }).strict(),
).refine(map => Object.keys(map).length >= 1)
```

Binding rules (final shapes confirmed in Slice A):

- **Gate-template kind binding.** A primitive whose runtime usage is
  synthesis or verification carries `runtime_gate_template.kind ===
  'schema_sections'`. A dispatch-runtime primitive carries `kind ===
  'result_verdict'`. A checkpoint-runtime primitive carries `kind ===
  'checkpoint_selection'`. The runtime usage is determined by the
  set of `WorkflowRecipeExecutionKind` values that appear in items
  using this primitive (a per-primitive invariant enforced by Slice
  A's contract test).
- **Checkpoint template presence.** `checkpoint_template` is required
  if and only if the primitive's runtime usage is `checkpoint`.
  Refinement enforces both directions.
- **Write-slot coverage.** `write_slots` contains an entry for the
  primitive's `output_contract` value at minimum. If
  `alternative_input_contracts` introduces alternative output paths
  in future schema work, those are added then.
- **Protocol id consistency.** A recipe whose items all reference
  primitives sharing the same `protocol_id` value (mod `orchestrator`,
  which is universal) inherits that protocol id at compile time.
  Cross-protocol recipes (mixing `fix` and `build` items) are
  permitted but flagged by a future bridge-plan compiler check; this
  arc does not enforce protocol coherence at the recipe level.

`WorkflowRecipeItem` gains one field (Slice B):

```
checkpoint_overrides?: {
  prompt?:               string.min(1)
  choices?:              string[].min(1).unique
  safe_default_choice?:  string.min(1)
}
```

Binding rules (Slice B):

- **Override kind binding.** `checkpoint_overrides` may appear only
  on items whose primitive's runtime usage is `checkpoint`. A
  refinement rejects the override on non-checkpoint items.
- **Effective values.** Effective `prompt` = `override.prompt ??
  primitive.checkpoint_template.prompt_template`. Effective `choices`
  = `override.choices ?? primitive.checkpoint_template.choices`.
  Effective `safe_default_choice` = `override.safe_default_choice ??
  primitive.checkpoint_template.safe_default_choice`. The refinement
  requires effective `safe_default_choice ∈ effective choices`.

Failure modes the parsers reject:

- Primitive with `runtime_gate_template.kind` mismatched against the
  set of execution kinds items use (Slice A test).
- Primitive missing `checkpoint_template` while at least one recipe
  item using it has `execution.kind === 'checkpoint'`.
- Primitive `write_slots` missing a key for a contract ref that
  appears as an item's `output` (Slice A test).
- Recipe item carrying `checkpoint_overrides` against a non-checkpoint
  primitive.
- Effective `safe_default_choice` outside the effective `choices` set.

## §6 — Authority graph classification (ADR-0003)

Per ADR-0003, every touched authority artifact is classified before
contract authorship begins. Both rows are greenfield in
`specs/artifacts.json` today, so no successor-to-live characterization
slice is required:

- `workflow.primitive_catalog` — greenfield
  (`specs/artifacts.json:32`). Slice 135 originated it. Slice A widens
  the schema and atomically backfills the catalog so the row stays
  parseable at every commit.
- `workflow.recipe_definition` — greenfield
  (`specs/artifacts.json:71`). Slice B adds the optional
  `checkpoint_overrides` field; existing recipes that omit it remain
  valid.

Clean break is not invoked. The widening is purely additive: existing
parsers reject only inputs that were not previously valid (e.g.,
catalogs missing the new required fields after Slice A lands). The
runtime `Gate`, `Step`, `Workflow`, `Phase`, and `EntryMode` schemas
are unchanged.

## §7 — Verification substrate

The arc rides existing Tier-0 verification commands. No new substrate
slice is required:

- `npm run check` — `tsc --noEmit` enforces the new `WorkflowPrimitive`
  shape, `WorkflowProtocolId` enum, `RuntimeGateTemplate` discriminated
  union, `CheckpointTemplate` and `WriteSlotMap` types, and the new
  optional `WorkflowRecipeItem.checkpoint_overrides` field at the
  boundary.
- `npm run lint` — `biome check`.
- `npm run test` — `vitest`. Slice A's contract tests join
  `tests/contracts/`; Slice B's tests join the same directory.
- `npm run verify` — composite gate.
- `npm run audit` — drift visibility, including `ARC_CLOSE_GATES`
  presence checks.

Per AGENTS.md Tier-0, `check`, `lint`, `test`, `verify` must all be
green before any commit in a Ratchet-Advance lane. Each slice in this
arc honors that gate.

## §8 — Slices

### 8.1 Slice A — Primitive widening + catalog backfill (Heavy, Ratchet-Advance)

**Failure mode addressed.** `WorkflowPrimitive.gate.description` is
free-form prose, not a runtime payload. There is no `protocol_id`,
no `checkpoint_template`, and no `write_slots` on any catalog entry.
The bridge cannot resolve runtime gate shapes, protocol ids,
checkpoint shapes, or per-output write paths from authorities that
do not encode them — Codex challenger pass 02 CRITICAL #1.

**Acceptance evidence.**

- `WorkflowPrimitive` in `src/schemas/workflow-primitives.ts` exports
  the four new fields per §5 with the exact shapes named there. Type
  exports `WorkflowProtocolId`, `RuntimeGateTemplate`,
  `CheckpointTemplate`, `WriteSlotMap` exist.
- `specs/workflow-primitive-catalog.json` has all 15 entries
  populated with the four new fields. Catalog passes
  `WorkflowPrimitiveCatalog.parse` on the staged commit.
- A new contract test under `tests/contracts/` (or extending
  `tests/contracts/workflow-primitive-catalog.test.ts`) asserts:
  - Every catalog entry carries non-empty `protocol_id`,
    `runtime_gate_template`, and `write_slots`.
  - Every checkpoint-runtime primitive carries
    `checkpoint_template`; every non-checkpoint primitive does not.
  - `runtime_gate_template.kind` matches the primitive's runtime
    usage as derived from items in
    `specs/workflow-recipes/fix-candidate.recipe.json` (joined via
    `validateWorkflowRecipeCatalogCompatibility`).
  - `write_slots` contains at least an entry for the primitive's
    `output_contract` field, and the `path` / `schema` strings are
    non-empty.
  - `safe_default_choice` ∈ `choices` for every
    `checkpoint_template` (existing union refinement; explicit
    test added).
- `FIX_RESULT_PATH_BY_ARTIFACT_ID` and
  `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` remain in
  `src/schemas/artifacts/fix.ts` unchanged. The new `write_slots`
  data on catalog primitives is the catalog-resident parallel
  surface; the Fix-result tables stay as the Fix-protocol view.
- `npm run verify` green on the slice commit.

**Why this not adjacent.** Splitting schema additions and catalog
backfill across two slices breaks Tier-0 between them: adding required
fields to `WorkflowPrimitive` rejects the un-backfilled catalog (E14).
Folding Slice A into Slice B mixes per-primitive substrate with
per-item recipe-side widening; any failure then cannot distinguish
"primitive template wrong" from "recipe override misapplied."

**Lane.** Ratchet-Advance. Schema/test ratchet strictly advances by
four new exported types, four new fields on `WorkflowPrimitive`, one
new contract-test surface. No ratchet regresses.

### 8.2 Slice B — Recipe-item checkpoint overrides (Heavy, Ratchet-Advance)

**Failure mode addressed.** The catalog has one checkpoint-runtime
primitive (`human-decision`) but the Fix recipe calls it twice for
two distinct decisions (verification check, review check). Templating
the prompt purely at the primitive level forces both checkpoints to
share one prompt, which is not the design intent. Without per-item
customization, the bridge cannot produce a runtime `CheckpointStep`
with the right concrete `policy.prompt` for each item.

**Acceptance evidence.**

- `WorkflowRecipeItem` in `src/schemas/workflow-recipe.ts` exports an
  optional `checkpoint_overrides` field with the shape named in §5.
  A schema refinement enforces that overrides are absent on items
  whose primitive's runtime usage is not `checkpoint`.
- A second refinement enforces that effective
  `safe_default_choice` (override or template) is a member of the
  effective `choices` set (override or template).
- `specs/workflow-recipes/fix-candidate.recipe.json` is updated:
  every checkpoint item gains a `checkpoint_overrides` block with a
  concrete `prompt` distinct from the primitive template default.
  The projection regenerates if the projection format encodes any
  checkpoint data (this arc does not require the projection format
  to widen; if it does, that change is folded here).
- A new contract test under `tests/contracts/` asserts:
  - `checkpoint_overrides` rejects on a synthetic non-checkpoint
    item.
  - Effective `safe_default_choice` outside effective `choices`
    rejects.
  - The Fix recipe's two checkpoint items carry distinct
    `prompt` values.
- `npm run verify` green on the slice commit.

**Why this not adjacent.** Folding into Slice A mixes per-primitive
substrate with per-item recipe-side widening (above). Deferring to
the bridge plan revision 03 conflates substrate widening with
materialization assembly, which is the conflation pass 01 and pass
02 already rejected as a single-axis conflation. The override slot
is recipe-domain authority work, not bridge-domain authority work.

**Lane.** Ratchet-Advance. Schema ratchet strictly advances by one
new optional field with two refinements; existing recipes remain
valid; the Fix recipe fixture advances.

### 8.3 Slice D — Arc-close composition review (Heavy, Ratchet-Advance, ceremony + gate wiring)

**Failure mode addressed.** Per-slice challenger passes do not
surface boundary-seam drift across an arc. This arc widens two
authority schemas across two implementation slices and is the
substrate the bridge plan compiles against, so AGENTS.md cross-slice
composition review cadence applies. The composition review must be
mechanically enforceable, not "promised" in prose.

**Acceptance evidence.**

- Two prong reviews land under `specs/reviews/`:
  - `recipe-runtime-substrate-arc-close-claude-composition-adversary.md`
  - `recipe-runtime-substrate-arc-close-codex-cross-model-challenger.md`

  The two filenames satisfy the Slice-40 fold-in convention: one
  filename matches `*claude*`, the other matches `*codex*`.
- Both prongs return ACCEPT or ACCEPT-WITH-FOLD-INS, with any
  fold-ins merged before close.
- A new exported constant in `scripts/audit.mjs` named
  `RECIPE_RUNTIME_SUBSTRATE_ARC_CEREMONY_SLICE` is set to the
  numeric ceremony slice id (the same slice id that lands this
  ceremony commit).
- A new `Object.freeze({...})` entry is appended to the
  `ARC_CLOSE_GATES` array with:
  - `arc_id: 'recipe-runtime-substrate'`,
  - `description: 'Recipe Runtime Substrate Arc (Slices A, B, D)'`,
  - `ceremony_slice: RECIPE_RUNTIME_SUBSTRATE_ARC_CEREMONY_SLICE`,
  - `plan_path: 'specs/plans/recipe-runtime-substrate.md'`,
  - `review_file_regex: /recipe-runtime-substrate-arc-close-(claude-composition-adversary|codex-cross-model-challenger)/i`.
- The audit-test surface that covers `ARC_CLOSE_GATES` gains
  assertions for the new entry: gate fires at the ceremony slice
  marker; regex matches both prong files; regex does not match
  per-slice review records.
- Same-commit staging discipline holds: the ceremony commit stages
  both prong files, the new constant, the new gate entry, the
  audit-test updates, AND advances `current_slice` in
  `PROJECT_STATE.md` atomically. Check 26 audit posture matches
  prior gate-introducing slices (47d, 55, 62, 68, 75, 82, 88, 92,
  126).
- `npm run audit` green against the staged tree.

**Why this not adjacent.** Skipping the composition review and
relying on per-slice challenger passes alone is exactly the failure
mode AGENTS.md calls out. Folding gate-wiring into Slice B mixes
recipe-domain widening with ceremony machinery and breaks the
same-commit-staging precedent that prior arcs (47d, 55, 62, 68, 75,
82, 88, 92, 126) have established.

**Lane.** Ratchet-Advance. The `ARC_CLOSE_GATES` array gains a new
frozen entry; the audit-test surface gains assertions covering it.
Both ratchets strictly advance.

## §9 — Ratchets

- **`WorkflowPrimitive` field count.** Strictly advances by 4 in
  Slice A (the four new fields). No regression.
- **Catalog runtime-payload coverage.** Strictly advances from 0
  catalog entries carrying `runtime_gate_template` + `protocol_id` +
  `write_slots` to all 15 entries carrying them, in Slice A.
- **Catalog `checkpoint_template` coverage on checkpoint-runtime
  primitives.** Strictly advances from 0 to all such primitives in
  Slice A. (Currently one such primitive: `human-decision`.)
- **`WorkflowRecipeItem` optional-field count.** Strictly advances
  by 1 in Slice B (the new `checkpoint_overrides` field). No
  regression.
- **Fix recipe checkpoint distinguishability.** Strictly advances
  from 0 (the recipe encodes no per-item checkpoint difference) to
  ≥2 (each checkpoint item carries a distinct `prompt`), in Slice B.
  Measured by counting distinct effective `prompt` values across
  the recipe's checkpoint items.
- **Contract test count.** Strictly advances by ≥1 new test file or
  test suite in Slice A and Slice B.
- **`ARC_CLOSE_GATES` length.** Strictly advances by 1 in Slice D.
- AGENTS.md hard invariant 8 honored: each ratchet tracked
  independently in slice closes.

## §10 — Rollback

- Slice A is rollback-safe by `git revert` of the slice commit. The
  schema additions and the catalog backfill land atomically; reverting
  removes both together. The runtime `Gate` / `Step` / `Workflow`
  schemas are unchanged, so the runtime is unaffected.
- Slice B is rollback-safe by `git revert`. The `checkpoint_overrides`
  field is optional; reverting removes the field and restores the Fix
  recipe fixture.
- Slice D's gate-entry rollback is mechanical: revert the commit
  removes the `ARC_CLOSE_GATES` entry, the constant, the audit-test
  assertions, and the `current_slice` advance together. Prong review
  files revert with the commit.
- The arc never modifies the runtime `Gate`, `Step`, `Workflow`,
  `Phase`, or `EntryMode` schemas. Reverting any slice does not
  require runtime schema changes.

## §11 — Close criteria

The arc is closed when:

1. Slices A and B have each closed under Tier-0 gates with their
   contract tests green.
2. Slice D's two-prong composition review is committed with ACCEPT or
   ACCEPT-WITH-FOLD-INS verdicts on both prongs and any fold-ins are
   merged.
3. The ceremony commit has, atomically:
   - both prong review files staged under `specs/reviews/`, one
     `claude`-named and one `codex`-named;
   - the new `RECIPE_RUNTIME_SUBSTRATE_ARC_CEREMONY_SLICE` constant
     in `scripts/audit.mjs`;
   - the new `ARC_CLOSE_GATES` entry in the same file;
   - the audit-test assertions covering the new entry;
   - `current_slice` advanced in `PROJECT_STATE.md` to the ceremony
     slice id.
   This matches the same-commit-staging discipline established by
   slices 47d / 55 / 62 / 68 / 75 / 82 / 88 / 92 / 126.
4. `npm run audit` is green on the closing commit. The active
   arc-close composition-review presence check sees the new gate
   firing at the ceremony slice marker and the regex matching both
   prong files.
5. The plan's `status:` is updated to `closed` with `closed_at` and
   `closed_in_slice` set.
6. The compiled-recipe-runtime-bridge plan is unblocked: revision 03
   takes this arc's closing commit as its `base_commit`. The bridge
   plan retains its `prior_challenger_passes` chain and re-dispatches
   Codex challenger against revision 03.
