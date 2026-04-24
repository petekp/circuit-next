# Domain Glossary — circuit-next Ubiquitous Language

**Status:** Phase 1 draft. Terms that have been ratified through contract
authorship are marked `[ratified]`; terms still under discussion are
marked `[draft]`.

The goal of this glossary is to eliminate synonyms. Use these terms exactly,
in code, in specs, in commits, in conversation. If a concept needs a new
term, propose it here in a new commit before using it elsewhere.

---

## Core types

- **Workflow** `[draft]` — A named, versioned definition of a multi-step
  automation. Workflows are types. They have an `id`, `version`, `purpose`,
  entry signals, entry modes, phases, and steps. Not to be confused with
  "workflow" in a casual sense (a Workflow is the specific type defined in
  `src/schemas/workflow.ts`).

- **Run** `[draft]` — An instance of a Workflow executing. A Run has a
  `RunId`, a link to its Workflow, a `LaneDeclaration`, a `rigor`, and an
  append-only event log. A Run is deterministically replayable from its
  events + the Workflow manifest snapshot.

- **Phase** `[draft]` — A named portion of a Workflow. Phases may map to
  canonical spine positions (Frame, Analyze, Plan, Act, Verify, Review,
  Close) or be workflow-specific. Phases are ordered groupings of Steps.

- **Step** `[draft]` — The atomic unit of execution inside a Phase. A Step
  is one of three variants: **SynthesisStep** (orchestrator writes an
  artifact, schema-sections gate), **CheckpointStep** (orchestrator pauses
  for human or auto-resolver selection, checkpoint-selection gate), or
  **DispatchStep** (worker executes remotely, result-verdict gate with a
  dispatch role).

- **Gate** `[draft]` — A validator at a step boundary. Three kinds:
  `schema_sections`, `checkpoint_selection`, `result_verdict`. A step
  passes when its gate returns `pass`.

- **Event** `[draft]` — An append-only record written during a Run. Kinds:
  `run.bootstrapped`, `step.entered`, `step.artifact_written`,
  `gate.evaluated`, `checkpoint.requested`, `checkpoint.resolved`,
  `dispatch.started`, `dispatch.request`, `dispatch.receipt`,
  `dispatch.result`, `dispatch.completed`, `dispatch.failed`,
  `step.completed`, `step.aborted`, `run.closed`. The event log is the
  authoritative state. The intermediate dispatch kinds (`dispatch.request`
  / `receipt` / `result`) form the durable dispatch transcript required by
  ADR-0007 CC#P2-2 Enforcement binding for non-dry-run adapters.
  `dispatch.failed` records adapter invocation exceptions before any
  adapter result exists.

- **Snapshot** `[draft]` — A derived projection of the event log. A
  snapshot is a pure function of events + manifest. Snapshots are cache;
  events are truth.

---

## Methodology vocabulary

- **Lane** `[ratified]` — The framing class of a slice of work. Six lanes:
  `ratchet-advance`, `equivalence-refactor`, `migration-escrow`,
  `discovery`, `disposable`, `break-glass`. Every Run carries a
  `LaneDeclaration`.

- **Lane declaration** `[ratified]` — The framing record a slice must
  present before implementation: lane, failure mode, acceptance evidence,
  alternate framing. `migration-escrow` adds expiry + restoration plan;
  `break-glass` adds post-hoc ADR deadline.

- **Ratchet** `[draft]` — A measured property of the codebase that must
  strictly advance and cannot regress. Examples: test count, lint-error
  count, mutation score, type-coverage percentage. In Tier 0, ratchets are
  *not yet formalized*; specs/contracts will identify candidate ratchets.

- **Rigor** `[draft]` — A named tier of per-workflow process depth.
  Levels: `lite`, `standard`, `deep`, `tournament`, `autonomous`.
  "Consequential" rigor (methodology-blessed governance tier) includes
  `deep`, `tournament`, and `autonomous`.

- **Cross-model challenger** `[ratified]` — A worker run on a different
  model (Codex when authoring on Claude, Claude when authoring on Codex)
  whose output is an **objection list**, not an approval. Used narrowly:
  ratchet changes, contract-relaxation ADRs, migration escrows, gate
  loosening. One Swiss-cheese layer (Knight & Leveson 1986 correlation
  applies), not independent corroboration.

---

## Dispatch vocabulary

