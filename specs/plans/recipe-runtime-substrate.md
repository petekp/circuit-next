---
plan: recipe-runtime-substrate
status: challenger-pending
revision: 10
opened_at: 2026-04-26
opened_in_session: recipe-runtime-substrate-arc-open
base_commit: 60fe76e6dce52d0f7fddaf611f4c2cf19ee499af
target: recipe-substrate
authority:
  - specs/methodology/decision.md
  - specs/adrs/ADR-0003-authority-graph-gate.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - specs/adrs/ADR-0013-primitive-backed-workflow-recipes.md
  - specs/contracts/workflow.md
  - specs/workflow-primitives.md
  - specs/workflow-recipe-composition.md
  - specs/plans/runtime-checkpoint-artifact-widening.md
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
  - tests/contracts/workflow-recipe.test.ts
artifact_ids:
  - workflow.primitive_catalog
  - workflow.recipe_definition
prior_challenger_passes:
  - specs/reviews/recipe-runtime-substrate-codex-challenger-01.md
  - specs/reviews/recipe-runtime-substrate-codex-challenger-02.md
  - specs/reviews/recipe-runtime-substrate-codex-challenger-03.md
  - specs/reviews/recipe-runtime-substrate-codex-challenger-04.md
  - specs/reviews/recipe-runtime-substrate-codex-challenger-05.md
  - specs/reviews/recipe-runtime-substrate-codex-challenger-06.md
  - specs/reviews/recipe-runtime-substrate-codex-challenger-07.md
  - specs/reviews/recipe-runtime-substrate-codex-challenger-08.md
  - specs/reviews/recipe-runtime-substrate-codex-challenger-09.md
---

# Recipe Runtime Substrate Plan

A prerequisite arc for the compiled-recipe-runtime-bridge. The bridge as
revised in revision 02 (challenger pass 02, REJECT) cannot resolve runtime
fields out of authorities that do not encode them. This arc widens the
recipe-domain authorities so the bridge has real sources to compile
against. Two slices land it: a Heavy slice that adds workflow-specific
runtime payload at the **recipe-item** layer (and a single typed
`workflow_kind` at the recipe layer) and atomically backfills the catalog
plus the Fix recipe, and an arc-close composition review wired into
`ARC_CLOSE_GATES`.

Revision 03 is a structural reframe driven by challenger pass 02
(REJECT-PENDING-FOLD-INS, 2C / 1H / 1M). Pass 02 verified that the
revision-02 layering — workflow-specific runtime payload bound to
`WorkflowPrimitive` — was wrong: the same primitive (`human-decision`,
`frame`, `batch`) is intentionally reused across multiple recipes with
distinct concrete payloads, so binding one `protocol_role`, one
`runtime_gate_template.kind`, one `checkpoint_template`, and one
concrete `write_slot` `{path, schema}` to the primitive forces a single
recipe's concretes into the shared catalog and turns ordinary reuse into
a schema contradiction. Revision 03 keeps the revision-02 shape
decisions (decompose `protocol_id`, drop Slice B, derive runtime
`gate.allow` from `checkpoint_policy.choices`, mirror runtime
`CheckpointPolicy`) and **moves the workflow-specific payload from the
primitive layer to the recipe-item layer**:

- F1 (CRITICAL fold-in): `protocol_role`, `runtime_gate_template`, and
  `checkpoint_policy` move from `WorkflowPrimitive` to a new
  `WorkflowRecipeItem.runtime_step` block. The same primitive can now
  back distinct recipe items with distinct concretes (E22). Primitive
  keeps only the truly invariant `protocol_version` integer (default 1
  in the catalog). Bridge composes
  `Step.protocol = '${recipe.workflow_kind}-${recipe_item.runtime_step.protocol_role}@v${primitive.protocol_version}'`.
- F2 (CRITICAL fold-in): `write_target` `{path, schema}` moves from
  `WorkflowPrimitive.write_slots` to
  `WorkflowRecipeItem.runtime_step.write_target`. The `frame` primitive
  no longer binds one concrete artifact path; each recipe item carries
  its own concrete target (E23). Primitive surface is fully generic
  again — no `write_slots` map.
- F3 (HIGH fold-in): `gate_template.kind` is per recipe-item, paired
  with the item's own `execution.kind`. The `batch` primitive (mixed
  `action_surface`, legally usable as `synthesis | dispatch |
  verification | checkpoint` per `acceptedExecutionKinds`) can now be
  reused across recipe items with different gate kinds without schema
  contradiction (E24).
- F4 (MED fold-in): the `WorkflowKind` slug-shape drift check is
  strengthened. Slice A's contract test now (a) asserts every key in
  `WORKFLOW_KIND_CANONICAL_SETS` satisfies
  `/^[a-z][a-z0-9-]*$/`, and (b) for every `WorkflowKind` value AND
  every `WorkflowRecipeItem.runtime_step.protocol_role` value in the
  Fix recipe, asserts the composed string
  `'${workflow_kind}-${protocol_role}@v${primitive.protocol_version}'`
  parses against `ProtocolId` (E25). The smoke test is no longer
  `'fix'`-only.
