---
contract: config
status: ratified-v0.1
version: 0.1
schema_source: src/schemas/config.ts
last_updated: 2026-04-20
depends_on: [ids, selection-policy, adapter, step]
artifact_ids:
  - config.root
  - config.layered
  - config.circuit-override
invariant_ids: [CONFIG-I1, CONFIG-I2, CONFIG-I3, CONFIG-I4, CONFIG-I5, CONFIG-I6, CONFIG-I7, CONFIG-I8]
property_ids: [config.prop.surplus_keys_rejected_transitively, config.prop.layered_composition_preserves_strictness, config.prop.circuit_override_record_closed_under_workflow_id]
---

# Config Contract

A **Config** is the persisted, layered configuration surface a runner
consumes before any dispatch step executes. The config contract governs
three related surfaces:

1. **`Config`** — the top-level shape a single layer contributes, combining
   `schema_version`, a `DispatchConfig` (see
   `docs/contracts/adapter.md`), a map of per-circuit overrides
   (`CircuitOverride`), and a `defaults` object carrying a
   `SelectionOverride` (see `docs/contracts/selection.md`).
2. **`LayeredConfig`** — the layer-identity wrapper around a `Config`:
   which `ConfigLayer` produced it and (optionally) the source path that
   backs it.
3. **`CircuitOverride`** — the per-workflow slot stored in `Config.circuits`,
   reserving a stable authoring surface for per-circuit selection tweaks.

The contract answers: what must be true of a `Config`, a `LayeredConfig`,
and a `CircuitOverride` for config composition to be structurally sound,
surplus-key-safe, and independently auditable before dispatch begins?

## Scope

This contract covers the **static shape** each config layer contributes.
It does NOT cover:

- Layer **composition semantics** (right-biased merge order; default <
  user-global < project < invocation). Selection-level composition is
  owned by `docs/contracts/selection.md` SEL-I5..I8; config-file
  composition for non-selection fields (e.g. merging two layers'
  `dispatch.roles` maps) is reserved for v0.2 with an explicit ADR.
- **Discovery and load semantics** beyond the canonical runtime path.
  Slice 86 adds the product loader for `~/.config/circuit-next/
  config.yaml` and current-working-directory `.circuit/config.yaml`, but this
  contract still governs the parsed shape after load. Broader discovery
  policy (alternate filenames, upward project-root search, TOML/JSON
  variants, and recovery UX) remains outside this static shape contract.
- **Dispatch resolution** inside `DispatchConfig` (precedence and
  registry closure). Those live in `docs/contracts/adapter.md`
  (ADAPTER-I7/I8).
- **Selection override shape** inside `Config.defaults.selection` and
  `CircuitOverride.selection`. That shape is owned by
  `docs/contracts/selection.md` (SEL-I1..I4).

## Ubiquitous language

See `specs/domain.md#configuration-vocabulary` for canonical definitions
of **Config layer**, **Selection layer**, **Selection override**, and
**Resolved selection**. This contract binds to the existing vocabulary
and does not introduce new terms.

The distinction to keep straight: a **`Config`** is a single layer's
parsed record (e.g. the contents of a user-global YAML file after
parsing and schema validation). A **`LayeredConfig`** is a `Config`
tagged with its provenance — which layer it came from and (optionally)
what path on disk it was loaded from. A merged effective configuration
at dispatch time is NOT a `LayeredConfig`; it is the composition of
several `LayeredConfig`s into (a) a `ResolvedSelection` (per selection
contract) and (b) a resolved `DispatchConfig` (per adapter contract).
The v0.1 Config contract governs each layer's shape, not the merge.

## Invariants

The runtime MUST reject any `Config`, `LayeredConfig`, or
`CircuitOverride` that violates these. All invariants are enforced via
`src/schemas/config.ts`; tested in
`tests/contracts/schema-parity.test.ts`.

