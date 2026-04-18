# Phase 0 Internal Evidence — Existing Circuit (Codex researcher, blind)

## Reading Index

- [fact] Read primary repository contract files outside `docs/`: `README.md`, `ARCHITECTURE.md`, `CUSTOM-CIRCUITS.md`, `CIRCUITS.md`, `AGENTS.md`, and `CLAUDE.md`; the README defines Circuit as structured, resumable, multi-phase workflow orchestration inside Claude Code. `README.md:8`
- [fact] Read shipped workflow manifests for `build`, `explore`, `migrate`, `repair`, `run`, and `sweep`; generated surface docs enumerate those workflows plus utility commands. `CIRCUITS.md:11`
- [fact] Read JSON schemas for manifests, events, job results, state, continuity records/indexes, and surface manifests; the manifest schema requires `schema_version` and `circuit` and rejects additional top-level properties. `schemas/circuit-manifest.schema.json:6`
- [fact] Read shell relay wrappers and prompt composer; the `circuit-engine.sh` and `dispatch.sh` wrappers delegate to bundled Node CLIs. `scripts/relay/circuit-engine.sh:1`, `scripts/relay/dispatch.sh:1`
- [fact] Read runtime TypeScript source for bootstrap, state derivation, command support, dispatch, checkpoint, synthesis, resume, continuity, config, catalog extraction, custom circuits, Codex isolation, and batch mutation; the runtime package declares build, typecheck, and test scripts. `scripts/runtime/engine/package.json:23`
- [fact] Read architectural ratchet tests and type packages; ratchets ban direct runtime reads of `state.json` as canonical input. `scripts/runtime/engine/src/architecture-ratchets.test.ts:239`
- [assumption] I did not read the deferred `docs/` directory or the sibling Claude draft; this pass intentionally weights executable implementation, schemas, shells, and tests over narrative materials.

## Invariants (≥12)

- [invariant] A circuit is not just code or prose; its identity is the pairing of `circuit.yaml` topology with `SKILL.md` execution contract, and the architecture says quality checks can silently skip if those disagree. `ARCHITECTURE.md:27`, `ARCHITECTURE.md:40`
- [invariant] Durable state is event-led: runtime reads the manifest snapshot and append-only event log, derives `state.json`, and treats ledger state as stronger than artifact presence. `ARCHITECTURE.md:91`, `scripts/runtime/engine/src/derive-state.ts:1`
- [invariant] Attached run roots must live under the project-local `.circuit/circuit-runs/` tree; bootstrap rejects attached run roots outside that directory. `ARCHITECTURE.md:119`, `scripts/runtime/engine/src/bootstrap.ts:51`
- [invariant] Bootstrap writes and then pins a manifest snapshot; if a snapshot already exists, the live manifest must byte-match it before the run continues. `scripts/runtime/engine/src/bootstrap.ts:128`
- [invariant] A new event log is initialized with `run_started` and initial `step_started`; bootstrap derives and persists state from that log rather than trusting pre-existing files. `scripts/runtime/engine/src/bootstrap.ts:140`, `scripts/runtime/engine/src/bootstrap.ts:171`
- [invariant] Orchestrator synthesis completion only supports steps with executor `orchestrator` and kind `synthesis`. `scripts/runtime/engine/src/complete-synthesis.ts:111`
- [invariant] Synthesis section gates are mechanical H2 checks: each required section must exist and contain nonempty body text. `scripts/runtime/engine/src/complete-synthesis.ts:47`
- [invariant] The synthesis runtime only implements `schema_sections`; any other synthesis gate kind is rejected even if schema-defined. `scripts/runtime/engine/src/complete-synthesis.ts:190`
- [invariant] Dispatch steps require a request file, create or reuse a receipt, append `dispatch_requested`, and only append `dispatch_received` when a receipt exists. `scripts/runtime/engine/src/dispatch-step.ts:259`, `scripts/runtime/engine/src/dispatch-step.ts:296`
- [invariant] Dispatch reconciliation requires the declared result file and marks a complete result as routeable only when its verdict appears in the step's pass list. `scripts/runtime/engine/src/dispatch-step.ts:347`, `scripts/runtime/engine/src/dispatch-step.ts:463`
- [invariant] A dispatch result claiming `complete` must have written every declared artifact path before the runtime will advance. `scripts/runtime/engine/src/dispatch-step.ts:453`
- [invariant] Checkpoint request/resolve is file-backed: request requires a checkpoint request artifact, resolve requires a response artifact, validates selection, then routes. `scripts/runtime/engine/src/checkpoint-step.ts:158`, `scripts/runtime/engine/src/checkpoint-step.ts:234`
- [invariant] Terminal step routing appends `run_completed`; nonterminal routing appends the next `step_started`. `scripts/runtime/engine/src/command-support.ts:337`
- [invariant] Terminal states clear the indexed current run; active nonterminal states upsert it. `scripts/runtime/engine/src/command-support.ts:402`, `scripts/runtime/engine/src/continuity-control-plane.ts:445`
- [invariant] Adapter routing precedence is explicit adapter, then role mapping, then circuit mapping, then default, then auto fallback. `README.md:204`, `scripts/runtime/engine/src/dispatch.ts:213`
- [invariant] Built-in process adapters are reserved names, and custom adapters must be nonempty argv arrays with string entries. `scripts/runtime/engine/src/dispatch.ts:159`
- [invariant] Codex isolated dispatch creates a per-workspace runtime root, writes isolated config, copies auth, sanitizes env, and launches `codex exec --full-auto --ephemeral`. `scripts/runtime/engine/src/codex-runtime.ts:313`, `scripts/runtime/engine/src/codex-runtime.ts:332`, `scripts/runtime/engine/src/codex-runtime.ts:348`, `scripts/runtime/engine/src/codex-runtime.ts:819`
- [invariant] Custom circuits are validated by bootstrapping a detached run and requiring manifest/events/state/active-run artifacts before publish. `scripts/runtime/engine/src/catalog/custom-circuits.ts:351`