- Frontmatter `base_commit` advances from `dcfeb517…` (slice-156, the
  plan draft) to `b98c5457…` (slice-156a, the actual base of the
  fold-in revision). Pass 02 caught the stale ref.

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
| E4 | `WorkflowRecipeItem` exposes `{id: StepId, uses: WorkflowPrimitiveId, title: string.min(1), phase: CanonicalPhase, input: Record<string-key, WorkflowPrimitiveContractRef>.default({}), output: WorkflowPrimitiveContractRef, evidence_requirements: WorkflowRecipeEvidenceRequirements (REQUIRED), execution: WorkflowRecipeExecution {kind: synthesis\|dispatch\|verification\|checkpoint, ...}, selection: SelectionOverride.optional(), routes: Record<string, WorkflowRecipeRouteTarget>.refine(non-empty), route_overrides: Record<string, WorkflowRecipeRouteModeOverrides>.default({})}.strict().superRefine(routes/route_overrides validation)`. There is no `runtime_step`, `gate_template`, `checkpoint_policy`, or `write_target` slot on the item today. There is no `edges` field on `WorkflowRecipeItem` either; the `edges` field belongs to the draft shape `WorkflowRecipeDraft` consumed by `compileWorkflowRecipeDraft` (the route layer is the live successor). Recipe items inherit data from the primitive they reference via `uses`. | verified | `src/schemas/workflow-recipe.ts:103-158` (the WorkflowRecipeItem shape); `src/schemas/workflow-recipe.ts:293-315` (WorkflowRecipeDraft where `edges` lives) |
| E5 | The Fix recipe fixture (`specs/workflow-recipes/fix-candidate.recipe.json`) declares 12 items across `frame`, `analyze`, `act`, `verify`, `review`, `close`, with the canonical `plan` phase omitted by ADR-0013. Items reference primitives via `uses` and declare `output` as a contract ref string. | verified | `specs/workflow-recipes/fix-candidate.recipe.json`, `specs/workflow-recipes/fix-candidate.projection.json` |
| E6 | `FIX_RESULT_PATH_BY_ARTIFACT_ID` and `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` are file-local `const` declarations (no `export`) in `src/schemas/artifacts/fix.ts:4,14`. They cover `fix.brief`, `fix.context`, `fix.diagnosis`, `fix.no-repro-decision`, `fix.change`, `fix.verification`, `fix.review`. They are workflow-specific (Fix-only) and not reusable by other recipes today. | verified | `src/schemas/artifacts/fix.ts:4,14` |
| E7 | The primitive catalog (`specs/workflow-primitive-catalog.json`) carries 15 primitive entries matching `WORKFLOW_PRIMITIVE_IDS` in `src/schemas/workflow-primitives.ts:3-19`. Each entry has the same `gate: {kind, description}` shape as the schema. No catalog entry carries runtime gate payloads, protocol ids, checkpoint templates, or write slots today. | verified | `specs/workflow-primitive-catalog.json:1-80`, `src/schemas/workflow-primitives.ts:3-19` |
| E8 | `workflow.primitive_catalog` is row 32 in `specs/artifacts.json` with `surface_class: greenfield`. `workflow.recipe_definition` is row 71 with `surface_class: greenfield`. Both rows are the materialization targets of this arc. | verified | `specs/artifacts.json:32`, `specs/artifacts.json:71` |
| E9 | Codex challenger pass 02 against the bridge plan (`specs/reviews/compiled-recipe-runtime-bridge-codex-challenger-02.md`) returned REJECT-PENDING-FOLD-INS with two CRITICAL findings; finding 1 is the upstream-data shortfall this arc resolves. Pass 02's revision-03 path (a-3) names this prerequisite arc explicitly. | verified | `specs/reviews/compiled-recipe-runtime-bridge-codex-challenger-02.md:52-75,210-223` |
| E10 | `ARC_CLOSE_GATES` in `scripts/audit.mjs` is the frozen array enforcing arc-close composition reviews; entries are `{arc_id, description, ceremony_slice, plan_path, review_file_regex}`. Slice 40 fold-in requires the two-prong gate to distinguish a Claude-prong file (name-match `*Claude*` / `*claude*`) from a Codex-prong file (name-match `*Codex*` / `*codex*`); a single-prong satisfaction is rejected. | verified | `scripts/audit.mjs` (ARC_CLOSE_GATES array; Slice 40 prong-distinction block) |
| E11 | `PROJECT_STATE.md` `current_slice: 156` after the bridge revision-02 commit (`25359fd`) and the slice-156 plan-draft + slice-156a fold-in commits. This arc's slice-A implementation opens at 157 or later, depending on operator dispatch. | verified | `PROJECT_STATE.md`, recent git log |
| E12 | `WorkflowPrimitiveRoute` in `src/schemas/workflow-primitives.ts:24-34` enumerates `continue, retry, revise, ask, split, stop, handoff, escalate, complete`. The runner outcome enum in `src/schemas/event.ts:56` is `{pass, fail}`. The recipe-outcome → runner-outcome lowering rule is a bridge-plan concern (revision 03 §5), not this arc's concern; this arc preserves the recipe-outcome vocabulary unchanged. | verified | `src/schemas/workflow-primitives.ts:24-34`, `src/schemas/event.ts:56` |
| E13 | `tests/contracts/workflow-primitive-catalog.test.ts` and `tests/contracts/workflow-recipe.test.ts` are the existing contract tests that will gain assertions when the schemas widen. The existing `validateWorkflowRecipeCatalogCompatibility` lookup in `src/schemas/workflow-recipe.ts` joins recipes to primitives. | verified | `tests/contracts/workflow-primitive-catalog.test.ts`, `tests/contracts/workflow-recipe.test.ts`, `src/schemas/workflow-recipe.ts:468-567` |
| E14 | The catalog widening cannot land schema and backfill in separate slices without breaking the parser between them: adding a required field to `WorkflowPrimitive` rejects the un-backfilled catalog. Atomic schema + backfill in one slice is the only ordering that keeps Tier-0 green at every commit. The same logic applies to `WorkflowRecipeItem.runtime_step` and the Fix recipe backfill. | inferred | derived from E1, E4, E7 + Zod strict-mode parser semantics |
| E15 | The Fix recipe (`specs/workflow-recipes/fix-candidate.recipe.json`) has exactly **one** checkpoint item (`fix-no-repro-decision`, in the `analyze` phase, using primitive `human-decision`). Multiple recipe items reach this checkpoint via `ask` route targets, but the checkpoint node itself is single. Per-item checkpoint customization at THIS recipe's scale is therefore not required for multi-checkpoint Fix flows; the structural justification for keying checkpoint policy at recipe-item level is cross-recipe reuse of `human-decision` (E22), not within-recipe multiplicity. | verified | `specs/workflow-recipes/fix-candidate.recipe.json:184-185` (only `"kind": "checkpoint"` occurrence) |
| E16 | The runtime `ProtocolId` is a Zod string with regex `/^[a-z][a-z0-9-]*@v\d+$/` and brand `'ProtocolId'`. Live workflow fixtures use values like `build-frame@v1`, `build-act@v1`, `build-plan@v1`, `build-verify@v1`, confirming the structural pattern `{workflow-kind}-{protocol-role}@v{N}`. A coarse family enum (`fix`, `build`, ...) cannot satisfy this regex. Pass 01 finding F1. | verified | `src/schemas/ids.ts:26-30`, `tests/runner/build-checkpoint-exec.test.ts:76,150,188,240,278,293` |
| E17 | `WorkflowRecipe` declares `contract_aliases: WorkflowRecipeContractAlias[]` mapping generic primitive output contracts (e.g., `workflow.brief@v1`) to recipe-specific concretes (e.g., `fix.brief@v1`). The Fix recipe declares 9 such aliases. The runtime helper `contractIsCompatible` already consults this map when joining recipe items to primitive output contracts. The aliases translate contract refs only, not artifact paths or schemas — pass 02 finding F2 caught that revision 02's "generic-keyed `write_slots`" still bound concrete `{path, schema}` payloads at the primitive layer. Revision 03 moves the payload to the recipe item. | verified | `src/schemas/workflow-recipe.ts:39-44,169,221`, `specs/workflow-recipes/fix-candidate.recipe.json:16-53` |
| E18 | The runtime `Step` superRefine at `src/schemas/step.ts:166-175` requires `gate.allow === policy.choices.id` exactly (joined-by-NUL string equality). `CheckpointSelectionGate.allow` and `CheckpointPolicy.choices.id` are bound to a single source of truth at bridge time. The bridge derives `gate.allow` from `recipe_item.runtime_step.checkpoint_policy.choices.map(c => c.id)` so the invariant holds by construction. | verified | `src/schemas/step.ts:166-175`, `src/schemas/gate.ts:58-65`, `src/schemas/step.ts:60-110` |
| E19 | The runtime `CheckpointPolicy` (`src/schemas/step.ts:60-110`) exposes structured `choices: Array<{id, label?, description?}>`, optional `safe_default_choice`, optional `safe_autonomous_choice` (each must reference a declared choice id), and optional `build_brief: {scope, success_criteria, verification_command_candidates}`. A bare-string template surface is strictly narrower than what the runtime supports today. Pass 01 finding F5. | verified | `src/schemas/step.ts:60-110` |
| E20 | `WORKFLOW_KIND_CANONICAL_SETS` at `scripts/policy/workflow-kind-policy.mjs:37-62` enumerates `{explore, review, build, fix}` as the canonical workflow kinds, each with its own canonical phase set. Fix's canonicals are `[frame, analyze, act, verify, review, close]` with `omits: [plan]`. A `WorkflowKind` Zod enum mirroring these keys gives the bridge a typed source for the workflow-kind half of the protocol id. | verified | `scripts/policy/workflow-kind-policy.mjs:37-62` |
| E21 | Unknown-blocking: none. The five target fields and their placement (recipe-level for `workflow_kind`, recipe-item-level for the `runtime_step` block, primitive-level for the `protocol_version` integer) are concrete in §5; the bridge composes `Step.protocol` from `recipe.workflow_kind` + `recipe_item.runtime_step.protocol_role` + `primitive.protocol_version` at compile time. The lowering of recipe outcomes to runner outcomes remains explicitly out of scope and bound to the bridge plan revision 03. | unknown-blocking | §5 design decisions are revision-03-final |
| E22 | The shared primitive `human-decision` is intentionally reusable as a checkpoint in any canonical phase. `acceptedPhases` in `src/schemas/workflow-recipe.ts:404-405` admits `human-decision` in all `CANONICAL_PHASES`, and `acceptedExecutionKinds` admits any `host`-surface primitive as a `checkpoint` execution. The live Build workflow already uses a checkpoint with protocol `build-frame@v1` and a Build-brief-specific checkpoint policy; the Fix recipe uses the same primitive at `fix-no-repro-decision` (analyze phase) with a different prompt and choice set. One primitive-scoped `protocol_role` and one primitive-scoped `checkpoint_template` cannot represent both — workflow-specific concretes belong at the recipe-item layer, keyed by use-site. Pass 02 finding F1. | verified | `src/schemas/workflow-recipe.ts:364-377,380-406`, `specs/workflow-recipes/fix-candidate.recipe.json:169-186`, `.claude-plugin/skills/build/circuit.json:84-137`, `specs/workflow-primitives.md:113-150`, `tests/runner/build-checkpoint-exec.test.ts:76,150,188,240` |
| E23 | The shared primitive `frame` generically outputs `workflow.brief@v1`. Explore materializes that as `artifacts/brief.json` + `explore.brief@v1`; Build as `artifacts/build/brief.json` + `build.brief@v1`; Fix aliases it to `fix.brief@v1` with Fix-specific tables at `artifacts/fix/brief.json`. `WorkflowRecipe.contract_aliases` translates generic contract refs only, not artifact paths. A primitive-scoped `write_slots['workflow.brief@v1'] = {path, schema}` would force one concrete workflow's artifact location into the shared catalog. The concrete `{path, schema}` pair belongs at the recipe-item layer, after alias resolution. Pass 02 finding F2. | verified | `src/schemas/workflow-recipe.ts:39-44`, `specs/workflow-primitive-catalog.json:49-53`, `specs/workflow-recipes/fix-candidate.recipe.json:16-20`, `src/schemas/artifacts/fix.ts:4-22`, `.claude-plugin/skills/explore/circuit.json:60-73`, `.claude-plugin/skills/build/circuit.json:122-128` |
| E24 | The shared primitive `batch` declares `action_surface: 'mixed'` (`specs/workflow-primitive-catalog.json:243`), which `acceptedExecutionKinds` legally admits as `synthesis \| dispatch \| verification \| checkpoint`. A singular per-primitive `runtime_gate_template.kind` chosen from how recipes currently use `batch` cannot honestly model that generic capability — the first later recipe that uses `batch` in a different execution kind would look like a schema contradiction instead of normal reuse. The gate kind belongs at the recipe-item layer, paired with that item's own `execution.kind`. Pass 02 finding F3. | verified | `specs/workflow-primitive-catalog.json:238-255`, `src/schemas/workflow-recipe.ts:364-377` |
| E25 | `WORKFLOW_KIND_CANONICAL_SETS` lives in plain `.mjs` object keys, not a regex-validated type. A future key with an underscore, uppercase letter, or other non-slug character would satisfy a Zod-enum equality test against `Object.keys(...)` and still break the composed `${workflow_kind}-${protocol_role}@v${version}` against `ProtocolId`'s regex. Slice A's contract test must (a) assert every key satisfies `/^[a-z][a-z0-9-]*$/` and (b) for every `WorkflowKind` value AND every `recipe_item.runtime_step.protocol_role` value in registered recipes, assert the composed string parses against `ProtocolId`. Pass 02 finding F4. | verified | `scripts/policy/workflow-kind-policy.mjs:36-62`, `src/schemas/ids.ts:26-29` |
| E26 | The substrate carries THREE parallel surfaces for artifact-schema authority on a recipe item: (a) `WorkflowRecipeItem.output` at `src/schemas/workflow-recipe.ts:112-120` (recipe-domain ref, possibly aliased per `recipe.contract_aliases` at `src/schemas/workflow-recipe.ts:39-44,169,221`); (b) `runtime_step.write_target.schema` (this arc's new field at the recipe-item layer, post-alias concrete); and (c) the retained Fix-only tables `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` + `FIX_RESULT_PATH_BY_ARTIFACT_ID` at `src/schemas/artifacts/fix.ts:4-22` (Fix-protocol view kept per §3 out-of-scope). Without explicit cross-surface invariants, these three sources can drift: a recipe item could parse with `write_target.schema = 'x@v1'` while `item.output` (alias-resolved) = `'y@v1'`, handing the bridge contradictory write bindings. The bridge would then either fail at compile time (best case) or write to the wrong location (worst case). Pass 03 finding F1. F1 fold-in encodes two anti-drift invariants in §5 binding rules + corresponding contract tests in Slice A acceptance evidence. | verified | `src/schemas/workflow-recipe.ts:39-44,112-120,169,221,446-447,513-517`, `src/schemas/artifacts/fix.ts:4-22`, `specs/plans/recipe-runtime-substrate.md:226-235,341-342,453-460,656-662` (the surfaces themselves and pass-03 F1's pointer set) |

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
to read. Revision 03 places the data at the layer that already owns
workflow-specific concretes — the recipe-item — and keeps the primitive
layer fully generic so cross-recipe reuse stays sound. The data lives
in three places in the recipe domain: a per-primitive `protocol_version`
integer (the only field that is genuinely invariant across recipes), a
per-recipe `workflow_kind` enum value, and a per-recipe-item
`runtime_step` block that carries the workflow-specific runtime payload
(`protocol_role`, `gate_template` with kind chosen at the item, optional
`checkpoint_policy` mirroring the runtime `CheckpointPolicy` surface,
`write_target` as a concrete `{path, schema}` pair). The bridge composes
`Step.protocol` from `recipe.workflow_kind` + `recipe_item.runtime_step.protocol_role`
+ `primitive.protocol_version`, structurally satisfying the runtime
`ProtocolId` regex (E16) while letting one primitive back many recipe
items with distinct concretes (E22, E23, E24).