- **CONFIG-I1 — `Config` rejects surplus keys at parse time (`.strict()`).**
  A top-level authorial typo like `defuults: {...}` or `dispath: {...}`
  is rejected by Zod rather than silently stripped. Silent stripping
  turns the author's intent (e.g. "set the default skills for all
  circuits") into an empty defaults object whose absence shows up far
  from the typo — typically as a surprising model/effort/skills choice
  during dispatch. Rejecting at parse time points the operator at the
  typo directly (`[schema_version, defuults]: unrecognized key`).
  Enforced at `src/schemas/config.ts` via `.strict()` on the top-level
  `Config` `z.object`.

- **CONFIG-I2 — `LayeredConfig` rejects surplus keys at parse time
  (`.strict()`).** The layer wrapper has exactly three fields (`layer`,
  `source_path`, `config`); a fourth field (`origin`, `checksum`,
  etc.) is a schema change, not a silent add. Future ledger fields
  require an ADR. Enforced at `src/schemas/config.ts` via `.strict()`
  on the `LayeredConfig` `z.object`.

- **CONFIG-I3 — `CircuitOverride` rejects surplus keys at parse time
  (`.strict()`).** A per-circuit slot admits only the documented
  override fields (currently `selection`, with `skills` already removed
  per Codex HIGH #5 fold-in on the adapter contract). A typo or an
  attempt to smuggle a new override category through a circuit slot
  without going through the contract is rejected. Enforced at
  `src/schemas/config.ts` via `.strict()` on the `CircuitOverride`
  `z.object`.

- **CONFIG-I4 — Nested `Config.defaults` rejects surplus keys at parse
  time (`.strict()`).** The `defaults` object is a nested record whose
  only field at v0.1 is `selection?: SelectionOverride`. Surplus keys
  at this nesting level (`defaults: {selections: {...}}` with a plural
  typo) are rejected, not stripped. Without CONFIG-I4, a plural typo
  would silently produce an empty `defaults.selection`, which composes
  into every circuit's selection resolution as "no default override"
  instead of the author's intended defaults. Enforced at
  `src/schemas/config.ts` via `.strict()` on the nested `defaults`
  `z.object`.

- **CONFIG-I5 — `ConfigLayer` is a closed 4-variant enum.** The enum
  is the frozen tuple `['default', 'user-global', 'project',
  'invocation']`. The four layers are the persistence-plus-invocation
  set that config-file composition adjudicates over. Adding a fifth
  layer (e.g. `environment`, `remote`) requires an ADR because the
  precedence order documented in `specs/domain.md#configuration-vocabulary`
  and the `ConfigLayer` enum must evolve together. Enforced at
  `src/schemas/config.ts` (`ConfigLayer = z.enum([...])`).

- **CONFIG-I6 — `Config.schema_version` is `z.literal(1)`; the parser
  refuses any other version at v0.1.** The schema version is a
  forward-compatibility hook reserved for future breaking changes to
  the `Config` shape. At v0.1, only version `1` is accepted. An
  operator config file declaring `schema_version: 2` is rejected at
  parse time with a clear error; attempting to parse it as v1 would
  produce latent divergence between the file's intent and the runtime
  behavior. Future bumps require an ADR. Enforced at
  `src/schemas/config.ts` via `z.literal(1)`.

- **CONFIG-I7 — Bare `{schema_version: 1}` produces a fully-populated
  default `Config` via schema-level `.default(...)` on every
  non-version field.** `dispatch`, `circuits`, and `defaults` all
  carry schema-level defaults (`DispatchConfig` defaults to
  `{default: 'auto', roles: {}, circuits: {}, adapters: {}}`;
  `circuits` defaults to `{}`; `defaults` defaults to `{}`). This
  preserves the existing ergonomic: a minimal operator config file
  that sets only the schema version parses successfully and produces
  a reasonable runtime configuration. Without CONFIG-I7, a
  minimal-config ergonomic would collide with CONFIG-I1's strictness
  (the parser would accept no surplus keys but also reject the bare
  form). The two are reconciled by schema-level defaults on required
  fields. Enforced at `src/schemas/config.ts` via `.default(...)` on
  `dispatch`, `circuits`, and `defaults`.

- **CONFIG-I8 — `Config.circuits` keys are `WorkflowId`s at parse time
  (closes Codex MED #5 fold-in).** `Config.circuits` is typed
  `z.record(WorkflowId, CircuitOverride)`. A record whose key fails
  `WorkflowId`'s regex (e.g. `"Bad Id"` with a space, `"workflow/"`
  with a slash) is rejected at parse time, not at dispatch time —
  which would be deep inside a Run after a partial-progress event
  log. A record whose key matches the regex but references a workflow
  not installed in the catalog at dispatch time is LEGAL (per-circuit
  overrides for not-yet-installed workflows are allowed — same
  posture as `DispatchConfig.circuits` per ADAPTER-I8 closure notes).
  Catalog-closure of the `WorkflowId` against installed workflows is
  NOT enforced at v0.1. Enforced at `src/schemas/config.ts` via
  `z.record(WorkflowId, ...)`; tested as schema parity rather than
  as a property because negative cases are cheap to pin without a
  fuzzing harness.

## Pre-conditions

- A `Config` is produced by parsing one layer's on-disk YAML (or
  in-memory invocation argv projection) into an object and passing it
  to `Config.safeParse`. Slice 86 product discovery currently loads only
  the user-global and current-working-directory project files; default and
  invocation layers are schema/resolver-supported inputs for callers that
  inject them directly until later product wiring lands.