## Seams (≥8)

- [seam] Manifest schema to runtime TS is a hard seam: JSON schema strongly constrains step shape, while much runtime code consumes manifest nodes through flexible structural types and late checks.
- [seam] `SKILL.md` to `circuit.yaml` is the semantic seam most likely to drift because one describes what should happen and the other controls what can advance.
- [seam] Event log to derived state is the persistence seam; append-only NDJSON is canonical, while `state.json` is a cache and dashboard aid.
- [seam] Worker exchange is a multi-file seam: prompt/request file, receipt JSON, result JSON, and declared artifacts all need to align before a dispatch step can route.
- [seam] Prompt composition is a separate contract layer: header, selected skill files, template, protocol sentinel, placeholders, and adapter hints are assembled before any model sees the task.
- [seam] Adapter dispatch splits semantic role/circuit intent from transport: `agent` returns a ready receipt with prompt content, while process adapters synchronously execute and return process diagnostics.
- [seam] Continuity has two authorities with precedence rules: pending continuity records can override current-run banners and active-run resume context.
- [seam] Custom circuits cross from user-global catalog into project-visible command surface through generated shims and a routing-context prose injection.
- [seam] Workers adapter creates a nested orchestration boundary: the parent owns child run root and synthesis, while the workers runtime owns batch state and inner retry loops.
- [seam] Codex isolation is a process-boundary seam: runtime directories, sanitized env, copied auth, PID files, janitor cleanup, and process-group termination must agree on ownership.
- [seam] Generated/plugin cache surface is a deployment seam: source changes do not automatically affect the cached plugin until the sync script runs.
- [seam] Gate schema is broader than gate implementation: schema admits multiple gate kinds, but each runtime command supports only a subset in context.

## Failure Modes (≥10)