This is a planning-readiness arc by ADR-0010: a Heavy implementation
arc requires its substrate to encode the structural fields its
acceptance evidence depends on. The bridge plan stays at
challenger-pending revision 02 until this arc closes; bridge revision
03 takes the widened substrate as its base.

## §3 — Scope

In scope:

- **Per-primitive minimal addition** (Slice A). Add one field to
  `WorkflowPrimitive`:
  - `protocol_version: z.number().int().min(1)` — defaults to 1 in the
    catalog backfill. The only genuinely invariant runtime datum the
    primitive owns: it names the catalog entry's protocol-version
    contract and lets the catalog evolve a primitive's protocol surface
    independently of recipes. The bridge composes the runtime
    `Step.protocol` as
    `'${recipe.workflow_kind}-${recipe_item.runtime_step.protocol_role}@v${primitive.protocol_version}'`,
    which structurally satisfies the runtime `ProtocolId` regex
    `/^[a-z][a-z0-9-]*@v\d+$/` (E16). No other workflow-specific
    payload lives at the primitive layer; the primitive's existing
    surface (`input_contracts`, `output_contract`, `action_surface`,
    `produces_evidence`, `gate.description`, `allowed_routes`,
    `human_interaction`, `host_capabilities`) stays generic and
    unchanged.

