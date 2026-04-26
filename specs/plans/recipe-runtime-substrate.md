---
plan: recipe-runtime-substrate
status: challenger-pending
revision: 02
opened_at: 2026-04-26
opened_in_session: recipe-runtime-substrate-arc-open
base_commit: dcfeb517ee2e7d2ae44efc66d96b27e5fee2f0f2
target: recipe-substrate
authority:
  - specs/methodology/decision.md
  - specs/adrs/ADR-0003-authority-graph-gate.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - specs/adrs/ADR-0013-primitive-backed-workflow-recipes.md
  - specs/contracts/workflow.md
  - specs/workflow-primitives.md
  - specs/workflow-recipe-composition.md
  - src/schemas/ids.ts
  - src/schemas/workflow-primitives.ts
  - src/schemas/workflow-recipe.ts
  - src/schemas/gate.ts
  - src/schemas/step.ts
  - src/schemas/artifacts/fix.ts
  - scripts/policy/workflow-kind-policy.mjs
  - specs/workflow-primitive-catalog.json
  - specs/workflow-recipes/fix-candidate.recipe.json
  - specs/artifacts.json
  - scripts/audit.mjs
artifact_ids:
  - workflow.primitive_catalog
  - workflow.recipe_definition
prior_challenger_passes:
  - specs/reviews/recipe-runtime-substrate-codex-challenger-01.md
---

# Recipe Runtime Substrate Plan

A prerequisite arc for the compiled-recipe-runtime-bridge. The bridge as
revised in revision 02 (challenger pass 02, REJECT) cannot resolve runtime
fields out of authorities that do not encode them: there is no `protocol_id`
authority that satisfies the runtime `ProtocolId` regex (`name@v1`-shaped),
the primitive-catalog `gate` field is a description string instead of a
structured runtime payload, primitives carry no checkpoint prompt / choices
/ safe-default-choice data, and per-item `writes.artifact.{path, schema}`
sources do not exist outside the workflow-specific `FIX_RESULT_*` tables.
This arc widens the recipe-domain authorities so the bridge has real
sources to compile against. Two slices land it: a Heavy slice that adds
five runtime-payload fields across `WorkflowPrimitive` and `WorkflowRecipe`
and atomically backfills the catalog plus the Fix recipe, and an
arc-close composition review wired into `ARC_CLOSE_GATES`.

Revision 02 fold-ins from challenger pass 01 (REJECT-PENDING-FOLD-INS,
3C / 1H / 1M):

- F1 (CRITICAL): `protocol_id` reshaped from a coarse five-value enum
  into two orthogonal authorities — `WorkflowRecipe.workflow_kind`
  (existing `WORKFLOW_KIND_CANONICAL_SETS` keys) plus
  `WorkflowPrimitive.protocol_role` (slug-shaped). The bridge composes
  `Step.protocol = '${workflow_kind}-${protocol_role}@v${protocol_version}'`,
  which is structurally guaranteed to satisfy the runtime `ProtocolId`
  regex `/^[a-z][a-z0-9-]*@v\d+$/`.
- F2 (CRITICAL): Slice B dropped entirely. The premise — Fix calls
  `human-decision` twice with distinct prompts — was factually wrong;
  the Fix recipe has exactly one checkpoint item. The per-item override
  slot is forward-looking infrastructure not needed by any current
  recipe; it can be added by a future recipe that genuinely needs it,
  without blocking the bridge.
- F3 (CRITICAL): `write_slots` re-keyed against the primitive's GENERIC
  output contract refs only (e.g., `workflow.brief@v1`), not against
  recipe-specific aliases (e.g., `fix.brief@v1`). The bridge applies
  `recipe.contract_aliases` resolution at compile time to pick the
  concrete artifact slot. Shared primitives stay free of recipe-specific
  alias keys, preserving ADR-0013 separation.
- F4 (HIGH): `runtime_gate_template` for the `checkpoint_selection`
  variant carries no `allow` field. The runtime `gate.allow` is derived
  at bridge time from the effective `checkpoint_template.choices.id`
  list, so the runtime `gate.allow === policy.choices.id` invariant is
  satisfied by construction with one source of truth.
