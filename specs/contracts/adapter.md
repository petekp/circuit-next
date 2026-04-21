---
contract: adapter
status: ratified-v0.1
version: 0.1
schema_source: src/schemas/adapter.ts
last_updated: 2026-04-19
depends_on: [ids, step, selection-policy]
enforces_also_in: [src/schemas/config.ts, src/schemas/event.ts]
codex_adversarial_review: specs/reviews/adapter-md-v0.1-codex.md
artifact_ids:
  - adapter.registry
  - adapter.reference
  - adapter.resolved
invariant_ids: [ADAPTER-I1, ADAPTER-I2, ADAPTER-I3, ADAPTER-I4, ADAPTER-I5, ADAPTER-I6, ADAPTER-I7, ADAPTER-I8, ADAPTER-I9, ADAPTER-I10, ADAPTER-I11]
property_ids: [adapter.prop.custom_command_direct_exec_semantics, adapter.prop.custom_command_environment_isolation, adapter.prop.registry_closure_preserved_under_config_merge, adapter.prop.reserved_name_disjointness_across_layer_merge, adapter.prop.resolution_is_total_and_first_match_wins, adapter.prop.resolved_from_agrees_with_resolution]
---

# Adapter Contract

An **Adapter** is the dispatch target a `DispatchStep` executes against at
run time. The adapter contract governs three related surfaces:

1. **Adapter identity** — `BuiltInAdapter`, `AdapterName`, and
   `CustomAdapterDescriptor`, which together name every dispatchable
   executor.
2. **Adapter references** — `AdapterRef` and `AdapterReference`, which
   spell how steps, roles, circuits, and the default refer to an adapter
   without re-declaring its shape at every reference site.
3. **Dispatch resolution** — the total ordered precedence that picks a
   concrete adapter for a step at dispatch time, plus the in-event
   provenance record (`DispatchStartedEvent.resolved_from`) that makes
   the choice auditable after the fact.

The contract answers: what must be true of an adapter name, a custom
descriptor, an adapter reference, and a dispatch resolution record for
the dispatch layer to be structurally sound, name-space-safe, and
independently auditable?

## Ubiquitous language

See `specs/domain.md#dispatch-vocabulary` for canonical definitions of
**Adapter**, **AdapterRef**, **Role**, and **Dispatch resolution**. Do
not introduce synonyms; new vocabulary must land in `specs/domain.md`
before use here. This slice adds the entry **AdapterName** (as a regex-
constrained slug, reserved-name-disjoint from `BuiltInAdapter`), the
entry **Custom adapter descriptor** (a registered executor with an
argv command vector), and the entry **Dispatch resolution source** (the
category-plus-disambiguator record emitted on every `DispatchStartedEvent`)
to `specs/domain.md`.

The distinction to keep straight: an **adapter** is the executor that
runs a worker (Claude Code Agent tool subagent, Codex CLI, custom
operator-authored command). An **adapter reference** is what a config
file or step carries pointing AT an adapter. `AdapterRef` (in
`src/schemas/adapter.ts`) is the full 3-variant union that admits an
inline `CustomAdapterDescriptor`; `AdapterReference` (in
`src/schemas/config.ts`) is the 2-variant union used inside
`dispatch.roles` and `dispatch.circuits` that REFUSES inline custom
descriptors and requires registration via `dispatch.adapters[name]`
instead. The asymmetry is intentional (ADAPTER-I5).

## Invariants

The runtime MUST reject any `BuiltInAdapter`, `AdapterName`,
`CustomAdapterDescriptor`, `AdapterRef`, `AdapterReference`,
`DispatchConfig`, or `DispatchStartedEvent.resolved_from` that
violates these. All invariants are enforced via `src/schemas/adapter.ts`
and — for the cross-schema invariants — the schema files named per
invariant; tested in `tests/contracts/schema-parity.test.ts`.