- [failure-mode] Contract drift between `SKILL.md` and `circuit.yaml` can silently skip intended quality checks because the runtime advances from manifest gates, not from prose intent.
- [failure-mode] Build Lite currently has visible contract drift: the manifest description says review still runs, while the generated circuit surface says Lite has no independent review. `skills/build/circuit.yaml:18`, `CIRCUITS.md:156`
- [failure-mode] A custom workflow can validate with schema-supported gate kinds such as `all_outputs_present` or `option_count`, but an orchestrator synthesis step using them would fail at runtime because synthesis only supports `schema_sections`. `schemas/circuit-manifest.schema.json:264`, `scripts/runtime/engine/src/complete-synthesis.ts:190`
- [failure-mode] `job-result.schema.json` requires rich structured result fields, but dispatch reconciliation parses loose JSON and infers `completion` and `verdict` from several ad hoc locations instead of validating the schema. `schemas/job-result.schema.json:5`, `scripts/runtime/engine/src/dispatch-step.ts:386`
- [failure-mode] A nonpassing dispatch result records `job_completed` but does not append a `gate_failed` event, reducing the explicitness of the event trail for failed worker gates. `scripts/runtime/engine/src/dispatch-step.ts:507`
- [failure-mode] Event writes use direct append calls without a visible file lock; concurrent tools touching the same event log could reorder or interleave writes. `scripts/runtime/engine/src/append-event.ts:82`, `scripts/runtime/engine/src/update-batch.ts:219`
- [failure-mode] Dispatch receipt contracts drift across layers: the runtime-core type centers `exchange_id`, the event schema also allows adapter/transport receipts, and command support requires adapter/transport/resolved_from while inventing a `job_id` when absent. `scripts/runtime/engine/src/runtime-core/types.ts:216`, `schemas/event.schema.json:84`, `scripts/runtime/engine/src/command-support.ts:447`
- [failure-mode] Codex janitor ownership detection depends on process command strings containing owned paths; processes with unexpected argv shape may be missed or misclassified. `scripts/runtime/engine/src/codex-runtime.ts:385`
- [failure-mode] Config discovery picks one config by search order plus home fallback and does not merge layered settings, so project/global expectations can diverge. `scripts/runtime/engine/src/config.ts:67`, `scripts/runtime/engine/src/config.ts:109`
- [failure-mode] Custom circuit routing is injected as prose for the model rather than enforced as a typed resolver, so ambiguous commands can still depend on model interpretation after built-in tie-breaks. `scripts/runtime/engine/src/catalog/custom-circuits.ts:422`
- [failure-mode] Checkpoint selection parsing can fall back to a supplied selection when JSON parsing fails, which means malformed response files can still resolve if an external caller passes a fallback. `scripts/runtime/engine/src/checkpoint-step.ts:58`
- [failure-mode] State projection can fall back to the current step when an event lacks `step_id`; malformed or legacy events can be attributed to the wrong step if the surrounding order is bad. `scripts/runtime/engine/src/derive-state.ts:96`
- [failure-mode] Section gates prove only headings and nonempty bodies, not semantic quality; a syntactically complete artifact can still be empty of useful evidence. `scripts/runtime/engine/src/complete-synthesis.ts:47`
- [failure-mode] Runtime budgets are mostly declarative at the manifest/schema level; `max_attempts` is schema-defined, but dispatch attempt selection increments from observed jobs and routes rather than from a central budget enforcer. `schemas/circuit-manifest.schema.json:224`, `scripts/runtime/engine/src/dispatch-step.ts:97`
- [failure-mode] Source/plugin cache split can ship stale command behavior when repository source is changed but cache sync is skipped. `AGENTS.md:3`, `CLAUDE.md:3`

## Facts