- F5 (MED): `checkpoint_template` widened to fully mirror the runtime
  `CheckpointPolicy` surface — structured `{id, label?, description?}`
  choices, optional `safe_default_choice` and `safe_autonomous_choice`
  (each must reference a declared choice id), optional `build_brief`
  block. No checkpoint widening is forced; primitives that do not need
  a slot omit it.

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
| E15 | The Fix recipe (`specs/workflow-recipes/fix-candidate.recipe.json`) has exactly **one** checkpoint item (`fix-no-repro-decision`, in the `analyze` phase, using primitive `human-decision`). Multiple recipe items reach this checkpoint via `ask` route targets, but the checkpoint node itself is single. Per-item checkpoint customization is therefore not required by any current recipe; the existing checkpoint can be served entirely by the primitive-level `checkpoint_template` introduced in §5. Pass 01 finding F2. | verified | `specs/workflow-recipes/fix-candidate.recipe.json:184-185` (only `"kind": "checkpoint"` occurrence) |
| E16 | The runtime `ProtocolId` is a Zod string with regex `/^[a-z][a-z0-9-]*@v\d+$/` and brand `'ProtocolId'`. Live workflow fixtures use values like `build-frame@v1`, `build-act@v1`, `build-plan@v1`, `build-verify@v1`, confirming the structural pattern `{workflow-kind}-{protocol-role}@v{N}`. A coarse family enum (`fix`, `build`, ...) cannot satisfy this regex. Pass 01 finding F1. | verified | `src/schemas/ids.ts:26-30`, `tests/runner/build-checkpoint-exec.test.ts:76,150,188,240,278,293` |
| E17 | `WorkflowRecipe` declares `contract_aliases: WorkflowRecipeContractAlias[]` mapping generic primitive output contracts (e.g., `workflow.brief@v1`) to recipe-specific concretes (e.g., `fix.brief@v1`). The Fix recipe declares 7 such aliases. The runtime helper `contractIsCompatible` already consults this map when joining recipe items to primitive output contracts. Storing recipe-specific keys in primitive-level `write_slots` would duplicate or fight this seam. Pass 01 finding F3. | verified | `src/schemas/workflow-recipe.ts:169,221,502,513`, `specs/workflow-recipes/fix-candidate.recipe.json:16-44` |
| E18 | The runtime `Step` superRefine at `src/schemas/step.ts:166-175` requires `gate.allow === policy.choices.id` exactly (joined-by-NUL string equality). `CheckpointSelectionGate.allow` and `CheckpointPolicy.choices.id` are bound to a single source of truth at bridge time. A primitive-template carrying both authorities independently would invite drift. Pass 01 finding F4. | verified | `src/schemas/step.ts:166-175`, `src/schemas/gate.ts:58-65`, `src/schemas/step.ts:60-110` |
| E19 | The runtime `CheckpointPolicy` (`src/schemas/step.ts:60-110`) exposes structured `choices: Array<{id, label?, description?}>`, optional `safe_default_choice`, optional `safe_autonomous_choice` (each must reference a declared choice id), and optional `build_brief: {scope, success_criteria, verification_command_candidates}`. A bare-string template surface is strictly narrower than what the runtime supports today. Pass 01 finding F5. | verified | `src/schemas/step.ts:60-110` |
| E20 | `WORKFLOW_KIND_CANONICAL_SETS` at `scripts/policy/workflow-kind-policy.mjs:37-62` enumerates `{explore, review, build, fix}` as the canonical workflow kinds, each with its own canonical phase set. Fix's canonicals are `[frame, analyze, act, verify, review, close]` with `omits: [plan]`. A `WorkflowKind` Zod enum mirroring these keys gives the bridge a typed source for the workflow-kind half of the protocol id. | verified | `scripts/policy/workflow-kind-policy.mjs:37-62` |
| E21 | Unknown-blocking: none. The five target fields and their placement (primitive-level vs recipe-level) are concrete in §5; the bridge composes `Step.protocol` from `recipe.workflow_kind` + `primitive.protocol_role` at compile time. The lowering of recipe outcomes to runner outcomes remains explicitly out of scope and bound to the bridge plan revision 03. | unknown-blocking | §5 design decisions are revision-02-final |

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
to read. The data lives in two places in the recipe domain:
per-primitive fields that template the primitive's runtime contribution
(`protocol_role`, `protocol_version`, structured `runtime_gate_template`,
optional structured `checkpoint_template`, `write_slots` keyed by
GENERIC contract refs), and a per-recipe `workflow_kind` field that
the bridge composes with `protocol_role` to form the runtime
`Step.protocol` id (`/^[a-z][a-z0-9-]*@v\d+$/`). Per-item override
slots are explicitly NOT introduced — the Fix recipe has one checkpoint
that the primitive-level template serves fully (E15), and forward-looking
infrastructure with no current consumer is the corner-cut pattern this
arc avoids. Once the substrate carries the data, the bridge becomes a
mechanical join.