- **ADAPTER-I1 — `BuiltInAdapter` is a closed 3-variant enum with
  declared semantic distinctions; adding a built-in is a breaking
  change.** The enum is the frozen tuple `['agent', 'codex',
  'codex-isolated']`. The three built-ins mean:
  - `agent` — the Claude Code headless CLI (`claude -p` print-mode or
    equivalent), invoked as a **subprocess** of the Node.js runtime per
    ADR-0009 §1 (v0 invocation-pattern decision: subprocess-per-adapter).
    Superseded prior wording described this as "the Claude Code Agent
    tool (same-process)" — that phrasing was SDK-flavored and is replaced
    here to match ADR-0009's subprocess-per-adapter decision. The
    subprocess inherits the operator session's filesystem + environment
    via the parent process but runs as a child `claude` executable,
    not in the host Node process. No `@anthropic-ai/sdk` dep at v0;
    ADR-0009 §4 Check 28 enforces this at package.json level.
  - `codex` — the Codex CLI dispatched via `codex exec` as a
    **subprocess** of the Node.js runtime (same invocation pattern as
    `agent` per ADR-0009 §1) in the operator's current session context.
    Same host session as `agent`; distinct model vendor; distinct
    subprocess.
  - `codex-isolated` — the Codex CLI dispatched as a subprocess in a
    git worktree (or a distinct-UID sandbox once Tier 2+ lands). Same
    subprocess invocation pattern as `codex`; separate filesystem view;
    implementer isolation discipline per CLAUDE.md Hard Invariants #1-#3.
  The three are NOT interchangeable: `codex` and `codex-isolated`
  dispatch to the same binary but under different isolation regimes;
  `agent` dispatches to a different binary entirely. Choosing between
  `codex` and `codex-isolated` is a correctness-of-isolation decision
  (same-filesystem vs separate-worktree), not an ergonomic one.
  Adding a fourth built-in is a schema-level change that forces all
  consumers (`DispatchConfig.default`, `dispatch.roles`,
  `dispatch.circuits`, the adapter-bridge dispatcher, and every
  contract test) to coordinate. Enforced at `src/schemas/adapter.ts`
  (`BuiltInAdapter = z.enum(['agent', 'codex', 'codex-isolated'])`).

- **ADAPTER-I2 — `AdapterName` regex + reserved-name disjointness.**
  `AdapterName` matches `^[a-z][a-z0-9-]*$`: lowercase letter + optional
  lowercase alnum or hyphen. No uppercase (avoids cross-platform
  case-sensitivity issues in registry keys). No leading digit (parses
  cleanly as an identifier in future DSLs). No whitespace. No trailing
  hyphen regex enforcement in v0.1 (cosmetic; v0.2 may add). **Reserved-
  name separation.** A custom adapter key registered in
  `dispatch.adapters[name]` MUST NOT collide with any `BuiltInAdapter`
  enum value NOR the reserved `'auto'` sentinel used by
  `dispatch.default`. A custom adapter named `codex` would silently
  shadow the built-in in `dispatch.default` resolution — it would parse
  successfully under the regex, appear in the registry, and be picked
  up by `default: 'codex'`, producing a behavior divergence the author
  did not intend. v0.1 rejects the collision at parse time in
  `DispatchConfig.superRefine`. Enforced at `src/schemas/adapter.ts`
  (the regex) and `src/schemas/config.ts` (the reservation check).