- **Per-recipe-item runtime payload widening** (Slice A). Add one
  required field to `WorkflowRecipeItem`:
  - `runtime_step: RuntimeStep` — a strict object carrying the
    workflow-specific runtime payload that this recipe item contributes
    to the compiled `Step`. Shape:
    - `protocol_role: ProtocolRoleSlug` — slug-shaped identifier
      (`/^[a-z][a-z0-9-]*$/`) naming this item's role inside the
      composed `Step.protocol` id. Two recipe items that `use` the
      same primitive can declare distinct `protocol_role` values when
      the primitive is reused with different runtime semantics (the
      `human-decision` case in E22; the `batch` case in E24).
    - `gate_template: RuntimeGateTemplate` — a discriminated-union
      template that mirrors the runtime `Gate` kind minus the
      `source` field (which is structurally bound to gate kind by
      `gate.ts`). Variants: `{kind: 'schema_sections', required:
      string[].min(1)}`, `{kind: 'result_verdict', pass:
      string[].min(1)}`, `{kind: 'checkpoint_selection'}` (no `allow`
      payload — bridge derives it from `checkpoint_policy.choices.id`
      at compile time so the runtime
      `gate.allow === policy.choices.id` invariant holds by
      construction; E18). The kind binds to this item's
      `execution.kind`, not to the primitive — that is what permits a
      mixed-surface primitive like `batch` to participate in different
      gate kinds across recipe items (E24).
    - `checkpoint_policy?: CheckpointPolicyTemplate` — present iff
      `execution.kind === 'checkpoint'`. Mirrors the runtime
      `CheckpointPolicy` surface (`src/schemas/step.ts:60-110`, E19):
      `{prompt_template: string.min(1), choices: Array<{id:
      string.min(1), label?: string.min(1), description?:
      string.min(1)}>.min(1) (id-unique), safe_default_choice?:
      string.min(1), safe_autonomous_choice?: string.min(1),
      build_brief?: {scope: string.min(1), success_criteria:
      string[].min(1), verification_command_candidates:
      BuildVerificationCommand[].min(1)}}`. Refinement requires
      `safe_default_choice` and `safe_autonomous_choice` (when
      supplied) each to reference a declared choice id, mirroring
      runtime `CheckpointPolicy` superRefine.
    - `write_target: {path: string.min(1), schema: string.min(1)}` —
      the concrete artifact path and schema reference this recipe
      item materializes its `output` to. Each recipe item carries its
      own concrete target; the same primitive can back items in
      different recipes with different concrete targets (the `frame`
      case in E23). Recipe-specific contract refs (e.g.,
      `fix.brief@v1`) inhabit the item's `output` field through
      `recipe.contract_aliases`; the bridge does not need to translate
      paths or schemas at compile time, because they are already
      concrete on the item. **Schema authority is single-source by
      construction** (F1 fold-in, E26): a §5 binding rule plus
      Slice A contract tests assert that
      `runtime_step.write_target.schema` equals
      `recipe.contract_aliases.resolve(item.output)` (anti-drift
      across `item.output` ↔ `write_target.schema`); for Fix items
      whose alias-resolved output maps to a Fix-table key,
      additional parity asserts
      `runtime_step.write_target.{path, schema}` equals
      `FIX_RESULT_*[fix_artifact_id]` (anti-drift across
      `write_target.{path, schema}` ↔ retained Fix-only tables).

- **Per-recipe workflow-kind binding** (Slice A). Add one required
  field to `WorkflowRecipe`:
  - `workflow_kind: WorkflowKind` — `z.enum(['explore', 'review',
    'build', 'fix'])` mirroring the keys of
    `WORKFLOW_KIND_CANONICAL_SETS` (E20). Used by the bridge to
    compose `Step.protocol`. A future primitive that legitimately
    spans workflow kinds stays neutral; the recipe carries the
    workflow-kind dimension. A recipe whose items reference primitives
    with mixed `protocol_role` values is well-formed; the recipe's
    single `workflow_kind` field still feeds every step's protocol id.

- **Atomic catalog and Fix-recipe backfill** (Slice A). Populate
  `protocol_version: 1` for all 15 entries in
  `specs/workflow-primitive-catalog.json` AND populate
  `workflow_kind: 'fix'` plus a complete `runtime_step` block on all
  12 items in `specs/workflow-recipes/fix-candidate.recipe.json`, in
  the same commit that lands the schema additions. The catalog passes
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
  the `gate.allow` derivation from `runtime_step.checkpoint_policy.choices.id`,
  and the read of `runtime_step.write_target` into `Step.writes.artifact`.
- **Per-primitive runtime payload.** Workflow-specific concretes
  (`protocol_role`, `gate_template`, `checkpoint_policy`,
  `write_target`) do NOT live on `WorkflowPrimitive`. The primitive
  layer carries only the genuinely invariant `protocol_version`
  integer plus its existing generic surface. This is the central
  reframe of revision 03 (E22, E23, E24).
- **Per-item override slot for forward-looking customization beyond
  `runtime_step`.** No additional override slot. The `runtime_step`
  block IS the per-item customization layer; everything a recipe item
  needs to contribute to the runtime `Step` lives there. A future
  recipe that needs further variation can add fields to `runtime_step`
  in a future arc when a real consumer exists.
- **The recipe-outcome → runner-outcome lowering rule.** That belongs
  in the bridge plan revision 03 §5 (it's a compiler-side concern).
  This arc preserves `WorkflowPrimitiveRoute` and recipe-edge outcomes
  unchanged.
- **Live Fix execution.** Out of scope for the same reasons the bridge
  plan §3 names.
- **Removal of `FIX_RESULT_PATH_BY_ARTIFACT_ID` /
  `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID`.** Those tables stay as a
  Fix-protocol surface for callers that want a typed Fix-only view.
  Slice A's per-item `runtime_step.write_target` provides the
  recipe-resident equivalent. The bridge plan revision 03 chooses
  which surface its assertions bind through.
- **New primitive ids or new recipe shapes.** The 15 catalog
  primitive identifiers and the Fix recipe identity are unchanged;
  this arc widens their schemas, not the set of primitives or
  recipes.
- **`WorkflowPrimitive.gate.description` removal.** The free-form
  description stays as a human-facing rationale field. Mechanical
  removal is a follow-up cleanup, not this arc's work.

## §4 — Non-goals

- The runtime `Gate`, `CheckpointPolicy`, `Step`, and `Workflow`
  schemas in `src/schemas/{gate,step,workflow,phase}.ts` are not
  touched by this arc's slices. The runtime `Gate`,
  `CheckpointPolicy`, and `Workflow` shapes are already capable of
  carrying what the bridge produces. The runtime `Step` shape is
  capable for synthesis, verification, and dispatch step kinds; for
  the **checkpoint** kind, `Step.writes.artifact` is restricted by
  the refinement at `src/schemas/step.ts:176-191` to schema
  `'build.brief@v1'` only — a restriction that rejects any non-Build
  checkpoint artifact (e.g., the Fix `fix-no-repro-decision` item
  materializing `fix.no-repro-decision@v1`). The parse-layer
  widening of that restriction is the scope of a separate
  **prerequisite arc** with its own plan at
  `specs/plans/runtime-checkpoint-artifact-widening.md` (status
  challenger-cleared, revision 04, base_commit `190122d00ba47a0fe34caef2a2a1d28128b585e5`),
  explicitly budgeted as a planning-readiness predecessor per
  ADR-0010. Substrate revision 04's F2-closure depends on the
  prerequisite arc's Slice A widening being live in code; the
  prerequisite arc's plan covers parse-layer scope only (the
  runner-side execution materializer at
  `src/runtime/runner.ts:861,888,980,995,1166-1206,1604` is Build-
  only and is fenced off in the prerequisite arc's §3 out-of-scope,
  owned by a future Fix-runtime arc).
- Aggregate ratchet scoring or single-knob composition is not
  introduced. AGENTS.md hard invariant 8 is preserved: each ratchet
  in §9 is tracked independently.
- No `write_slots` map on `WorkflowPrimitive`. Concrete `{path,
  schema}` data lives only on recipe items (E23). The primitive's
  generic `output_contract` field is unchanged.
- No primitive-scoped `runtime_gate_template` or `checkpoint_template`.
  Workflow-specific gate kinds and checkpoint payloads live on recipe
  items (E22, E24).
- Multi-rigor templating on primitives is not introduced. Rigor
  remains an entry-mode concern, not a primitive-template concern.

## §5 — Target seam shape

### Seam diagram

The new fields and their downstream runtime consumers:

```
WorkflowRecipe.workflow_kind ─────────────────────────┐
                                                       │
WorkflowRecipeItem.runtime_step.protocol_role ────────┤   bridge composes
                                                       ├─► '${workflow_kind}-${protocol_role}@v${protocol_version}' ─► Step.protocol  [ProtocolId regex /^[a-z][a-z0-9-]*@v\d+$/]
WorkflowPrimitive.protocol_version ───────────────────┘                                                                   (E16)

WorkflowRecipeItem.runtime_step.gate_template
   └─► Step.gate    [for checkpoint kind, gate.allow is DERIVED from runtime_step.checkpoint_policy.choices.id at bridge time, not stored on the template]
                    (E18: runtime enforces gate.allow === policy.choices.id by superRefine)

WorkflowRecipeItem.runtime_step.checkpoint_policy (full mirror of runtime CheckpointPolicy)
   └─► Step.policy  (E19)

WorkflowRecipeItem.runtime_step.write_target (concrete {path, schema} on the item)
   └─► Step.writes.artifact  (E23: per-recipe-item, no alias resolution required AT the recipe-domain authoring layer;
                             for CHECKPOINT items, parse-acceptance by runtime CheckpointStep refinement requires
                             the prerequisite arc `specs/plans/runtime-checkpoint-artifact-widening.md`
                             challenger-cleared revision 04 to land — see §4 prerequisite-arc dependency note)
```