This is a planning-readiness arc by ADR-0010: a Heavy implementation
arc requires its substrate to encode the structural fields its
acceptance evidence depends on. The bridge plan stays at
challenger-pending revision 02 until this arc closes; bridge revision
03 takes the widened substrate as its base.

## §3 — Scope

In scope:

- **Per-primitive runtime payload widening** (Slice A). Add four fields
  to `WorkflowPrimitive`:
  - `protocol_role: ProtocolRoleSlug` — a slug-shaped identifier
    (`/^[a-z][a-z0-9-]*$/`) naming the primitive's role inside the
    `Step.protocol` id (e.g., `frame`, `gather-context`,
    `human-decision`). The bridge composes the runtime
    `Step.protocol` as `'${recipe.workflow_kind}-${primitive.protocol_role}@v${primitive.protocol_version}'`,
    which structurally satisfies the runtime `ProtocolId` regex
    `/^[a-z][a-z0-9-]*@v\d+$/` (E16). The slug stays free of the
    workflow-kind half so a primitive remains generic across recipes.
  - `protocol_version: number.int.min(1)` — defaults to 1 in the
    catalog backfill; allows future per-primitive evolution without
    moving every recipe forward in lockstep.
  - `runtime_gate_template` — a discriminated-union template that
    mirrors the runtime `Gate` kind minus the `source` field (which
    is structurally bound to the gate kind by `gate.ts`). Variants:
    `{kind: 'schema_sections', required: string[].min(1)}`,
    `{kind: 'result_verdict', pass: string[].min(1)}`,
    `{kind: 'checkpoint_selection'}` (no `allow` payload — see binding
    rule in §5; the runtime `gate.allow` is derived from the effective
    `checkpoint_template.choices.id` list at bridge time so the
    runtime `gate.allow === policy.choices.id` invariant holds by
    construction).
  - `checkpoint_template` — optional, present only on checkpoint-runtime
    primitives. Mirrors the runtime `CheckpointPolicy` surface
    (`src/schemas/step.ts:60-110`, E19): `{prompt_template:
    string.min(1), choices: Array<{id: string.min(1), label?:
    string.min(1), description?: string.min(1)}>.min(1) (id-unique),
    safe_default_choice?: string.min(1), safe_autonomous_choice?:
    string.min(1), build_brief?: {scope: string.min(1),
    success_criteria: string[].min(1), verification_command_candidates:
    BuildVerificationCommand[].min(1)}}`. Refinement requires
    `safe_default_choice` and `safe_autonomous_choice` (when supplied)
    each to reference a declared choice id, mirroring runtime
    `CheckpointPolicy` superRefine.
  - `write_slots` — a `Record<GenericContractRef, {path: string.min(1),
    schema: string.min(1)}>` mapping each of the primitive's GENERIC
    output contract refs (the values of `output_contract` and any
    alternative output paths) to a concrete artifact path and schema
    reference. Recipe-specific outputs (e.g., `fix.brief@v1`) are NOT
    keys in this map; the bridge resolves them via
    `recipe.contract_aliases` (E17) at compile time. Provides the
    catalog-resident parallel to the workflow-specific `FIX_RESULT_*`
    tables.

