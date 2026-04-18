# Circuit Abstraction Inventory — Surface-Level

**Scope note.** This is an orchestrator-compiled **surface-level** inventory of
the abstractions the existing Circuit implementation (`~/Code/circuit/`)
depends on. It is drawn only from top-level docs and schema-manifest paths —
it deliberately does not extract invariants, seams, or failure modes at depth.
Those extractions happen in `evidence-draft-claude.md` (Worker C) and
`evidence-draft-codex.md` (Worker D), both blind to `~/Code/circuit/docs/*`.

The inventory exists to give Workers A and B (external researchers) and the
later synthesis step a canonical list of targets — "here are the abstractions
Circuit relies on; find external prior art for each."

## Source files for this inventory

- `~/Code/circuit/README.md`
- `~/Code/circuit/CIRCUITS.md` — workflow catalog
- `~/Code/circuit/CUSTOM-CIRCUITS.md` — user-authored workflow contract
- `~/Code/circuit/CLAUDE.md` — project session rules (surface only)
- `~/Code/circuit/ARCHITECTURE.md` — table of contents only
- `~/Code/circuit/AGENTS.md`
- `~/Code/circuit/circuit.config.example.yaml` — user config shape
- `~/Code/circuit/skills/build/circuit.yaml` + `skills/build/SKILL.md` — one representative workflow manifest
- `~/Code/circuit/schemas/*.schema.json` — filename-level view of authoritative schemas

No reads of `~/Code/circuit/docs/*.md`, `~/Code/circuit/scripts/runtime/engine/src/**`, `~/Code/circuit/hooks/*.{sh,js}` bodies, or `~/Code/circuit/scripts/relay/*.sh` bodies. The inventory is name-level and contract-level only.

## Abstraction list

### A. Workflow

- Five primary workflows: Build, Explore, Repair, Migrate, Sweep.
- Two utilities: Create, Handoff, Review.
- Each workflow has: `id`, `version`, `purpose`, `entry.signals` (include/exclude), `entry_modes` (named → `{start_at, rigor, description}`), ordered `steps`, optional `dispatch` overrides, optional `skills` per-circuit.
- External research target: how other systems name and compose workflows
  (Temporal, Prefect, Dagster, Argo; LangGraph's graph compiler; CrewAI's
  Flows; OpenAI Swarm; the Vercel AI SDK workflow primitives).

### B. Phase (shared spine)

- Spine: `Frame → Analyze → Plan → Act → Verify → Review → Close`.
- Each workflow omits, renames, or reshapes specific phases (Explore omits
  Act/Verify/Review; Build omits Analyze; Repair folds Plan into the
  regression contract in `brief.md`; Migrate renames Analyze→Inventory,
  Plan→Coexistence Plan, Act→Batch Execution, Review→Cutover Review;
  Sweep renames Analyze→Survey, Plan→Queue/Triage, Act→Batch Execute,
  Review→Deferred Review).
- Phases are conceptual; steps inside a phase are the executable unit.
- External research target: phase-based workflow vs graph-based; state
  machine formalisms (Temporal workflows, XState, BPMN); Operator pattern in
  Kubernetes-style controllers.

### C. Step

- Atomic unit of execution inside a phase.
- Fields: `id`, `title`, `executor` (`orchestrator` | `worker`), `kind`
  (`synthesis` | `checkpoint` | `dispatch`), `protocol` (e.g.
  `build-frame@v1`), `reads` (paths), `writes` (artifact / request /
  response / receipt / result paths with schema refs), optional `budgets`
  (`max_attempts`), `gate`, `routes` (named labels → next step id).
- Three executor/kind combos: orchestrator-synthesis, orchestrator-checkpoint,
  worker-dispatch.
- External research target: step types in Temporal (activities/workflows);
  Airflow operators; GitHub Actions jobs/steps; the Unix pipe contract
  (stdin/stdout vs side effects).

### D. Artifact

- Structured markdown file produced per step with a versioned schema
  reference (`brief@v1`, `plan@v1`, `review@v1`, `result@v1`, etc.).
- Canonical per-workflow chain: `brief.md` → `analysis.md` / `inventory.md`
  → `plan.md` / `decision.md` / `coexistence-plan.md` → `review.md` →
  `result.md`.
- Resume is artifact-chain-driven: walk the chain, re-enter at the first
  missing artifact.
- External research target: `Contract-First` literature (Parnas-style
  module specifications); literate-programming output chains; RFC/PRD
  structured docs; OpenAPI spec files; Pulumi/Terraform IaC state files.

### E. Rigor Profile