### Primitive widening

`WorkflowPrimitive` gains exactly one field:

```
protocol_version: z.number().int().min(1)
```

No other field is added or moved. The primitive's existing surface
(`input_contracts`, `alternative_input_contracts`, `output_contract`,
`action_surface`, `produces_evidence`, `gate: {kind, description}`,
`allowed_routes`, `human_interaction`, `host_capabilities`, `notes?`)
is preserved verbatim. Catalog backfill sets `protocol_version: 1` on
all 15 entries.

### Recipe widening

`WorkflowRecipe` gains one required field:

```
workflow_kind: WorkflowKind
```

Type definition:

```
WorkflowKind = z.enum(['explore', 'review', 'build', 'fix'])  // mirrors WORKFLOW_KIND_CANONICAL_SETS keys (E20)
```

### Recipe-item widening

`WorkflowRecipeItem` gains one required field:

```
runtime_step: RuntimeStep
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
  z.object({ kind: z.literal('checkpoint_selection') }).strict(),    // no `allow` payload — bridge derives from checkpoint_policy.choices
])

CheckpointPolicyTemplate = z.object({
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

WriteTarget = z.object({
  path:   z.string().min(1),
  schema: z.string().min(1),
}).strict()

RuntimeStep = z.object({
  protocol_role:     ProtocolRoleSlug,
  gate_template:     RuntimeGateTemplate,
  checkpoint_policy: CheckpointPolicyTemplate.optional(),
  write_target:      WriteTarget,
}).strict()
```

### Binding rules (final shapes confirmed in Slice A)

- **Gate-template kind binding (per recipe item).** A recipe item
  with `execution.kind ∈ {synthesis, verification}` carries
  `runtime_step.gate_template.kind === 'schema_sections'`. A recipe
  item with `execution.kind === 'dispatch'` carries `kind ===
  'result_verdict'`. A recipe item with `execution.kind ===
  'checkpoint'` carries `kind === 'checkpoint_selection'`. The
  binding is per-item, not per-primitive; the same primitive may back
  items with different gate kinds when its `action_surface` permits
  (E24).
- **Checkpoint policy presence (per recipe item).**
  `runtime_step.checkpoint_policy` is required if and only if the
  item's `execution.kind === 'checkpoint'`. Refinement enforces both
  directions on `WorkflowRecipeItem`.
- **Checkpoint single-source-of-truth.** The runtime `gate.allow`
  value is NOT stored on `runtime_step.gate_template`; the bridge
  derives it from
  `recipe_item.runtime_step.checkpoint_policy.choices.map(c => c.id)`
  at compile time. The runtime `step.ts:166-175` superRefine requires
  `gate.allow === policy.choices.id`; deriving from a single
  authority means the invariant holds by construction (E18).