- **Adapter** `[draft]` — A dispatch target for a worker. Built-ins:
  `agent` (Claude Code Agent tool), `codex` / `codex-isolated` (Codex CLI).
  Custom adapters are named, registered in `dispatch.adapters`, and
  invoked via argv with `PROMPT_FILE OUTPUT_FILE` appended.

- **AdapterRef** `[draft]` — A reference to an adapter. Three kinds:
  `{kind: 'builtin', name}`, `{kind: 'named', name}`, or a full
  `CustomAdapterDescriptor`.

- **Role** `[draft]` — A dispatch role enum: `researcher`, `implementer`,
  `reviewer`. (Note: `orchestrator` is an executor, NOT a role.)

- **Dispatch resolution** `[draft]` — The procedure that produces an
  `AdapterRef` for a Step. Precedence: explicit `--adapter` → `roles.<role>`
  → `circuits.<workflow_id>` → `dispatch.default` → auto-detect. Recorded
  in `DispatchStartedEvent.resolved_from`.

---

## Configuration vocabulary

- **Config layer** `[draft]` — One of `default`, `user-global` (at
  `~/.config/circuit-next/config.yaml`), `project` (at
  `./.circuit/config.yaml` from the current working directory),
  `invocation` (per-command overrides). Slice 86 wires the current
  product CLI to discover `user-global` and `project`; `default` and
  `invocation` are schema/resolver-supported seams until a later slice
  wires plugin default discovery and public per-command selection flags.

- **Selection layer** `[draft]` — The full precedence chain for model /
  effort / skills selection: `default < user-global < project < workflow
  < phase < step < invocation`. Selection layers are a superset of config
  layers; they include workflow/phase/step-authored defaults. The resolver
  can fold all seven when supplied by a caller; the current CLI product
  path supplies workflow/phase/step from the workflow fixture plus
  user-global/project config files.

- **Selection override** `[draft]` — A partial selection record that a
  layer contributes. Fields: `model` (provider-scoped), `effort`
  (OpenAI 6-tier), `skills` (inherit|replace|append|remove discriminated
  union), `rigor`, `invocation_options`.

- **Resolved selection** `[draft]` — The effective selection at dispatch
  time. The schema name is `ResolvedSelection` (`src/schemas/selection-
  policy.ts`). Carries `{model?, effort?, skills: SkillId[] unique,
  rigor?, invocation_options: JsonObject}`. It is a *cache*; the
  authoritative provenance is `SelectionResolution.applied` (see below).

- **Selection resolution** `[draft]` — The pair `{resolved, applied}`
  emitted by the resolver. The schema name is `SelectionResolution`
  (`src/schemas/selection-policy.ts`). `resolved` is the effective
  `ResolvedSelection`; `applied` is the ordered, identity-keyed
  provenance trace of which layers contributed what. Selection
  resolution is the audit surface; resolved selection is the
  adapter-consumption surface.

- **Provider-scoped model** `[draft]` — `{ provider: 'openai' | 'anthropic'
  | 'gemini' | 'custom'; model: string }`. Avoids marketing-name
  enumeration; adapter-specific code validates known model strings.

- **Effort** `[draft]` — OpenAI's 6-tier vocabulary: `none`, `minimal`,
  `low`, `medium`, `high`, `xhigh`. Chosen over a 4-tier or provider-
  specific enum for cross-provider portability. (Anthropic does not
  expose reasoning-effort tiers as of 2026-04; Gemini's tier map is still
  evolving.)

---

## Continuity vocabulary

- **Continuity record** `[v0.1]` — A cross-session handoff record. Two
  discriminants: `standalone` (no active run; narrative-only) and
  `run-backed` (anchored to a specific `RunId` plus **run-attached
  provenance**). Stored at `<control-plane>/continuity/records/
  ${record_id}.json`; indexed by the **continuity index**. Identity is
  `record_id`, a `ControlPlaneFileStem` used directly as the filename
  stem. Authority: `specs/contracts/continuity.md` v0.1,
  `specs/artifacts.json` artifact id `continuity.record`.

- **Continuity index** `[v0.1]` — The resolver artifact that determines
  which continuity record is authoritative for resume and which run (if
  any) is currently attached. Stored at
  `<control-plane>/continuity/index.json`. Carries two orthogonal
  pointers: **pending-record pointer** and **attached-run pointer**.
  Either may be null; both may be populated. Authority:
  `specs/contracts/continuity.md` v0.1,
  `specs/artifacts.json` artifact id `continuity.index`.