- Named rigor levels (enumerated per-workflow): Lite, Default/Standard,
  Deep, Tournament (Explore only), Autonomous.
- Rigor affects: number of workers dispatched, presence of seam-proof,
  adversarial stances count, auto-resolution of checkpoints.
- Tournament specifically: 3 diverging stances → 3 adversarial reviews →
  revise → stress-test → converge → pre-mortem.
- External research target: graded assurance levels (DO-178C DAL,
  ISO 26262 ASIL); AI evaluation rigor tiers (thorough vs quick); dspy
  rigor compilation.

### F. Entry Mode

- Per-workflow named starting configurations that tie `start_at` (step id)
  to a `rigor` profile.
- Surface: `lite`, `default`, `deep`, `autonomous`, (Explore adds
  `tournament`).
- Intent hints (prefix shortcuts in `/circuit:run <prefix>: <task>`):
  `fix:` → Repair/Lite; `repair:` → Repair/Deep; `develop:` → Build/Standard;
  `decide:` → Explore/Tournament; `migrate:` → Migrate/Deep;
  `cleanup:` → Sweep/Standard; `overnight:` → Sweep/Autonomous.
- External research target: CLI subcommand design, npm script hierarchies,
  kubectl verb/noun compositions.

### G. Gate

- Three kinds: `schema_sections` (verify artifact contains required H2
  sections), `checkpoint_selection` (user/operator chose an option from a
  finite set), `result_verdict` (worker returned a named verdict from a
  allow-list).
- Gate failure blocks the phase edge.
- External research target: CI gate patterns; JSON Schema validation;
  type-driven development ("parse don't validate"); property-based test
  oracles.

### H. Executor Model

- Two executor types: `orchestrator` (runs in the main Claude Code session;
  composes synthesis and authors checkpoints) and `worker` (runs in a
  dispatched subagent or external model CLI).
- Worker dispatch happens through an adapter (Claude Code Agent tool;
  Codex CLI; custom wrapper executables).
- External research target: orchestrator/worker split in Airflow, Temporal,
  Argo Workflows; the `separate sessions for implementation and review`
  claim in Anthropic's harness-design writeups.

### I. Dispatch adapter

- Resolution order: explicit `--adapter` → `dispatch.roles.<role>` →
  `dispatch.circuits.<circuit>` → `dispatch.default` → auto-detect
  (`codex-isolated` if installed, else `agent`).
- Built-ins: `agent` (Claude Code Agent tool with worktree isolation),
  `codex` (alias for `codex-isolated`, runs Codex CLI in Circuit's
  isolated runtime home).
- Custom adapters are argv arrays; Circuit appends `PROMPT_FILE OUTPUT_FILE`.
- External research target: provider-agnostic LLM adapter patterns in
  Vercel AI SDK, LangChain `BaseLLM`, LlamaIndex `LLM`; OpenAI's responses
  API shape vs Anthropic's messages API vs Gemini; codex-cli's ephemeral
  exec pattern.

### J. Role

- Named `role` values: `researcher`, `implementer`, `reviewer`.
- Role maps to adapter through `dispatch.roles.<role>`.
- Example: `implementer: codex`, `reviewer: agent` separates who edits
  from who reviews.
- External research target: generator-evaluator split (Anthropic *Harness
  Design* 2025); separation of concerns in multi-agent systems; distinct-
  UID implementer vs reviewer sandbox.

### K. Skill registry and domain skills

- Circuit workflows can inject "domain skills" into dispatched worker
  prompts (e.g., `tdd`, `rust`, `swift-apps`).
- Skill lookup: `~/.claude/skills/<name>/SKILL.md` with YAML frontmatter
  (`name`, `description`, `trigger`).
- Skill dirs are orderable via `SKILL_DIRS`; plugin's own `skills/` is
  intentionally excluded from domain-skill lookup to prevent name
  collisions.
- External research target: VS Code extensions, OpenAI GPT tools,
  Anthropic skills ecosystem, pip-installable plugin registries, nix
  flakes as composable capability units.

### L. Configuration precedence

- Resolution: `./circuit.config.yaml` (project) > `~/.claude/circuit.config.yaml` (global user).
- Fields surfaced in example config: `dispatch` (default + roles + circuits +
  adapters), `circuits.<id>.skills` (comma-separated skills per circuit).
- External research target: npm config precedence; cargo config layering;
  kubeconfig merging; `.env` hierarchies; VS Code settings layers
  (default/user/workspace/folder).

### M. Bootstrap contract