- **Per-recipe workflow-kind binding** (Slice A). Add one field to
  `WorkflowRecipe`:
  - `workflow_kind: WorkflowKind` — `z.enum(['explore', 'review',
    'build', 'fix'])` mirroring the keys of
    `WORKFLOW_KIND_CANONICAL_SETS` (E20). Used by the bridge to compose
    `Step.protocol`. A future primitive that legitimately spans
    workflow kinds can stay neutral; the recipe carries the
    workflow-kind dimension.

- **Atomic catalog and Fix-recipe backfill** (Slice A). Populate the
  four new primitive fields for all 15 entries in
  `specs/workflow-primitive-catalog.json` AND the new
  `workflow_kind: 'fix'` field on
  `specs/workflow-recipes/fix-candidate.recipe.json`, in the same
  commit that lands the schema additions. The catalog passes
  `WorkflowPrimitiveCatalog.parse` and the Fix recipe passes
  `WorkflowRecipe.parse` at every commit on the slice.

- **Arc-close composition review** (Slice D). Two prong reviews under
  `specs/reviews/`, one Claude-labeled and one Codex-labeled per the
  Slice-40 fold-in convention, plus `ARC_CLOSE_GATES` wiring in
  `scripts/audit.mjs` and matching audit-test assertions.

Out of scope:

- **The bridge itself.** Materialization of compiled recipes into
  `Workflow` is the bridge plan's revision 03 work, not this arc's.
  This arc only widens the substrate. Bridge revision 03 owns the
  `protocol_id` composition (`${workflow_kind}-${protocol_role}@v${protocol_version}`),
  the `gate.allow` derivation from `checkpoint_template.choices.id`,
  and the `contract_aliases` resolution that picks recipe-specific
  artifact slots.
- **Per-item checkpoint customization.** The Fix recipe has one
  checkpoint item (E15); the primitive-level `checkpoint_template`
  serves it fully. A future recipe that genuinely calls the same
  checkpoint primitive with distinct prompts can introduce a
  per-item override slot then; building it now is forward-looking
  infrastructure with no current consumer (revision 02 fold-in F2).