- [fact] Circuit ships shared phases Frame, Analyze, Plan, Act, Verify, Review, Close, and Pause, and says progress is saved to disk after every phase. `README.md:73`
- [fact] Canonical run artifacts include `brief.md`, `analysis.md`, `plan.md`, `review.md`, and `result.md`. `README.md:136`
- [fact] Review independence is explicitly framed as a separate session with fresh knowledge of the brief and plan. `README.md:132`
- [fact] Config lookup checks user/global and project config, and project config wins. `README.md:169`
- [fact] Built-in adapters are `agent` and `codex`/`codex-isolated`; custom adapters append prompt and output paths to the wrapper argv. `README.md:214`
- [fact] Verification prerequisites include Node 20+, expected command surface, relay scripts, config discovery, and CLI round trips. `README.md:230`
- [fact] Compose-prompt searches domain skills under user global circuit skills and project-local `.claude/circuit/skills`, excluding plugin-bundled skills from domain lookup. `scripts/relay/compose-prompt.sh:31`
- [fact] Compose-prompt tracks placeholder sources and fails on unresolved placeholders outside fenced code blocks. `scripts/relay/compose-prompt.sh:73`, `scripts/relay/compose-prompt.sh:113`
- [fact] Compose-prompt requires the relay protocol sentinel only when it appends the relay protocol file. `scripts/relay/compose-prompt.sh:205`
- [fact] Hook registration runs SessionStart and UserPromptSubmit commands synchronously. `hooks/hooks.json:1`
- [fact] The UserPromptSubmit shell wrapper invokes the runtime hook with `spawnSync` and a 64 MB max buffer. `hooks/user-prompt-submit.js:3`
- [fact] Hook logic does nothing unless the submitted prompt parses as a Circuit slash command. `scripts/runtime/engine/src/user-prompt-submit.ts:425`
- [fact] The hook materializes `.circuit/bin` helper wrappers and makes them executable. `scripts/runtime/engine/src/user-prompt-submit.ts:120`
- [fact] The prompt surface contracts file is declared as the single source for semantic command-surface fragments. `scripts/runtime/engine/src/catalog/prompt-surface-contracts.ts:1`
- [fact] Surface summaries define fast-mode proof artifacts and stop conditions for smoke, review, and handoff flows. `scripts/runtime/engine/src/catalog/prompt-surface-contracts.ts:135`
- [fact] Ajv 2020 with formats is used for runtime schema validation. `scripts/runtime/engine/src/schema.ts:9`
- [fact] Schema root discovery walks upward until it finds the `schemas` directory. `scripts/runtime/engine/src/schema.ts:20`
- [fact] Command support validates every event payload before appending. `scripts/runtime/engine/src/command-support.ts:75`
- [fact] Artifact-written events are appended only for observed files that exist. `scripts/runtime/engine/src/command-support.ts:194`
- [fact] Command preconditions require a current step and allowed run status, except for completed no-op routing. `scripts/runtime/engine/src/command-support.ts:258`
- [fact] Route overrides must match a route declared on the manifest step. `scripts/runtime/engine/src/command-support.ts:290`
- [fact] The event schema includes dispatch, job, artifact, gate, checkpoint, run completion, and invocation event types. `schemas/event.schema.json:28`
- [fact] The job-result schema requires `artifacts_written`, `files_changed`, `tests`, `issues`, and `sandbox_limited`. `schemas/job-result.schema.json:5`
- [fact] The state schema encodes statuses including initialized, in progress, waiting checkpoint/worker, terminal statuses, and failed. `schemas/state.schema.json:23`
- [fact] Continuity records require `resume_contract.resume` to be true and `auto_resume` to be false. `schemas/continuity-record.schema.json:77`
- [fact] The continuity index requires `project_root`, `current_run`, and `pending_record`. `schemas/continuity-index.schema.json:6`
- [fact] Continuity status prioritizes pending records over current run context. `scripts/runtime/engine/src/continuity-commands.ts:232`
- [fact] Continuity save validates typed debt bullets and disallows debt bullets in the state markdown body. `scripts/runtime/engine/src/continuity-commands.ts:342`
- [fact] Continuity JSON writes are atomic temp-file renames. `scripts/runtime/engine/src/continuity-control-plane.ts:278`
- [fact] Resume walks manifest order unless recorded routes exist, then follows the recorded route chain with a visited set. `scripts/runtime/engine/src/resume.ts:65`
- [fact] Resume treats a job complete without gated artifacts as incomplete. `scripts/runtime/engine/src/resume.ts:123`
- [fact] Custom circuit slugs cannot collide with reserved slugs, aliases, or shipped catalog entries. `scripts/runtime/engine/src/catalog/custom-circuits.ts:191`
- [fact] Custom publish copies `circuit.yaml` and `SKILL.md`, removes the draft, and materializes command surfaces. `scripts/runtime/engine/src/catalog/custom-circuits.ts:390`
- [fact] The catalog extractor rejects workflow skills whose `circuit.id` does not match the directory name. `scripts/runtime/engine/src/catalog/extract.ts:229`
- [fact] Non-workflow utility skills without `circuit.yaml` must declare a utility or adapter role. `scripts/runtime/engine/src/catalog/extract.ts:208`
- [fact] Runtime-core brands IDs and safe paths, but many public payloads still cross JSON boundaries. `scripts/runtime/engine/src/runtime-core/types.ts:1`
- [fact] Definition IR has an explicit enforcement class taxonomy including runtime-enforced, resolver-enforced, adapter-enforced, receipt-audited, prompt-guidance, and prose-only. `scripts/runtime/engine/src/definition-ir/types.ts:15`
- [fact] Definition IR budget policy includes allowed profiles, parallelism, rounds, premium dispatches, timeout seconds, and cap behavior. `scripts/runtime/engine/src/definition-ir/types.ts:80`
- [fact] The update-batch CLI mutates batch state by appending normalized events and writing the batch file atomically. `scripts/runtime/engine/src/update-batch.ts:662`
- [fact] Batch validation checks phase, type, status, current slice, and done slices with zero attempts. `scripts/runtime/engine/src/update-batch.ts:549`
- [fact] Architecture ratchets ban legacy vocabulary and direct `state.json` canonical reads in live runtime and maintainer code. `scripts/runtime/engine/src/architecture-ratchets.test.ts:219`, `scripts/runtime/engine/src/architecture-ratchets.test.ts:239`