- **Write-target schema single-source-of-truth (anti-drift
  invariants).** The substrate has THREE surfaces that carry
  artifact-schema authority (E26): (a) `WorkflowRecipeItem.output`
  (recipe-domain ref, possibly recipe-aliased per
  `recipe.contract_aliases`); (b) `runtime_step.write_target.schema`
  (post-alias concrete on the recipe item, this arc's new field);
  and (c) the retained Fix-only tables
  `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` and
  `FIX_RESULT_PATH_BY_ARTIFACT_ID` at
  `src/schemas/artifacts/fix.ts:4-22` (kept as a Fix-protocol view
  per §3 out-of-scope). Without explicit cross-surface invariants,
  these three sources can drift and the bridge would receive
  contradictory write bindings. This arc defines two binding rules
  with **split enforcement surfaces**: Rule 1 (schema parity) is
  parser-side (`WorkflowRecipe` superRefine), Rule 2 (Fix-table
  parity) is test-side (Fix-recipe-specific contract test). The
  split is definitive — no parser-vs-test reopening — and §8.1
  acceptance evidence states the same split:
  - **Rule 1: Schema parity (parser-side, recipe-level
    superRefine).** `runtime_step.write_target.schema` MUST equal
    `recipe.contract_aliases.resolve(item.output)` — i.e., the
    schema string after alias resolution. For an item whose
    `output` is a generic primitive contract ref (e.g.,
    `workflow.brief@v1`), `write_target.schema` is the recipe's
    aliased concrete (e.g., `fix.brief@v1` for the Fix recipe via
    `contract_aliases`). For an item whose `output` is already a
    workflow-specific concrete (e.g., `fix.no-repro-decision@v1`
    with no alias entry), `write_target.schema` equals `output`
    verbatim. The invariant is enforced by a `WorkflowRecipe`
    superRefine in Slice A (catalog-aware: the refinement consumes
    the recipe's `contract_aliases` map; the refinement runs at
    `WorkflowRecipe` level, not standalone `WorkflowRecipeItem`
    level, since item-level refinement cannot consult the parent
    recipe's `contract_aliases`). Slice A places the refinement in
    `src/schemas/workflow-recipe.ts` `WorkflowRecipe` superRefine.
  - **Rule 2: Fix-table parity (test-side, Fix-recipe contract
    test).** For every Fix recipe item whose `output` (after alias
    resolution) corresponds to a Fix artifact id present in
    `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID`,
    BOTH `runtime_step.write_target.schema` MUST equal
    `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID[fix_artifact_id]` AND
    `runtime_step.write_target.path` MUST equal
    `FIX_RESULT_PATH_BY_ARTIFACT_ID[fix_artifact_id]`. The
    invariant is enforced by a Fix-recipe-specific contract test
    in Slice A (asserting the on-disk Fix recipe satisfies the
    parity). To bind the contract test to source-of-truth, Slice A
    promotes `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` and
    `FIX_RESULT_PATH_BY_ARTIFACT_ID` from file-local `const`s at
    `src/schemas/artifacts/fix.ts:4-22` to **exported** read-only
    tables (named exports `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` and
    `FIX_RESULT_PATH_BY_ARTIFACT_ID`). The contract test imports
    the exports directly; the test is the SOLE enforcement
    surface for Fix-table parity (no parser-side superRefine for
    Fix-table parity — the schema-parity rule above is enough at
    the parse layer; Fix-table parity is a workflow-protocol
    correctness check that lives in tests). Future workflow
    recipes that add similar workflow-protocol tables would
    follow the same export + contract test pattern; this arc
    only encodes the Fix case because Fix is the only recipe with
    such tables today.
- **Write-target concretes (per recipe item).** Each recipe item
  carries its own concrete `{path, schema}` in
  `runtime_step.write_target`. Two recipe items that `use` the same
  primitive (same generic `output_contract` value) can declare
  distinct write targets, which is exactly the case for `frame`
  across Explore, Build, and Fix (E23). The bridge reads
  `runtime_step.write_target` directly into `Step.writes.artifact`
  with no alias resolution required AT the recipe-domain authoring
  layer — the recipe item's `write_target` is already post-alias-
  resolved (`{path, schema}` are concrete, not aliased refs). For
  non-checkpoint items (synthesis / verification / dispatch), the
  bridged shape is parse-acceptable today via the existing
  `ArtifactRef` slot at `src/schemas/step.ts:11-15`. For checkpoint
  items, the resulting `Step.writes.artifact` value is parse-
  acceptable by the runtime `CheckpointStep` refinement only when
  the prerequisite arc
  (`specs/plans/runtime-checkpoint-artifact-widening.md`, status
  challenger-cleared, revision 04) is live in code via its Slice A
  widening of `src/schemas/step.ts:176-191`. This arc's F2-closure
  claim is conditional on the prerequisite arc's Slice A being
  live in code; substrate plan §11 close criteria cite that
  precondition explicitly.
- **Protocol id composition.** The bridge composes
  `Step.protocol = '${recipe.workflow_kind}-${recipe_item.runtime_step.protocol_role}@v${primitive.protocol_version}'`.
  All three halves are typed in this arc; the composition itself is
  the bridge plan revision 03's responsibility. The composed string
  is structurally guaranteed to satisfy the runtime `ProtocolId`
  regex `/^[a-z][a-z0-9-]*@v\d+$/` because: `workflow_kind` ∈
  `{explore, review, build, fix}` (lowercase slugs, asserted by the
  drift contract test in Slice A), `protocol_role` is
  `ProtocolRoleSlug`-shaped (`/^[a-z][a-z0-9-]*$/`), and
  `protocol_version` is a positive integer (E16).
- **Shared-primitive reuse with distinct concretes.** A recipe item
  using `human-decision` declares its own
  `runtime_step.protocol_role` (e.g., `no-repro-decision` for the
  Fix recipe) and its own `runtime_step.checkpoint_policy`. A future
  Build recipe item using `human-decision` declares its own
  `runtime_step.protocol_role` (e.g., `frame`) and its own
  `runtime_step.checkpoint_policy` (the Build-brief variant). The
  primitive layer is fully generic and shared (E22).
- **Cross-protocol recipes.** A recipe whose items reference
  primitives with mixed `protocol_role` values is well-formed; the
  recipe's single `workflow_kind` field still feeds every step's
  protocol id. There is no per-item workflow-kind override; the
  recipe is the workflow-kind authority.

### Failure modes the schema or contract surface catches

(Most failures below are rejected at parse time by Zod refinements.
Two are contract-test drift assertions, not parser rejections, and
are flagged inline: the WorkflowKind enum-vs-policy equality check
and the WorkflowKind slug-shape drift check both live in the
Slice A contract test surface per §8.1, mirroring the test-side
enforcement chosen for Fix-table parity in §5 Rule 2.)

- Recipe item missing `runtime_step` (required field).
- Recipe item with `execution.kind === 'checkpoint'` whose
  `runtime_step.checkpoint_policy` is missing.
- Recipe item with `execution.kind !== 'checkpoint'` whose
  `runtime_step.checkpoint_policy` is present.
- Recipe item with `runtime_step.gate_template.kind` mismatched
  against `execution.kind` (synthesis|verification ↔ schema_sections;
  dispatch ↔ result_verdict; checkpoint ↔ checkpoint_selection).
- Recipe item `runtime_step.protocol_role` not matching
  `ProtocolRoleSlug` regex.
- Recipe item `runtime_step.write_target.path` or
  `runtime_step.write_target.schema` empty.
- Recipe item `runtime_step.write_target.schema` not equal to
  `recipe.contract_aliases.resolve(item.output)` (schema parity
  violation, F1 fold-in Rule 1, enforced by `WorkflowRecipe`
  superRefine).

(Fix-table parity is enforced at the test layer per F1 fold-in
Rule 2, not at the parser layer; see §5 anti-drift binding rules
for the Fix-table parity definition. The list above is mostly
parser-enforced, with the two WorkflowKind drift bullets below
being explicitly contract-test assertions per §8.1, mirroring the
test-side enforcement chosen for Fix-table parity.)
- `CheckpointPolicyTemplate.safe_default_choice` or
  `safe_autonomous_choice` not a member of the declared `choices.id`
  set (mirrors runtime `CheckpointPolicy` superRefine).
- Duplicate `choices.id` within a `CheckpointPolicyTemplate` (mirrors
  runtime).
- Recipe missing `workflow_kind` or declaring a value outside
  `WORKFLOW_KIND_CANONICAL_SETS` keys.
- `WorkflowKind` enum members not exactly equal to
  `Object.keys(WORKFLOW_KIND_CANONICAL_SETS)` (drift caught by Slice
  A's contract test).
- Any `WORKFLOW_KIND_CANONICAL_SETS` key not satisfying
  `/^[a-z][a-z0-9-]*$/` (slug-shape drift caught by Slice A's
  contract test, even when membership is correct; E25).
- Catalog entry `protocol_version` not a positive integer.

## §6 — Authority graph classification (ADR-0003)

Per ADR-0003, every touched authority artifact is classified before
contract authorship begins. Both rows are greenfield in
`specs/artifacts.json` today, so no successor-to-live characterization
slice is required:

- `workflow.primitive_catalog` — greenfield
  (`specs/artifacts.json:32`). Originated by an earlier slice. Slice A
  widens `WorkflowPrimitive` with the required `protocol_version`
  field and atomically backfills the catalog so the row stays
  parseable at every commit.
- `workflow.recipe_definition` — greenfield
  (`specs/artifacts.json:71`). Slice A adds the required
  `workflow_kind` field on `WorkflowRecipe` and the required
  `runtime_step` field on `WorkflowRecipeItem`; the Fix recipe is
  backfilled in the same commit (`workflow_kind: 'fix'` plus a
  `runtime_step` block on each of the 12 items). The Repair recipe is
  closed by supersession per ADR-0013 and not affected.

Clean break is not invoked. Existing parsers reject only inputs that
were not previously valid (e.g., catalogs missing the new required
field after Slice A lands, or recipes/items missing `workflow_kind` /
`runtime_step`). The runtime `Gate`, `Step`, `Workflow`, `Phase`, and
`EntryMode` schemas are unchanged.

## §7 — Verification substrate

The arc rides existing Tier-0 verification commands. No new substrate
slice is required:

- `npm run check` — `tsc --noEmit` enforces the new
  `WorkflowPrimitive.protocol_version` shape, the new
  `WorkflowRecipeItem.runtime_step` shape (`ProtocolRoleSlug` brand,
  `RuntimeGateTemplate` discriminated union, `CheckpointPolicyTemplate`
  and `WriteTarget` types), and the new required
  `WorkflowRecipe.workflow_kind` field (typed `WorkflowKind`) at the
  boundary.
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

### 8.1 Slice A — Primitive minimal addition + recipe widening + recipe-item runtime_step + atomic catalog and Fix-recipe backfill (Heavy, Ratchet-Advance)

**Failure mode addressed.** `WorkflowPrimitive.gate.description` is
free-form prose, not a runtime payload. There is no `protocol_version`
authority on any primitive, no `workflow_kind` on `WorkflowRecipe`,
and no `runtime_step` block on `WorkflowRecipeItem`. The bridge cannot
resolve runtime gate shapes, runtime `Step.protocol` ids (which must
satisfy the `ProtocolId` regex per E16), checkpoint shapes, or
per-output write paths from authorities that do not encode them. Pass
02 verified that binding workflow-specific runtime payload to the
primitive layer is the wrong layering: the same primitive is reused
across recipes with distinct concretes (E22, E23, E24). Revision 03
moves the workflow-specific payload to the recipe-item layer, leaving
the primitive layer fully generic.

**Acceptance evidence.**

- `WorkflowPrimitive` in `src/schemas/workflow-primitives.ts` adds
  one new required field, `protocol_version: z.number().int().min(1)`,
  per §5. No other primitive-level fields are added.
- `WorkflowRecipe` in `src/schemas/workflow-recipe.ts` adds the new
  required field `workflow_kind: WorkflowKind`. Type export
  `WorkflowKind` exists with members exactly matching the keys of
  `WORKFLOW_KIND_CANONICAL_SETS` in
  `scripts/policy/workflow-kind-policy.mjs`.
- `WorkflowRecipeItem` in `src/schemas/workflow-recipe.ts` adds the
  new required field `runtime_step: RuntimeStep` per §5. Type exports
  `ProtocolRoleSlug`, `RuntimeGateTemplate`,
  `CheckpointPolicyTemplate`, `WriteTarget`, `RuntimeStep` exist.
  Refinement ownership split between item-level and template-level
  schemas (mirroring the runtime split between `Step` superRefine
  and `CheckpointPolicy` superRefine):
  - `WorkflowRecipeItem` superRefine enforces ITEM-LEVEL bindings:
    (i) `execution.kind === 'checkpoint'` ↔
        `runtime_step.checkpoint_policy` present;
    (ii) `runtime_step.gate_template.kind` matches `execution.kind`
         per the binding rule in §5.
  - `CheckpointPolicyTemplate` superRefine (template-local) enforces
    TEMPLATE-LOCAL invariants, mirroring runtime `CheckpointPolicy`
    superRefine at `src/schemas/step.ts:60-110`:
    (iii) choice-id uniqueness + `safe_default_choice` /
          `safe_autonomous_choice` membership in the declared
          `choices.id` set.
- `specs/workflow-primitive-catalog.json` has all 15 entries
  populated with `protocol_version: 1`. Catalog passes
  `WorkflowPrimitiveCatalog.parse` on the staged commit. **No
  workflow-specific concretes appear at the catalog (primitive)
  layer.**
- `specs/workflow-recipes/fix-candidate.recipe.json` carries
  `"workflow_kind": "fix"` at the top level AND a complete
  `runtime_step` block on each of its 12 items. Recipe passes
  `WorkflowRecipe.parse` on the staged commit, and
  `validateWorkflowRecipeCatalogCompatibility` returns no issues.
- A new contract test under `tests/contracts/` (or extending
  `tests/contracts/workflow-recipe.test.ts`) joins recipe items ×
  primitives and asserts:
  - **Layering invariant.** No `WorkflowPrimitive` in the catalog
    carries any of the keys `protocol_role`, `gate_template`,
    `checkpoint_policy`, `runtime_gate_template`,
    `checkpoint_template`, `write_slots`, `write_target` (asserted by
    parse-only-strict semantics; the test reads the JSON file with
    extra-keys-fail and verifies no such key appears). The primitive
    layer is fully generic.
  - **Per-primitive `protocol_version` coverage.** Every catalog
    entry carries a positive-integer `protocol_version`.
  - **Recipe-level `workflow_kind` coverage.** The Fix recipe
    declares `workflow_kind: 'fix'`. (The single registered recipe
    today; ratchet defines the surface for future recipes.)
  - **Per-item `runtime_step` coverage.** Every recipe item in the
    Fix recipe carries `runtime_step` with non-empty
    `protocol_role` (matching `ProtocolRoleSlug` regex),
    `gate_template`, and `write_target` with non-empty `path` and
    `schema`. Every recipe item with `execution.kind === 'checkpoint'`
    carries `runtime_step.checkpoint_policy`; every recipe item with
    `execution.kind !== 'checkpoint'` does NOT.
  - **Gate-template kind ↔ execution kind binding.** Every recipe
    item's `runtime_step.gate_template.kind` matches its
    `execution.kind` per the §5 binding rule (synthesis|verification
    ↔ schema_sections; dispatch ↔ result_verdict; checkpoint ↔
    checkpoint_selection). The Fix backfill exercises this binding
    across all 12 Fix recipe items (6 synthesis, 4 dispatch, 1
    verification, 1 checkpoint per
    `specs/workflow-recipes/fix-candidate.recipe.json:54-336`). The structural invariant that the SAME
    PRIMITIVE (`human-decision`, `batch`) can back distinct items
    with distinct gate kinds is grounded in E22 / E24 (the primitive
    layer is fully generic; gate kind lives at recipe-item layer)
    but is NOT exercised by the on-disk Fix backfill alone (Fix has
    1 `human-decision` item and 0 `batch` items; cross-recipe
    reuse cases land in future workflow recipes). Slice A's
    contract test asserts the per-item binding via the Fix backfill;
    cross-recipe distinct-gate-kind reuse is a structural
    consequence of the schema shape, not a property the Fix-only
    join can directly demonstrate.
  - **CheckpointPolicyTemplate refinements.** Every
    `runtime_step.checkpoint_policy` has unique `choices.id`, and
    `safe_default_choice` / `safe_autonomous_choice` (when present)
    each ∈ `choices.id` (mirroring runtime `CheckpointPolicy`
    superRefine, E19).
  - **WorkflowKind enum-vs-policy parity.** The `WorkflowKind` enum
    members exactly equal `Object.keys(WORKFLOW_KIND_CANONICAL_SETS)`.
  - **WorkflowKind slug-shape drift.** Every key in
    `WORKFLOW_KIND_CANONICAL_SETS` satisfies `/^[a-z][a-z0-9-]*$/`
    (E25 fold-in).
  - **Bridge-time protocol-id composition (full Cartesian).** For
    every `WorkflowKind` value AND every distinct
    `runtime_step.protocol_role` value declared by a recipe item in
    the Fix recipe, the composed string `'${workflow_kind}-${protocol_role}@v${primitive.protocol_version}'`
    parses successfully against `ProtocolId` (E16). The smoke test
    is no longer `'fix'`-only; it iterates all four
    `WorkflowKind` values (E25 fold-in).
- `FIX_RESULT_PATH_BY_ARTIFACT_ID` and
  `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` keep their content unchanged
  (same artifact-id → path/schema mappings, same Fix-only authority
  scope) but their module surface changes in Slice A: file-local
  `const`s at `src/schemas/artifacts/fix.ts:4-22` become **named
  read-only exports** so the Fix-table parity contract test can
  import them as source-of-truth (per F1 fold-in Rule 2 below). The
  new `runtime_step.write_target` data on Fix recipe items is the
  recipe-resident parallel surface keyed by recipe item id; the
  Fix-result tables stay as the Fix-protocol view keyed by Fix
  artifact ids. **Cross-surface parity is enforced by Slice A**
  (F1 fold-in): `WorkflowRecipe` superRefine asserts schema parity
  (`runtime_step.write_target.schema === recipe.contract_aliases.resolve(item.output)`)
  for every recipe item, AND a Fix-specific contract test in
  `tests/contracts/workflow-recipe.test.ts` (or equivalent file
  binding `WorkflowRecipe` parsing) asserts Fix-table parity
  (`runtime_step.write_target.{schema,path}` ===
  `FIX_RESULT_*[fix_artifact_id]`) for every Fix recipe item whose
  output maps to a Fix table key. Both invariants prevent the
  three-surface drift Codex challenger pass-03 finding F1 named
  (E26).
- **Schema-authority parity enforcement** (F1 fold-in, Slice A):
  the two anti-drift rules use TWO DIFFERENT enforcement surfaces,
  named definitively here (no escape hatch):
  - **Rule 1 (schema parity, parse-time enforcement).** A new
    `WorkflowRecipe` superRefine block in `src/schemas/workflow-recipe.ts`
    enforces
    `runtime_step.write_target.schema === recipe.contract_aliases.resolve(item.output)`
    for every recipe item. The refinement runs at recipe level
    (not item level) so it can consult `contract_aliases`. A
    Slice A contract test in `tests/contracts/workflow-recipe.test.ts`
    titled
    `'WorkflowRecipe — runtime_step.write_target.schema must equal alias-resolved item.output for every recipe item'`
    asserts BOTH a positive case (the on-disk Fix recipe parses)
    AND a negative synthetic case (a hand-authored recipe with a
    mismatched `write_target.schema` fails `WorkflowRecipe.parse`).
  - **Rule 2 (Fix-table parity, test-time enforcement).** A
    Slice A contract test in `tests/contracts/workflow-recipe.test.ts`
    titled
    `'WorkflowRecipe (fix) — runtime_step.write_target.{path,schema} must equal FIX_RESULT_*[fix_artifact_id] for every Fix item with a Fix-table-mapped output'`
    asserts the Fix-recipe-specific table parity. The test imports
    `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` and
    `FIX_RESULT_PATH_BY_ARTIFACT_ID` directly from the
    Slice-A-promoted exports in `src/schemas/artifacts/fix.ts`
    (Slice A turns the file-local `const`s into named exports as
    part of the F1 fold-in implementation). The test asserts
    BOTH a positive case (every Fix recipe item with a Fix-table-
    mapped output satisfies the parity) AND a negative synthetic
    case (a hand-authored Fix recipe item with a `write_target.path`
    diverging from `FIX_RESULT_PATH_BY_ARTIFACT_ID` is rejected by
    the contract test). No parser-side superRefine is added for
    Fix-table parity — the schema-parity superRefine (Rule 1)
    holds at parse layer; Fix-table parity is a workflow-protocol
    correctness check that lives in the contract test surface.
- `npm run verify` green on the slice commit.

**Why this not adjacent.** Splitting the schema additions and the
catalog + recipe backfill across multiple slices breaks Tier-0 between
them: adding required fields to `WorkflowPrimitive`, `WorkflowRecipe`,
or `WorkflowRecipeItem` rejects un-backfilled catalog and recipe
respectively (E14). Splitting primitive widening from recipe-item
widening into separate slices is also unsound because the layering
invariant (no workflow-specific concretes at primitive layer) and the
gate-template kind ↔ execution kind binding both require the catalog
× recipe join to verify — neither half tested alone proves the seam.
Atomic schema + catalog + recipe in one slice is the only ordering
that keeps Tier-0 green at every commit and gives the contract test a
complete join surface to assert against.

**Lane.** Ratchet-Advance. Schema / test / type-export ratchets
strictly advance by five new exported recipe-side types
(`ProtocolRoleSlug`, `RuntimeGateTemplate`, `CheckpointPolicyTemplate`,
`WriteTarget`, `RuntimeStep`), one new exported recipe-level type
(`WorkflowKind`), one new field on `WorkflowPrimitive`
(`protocol_version`), one new field on `WorkflowRecipe`
(`workflow_kind`), one new field on `WorkflowRecipeItem`
(`runtime_step`), and one new contract-test surface. No ratchet
regresses.

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

- Two prong reviews land under `specs/reviews/` named per the
  audit's arc-close composition-review filename convention
  (`scripts/audit.mjs:5041-5042`
  `ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN` =
  `/^arc-.+-composition-review-(?:claude|codex)\.md$/i`):
  - `arc-recipe-runtime-substrate-composition-review-claude.md`
    (Claude-prong; surveys the substrate widening against the
    primitive catalog × Fix recipe join, the prerequisite-arc
    parse-acceptance dependency, and the F1/F2/F3 anti-drift
    invariants).
  - `arc-recipe-runtime-substrate-composition-review-codex.md`
    (Codex-prong; independent external review of the same surface).

  The two filenames satisfy BOTH the Slice-40 fold-in two-prong
  convention (one `*claude*`, one `*codex*`) AND audit Check 35's
  arc-subsumption shape (i) (per
  `ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN` at
  `scripts/audit.mjs:5041-5042`, the arc-close validation branch at
  `scripts/audit.mjs:5080-5117`, and the Check 35 call site that
  consumes the commit-body `arc-subsumption:` field at
  `scripts/audit.mjs:5235-5259`), so ceremony commits can satisfy
  both Check 26 and Check 35 via the same review pair without a
  separate per-slice Codex review record.
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
  - `review_file_regex: /^arc-recipe-runtime-substrate-composition-review-(?:claude|codex)\.md$/i`
    (arc-bound subset of `ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN`,
    matching exactly the two prong files).
- The audit-test surface that covers `ARC_CLOSE_GATES` gains
  assertions for the new entry: gate fires at the ceremony slice
  marker; regex matches both prong files; regex does not match
  per-slice review records. Slice D's audit-test updates cover BOTH
  `ARC_CLOSE_GATES` entry behavior (Check 26) AND Check 35
  arc-subsumption-shape acceptance for the new prong filenames.
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

- **`WorkflowPrimitive` field count.** Strictly advances by 1 in
  Slice A (`protocol_version`). No regression.
- **`WorkflowRecipe` field count.** Strictly advances by 1 in
  Slice A (`workflow_kind`). No regression.
- **`WorkflowRecipeItem` field count.** Strictly advances by 1 in
  Slice A (`runtime_step`). No regression.
- **Catalog `protocol_version` coverage.** Strictly advances from 0
  catalog entries carrying `protocol_version` to all 15 entries
  carrying it, in Slice A.
- **Recipe `workflow_kind` coverage.** Strictly advances from 0
  recipes carrying typed `workflow_kind` to all registered recipes
  carrying it (currently one: `fix-candidate`).
- **Recipe-item `runtime_step` coverage.** Strictly advances from 0
  recipe items carrying `runtime_step` to all 12 items in the Fix
  recipe carrying it, in Slice A.
- **Recipe-item `runtime_step.checkpoint_policy` coverage on
  checkpoint-execution items.** Strictly advances from 0 to all such
  items in Slice A. (Currently one such item:
  `fix-no-repro-decision`.)
- **Layering invariant assertion.** Strictly advances from 0 to ≥1
  contract-test asserting that no `WorkflowPrimitive` carries
  workflow-specific runtime concretes (`protocol_role`,
  `gate_template`, `checkpoint_policy`, `write_target` and the
  legacy revision-02 names `runtime_gate_template`,
  `checkpoint_template`, `write_slots`).
- **Bridge-time protocol-id composition smoke (full Cartesian).**
  Strictly advances from 0 to ≥1 contract-test asserting that for
  every `WorkflowKind` value AND every recipe-item
  `runtime_step.protocol_role` value, the composed string
  `'${workflow_kind}-${protocol_role}@v${primitive.protocol_version}'`
  parses against the runtime `ProtocolId` brand.
- **WorkflowKind slug-shape drift assertion.** Strictly advances
  from 0 to ≥1 contract-test asserting every key in
  `WORKFLOW_KIND_CANONICAL_SETS` satisfies `/^[a-z][a-z0-9-]*$/`
  (E25 fold-in).
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
6. **Prerequisite arc parse-layer widening must be live in code at
   close time.** The prerequisite arc plan
   (`specs/plans/runtime-checkpoint-artifact-widening.md`, status
   challenger-cleared, revision 04, base_commit
   `190122d00ba47a0fe34caef2a2a1d28128b585e5`) prescribes a Slice A
   widening that this arc's close gate requires to be in effect on
   disk before substrate close. At substrate close time, verify on
   disk that: (a) the `Step` superRefine block at
   `src/schemas/step.ts:176-191` reflects the widened shape per the
   prerequisite arc's §5 (the `'build.brief@v1'` allowlist gate is
   dropped while the precondition coupling is preserved), AND
   (b) the prerequisite arc's Workflow-level `it(...)` proof in
   `tests/contracts/schema-parity.test.ts` is committed and green
   under `npm run verify` (asserting that `Workflow.safeParse(...)`
   succeeds for a minimal Workflow whose checkpoint step carries
   `writes.artifact = {schema: 'fix.no-repro-decision@v1', path: 'artifacts/fix/no-repro-decision.json'}`
   with no `policy.build_brief`). At the time of substrate revision
   09 authoring (slice-156i HEAD), neither (a) nor (b) is yet live
   in code: `src/schemas/step.ts:176-191` still rejects any non-
   `build.brief@v1` checkpoint artifact schema, and
   `tests/contracts/schema-parity.test.ts:560-610` still contains
   only the pre-widening Step-level negative test. Without this
   precondition holding at close time, the §5 binding rule
   "Write-target concretes" parse-acceptance claim for checkpoint
   items is false and substrate F2 cannot be honestly closed. This arc cannot be honestly closed until
   criterion 6 holds; the bridge-unblock claim (criterion 7)
   remains deferred until criterion 6 holds. (Plan frontmatter
   `status:` lifecycle values are unaffected — `status:` follows
   the ADR-0010 lifecycle: `challenger-pending` →
   `challenger-cleared` → `operator-signoff` → `closed`. The
   prerequisite-arc-Slice-A-live gate is an execution-state
   precondition checked at close time, not a plan-lifecycle status
   value.)
7. The compiled-recipe-runtime-bridge plan is unblocked: revision 03
   takes this arc's closing commit as its `base_commit`. The bridge
   plan retains its `prior_challenger_passes` chain and re-dispatches
   Codex challenger against revision 03. Per criterion 6, the
   bridge unblock is contingent on the prerequisite arc Slice A
   being live in code; the bridge-unblock claim remains deferred
   until criterion 6 holds.