- **ADAPTER-I3 — `CustomAdapterDescriptor.command` is a non-empty argv
  vector of non-empty strings with a declared calling convention.**
  `command: z.array(z.string().min(1)).min(1)` — at least one element
  and no empty-string elements (an empty argv element would be passed
  to `execve(2)` as an empty argument, which has adapter-specific
  behavior, at best misleading, at worst a silent error). The argv
  form is **direct exec** (`spawn(command[0], command.slice(1).concat([promptFile, outputFile]))`
  or equivalent); no `/bin/sh -c` wrapping; no shell interpolation; no
  `${VAR}` expansion by the dispatcher. **Calling convention.** The
  dispatcher appends two positional arguments `PROMPT_FILE` and
  `OUTPUT_FILE` to `command` at invocation time; the adapter reads its
  prompt from `PROMPT_FILE` and writes its single-string response to
  `OUTPUT_FILE`. The adapter's exit code distinguishes success (0)
  from failure (non-zero); failure semantics are Phase 2. This is the
  contract every custom adapter must satisfy. Enforced at
  `src/schemas/adapter.ts`.

  **Scope caveat — cwd, env, path resolution, timeouts, and stdin
  semantics are Phase 2 (closes Codex LOW #9).** v0.1 deliberately
  does not specify: (a) whether `command[0]` may be relative, and if
  so what `PATH` lookup applies; (b) whether the adapter inherits
  the operator's `cwd` or the run's worktree; (c) whether environment
  variables are inherited, filtered, or augmented; (d) whether
  `stdin` is attached, closed, or piped with the prompt; (e) timeout
  enforcement. These are dispatcher-side runtime decisions that
  depend on the implementer-isolation regime (same-process vs
  worktree vs sandbox), which itself is Tier 2+ per CLAUDE.md Hard
  Invariants. The v0.1 contract constrains only the **structural
  shape** of `command`: non-empty argv of non-empty strings, direct
  exec, positional PROMPT_FILE/OUTPUT_FILE appended. The Phase 2
  property `adapter.prop.custom_command_direct_exec_semantics` plus
  a new property `adapter.prop.custom_command_environment_isolation`
  (to be authored in v0.2) will ratify the runtime policy.

- **ADAPTER-I4 — `AdapterRef` is a 3-variant discriminated union with
  transitive `.strict()`.** The variants are `BuiltInAdapterRef`
  (`{kind: 'builtin', name: BuiltInAdapter}`), `NamedAdapterRef`
  (`{kind: 'named', name: AdapterName}`), and `CustomAdapterDescriptor`
  (`{kind: 'custom', name: AdapterName, command: string[]}`). Each
  variant is `.strict()` so surplus keys (authorial typos like
  `{kind: 'named', names: 'gemini'}`) are rejected at parse time, not
  silently stripped. The discriminant is `kind`; the union uses
  `z.discriminatedUnion` so a malformed `kind` fails fast with a
  clear error path. This union is the full adapter-identity surface;
  it shows up in `DispatchStartedEvent.adapter` and as the runtime
  value the dispatcher calls. Enforced at `src/schemas/adapter.ts`.

- **ADAPTER-I5 — `AdapterReference` (registry-layer reference) refuses
  inline custom descriptors; every custom adapter MUST be registered.**
  `AdapterReference` (in `src/schemas/config.ts`) is the 2-variant
  discriminated union `{kind: 'builtin', name: BuiltInAdapter} |
  {kind: 'named', name: AdapterName}`. It is the type used inside
  `DispatchConfig.roles` and `DispatchConfig.circuits`. Inline
  `CustomAdapterDescriptor` is NOT a legal `AdapterReference`.
  **Rationale.** If `dispatch.roles` and `dispatch.circuits` could
  inline descriptors, three problems arise: (1) the same adapter
  might be defined differently in three places and the dispatcher
  would have no canonical definition to audit; (2) registry-closure
  checks (ADAPTER-I8) become impossible because there is no single
  registry; (3) operator-facing adapter lists (`circuit list adapters`
  in Phase 2) can't enumerate adapters that only appear inline. Custom
  adapters MUST be registered in `dispatch.adapters` exactly once and
  referenced by name thereafter. The asymmetry with `AdapterRef`
  (which DOES admit inline custom descriptors) is load-bearing:
  `AdapterRef` is the runtime value the dispatcher resolves TO;
  `AdapterReference` is what config files contain POINTING AT an
  adapter. Enforced at `src/schemas/config.ts` via `.strict()`
  discriminated-union with no `custom` variant.

- **ADAPTER-I6 — `DispatchRole` is a closed 3-variant enum; orchestrator
  is rejected.** The enum is `['researcher', 'implementer', 'reviewer']`.
  `orchestrator` is an **executor** (per step.ts / step.md STEP-I1), not
  a role; attempting to register `dispatch.roles.orchestrator = ...`
  is a schema error because `orchestrator` is not a legal record key
  under `z.record(DispatchRole, ...)`. This mirrors Step's executor-vs-
  role distinction and prevents the category confusion the existing
  Circuit carries. Enforced at `src/schemas/step.ts` (definition) and
  `src/schemas/config.ts` (consumer).

- **ADAPTER-I7 — Dispatch resolution precedence is total, ordered, and
  its category + disambiguator is recorded in
  `DispatchStartedEvent.resolved_from`.** The precedence order at
  dispatch time (top wins, first match returns):
  1. **Explicit** — the operator passed `--adapter <ref>` at
     invocation; the flag's value is the `AdapterRef` used.
  2. **Role** — the step has a `DispatchRole` and
     `DispatchConfig.roles[role]` is present; its `AdapterReference`
     is resolved (via `dispatch.adapters` if named).
  3. **Circuit** — `DispatchConfig.circuits[workflow_id]` is present;
     its `AdapterReference` is resolved similarly.
  4. **Default** — `DispatchConfig.default` is consulted. If the
     default is a `BuiltInAdapter` name or a registered
     `AdapterName`, dispatch uses it directly. If the default is the
     sentinel `'auto'`, dispatch defers to the auto-detect heuristic
     (Phase 2 — the heuristic uses the step's `role` and the
     available built-ins to pick).
  5. **Auto** — the Phase 2 heuristic selects.

  The resolution record emitted on every `DispatchStartedEvent` is
  `resolved_from: DispatchResolutionSource`, a discriminated union
  whose `source` discriminant names the winning precedence category
  and carries the disambiguator identifying *which* entry within the
  category contributed:
  - `{source: 'explicit'}`
  - `{source: 'role', role: DispatchRole}`
  - `{source: 'circuit', workflow_id: WorkflowId}`
  - `{source: 'default'}`
  - `{source: 'auto'}`

  The discriminated union closes the category-only-provenance gap
  pre-emptively (same shape as SEL-I7's `applied[]` entries for
  selection). An audit reading `DispatchStartedEvent.resolved_from`
  can identify the winning precedence category and — for the `role`
  and `circuit` categories — the exact role/workflow entry that won;
  the v0.1 drafting's flat `z.enum` could identify only the
  *category*. Enforced at `src/schemas/event.ts`; the union itself
  is exported from `src/schemas/adapter.ts` as
  `DispatchResolutionSource`.

  **Scope caveat — default/explicit/auto provenance is singleton by
  design (closes Codex MED #6 at the prose layer).** `{source:
  'default'}`, `{source: 'explicit'}`, and `{source: 'auto'}` carry
  no disambiguator at v0.1. For `default`, this is because the
  applied `default` on a merged Config is a single composed value
  — which config *layer* (user-global, project, invocation)
  contributed the winning `default` is lost after the layer merge
  (`src/schemas/config.ts`). Adding a `layer: ConfigLayer` field is
  a v0.2 consideration driven by real audit needs. For `explicit`,
  the original `--adapter` CLI token is recoverable from the
  invocation event elsewhere in the run log; promoting it onto
  `resolved_from` would duplicate provenance that already exists
  out-of-band. For `auto`, the heuristic does not exist yet (Phase
  2); promoting a `heuristic_id`/`rationale` field now would be
  speculative. v0.2 revisits all three based on evidence from real
  runs. The contract does NOT claim these three identify the
  specific config layer or heuristic branch that won at v0.1.

  **Role ↔ resolved_from.role binding (closes Codex HIGH #4).** On a
  `DispatchStartedEvent`, when `resolved_from.source === 'role'`, the
  event's `role` field MUST equal `resolved_from.role`. An event with
  `role: 'researcher'` paired with `resolved_from: {source: 'role',
  role: 'reviewer'}` parses each field independently but violates
  the role-provenance binding. Enforced at `src/schemas/event.ts`
  via a cross-field `superRefine` at the `Event` discriminated-union
  level (mirrors the `Step` pattern — variants stay plain
  `ZodObject`s so `z.discriminatedUnion` can admit them; cross-field
  refinements hoist to the union).

- **ADAPTER-I8 — Registry closure: every named reference resolves to a
  registered descriptor.** For every `AdapterReference` in
  `DispatchConfig.roles[*]`, `DispatchConfig.circuits[*]`, and for a
  string `DispatchConfig.default` that is neither a `BuiltInAdapter`
  nor the `'auto'` sentinel: the referenced name MUST be a key in
  `DispatchConfig.adapters`. The runtime lookup is therefore total by
  construction. Invalid references fail at PARSE time with a clear
  error path (`['roles', 'researcher']: role adapter not registered:
  gemini`), not at DISPATCH time (which might be deep inside a Run
  after a partial-progress event log). Closure is one-directional: a
  descriptor CAN be registered in `dispatch.adapters` without being
  referenced (it is available for `--adapter` at invocation time or
  for manual dispatch). Enforced at `src/schemas/config.ts` via
  `DispatchConfig.superRefine`.

- **ADAPTER-I9 — Transitive `.strict()` rejection across the dispatch
  surface.** `.strict()` is applied on `DispatchConfigBody` (top-level
  surplus-key rejection), every `AdapterRef` variant, every
  `AdapterReference` variant, every `DispatchResolutionSource` variant,
  and `CustomAdapterDescriptor`. Surplus keys are **rejected**, not
  stripped — a silent strip turns an authorial typo (`{kind: 'named',
  nmae: 'gemini'}`) into a named reference with no name, which then
  fails closure (ADAPTER-I8) with a misleading error far from the
  typo. Rejecting at parse time points the operator at the typo
  directly. Enforced at `src/schemas/adapter.ts`, `src/schemas/config.ts`,
  and `src/schemas/event.ts`.

- **ADAPTER-I10 — A resolved adapter MUST NOT be a pre-resolution
  named reference (closes Codex HIGH #1).** `DispatchStartedEvent.adapter`
  is typed `ResolvedAdapter`, a 2-variant discriminated union of
  `BuiltInAdapterRef` and `CustomAdapterDescriptor`. The
  `NamedAdapterRef` variant (`{kind: 'named', ...}`) is a
  pre-resolution pointer at the `dispatch.adapters` registry; it MUST
  be dereferenced into the registered `CustomAdapterDescriptor` (or
  a `BuiltInAdapterRef` for built-in names) before the dispatcher
  emits a `DispatchStartedEvent`. An event with `adapter: {kind:
  'named', name: 'gemini'}` would mean "we dispatched TO a symbolic
  reference" which is not an executor and is not replay-sufficient.
  Enforced at `src/schemas/adapter.ts` (the `ResolvedAdapter`
  definition) + `src/schemas/event.ts` (the event's `adapter` field
  type).

- **ADAPTER-I11 — Registry key and descriptor `name` must agree
  (closes Codex HIGH #2).** For every entry in
  `DispatchConfig.adapters`, the record key and the embedded
  `descriptor.name` field MUST be equal. `{adapters: {gemini:
  {name: 'ollama', command: [...]}}}` parses syntactically (both
  `gemini` and `ollama` satisfy `AdapterName`) but produces two
  identities for a single registered executor: events would carry
  `adapter.name: 'ollama'` while role/circuit references resolve to
  key `gemini`. An audit could not cross-reference the two without
  inverting the descriptor index. Enforced at `src/schemas/config.ts`
  via `DispatchConfig.superRefine`.

## Pre-conditions

- An `AdapterRef` is produced by parsing a runtime dispatch decision
  (CLI flag, config lookup, or auto-detect) into an object and passing
  it to `AdapterRef.safeParse`.
- A `DispatchConfig` is produced by layering config files (default,
  user-global, project, invocation) per `specs/contracts/config.md`
  (pending Phase 1 close Slice 26; tracked as arc-phase-1-close-codex.md §HIGH #3 correlated-miss) and passing the merged record to `DispatchConfig.safeParse`.
- Every `AdapterName` referenced in a `NamedAdapterRef` or an
  `AdapterReference` (`kind: 'named'`) must exist in the running
  plugin's `dispatch.adapters` registry at load time (ADAPTER-I8 at
  parse time makes this total by construction).
- A `DispatchStartedEvent` is emitted by the dispatcher immediately
  before the adapter spawn; its `adapter: AdapterRef` and
  `resolved_from: DispatchResolutionSource` must agree with the
  resolution the dispatcher performed.

## Post-conditions

After an `AdapterRef` is accepted:

- `kind` is one of `'builtin' | 'named' | 'custom'`.
- `builtin` variant's `name` is a `BuiltInAdapter` enum value.
- `named` variant's `name` is an `AdapterName`; closure is separately
  enforced at the registry layer.
- `custom` variant's `command` is a non-empty argv of non-empty strings.

After a `DispatchConfig` is accepted:

- `adapters` is a record keyed by unique `AdapterName`s, disjoint from
  `BuiltInAdapter` enum values and from the `'auto'` literal (ADAPTER-I2).
- Every named reference in `roles`, `circuits`, and (when named)
  `default` has a corresponding entry in `adapters` (ADAPTER-I8).
- `roles` keys are drawn from the `DispatchRole` enum (ADAPTER-I6).
- No surplus keys at the top level or in any nested adapter-surface
  object (ADAPTER-I9).

After a `DispatchStartedEvent` is accepted:

- `adapter` is a fully-resolved `ResolvedAdapter` (built-in or
  inline custom descriptor), NOT a pre-resolution named reference
  (ADAPTER-I10).
- `resolved_from` is a `DispatchResolutionSource` whose `source`
  discriminant names the winning precedence category and whose
  payload fields (where present — `role` or `workflow_id`) identify
  the exact contributing entry within that category (ADAPTER-I7).
- When `resolved_from.source === 'role'`, the event's `role` field
  equals `resolved_from.role` (ADAPTER-I7 binding).
- **Scope caveat — schema validates shape, not resolver agreement
  (closes Codex HIGH #5).** The v0.1 schema validates the event's
  fields in isolation (and the role binding as a single cross-field
  refinement). It does NOT bind `adapter` to `resolved_from`: an
  event with `adapter: {kind: 'builtin', name: 'codex'}` and
  `resolved_from: {source: 'circuit', workflow_id: 'explore'}`
  parses successfully even if the project config's
  `circuits.explore` override actually pointed at `gemini`. Binding
  `adapter` to `resolved_from` requires the resolver's side of the
  dispatch procedure; it is covered by the Phase 2 property
  `adapter.prop.resolved_from_agrees_with_resolution`. The schema
  is not audit-sufficient at v0.1 — only the pair (schema +
  resolver) is, and the resolver does not exist yet (Phase 2). An
  auditor reading a v0.1 event can reconstruct (a) the category
  and (for role/circuit) the specific entry that won, and (b) the
  resolved executor; they cannot independently verify the two
  agree without the resolver-level property test.

## Property ids (reserved for Phase 2 testing)

- `adapter.prop.resolution_is_total_and_first_match_wins` — For any
  valid `DispatchConfig`, any `step` with any `role`, and any
  `invocation` context, running the resolution procedure produces
  exactly one `AdapterRef` per step; the first matching precedence
  category wins and later categories are ignored. Property fuzzes
  over adversarial role/circuit/default overlap patterns.

- `adapter.prop.resolved_from_agrees_with_resolution` — For any
  dispatch resolution, the `DispatchStartedEvent.resolved_from`
  category matches the precedence category that actually won, and
  its disambiguator (role / workflow_id) matches the config entry
  whose `AdapterReference` was consumed. The "projection is a
  function" analog for dispatch resolution: `adapter` is the
  effective value; `resolved_from` is the provenance trace; they
  must agree.

- `adapter.prop.registry_closure_preserved_under_config_merge` —
  When `Config` layers are merged (default < user-global < project
  < invocation), the merged `DispatchConfig` still satisfies
  ADAPTER-I8 (registry closure). A per-layer merge that introduces
  a role adapter referencing a name registered only in a more-
  specific layer's `adapters` map must be rejected, because the
  merged config at a coarser layer would carry a dangling
  reference. Property fuzzes over layer merges and verifies closure.

- `adapter.prop.custom_command_direct_exec_semantics` — For any
  valid `CustomAdapterDescriptor`, the dispatcher's invocation
  argv is exactly `command ++ [promptFile, outputFile]`, with no
  shell wrapping and no env-var expansion performed by the
  dispatcher. Adversarial cases fuzz command vectors with shell-
  meaningful substrings (`"; rm -rf /"`, `$HOME`, backticks) and
  verify they are passed literally.

- `adapter.prop.reserved_name_disjointness_across_layer_merge` —
  The reservation check (ADAPTER-I2) holds not only within a
  single config layer but after merging layers. A custom adapter
  named `codex` in project config that doesn't collide with a
  user-global layer's adapters would still fail if the merged
  `adapters` record contained both the custom entry and the
  built-in reservation applied to the merged view.

## Cross-contract dependencies

- **step** (`src/schemas/step.ts`) — `DispatchRole` is declared here
  (`z.enum(['researcher', 'implementer', 'reviewer'])`) and consumed
  by `DispatchConfig.roles` and `DispatchStartedEvent.role`. The
  adapter contract constrains how roles are consumed; the step
  contract owns role's existence. Cross-reference
  `specs/contracts/step.md` STEP-I1 for the executor/role distinction.

- **selection-policy** (`src/schemas/selection-policy.ts`) — A step's
  resolved adapter and resolved selection are orthogonal dimensions
  at dispatch time: the adapter determines WHICH executor runs; the
  selection determines WHICH model/effort/skills/invocation_options
  that executor runs WITH. They compose at dispatch. Both are present
  on `DispatchStartedEvent`.

- **event** (`src/schemas/event.ts`) — `DispatchStartedEvent.adapter:
  AdapterRef` and `DispatchStartedEvent.resolved_from:
  DispatchResolutionSource`. The latter is newly promoted to a
  discriminated union in this slice (prior v0.1 drafting used a flat
  `z.enum`; the flat enum cannot identify the specific role/circuit
  that won, and an audit reading the event could not reconstruct the
  chosen adapter's provenance — same gap selection.md closed at
  HIGH #1 with its discriminated-union `applied[]` entries).

- **config** (`src/schemas/config.ts`) — `DispatchConfig.default`,
  `DispatchConfig.roles`, `DispatchConfig.circuits`, and
  `DispatchConfig.adapters` all consume adapter primitives. The
  reservation check (ADAPTER-I2) and closure check (ADAPTER-I8) are
  implemented in `DispatchConfig.superRefine`. Config reorganization
  (layer materialization, merge semantics) is out of scope for this
  contract; see `specs/contracts/config.md` (pending Phase 1 close Slice 26).

- **workflow** (`src/schemas/workflow.ts`) — `DispatchConfig.circuits`
  is keyed on `WorkflowId`, so workflow existence is a soft
  precondition for a circuit-specific adapter override. The adapter
  contract does NOT enforce that every `circuits[workflow_id]` key
  corresponds to an installed workflow; circuit-specific overrides
  for un-installed workflows are legal (they describe how to dispatch
  IF that workflow runs).

- **ids** (`src/schemas/ids.ts`) — `WorkflowId` is used as a
  disambiguator in `DispatchResolutionSource.circuit` variant.

## Failure modes (carried from evidence)

- `carry-forward:dispatch-resolution-folklore` — Prior Circuit
  conflated CLI flag, role, circuit, and default into a single
  imperative resolver function with no structured precedence record.
  Closed by ADAPTER-I7: precedence is documented, total, and the
  winning category is recorded per-dispatch. `specs/evidence.md`
  hard invariant covering dispatch (seam "Adapter/Dispatch") is the
  authoritative ancestor.

- `carry-forward:adapter-name-shadowing` — A custom adapter named
  `codex` in the operator's user-global config file silently shadows
  the built-in `codex` in `dispatch.default` resolution. Closed by
  ADAPTER-I2's reservation check: adapter names are disjoint from
  `BuiltInAdapter` enum values and the `'auto'` sentinel at parse
  time; a collision is a schema error, not a runtime divergence.

- `carry-forward:inline-custom-descriptor-scatter` — When custom
  descriptors could be inlined in roles/circuits, the same adapter
  appeared in three places with three slightly-different commands
  and no single source of truth. Closed by ADAPTER-I5: custom
  descriptors MUST be registered in `dispatch.adapters` and
  referenced by name from roles/circuits.

- `carry-forward:dispatch-provenance-unaudited` — Prior Circuit
  emitted a flat `resolved_from` category enum with no
  disambiguator; an auditor reading `DispatchStartedEvent` could
  tell the RESOLUTION WAS from a role override but not WHICH role,
  and from a circuit override but not WHICH circuit. Closed by
  ADAPTER-I7's `DispatchResolutionSource` discriminated union with
  role/workflow_id disambiguators. The shape deliberately mirrors
  SEL-I7 (selection applied[] entries) so the dispatch and selection
  provenance surfaces stay consistent.

- `carry-forward:argv-shell-wrapping` — A custom-adapter command
  ambiguously interpreted as "shell command" vs "argv vector"
  silently rewrites authored commands under `/bin/sh -c`, enabling
  shell interpolation the author did not intend. Closed by
  ADAPTER-I3: direct exec with positional `PROMPT_FILE OUTPUT_FILE`
  appended; no shell wrapping, no `${VAR}` expansion, no `cmd ; cmd`
  splitting.

- `carry-forward:empty-argv-element-silent-noop` — `command: ['']`
  or `command: ['codex', '']` parsed under v0.0 drafting because
  `z.array(z.string()).min(1)` does not constrain element content.
  An empty argv element is either a bug (authored nothing) or a
  silent gotcha (shell would drop it; `execve` does not).
  Closed by ADAPTER-I3's element-level `.min(1)`.

- `carry-forward:surplus-key-silent-strip-dispatch` — Prior to this
  slice, `DispatchConfigBody` was not `.strict()`. An authorial typo
  in `dispatch.adpaters` (transposition) was silently stripped and
  the intended custom-adapter registry was empty, resulting in a
  registry-closure failure pointed at a named reference that
  "did not exist" (it did — the author spelled it right in the
  reference, wrong in the key). Closed by ADAPTER-I9's transitive
  `.strict()`.

## Evolution

- **v0.1 (this draft)** — ADAPTER-I1..I11 enforced at the schema layer.
  **Codex adversarial property-auditor pass 2026-04-19** produced
  opening verdict REJECT with 5 HIGH + 3 MED + 1 LOW. All 5 HIGH + all
  3 MED + the 1 LOW folded in directly before commit (no deferrals to
  v0.2 except where the deferral itself is named as the resolution —
  MED #6 default-layer provenance and ADAPTER-I3's cwd/env semantics).
  Full fold-in record at `specs/reviews/adapter-md-v0.1-codex.md`.
  Final verdict chain: `REJECT → incorporated → ACCEPT (after fold-in)`.

  Schema-level landings for this slice:
  - `AdapterName` regex already in place; no change.
  - `CustomAdapterDescriptor.command` tightened to
    `z.array(z.string().min(1)).min(1)` (element-level `.min(1)` added).
  - `AdapterReference` in `config.ts` promoted from `z.union` to
    `z.discriminatedUnion` with per-variant `.strict()` AND **exported**
    (Codex MED #8 fold-in).
  - `DispatchConfigBody` gets `.strict()`.
  - `DispatchConfig.superRefine` extended with: reserved-name
    disjointness check (`adapters` key MUST NOT be a `BuiltInAdapter`
    or `'auto'`); own-property-only closure checks using
    `new Set(Object.keys(...))` — fixes the `constructor`/`toString`/
    `hasOwnProperty` bypass via prototype chain (Codex HIGH #3);
    registry-key ↔ descriptor-name parity check (ADAPTER-I11 / Codex
    HIGH #2).
  - `DispatchResolutionSource` added to `src/schemas/adapter.ts` as a
    5-variant discriminated union; `DispatchStartedEvent.resolved_from`
    in `src/schemas/event.ts` retyped from `z.enum([...])` to
    `DispatchResolutionSource`.
  - `ResolvedAdapter` added to `src/schemas/adapter.ts` as a 2-variant
    discriminated union (built-in + custom descriptor);
    `DispatchStartedEvent.adapter` in `src/schemas/event.ts` retyped
    from `AdapterRef` (which admits named references) to
    `ResolvedAdapter` — named references are pre-resolution pointers
    and MUST NOT appear in the event log (ADAPTER-I10 / Codex HIGH #1).
  - `Event` discriminated union wrapped in a cross-variant `superRefine`
    enforcing the `role === resolved_from.role` binding when
    `resolved_from.source === 'role'` (ADAPTER-I7 binding clause /
    Codex HIGH #4). Mirrors the `Step` union's pattern for cross-
    field constraints.
  - Prose tightenings: post-condition for `DispatchStartedEvent`
    explicitly scopes `adapter`↔`resolved_from` agreement to Phase 2
    (Codex HIGH #5 honesty fold-in); `{source: 'default'}`,
    `{source: 'explicit'}`, and `{source: 'auto'}` are explicitly
    singleton-at-v0.1 with v0.2 revisit rationale (Codex MED #6);
    auto-rationale claim removed from ADAPTER-I7 (Codex MED #7 — the
    auto variant carries no rationale field, and the test suite
    rejects surplus keys on it, so the original prose claim was
    self-contradictory); cwd/env/path semantics explicitly deferred
    to Phase 2 with property-id tags (Codex LOW #9).

- **v0.2 (Phase 1)** — Ratify `property_ids` above by landing the
  corresponding property-test harness at
  `tests/properties/visible/adapter/`. Decide whether
  `DispatchResolutionSource.explicit` should carry the literal
  `--adapter` CLI arg text for post-hoc flag reproduction (would add
  `{source: 'explicit', argv: string[]}` — currently deferred because
  the flag text is recoverable from the invocation event elsewhere).
  Decide whether `dispatch.default` should admit a full
  `CustomAdapterDescriptor` inline (currently it accepts only a string
  name → BuiltIn/registered AdapterName). Precedent from ADAPTER-I5
  suggests "no, register it first"; v0.2 will reconfirm with evidence
  from real workflows.

- **v1.0 (Phase 2)** — Ratified invariants + property tests +
  dispatch-resolution implementation with `adapter.prop.*` as
  acceptance gate + the auto-detect heuristic formalized (Phase 2
  decides what `'auto'` does).