- `circuit-engine bootstrap` materializes: `circuit.manifest.yaml` (expanded
  run-specific manifest), `events.ndjson` (append-only event log),
  `state.json` (derived snapshot), `artifacts/active-run.md` (live
  dashboard).
- Bootstrap is idempotent: if a run root already exists with a matching
  invocation id, bootstrap re-attaches rather than recreating.
- External research target: event-sourcing systems (EventStoreDB,
  Axon, Marten); CQRS + snapshotting; append-only logs (Kafka, git).

### N. Event-sourced state

- `events.ndjson`: append-only line-delimited JSON events. Each event is
  schema-typed (see `schemas/event.schema.json`).
- `state.json`: reducer-derived snapshot. Can be regenerated from events.
- Gate evaluation reads artifacts or results, not the event log directly.
- External research target: flux/redux reducers; event sourcing as system
  of record; CRDT convergence; projection patterns.

### O. Continuity

- `circuit-engine continuity save/resume/clear/status`.
- Two kinds: standalone (human-written narrative) and run-backed
  (anchored to an in-progress run).
- Fields: `project_root`, `goal`, `next`, `state_markdown`, `debt_markdown`,
  `resume_contract` (mode, requires_explicit_resume, auto_resume), `run_ref`.
- Index at `.circuit/control-plane/continuity-index.json`; records at
  `.circuit/control-plane/continuity-records/continuity-<uuid>.json`.
- Cross-session handoff: save in session N, resume in session N+1.
- External research target: Temporal workflow replay; pause/resume in
  durable execution systems; CRIU checkpointing; browser session-restore;
  session tokens in web auth.

### P. Checkpoints

- Orchestrator-authored pause points where a human (or auto-resolver) must
  select an option before the workflow continues.
- Request/response JSON at `checkpoints/{step_id}-{attempt}.{request,response}.json`.
- Request schema includes: `kind`, `options` (enumerated), `materialize_artifact`.
- Autonomous rigor auto-resolves via a default heuristic.
- External research target: human-in-the-loop (HITL) patterns in Temporal,
  Restate, Inngest; GitHub reviewable actions; Slack workflow builders.

### Q. Compose-prompt helper

- `compose-prompt` assembles a final worker prompt from a header file +
  optional domain skills + optional template + substitution of
  `{relay_root}` tokens + adapter hint.
- Header lives at `phases/<phase>/prompt-header.md`; output at
  `phases/<phase>/prompt.md`.
- Templates: `implement`, `review`, `ship-review`, `converge`.
- External research target: prompt composition libraries (LangChain
  PromptTemplate, dspy Signatures, Guidance), jsonnet-style templating,
  LaTeX import/include discipline.

### R. Adversarial review

- Built-in step in Tournament-rigor Explore. 3 parallel reviewers, each
  sees ONE proposal. Mission: "find what is wrong, do not be balanced."
- Schema: Strengths / Weaknesses / Hidden Assumptions / Feasibility /
  Verdict.
- Separate stress-test step (3 parallel attackers) on: seam failures, scale
  pressure, dependency failure, assumption inversion, time decay.
- External research target: devil's-advocacy patterns (Asch 1956), red-team
  pentesting, STRIDE threat modeling, SBOM adversarial review, premortems
  (Klein 2007).

### S. Seam proof

- Deep-rigor Explore (and Build) phase: after the plan/decision, dispatch
  a worker to prove the riskiest seam with code (failing test, thin spike,
  minimal integration).
- Output schema: `Seam Identified`, `What Was Built/Tested`, `Evidence`,
  `Verdict: DESIGN HOLDS | NEEDS ADJUSTMENT | DESIGN INVALIDATED`.
- External research target: architecture fitness functions (Neal Ford);
  "parse don't validate" as type-seam proof; GAMP 5 validation categories;
  demo-vs-formal-verification as seam proof.

### T. Circuit breakers (escalation)

- Escalation triggers enumerated per-workflow: dispatch-step-failure-twice,
  contradictory evidence, all-tournament-proposals-converge, all-stress-
  tests-fatally-flawed, seam-proof-invalidated, brief-too-vague.
- Shape: report failure context + option menu (narrow scope, reframe, abort).
- External research target: Erlang "let it crash," circuit-breaker
  pattern (Nygard); Hystrix; bulkhead isolation.

### U. Intent classification (router)

- `/circuit:run <task>` classifies into a workflow + rigor profile, then
  dispatches.
- Custom circuits register include/exclude signals. Built-ins resolve
  tie-breaks.
- External research target: intent-classification in chatbots
  (Dialogflow, Rasa), zero-shot LLM classifiers, LangChain Router.