- A `LayeredConfig` is produced by wrapping a parsed `Config` with its
  layer identity and (optionally) its source path, then passing the
  wrapper to `LayeredConfig.safeParse`.
- A `CircuitOverride` is produced only as a value inside
  `Config.circuits`; direct consumers parse it transitively through
  `Config.safeParse`.
- Layer composition (merging multiple `LayeredConfig`s into effective
  values at dispatch time) is out of scope for v0.1; see Scope above.

## Post-conditions

After a `Config` is accepted:

- `schema_version === 1` (CONFIG-I6).
- `dispatch` satisfies `DispatchConfig` invariants
  (`docs/contracts/adapter.md` ADAPTER-I1..ADAPTER-I11).
- `circuits` is a record whose keys are `WorkflowId`s and whose values
  are `CircuitOverride`s.
- `defaults.selection` (when present) is a `SelectionOverride` per
  `docs/contracts/selection.md` SEL-I1..SEL-I4.
- No surplus keys in any **declared object shape** under this
  contract's ownership (CONFIG-I1 + CONFIG-I4) or under delegated
  contracts' ownership (ADAPTER-I9 transitivity + SEL-I8 nested
  strictness on `SelectionOverride`). Strictness applies to declared
  object shapes (e.g. `Config`, `LayeredConfig`, `defaults`,
  `CircuitOverride`, `DispatchConfig`, `SelectionOverride`). It does
  NOT apply to **open record/data-map values** by design:
  `Config.circuits`, `DispatchConfig.roles`, `DispatchConfig.circuits`,
  `DispatchConfig.adapters`, and `SelectionOverride.invocation_options`
  are validated `z.record(...)` maps — their keys are shape-validated
  (e.g. by `WorkflowId` or `AdapterName`) and their values by the
  element schema, but additional string-keyed entries are the
  intended data shape, not surplus keys. A regression pair pinned
  this distinction: a typo inside `SelectionOverride` (e.g.
  `defaults.selection.rigr`) is rejected; an author-chosen adapter
  passthrough value (`defaults.selection.invocation_options.my_adapter_knob`)
  is accepted. Closes Codex MED #4 fold-in.

After a `LayeredConfig` is accepted:

- `layer` is one of the four `ConfigLayer` variants (CONFIG-I5).
- `source_path`, when present, is a string (v0.1 does not constrain
  the string to a valid filesystem path; path resolution is a
  dispatch-time runtime concern covered by Phase 2).
- `config` satisfies every `Config` post-condition above.
- No surplus keys at the wrapper level (CONFIG-I2).

After a `CircuitOverride` is accepted:

- `selection` (when present) is a `SelectionOverride`.
- No surplus keys (CONFIG-I3). Specifically, the v0.0 drafting's
  top-level `skills?: string[]` shortcut is rejected at this slice
  (already removed in Codex HIGH #5 fold-in on the adapter contract;
  this contract codifies the removal).

## Property ids (reserved for Phase 2 testing)

- `config.prop.surplus_keys_rejected_transitively` — For any valid
  `Config` and any path into the config tree into a **declared object
  shape** at which a surplus key is injected (top-level `Config`,
  `LayeredConfig` wrapper, `defaults`, `CircuitOverride`,
  `DispatchConfig`, `SelectionOverride`), the parser rejects the
  injection. Property fuzzes over key names that resemble typos of
  legal keys (edit distance 1-2) to catch any nesting level that was
  missed by drafter attention. Open record/data-map values
  (`Config.circuits`, `DispatchConfig.roles`/`.circuits`/`.adapters`,
  `SelectionOverride.invocation_options`) are OUT of scope for this
  property by construction (Codex MED #4 fold-in).

- `config.prop.layered_composition_preserves_strictness` — When
  multiple `LayeredConfig`s are composed per the documented
  precedence vocabulary in `specs/domain.md#configuration-vocabulary`,
  the composed record still rejects surplus keys at every declared
  object shape. A surplus key present in any contributing layer
  taints the composed view. The property is deliberately named
  **composition** rather than **right-biased merge** because
  selection-layer projection IS right-biased (per
  `docs/contracts/selection.md` SEL-I5..I8) but non-selection
  config-file composition (merging two layers' `dispatch.roles`
  maps, for instance) is still ADR-pending at v0.2. The strictness
  claim holds under any composition semantics that preserves
  declared-object parse legality. Property fuzzes over layer shuffles
  and surplus-key injections at each layer. Closes Codex MED #3
  fold-in.

- `config.prop.circuit_override_record_closed_under_workflow_id` —
  Every key in `Config.circuits` is a valid `WorkflowId` per
  `src/schemas/ids.ts`. A record key that matches the `WorkflowId`
  regex but references a workflow not installed in the catalog at
  dispatch time is LEGAL (per-circuit overrides for
  not-yet-installed workflows are allowed — same posture as
  `DispatchConfig.circuits` per ADAPTER-I8 closure notes). The
  property constrains only key shape, not catalog closure. Note that
  CONFIG-I8 (added in the Slice 26 Codex fold-in) already pins the
  key-shape enforcement at the schema-parity level; this property
  adds fuzzing breadth rather than changing the guarantee.

## Cross-contract dependencies

- **adapter** (`src/schemas/adapter.ts`, `docs/contracts/adapter.md`) —
  `Config.dispatch` is a `DispatchConfig`, which owns
  ADAPTER-I1..ADAPTER-I11. The adapter contract's strictness-
  transitivity (ADAPTER-I9) composes with CONFIG-I1 at parse time:
  a surplus key inside `dispatch.roles.researcher` is rejected by
  ADAPTER-I9; a surplus key at `dispatch` itself is rejected by
  ADAPTER-I9 on `DispatchConfigBody`; a surplus key at the `Config`
  root is rejected by CONFIG-I1. The three strictness layers
  compose without gap.

- **selection-policy** (`src/schemas/selection-policy.ts`,
  `docs/contracts/selection.md`) — `Config.defaults.selection`
  (when present) and `CircuitOverride.selection` (when present) are
  `SelectionOverride`s. Selection-layer invariants (SEL-I1..SEL-I4)
  apply. The `default` selection layer in the 7-tuple
  precedence (`default < user-global < project < workflow < phase <
  step < invocation`) is sourced from `Config.defaults.selection`
  in the `default` `ConfigLayer`; the `user-global` / `project` /
  `invocation` selection layers are sourced from
  `Config.defaults.selection` in the matching `ConfigLayer`. The resolver
  accepts all four config-layer identities when supplied; the current CLI
  product path discovers only user-global/project YAML and does not yet
  expose plugin default discovery or per-command invocation selection flags.
  This cross-contract mapping between ConfigLayer and SelectionLayer is
  documented in `specs/domain.md#configuration-vocabulary`. Slice 85
  adds the runtime selection resolver for already-loaded layers; Slice
  86 wires the product CLI to produce user-global/project layers from
  the canonical YAML paths. Additional discovery policy remains outside
  this config shape contract.

- **workflow** (`src/schemas/workflow.ts`) — `Config.circuits` is
  keyed on `WorkflowId`, so workflow existence is a soft
  precondition for per-circuit override. As with
  `DispatchConfig.circuits`, the config contract does NOT enforce
  that every `Config.circuits[workflow_id]` key corresponds to an
  installed workflow. Per-circuit overrides for un-installed
  workflows are legal (they describe how selection should compose
  IF that workflow runs).

- **ids** (`src/schemas/ids.ts`) — `WorkflowId` is the key-type for
  `Config.circuits`. Key-shape validation is delegated to that
  primitive.

- **step** (`src/schemas/step.ts`) — `DispatchRole` (declared there)
  is used transitively by `Config.dispatch.roles`; out of this
  contract's direct scope but noted so the dependency graph is
  complete.

## Failure modes (carried from evidence)

- `carry-forward:config-surface-shadow` — Prior to this slice, the
  config surface (`Config`, `ConfigLayer`, `LayeredConfig`,
  `CircuitOverride`) had no contract and no `config.*` artifact row
  in `specs/artifacts.json`. The `adapter.registry` artifact
  shadowed it by claiming broad schema exports including
  `Config`/`ConfigLayer`/`LayeredConfig`, which let authority-graph
  audit pass green even though the config surface was un-contracted.
  Closed by this slice via (a) authoring this contract, (b) adding
  `config.root` / `config.layered` / `config.circuit-override` rows
  to `specs/artifacts.json`, and (c) narrowing `adapter.registry`'s
  `schema_exports` to adapter-dispatch primitives only. Root-cause
  ancestor: `specs/reviews/arc-phase-1-close-codex.md#HIGH-3`.

- `carry-forward:surplus-key-silent-strip-config` — Prior to this
  slice, neither `Config` nor `LayeredConfig` was `.strict()`. An
  authorial typo at either level (e.g. `defuults: {...}` under
  `Config`, `souce_path: '...'` under `LayeredConfig`) silently
  stripped the typed'd field, producing a minimal-valid parse whose
  runtime behavior diverged from operator intent far from the typo.
  Closed by CONFIG-I1 + CONFIG-I2 + CONFIG-I4's transitive
  `.strict()`. The adapter-side analog
  `carry-forward:surplus-key-silent-strip-dispatch` (closed by
  ADAPTER-I9) is the sibling failure; CONFIG-I1 reaches the
  un-covered layer above it.

- `carry-forward:circuit-override-unconstrained-shape` — Prior to
  Codex HIGH #5 fold-in on the adapter contract, `CircuitOverride`
  carried a top-level `skills?: string[]` shortcut that bypassed
  `SelectionOverride.skills` (a typed `SkillOverride` discriminated
  union). The shortcut was removed; this contract codifies the
  removal as CONFIG-I3's strict-key rejection. Any attempt to
  reintroduce `CircuitOverride.skills` (or an analogous bypass) is
  caught at parse time.

## Evolution

- **v0.1 (this slice)** — CONFIG-I1..CONFIG-I8 enforced at the schema
  layer. Closes `specs/reviews/arc-phase-1-close-codex.md#HIGH-3`
  (config surface shadow). Closes `FUP-2` (Config and LayeredConfig
  missing `.strict()` at `src/schemas/config.ts:115` and `:135`) per
  `specs/plans/phase-1-close-revised.md` §Slice 26. **Codex
  adversarial property-auditor pass 2026-04-20** produced opening
  verdict REJECT on the contract-review linkage gate with 1 HIGH +
  4 MED + 1 LOW. All six objections folded in directly before commit
  (no deferrals to v0.2). Full fold-in record at
  `specs/reviews/config-md-v0.1-codex.md`. Final verdict chain:
  `REJECT → incorporated → ACCEPT (after fold-in)`.

  Schema-level landings for this slice:
  - `.strict()` added to the top-level `Config` `z.object` (CONFIG-I1).
  - `.strict()` added to the `LayeredConfig` `z.object` (CONFIG-I2).
  - `.strict()` added to the nested `defaults` object inside `Config`
    (CONFIG-I4).
  - `CircuitOverride` already carried `.strict()` pre-slice (Codex
    HIGH #5 fold-in on adapter contract); this contract codifies the
    posture as CONFIG-I3 so regression flags a named invariant.
  - CONFIG-I8 added (Codex MED #5 fold-in) — `Config.circuits` key
    shape enforced at parse time via `z.record(WorkflowId, ...)`;
    positive + negative schema-parity tests pin the guarantee.
  - `adapter.registry` `schema_exports` in `specs/artifacts.json`
    narrowed to `["DispatchConfig", "AdapterReference"]`; the other
    four prior entries (`Config`, `ConfigLayer`, `LayeredConfig`,
    `CircuitOverride`) rehome to the new `config.*` rows.
  - `pending_rehome` block removed from `adapter.registry`.

  Prose tightenings (Codex fold-ins):
  - Post-condition "no surplus keys at any nested level" qualified to
    "no surplus keys in any **declared object shape**"; open
    record/data-map values (`Config.circuits`,
    `DispatchConfig.roles`/`.circuits`/`.adapters`,
    `SelectionOverride.invocation_options`) explicitly out of scope
    (Codex MED #4).
  - The draft's layered-merge "right-biased preserves strictness"
    property renamed to
    `config.prop.layered_composition_preserves_strictness` so the
    property wording does not commit to a composition semantics the
    Scope section says is ADR-pending (Codex MED #3).
  - Pinned artifact-authority test extended to assert exact
    `schema_exports` equality for `config.root`, `config.layered`,
    and `config.circuit-override` (Codex MED #2).
  - CONFIG-I7 default-layer ergonomic probe added: a `LayeredConfig`
    with `layer: "default"` and `config: {schema_version: 1}` parses
    through and produces all expected defaults on
    `dispatch.default`/`.roles`/`.circuits`/`.adapters`, `circuits`,
    and `defaults` (Codex LOW #6).

- **v0.2 (Phase 1)** — Ratify `property_ids` above by landing the
  corresponding property-test harness at
  `tests/properties/visible/config/`. Decide whether layer
  composition semantics (the merge resolver across multiple
  `LayeredConfig`s) belongs to this contract or to a new
  `docs/contracts/config-composition.md`. Precedent suggests
  separate: adapter composition lives in adapter.md only through
  `DispatchConfig.superRefine`; selection composition lives in
  `selection.md` through `SelectionResolution`. Config-file
  composition (non-selection fields) is a distinct surface — v0.2
  decides whether to split.

- **v1.0 (Phase 2)** — Ratified invariants + property tests. Slice 86
  lands the first runtime discovery/load layer for canonical user-global
  and current-working-directory project YAML files. Discovery invariants beyond that narrow loader
  (alternate file locations, upward root search, path-traversal safety,
  and richer recovery UX) land in a Phase 2 runtime-boundary contract,
  not this shape contract.