- **Resume contract** `[v0.1]` — The posture a continuity record declares
  for how the next session should pick it up. Carries `mode`
  (`resume_run` | `resume_standalone`, bound to `continuity_kind` per
  CONT-I5) and two safety booleans (`auto_resume`,
  `requires_explicit_resume`) where exactly one MUST be true (CONT-I6).
  Both-true or both-false forms are rejected at parse time.

- **Run-attached provenance** `[v0.1]` — The snapshot-of-state embedded in
  a run-backed continuity record: `current_phase`, `current_step`,
  `runtime_status`, `runtime_updated_at` (plus the `run_id` /
  `invocation_id` identity pair). Enough to make resume adjudication
  auditable by comparing "what was true at save time" vs "what is true
  now." A bare `{run_id}` is rejected (CONT-I7).

- **Pending-record pointer** `[v0.1]` — The index entry that names which
  continuity record is authoritative for the next resume. Keyed by
  `record_id` (a `ControlPlaneFileStem`), type-aligned with the record-
  side identity. Round-trip `<control-plane>/continuity/records/
  ${record_id}.json` is schema-safe.

- **Attached-run pointer** `[v0.1]` — The index entry that names which
  run is currently live. Carries `run_id`, `current_phase`,
  `current_step`, `runtime_status`, `attached_at`, `last_validated_at`.
  Orthogonal to pending-record pointer.

- **Dangling reference (continuity)** `[v0.1]` — The failure state where
  `ContinuityIndex.pending_record.record_id` names a file absent from
  `<control-plane>/continuity/records/`. Runtime policy:
  error-at-resolve; the resume flow surfaces the mismatch rather than
  silently falling back.

---

## Skill + plugin vocabulary

- **Skill** `[v0.1]` — A discoverable capability with a trigger. L1 is
  YAML frontmatter (~80-100 tokens: id, title, description, trigger);
  L2 is SKILL.md body (<5k tokens, loaded on trigger match); L3 is extra
  files (loaded on explicit demand). Authority:
  `specs/contracts/skill.md` v0.1; artifact id `skill.descriptor`.

- **Plugin** `[draft]` — The Claude Code plugin surface that circuit-next
  installs into: commands, agents, hooks, skills, MCP servers, monitors.
  Manifest at `.claude-plugin/plugin.json`.

- **Catalog compiler** `[draft]` — A build-time tool that regenerates
  user-facing surfaces (`CIRCUITS.md` regions, `SKILL.md` contract
  regions, `commands/*.md` shims, public-commands list) from TS source of
  truth. Hand-editing compiler-owned files is an anti-pattern.

---

## Anti-patterns (named, so they can be rejected at review)

- **Prose/YAML drift** — When `SKILL.md` prose and `circuit.yaml`
  structure disagree. Internal evidence (`bootstrap/evidence-draft-
  codex.md`) shows existing Circuit has this drift in Build Lite.
  Prevented structurally by contract test in Phase 1.

- **Verdict enum bloat** — When a global verdict enum + per-protocol
  conditionals grow past ~30 protocols × ~3 verdicts each, making schema
  evolution require coordinated edits in 3+ files. Existing Circuit has
  this. circuit-next should constrain verdict vocabulary per step kind,
  not per protocol.

- **Prose-as-hidden-policy** — When judgment rules live in SKILL.md
  prose rather than in typed contracts. External prior art (DSPy, BAML,
  GEPA) treats prompt-as-compiled-artifact; circuit-next should too.

- **Hidden runtime** — When a compiler (Option 3 / Work-Pattern Policy
  Compiler in the 4 prior-art docs) carries runtime policy smuggled
  through IR semantics. Knight & Leveson 1986 N-version correlation
  warns about this.

---

## Terms explicitly rejected

- "**Circuit**" as the type name. The plugin is named `circuit-next`; a
  type named `Circuit` would cause user confusion ("is this an instance
  of the plugin or a workflow type?"). **Workflow** is used instead.

- "**Pipeline**" as a synonym for Workflow. External prior art uses
  `pipeline` for data-engineering DAGs (Dagster, Prefect). circuit-next
  workflows have phase spines + branch routes, not pure DAGs. Use
  **Workflow**.

- "**Job**" as a synonym for Step. In existing Circuit, "job" refers to
  dispatched worker artifacts (`jobs/*.{request,receipt,result}.json`).
  Use **DispatchStep** for the type; **job** only for the artifact.

- "**Session**" as a Run synonym. A Session is the human-facing shell
  (Claude Code conversation); a Run is the machine-facing execution. A
  single Session can span multiple Runs; a Run can span multiple
  Sessions (via continuity).