### V. Custom circuits

- Users author custom workflows under `~/.claude/circuit/skills/<name>/`
  with a `circuit.yaml` manifest.
- Built-in explicit intent hints win over custom; otherwise custom wins
  when its include-signal match is materially stronger than the best
  built-in.
- External research target: extensibility patterns in pytest/plugins,
  rspec formatters, VS Code custom commands.

### W. Catalog compiler

- `scripts/runtime/bin/catalog-compiler.js generate` regenerates:
  `commands/*.md`, regions in `CIRCUITS.md`, regions in
  `skills/*/SKILL.md`, `.claude-plugin/public-commands.txt`, and
  `scripts/runtime/generated/*.json`.
- Source of truth: TS under `scripts/runtime/engine/src/catalog/`.
- `catalog-compiler generate --check` fails CI on stale generated surface.
- External research target: compile-oriented documentation (`mdBook`,
  `mkdocs` templating, `dev` compiler flags), generated API docs
  (OpenAPI codegen), literate programming (Knuth).

### X. Hooks

- Session-start hook (`session-start.sh`) populates `.circuit/bin/`
  helper wrappers; wires `plugin-root` pointer.
- User-prompt-submit hook (`user-prompt-submit.js`) injects the "Circuit
  Invocation" context (invocation id + custom-circuit catalog).
- External research target: git hooks, Anthropic Claude Code hooks,
  Claude hooks lifecycle events, Temporal lifecycle interceptors.

### Y. Plugin manifest

- `.claude-plugin/plugin.json` declares plugin identity, version,
  components (commands, skills, agents, hooks, MCP servers).
- `public-commands.txt` generated by catalog-compiler; defines which
  slash-commands the plugin exposes.
- External research target: Claude Code plugin authoring docs; VS Code
  `package.json` extension manifest; Helm chart shape.

### Z. Run root and artifact layout

- Runs live at `.circuit/circuit-runs/<slug>/`.
  - `circuit.manifest.yaml` — expanded per-run manifest
  - `events.ndjson` — append-only event log
  - `state.json` — derived snapshot
  - `artifacts/` — workflow output chain (brief.md, analysis.md, etc.)
  - `phases/<phase>/` — per-phase worker material (prompt-header, prompt,
    reports, last-messages, jobs)
  - `checkpoints/<step>-<attempt>.{request,response}.json`
  - `artifacts/active-run.md` — live dashboard for the human
- External research target: structured run outputs in AI eval harnesses
  (OpenAI Evals, Inspect), CI artifact paths (GitHub Actions),
  reproducible-research directory layouts (Snakemake, Nextflow).

## Research-target map (handoff to Workers A + B)

For each external researcher, these are the highest-signal external
prior-art categories to survey:

- **Durable workflow engines** → Temporal, Restate, Inngest, Dagster,
  Prefect, Argo
- **Agent-framework orchestration** → LangGraph, CrewAI, AutoGen, MetaGPT,
  OpenDevin, SWE-agent, OpenAI Swarm
- **Claude Code ecosystem** → Anthropic Claude Code docs, plugin
  specifications, skills registry, Claude Agent SDK, Agent tool API
- **Codex/OpenAI ecosystem** → OpenAI Responses API, Assistants API,
  function calling, structured output, Codex CLI design
- **Contract-first / policy-compiled** → DSPy, GEPA, Guidance, LMQL,
  Outlines, Open Policy Agent, Cedar
- **Event sourcing** → EventStoreDB, Axon, Marten, Martin Fowler's writeup
- **Configuration precedence patterns** → npm, cargo, VS Code settings,
  nix, kubeconfig
- **Prompt composition libraries** → LangChain PromptTemplate, dspy
  Signatures, Guidance, BAML
- **Multi-model adversarial patterns** → Anthropic *Harness Design* 2025,
  Knight & Leveson 1986 (N-version programming), Berkeley multi-agent
  failure study 2025
- **Evaluation harnesses** → OpenAI Evals, Anthropic Inspect, lm-eval-
  harness, MLFlow tracking

## What this inventory does NOT do

- Does not enumerate failure modes, seams, or invariants at implementation
  depth. That is Workers C+D's job.
- Does not critique Circuit's organic evolution or accreted complexity.
  That is the synthesis step's job.
- Does not anticipate the Work-Pattern Policy Compiler direction from the
  4 deferred prior-art docs. Those are the prior-art-audit's subject.
- Does not make architectural recommendations for circuit-next. That is
  Phase 1 Contract Authorship.