## Inferences

- [inference] The system is already ledger-oriented in implementation, but several command surfaces still rely on convention-heavy JSON files rather than fully schema-validated exchange contracts.
- [inference] TypeScript brands document intent for IDs and safe paths, but runtime trust is mostly carried by Ajv at boundaries and by path existence checks at reconciliation time.
- [inference] The strongest current abstraction is not "phase"; it is "ledgered step transition with declared files and gates." Phases are user-facing grouping, while events and routes are operational truth.
- [inference] Custom circuits are intentionally user-extensible, but the real compatibility surface is much larger than `circuit.yaml`: prompts, generated command shims, hook context, adapter config, and active-run continuity all participate.
- [inference] The implementation favors recoverability over strict locking: rebuild-from-log and atomic JSON writes exist, but append operations themselves are not obviously serialized.
- [inference] The Codex adapter is much more than a subprocess call; it is an isolation and cleanup subsystem with its own state, ownership model, and failure semantics.
- [inference] Existing tests act partly as architectural policy compiler: ratchets encode removed vocabulary, forbidden state reads, and known sharp edges that types alone do not prevent.
- [inference] Budget and cost concepts are present in schemas and IR, but current executable enforcement appears thinner than routing, gating, and continuity enforcement.
- [inference] Prompt composition is treated as production infrastructure, not convenience glue; placeholder provenance and sentinel detection show this layer has failed before.
- [inference] The system has converged toward "artifact content plus event proof" rather than "model says it did it" as the core correctness principle.

## Unknowns

- [unknown] I did not prove whether all workflow SKILL prose and circuit manifests agree; I sampled implementation surfaces and known manifest/docs drift, not every line of every skill.
- [unknown] I did not inspect bundled compiled JS under `scripts/runtime/bin`; source TypeScript was treated as authoritative per repository guidance.
- [unknown] I did not run the full test suite, so evidence here is static plus implementation reading rather than dynamic proof.
- [unknown] I did not determine whether external orchestrator usage serializes event writes enough to make append locking unnecessary in practice.
- [unknown] I did not audit every generated/public command shim for parity with prompt-surface contracts.
- [unknown] I did not verify all custom adapter failure paths with actual process executions.
- [unknown] I did not inspect deferred prior-art documentation, so any historical design intent behind current drift is intentionally absent.
- [unknown] I did not map these findings to any future Work-Pattern Policy Compiler direction.

## Abstraction-by-Abstraction Map