- **The recipe-outcome → runner-outcome lowering rule.** That belongs
  in the bridge plan revision 03 §5 (it's a compiler-side concern).
  This arc preserves `WorkflowPrimitiveRoute` and recipe-edge outcomes
  unchanged.
- **Live Fix execution.** Out of scope for the same reasons the bridge
  plan §3 names.
- **Removal of `FIX_RESULT_PATH_BY_ARTIFACT_ID` /
  `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID`.** Those tables stay as a
  Fix-protocol surface for callers that want a typed Fix-only view.
  Slice A's `write_slots` provides the catalog-resident equivalent
  keyed by generic contracts. The bridge plan revision 03 chooses
  which surface its assertions bind through.
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
- No per-item checkpoint customization — the
  `checkpoint_overrides` slot on recipe items stays out of scope per
  revision 02 fold-in F2. The Fix recipe has one checkpoint and the
  primitive-level template serves it fully (E15). A future recipe
  that genuinely calls the same checkpoint primitive with distinct
  prompts can introduce the override slot then.
- Multi-rigor templating on primitives is not introduced. Rigor
  remains an entry-mode concern, not a primitive-template concern.

## §5 — Target seam shape

### Seam diagram

The new fields and their downstream runtime consumers:

```
WorkflowRecipe.workflow_kind ─────────┐
                                       ├─► bridge composes
WorkflowPrimitive.protocol_role ──────┤   `${workflow_kind}-${protocol_role}@v${protocol_version}` ─► Step.protocol  [ProtocolId regex /^[a-z][a-z0-9-]*@v\d+$/]
WorkflowPrimitive.protocol_version ───┘                                                                (E16)

WorkflowRecipeItem.output (recipe-aliased)
   └─► WorkflowRecipe.contract_aliases (existing) ─► generic ref ─► WorkflowPrimitive.write_slots[generic] ─► Step.writes.artifact
                                                                     (E17)

WorkflowPrimitive.runtime_gate_template (kind ∈ {schema_sections, result_verdict, checkpoint_selection})
   └─► Step.gate    [for checkpoint kind, gate.allow is DERIVED from checkpoint_template.choices.id at bridge time, not stored on the template]
                    (E18: runtime enforces gate.allow === policy.choices.id by superRefine)

WorkflowPrimitive.checkpoint_template (full mirror of runtime CheckpointPolicy)
   └─► Step.policy  (E19)
```

### Primitive widening

`WorkflowPrimitive` gains four fields:

```
protocol_role:        ProtocolRoleSlug
protocol_version:     z.number().int().min(1)
runtime_gate_template: RuntimeGateTemplate
checkpoint_template?: CheckpointTemplate
write_slots:          WriteSlotMap
```

Type definitions (final field set authored in Slice A):

```
ProtocolRoleSlug = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/)
  .brand<'ProtocolRoleSlug'>()

RuntimeGateTemplate = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('schema_sections'),     required: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ kind: z.literal('result_verdict'),      pass:     z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ kind: z.literal('checkpoint_selection') }).strict(),    // no `allow` payload — bridge derives from checkpoint_template.choices
])

CheckpointTemplate = z.object({
  prompt_template:        z.string().min(1),
  choices:                z.array(
    z.object({
      id:          z.string().min(1),
      label:       z.string().min(1).optional(),
      description: z.string().min(1).optional(),
    }).strict()
  ).min(1),                                                          // .id-unique enforced by superRefine
  safe_default_choice:    z.string().min(1).optional(),              // must ∈ choices.id when present
  safe_autonomous_choice: z.string().min(1).optional(),              // must ∈ choices.id when present
  build_brief:            z.object({
    scope:                            z.string().min(1),
    success_criteria:                 z.array(z.string().min(1)).min(1),
    verification_command_candidates:  z.array(BuildVerificationCommand).min(1),
  }).strict().optional(),
}).strict().superRefine((tpl, ctx) => {
  // mirrors src/schemas/step.ts:60-110 `CheckpointPolicy` superRefine:
  //  - duplicate choice id → issue
  //  - safe_default_choice / safe_autonomous_choice not ∈ choice ids → issue
})

WriteSlotMap = z.record(
  WorkflowPrimitiveContractRef,                                       // GENERIC contract refs only (recipe-aliased refs forbidden)
  z.object({
    path:   z.string().min(1),
    schema: z.string().min(1),
  }).strict(),
).refine(map => Object.keys(map).length >= 1)
```

### Recipe widening

`WorkflowRecipe` gains one field:

```
workflow_kind: WorkflowKind
```

Type definition:

```
WorkflowKind = z.enum(['explore', 'review', 'build', 'fix'])  // mirrors WORKFLOW_KIND_CANONICAL_SETS keys (E20)
```

### Binding rules (final shapes confirmed in Slice A)

- **Gate-template kind binding.** A primitive whose runtime usage is
  `synthesis` or `verification` carries `runtime_gate_template.kind ===
  'schema_sections'`. A `dispatch`-runtime primitive carries `kind ===
  'result_verdict'`. A `checkpoint`-runtime primitive carries `kind ===
  'checkpoint_selection'`. Runtime usage is determined by the set of
  `WorkflowRecipeExecutionKind` values that appear in items using this
  primitive (per-primitive invariant enforced by Slice A's contract
  test, joining catalog × recipe).
- **Checkpoint template presence.** `checkpoint_template` is required
  if and only if the primitive's runtime usage is `checkpoint`.
  Refinement enforces both directions.
- **Checkpoint single-source-of-truth (F4 fold-in).** The runtime
  `gate.allow` value is NOT stored on `runtime_gate_template`; the
  bridge derives it from
  `effective_checkpoint_template.choices.map(c => c.id)` at compile
  time. The runtime `step.ts:166-175` superRefine requires
  `gate.allow === policy.choices.id`; deriving from a single authority
  means the invariant holds by construction (E18).
- **Write-slot key surface (F3 fold-in).** `write_slots` keys are the
  primitive's GENERIC output contract refs only — that is, the values
  appearing in `WorkflowPrimitive.output_contract` and in
  `alternative_input_contracts`. Recipe-specific contract refs (e.g.,
  `fix.brief@v1` from `contract_aliases.actual`) are NEVER keys in
  `write_slots`. The bridge applies `recipe.contract_aliases`
  resolution to translate between recipe-aliased refs and generic
  primitive keys when picking the concrete artifact slot for a step
  (E17).
- **Write-slot coverage.** `write_slots` contains an entry for the
  primitive's `output_contract` value at minimum. If
  `alternative_input_contracts` introduces alternative output paths in
  future schema work, those are added then.
- **Protocol id composition (F1 fold-in).** The bridge composes
  `Step.protocol = '${recipe.workflow_kind}-${primitive.protocol_role}@v${primitive.protocol_version}'`.
  Both halves are typed in this arc; the composition itself is the
  bridge plan revision 03's responsibility. The composed string is
  structurally guaranteed to satisfy the runtime `ProtocolId` regex
  `/^[a-z][a-z0-9-]*@v\d+$/` because: `workflow_kind` ∈
  `{explore, review, build, fix}` (lowercase slugs), `protocol_role`
  is `ProtocolRoleSlug`-shaped (`/^[a-z][a-z0-9-]*$/`), and
  `protocol_version` is a positive integer (E16).
- **Cross-protocol recipes.** A recipe whose items reference primitives
  with mixed `protocol_role` values is well-formed; the recipe's single
  `workflow_kind` field still feeds every step's protocol id. There is
  no per-item workflow-kind override; if a primitive ever needs to
  vary by workflow kind, that's a primitive-design problem, not a
  recipe-item problem.

### Failure modes the parsers reject

- Primitive with `runtime_gate_template.kind` mismatched against the
  set of execution kinds items use (Slice A test, joining catalog ×
  recipe via `validateWorkflowRecipeCatalogCompatibility`).
- Primitive missing `checkpoint_template` while at least one recipe
  item using it has `execution.kind === 'checkpoint'`.
- Primitive carrying `checkpoint_template` while no recipe item using
  it has `execution.kind === 'checkpoint'`.
- Primitive `write_slots` missing a key for the primitive's
  `output_contract`.
- Primitive `write_slots` containing a recipe-aliased contract ref
  (e.g., a key matching any `recipe.contract_aliases.actual` in any
  registered recipe but not appearing as a generic primitive output
  contract anywhere in the catalog). Slice A test surfaces this if it
  occurs.
- `CheckpointTemplate.safe_default_choice` or
  `safe_autonomous_choice` not a member of the declared `choices.id`
  set (mirrors runtime `CheckpointPolicy` superRefine).
- Duplicate `choices.id` within a `CheckpointTemplate` (mirrors
  runtime).
- Recipe declaring `workflow_kind` outside the
  `WORKFLOW_KIND_CANONICAL_SETS` key set.

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
  (`specs/artifacts.json:71`). Slice A adds the required
  `workflow_kind` field on `WorkflowRecipe`; the Fix recipe is
  backfilled in the same commit (`workflow_kind: 'fix'`). The Repair
  recipe is closed by supersession per ADR-0013 and not affected.

Clean break is not invoked. Existing parsers reject only inputs that
were not previously valid (e.g., catalogs missing the new required
fields after Slice A lands, or recipes missing `workflow_kind`). The
runtime `Gate`, `Step`, `Workflow`, `Phase`, and `EntryMode` schemas
are unchanged.

## §7 — Verification substrate

The arc rides existing Tier-0 verification commands. No new substrate
slice is required:

- `npm run check` — `tsc --noEmit` enforces the new `WorkflowPrimitive`
  shape, `ProtocolRoleSlug` brand, `RuntimeGateTemplate` discriminated
  union, `CheckpointTemplate` and `WriteSlotMap` types, and the new
  required `WorkflowRecipe.workflow_kind` field (typed `WorkflowKind`)
  at the boundary.
- `npm run lint` — `biome check`.
- `npm run test` — `vitest`. Slice A's contract tests join
  `tests/contracts/`.
- `npm run verify` — composite gate.
- `npm run audit` — drift visibility, including `ARC_CLOSE_GATES`
  presence checks.

Per AGENTS.md Tier-0, `check`, `lint`, `test`, `verify` must all be
green before any commit in a Ratchet-Advance lane. Each slice in this
arc honors that gate.

## §8 — Slices

### 8.1 Slice A — Primitive widening + recipe widening + atomic catalog and Fix-recipe backfill (Heavy, Ratchet-Advance)

**Failure mode addressed.** `WorkflowPrimitive.gate.description` is
free-form prose, not a runtime payload. There is no `protocol_role`
or `protocol_version` authority on any primitive, no
`checkpoint_template`, and no `write_slots` on any catalog entry.
`WorkflowRecipe` carries no `workflow_kind` typed value either.
The bridge cannot resolve runtime gate shapes, runtime `Step.protocol`
ids (which must satisfy the `ProtocolId` regex per E16), checkpoint
shapes, or per-output write paths from authorities that do not
encode them — Codex challenger pass 02 CRITICAL #1, refined by pass
01 findings F1 / F3 / F4 / F5.

**Acceptance evidence.**

- `WorkflowPrimitive` in `src/schemas/workflow-primitives.ts` exports
  the four new fields per §5 with the exact shapes named there. Type
  exports `ProtocolRoleSlug`, `RuntimeGateTemplate`,
  `CheckpointTemplate`, `WriteSlotMap` exist.
- `WorkflowRecipe` in `src/schemas/workflow-recipe.ts` exports the
  new required `workflow_kind: WorkflowKind` field. Type export
  `WorkflowKind` exists with members exactly matching the keys of
  `WORKFLOW_KIND_CANONICAL_SETS` in
  `scripts/policy/workflow-kind-policy.mjs`.
- `specs/workflow-primitive-catalog.json` has all 15 entries
  populated with the four new fields. Catalog passes
  `WorkflowPrimitiveCatalog.parse` on the staged commit.
- `specs/workflow-recipes/fix-candidate.recipe.json` carries
  `"workflow_kind": "fix"` and passes `WorkflowRecipe.parse` on the
  staged commit.
- A new contract test under `tests/contracts/` (or extending
  `tests/contracts/workflow-primitive-catalog.test.ts`) asserts:
  - Every catalog entry carries non-empty `protocol_role`
    (`ProtocolRoleSlug` regex), positive integer `protocol_version`,
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
  - `write_slots` keys are GENERIC contract refs only — no key
    matches any registered `recipe.contract_aliases.actual` value
    (rejecting recipe-aliased keys like `fix.brief@v1` per F3 fold-in).
  - `CheckpointTemplate.choices.id` are unique within a template,
    and `safe_default_choice` / `safe_autonomous_choice` (when
    present) each ∈ `choices.id` (mirroring runtime
    `CheckpointPolicy` superRefine, E19).
  - The `WorkflowKind` enum members exactly equal
    `Object.keys(WORKFLOW_KIND_CANONICAL_SETS)` — drift between the
    Zod enum and the policy table is rejected.
  - Bridge-time protocol-id composition smoke test: for each catalog
    primitive, `'fix-' + primitive.protocol_role + '@v' + primitive.protocol_version`
    parses successfully against `ProtocolId` (E16). This proves the
    composed string structurally satisfies the runtime regex without
    waiting for the bridge plan to land.
- `FIX_RESULT_PATH_BY_ARTIFACT_ID` and
  `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` remain in
  `src/schemas/artifacts/fix.ts` unchanged. The new `write_slots`
  data on catalog primitives is the catalog-resident parallel
  surface keyed by generic contract refs; the Fix-result tables
  stay as the Fix-protocol view keyed by Fix artifact ids.
- `npm run verify` green on the slice commit.

**Why this not adjacent.** Splitting schema additions and catalog +
recipe backfill across multiple slices breaks Tier-0 between them:
adding required fields to `WorkflowPrimitive` and `WorkflowRecipe`
rejects un-backfilled catalog and recipe respectively (E14 plus its
analog for `workflow_kind`). Splitting primitive widening from recipe
widening into separate slices is also unsound because the catalog ×
recipe join (`validateWorkflowRecipeCatalogCompatibility`) is what
verifies `runtime_gate_template.kind` against actual runtime usage —
neither half tested alone proves the seam. Atomic schema + catalog +
recipe in one slice is the only ordering that keeps Tier-0 green at
every commit and gives the contract test a complete join surface to
assert against.

**Lane.** Ratchet-Advance. Schema / test / type-export ratchets
strictly advance by four new exported primitive-side types
(`ProtocolRoleSlug`, `RuntimeGateTemplate`, `CheckpointTemplate`,
`WriteSlotMap`), one new exported recipe-side type (`WorkflowKind`),
five new fields total across `WorkflowPrimitive` and `WorkflowRecipe`,
and one new contract-test surface. No ratchet regresses.

### 8.2 Slice D — Arc-close composition review (Heavy, Ratchet-Advance, ceremony + gate wiring)

**Failure mode addressed.** Per-slice challenger passes do not
surface boundary-seam drift across an arc. This arc widens two
authority schemas (`workflow.primitive_catalog` and
`workflow.recipe_definition`) and is the substrate the bridge plan
compiles against, so AGENTS.md cross-slice composition review cadence
applies. The composition review must be mechanically enforceable, not
"promised" in prose. Slice D applies even though the arc has only one
implementation slice (Slice A) plus this ceremony slice: the
substrate's downstream consumer (the bridge plan) is a privileged
runtime arc, and the cross-arc seam between substrate and bridge is
exactly where boundary drift would surface.

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
  - `description: 'Recipe Runtime Substrate Arc (Slices A, D)'`,
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
relying on Slice A's per-slice challenger pass alone is exactly the
failure mode AGENTS.md calls out — substrate-to-bridge seam drift
hides in the cross-arc gap. Folding gate-wiring into Slice A mixes
authority-schema widening with ceremony machinery and breaks the
same-commit-staging precedent that prior arcs (47d, 55, 62, 68, 75,
82, 88, 92, 126) have established.

**Lane.** Ratchet-Advance. The `ARC_CLOSE_GATES` array gains a new
frozen entry; the audit-test surface gains assertions covering it.
Both ratchets strictly advance.

## §9 — Ratchets

- **`WorkflowPrimitive` field count.** Strictly advances by 4 in
  Slice A (`protocol_role`, `protocol_version`,
  `runtime_gate_template`, `write_slots`; `checkpoint_template` is
  optional and counted as part of the field surface advance). No
  regression.
- **`WorkflowRecipe` field count.** Strictly advances by 1 in
  Slice A (`workflow_kind`). No regression.
- **Catalog runtime-payload coverage.** Strictly advances from 0
  catalog entries carrying `runtime_gate_template` + `protocol_role`
  + `protocol_version` + `write_slots` to all 15 entries carrying
  them, in Slice A.
- **Catalog `checkpoint_template` coverage on checkpoint-runtime
  primitives.** Strictly advances from 0 to all such primitives in
  Slice A. (Currently one such primitive: `human-decision`.)
- **Recipe `workflow_kind` coverage.** Strictly advances from 0
  recipes carrying typed `workflow_kind` to all registered recipes
  carrying it (currently one: `fix-candidate`).
- **Bridge-time protocol-id composition smoke.** Strictly advances
  from 0 to ≥1 contract-test asserting that the composed string
  `'fix-' + protocol_role + '@v' + protocol_version` parses against
  the runtime `ProtocolId` brand for every catalog primitive
  (proves the regex compatibility seam without waiting for the
  bridge plan to land).
- **Contract test count.** Strictly advances by ≥1 new test file or
  test suite in Slice A.
- **`ARC_CLOSE_GATES` length.** Strictly advances by 1 in Slice D.
- AGENTS.md hard invariant 8 honored: each ratchet tracked
  independently in slice closes.

## §10 — Rollback

- Slice A is rollback-safe by `git revert` of the slice commit. The
  schema additions and the catalog + recipe backfill land atomically;
  reverting removes them together. The runtime `Gate` / `Step` /
  `Workflow` schemas are unchanged, so the runtime is unaffected.
- Slice D's gate-entry rollback is mechanical: revert the commit
  removes the `ARC_CLOSE_GATES` entry, the constant, the audit-test
  assertions, and the `current_slice` advance together. Prong review
  files revert with the commit.
- The arc never modifies the runtime `Gate`, `Step`, `Workflow`,
  `Phase`, or `EntryMode` schemas. Reverting any slice does not
  require runtime schema changes.

## §11 — Close criteria

The arc is closed when:

1. Slice A has closed under Tier-0 gates with its contract tests
   green.
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