- [inference] Circuit definition: `circuit.yaml` is the executable topology, `SKILL.md` is the behavioral contract, schemas are the static guardrails, and catalog extraction enforces naming and role constraints.
- [inference] Run identity: attached runs are project-local directories with a pinned manifest, event log, derived state, active-run dashboard, and optional continuity index entry.
- [inference] Step execution: orchestrator steps complete by checking artifact sections; dispatch steps complete by reconciling worker result JSON and declared artifacts; checkpoint steps complete by selecting an allowed option.
- [inference] Gates: gates are transition guards tied to artifacts and routes; the schema describes several kinds, but command-specific implementations decide which gate kinds actually execute.
- [inference] Artifacts: canonical artifacts are curated state, while raw worker reports are inputs for parent synthesis unless a workflow explicitly treats them as final outputs.
- [inference] Event ledger: every meaningful transition is an event, and rebuild/resume logic treats the ledger as source of truth.
- [inference] Continuity: pending records are explicit resume contracts, current run is passive context, and the system deliberately avoids auto-resume.
- [inference] Prompt surface: slash commands and fast modes are generated/injected protocol surfaces, not only documentation; helper wrappers make local runtime tools addressable to the model.
- [inference] Adapter layer: adapter resolution is policy, while agent/process/Codex transports are execution mechanisms with materially different isolation and completion semantics.
- [inference] Workers/batch layer: worker orchestration keeps its own batch state machine and event log, then hands raw reports back for parent-level synthesis.
- [inference] Custom circuits: extensibility is validated by detached bootstrap and then surfaced through global catalog overlays and project-injected routing hints.
- [inference] Verification/ratchets: architectural constraints are partly enforced by tests that scan source patterns for forbidden residues, not just by types or schemas.

## Hard Lessons for circuit-next

- [inference] Make the event ledger and transition command model explicit early; it is the current system's strongest correctness spine.
- [inference] Do not let manifest schemas get ahead of runtime gate support; every schema-admitted option should have an executable owner or be explicitly marked design-only.
- [inference] Treat worker result JSON as an API, not a convenience file; schema-validate it at reconciliation if downstream routing depends on it.
- [inference] Keep prose contracts close to executable topology, but add mechanical drift checks for SKILL/manifests wherever possible.
- [inference] Budget semantics need runtime ownership, not only manifest fields and narrative instructions.
- [inference] If parallel workers or adapters can touch one run root, append operations need a clear serialization story.
- [inference] Preserve the distinction between raw reports and canonical artifacts; promotion should be explicit and gated.
- [inference] Continuity should remain opt-in and explicit, but the authority order between pending record, current run, and active-run dashboard must be documented in executable tests.
- [inference] Adapter isolation is a product surface: env allowlists, auth copies, runtime cleanup, and process ownership must be designed as first-class behavior.
- [inference] Generated command surfaces need compiler ownership and cache-sync checks; otherwise the model may see one interface while the shell runs another.
- [inference] Section gates are useful low-cost guards, but circuit-next should not mistake them for semantic validation.
- [inference] Keep architectural ratchets; they encode institutional memory where the type system cannot see.

## Blind-Pass Self-Audit

- [assumption] Bias acknowledged: I overweighted executable TypeScript, shell behavior, schemas, and ratchets relative to narrative design intent.
- [assumption] Bias acknowledged: I am skeptical of abstractions that do not compile, validate, or route, so I may underweight useful human-process guidance in skills.
- [assumption] Bias acknowledged: I looked for schema/runtime drift and boundary failures, which can make the system look more brittle than it may be under normal orchestrator usage.
- [assumption] Blindness maintained: I did not read the sibling Claude draft and did not reconcile with another researcher's interpretation.
- [assumption] Scope discipline maintained: I avoided deferred prior-art docs and did not map findings to any future policy-compiler direction.
- [unknown] Residual risk: line citations are static evidence, but I did not execute workflows to confirm dynamic behavior under concurrent dispatch, adapter failures, or custom circuit publication.
- [unknown] Residual risk: there may be additional invariants encoded in generated JS or deferred docs that this pass intentionally omitted.
