# Adversarial Review — circuit-next Type Skeleton (Codex)

## Verdict
`NEEDS ADJUSTMENT`.

The skeleton is a useful first pass at local record shapes, but it does not yet encode the methodology's load-bearing guarantees. The highest-risk failures are graph closure, lane attachment, selection precedence, and event replay completeness. These are not cosmetic omissions: if implementation starts on this skeleton unchanged, the first engine commits will either add ad hoc validator code beside the schemas or break the public shapes immediately.

## Objection List (ordered by severity)

- **Workflow Graph Is Not Closed.** (Severity: HIGH)
  - **Claim.** `Workflow` permits entry modes, phases, and routes to reference nonexistent steps, and it permits duplicate ids across phases and steps. The exported schema validates object shape, not the workflow graph.
  - **Evidence.** `Workflow.entry_modes[].start_at` is only a `StepId` (`src/schemas/workflow.ts:13-18`); `Workflow.phases` and `Workflow.steps` are independent arrays (`src/schemas/workflow.ts:30-32`); `Phase.steps` is an unconstrained `StepId[]` (`src/schemas/phase.ts:15-20`); `RouteMap` stores route targets as plain `string` (`src/schemas/step.ts:28-30`). The test only covers one self-consistent happy path (`tests/contracts/schema-parity.test.ts:119-155`).
  - **Why it matters.** A manifest can parse while bootstrapping a run that cannot resume, route, or close. This undercuts the type skeleton's purpose: the first engine code will need a second "real manifest validator" outside the schema.
  - **Proposed fix.** Add a `superRefine` on `Workflow` that enforces unique ids, all `entry_modes.start_at` in `steps`, all `phases[].steps` in `steps`, every step appears in exactly one phase unless explicitly marked shared, every route target is either `@complete` or an existing `StepId`, and route labels match gate outcomes.

```ts
export const Workflow = WorkflowShape.superRefine((wf, ctx) => {
  const stepIds = new Set(wf.steps.map((s) => s.id));
  if (stepIds.size !== wf.steps.length) issue(ctx, ['steps'], 'duplicate step id');
  for (const mode of wf.entry_modes) requireStep(ctx, stepIds, ['entry_modes', mode.name, 'start_at'], mode.start_at);
  for (const phase of wf.phases) for (const id of phase.steps) requireStep(ctx, stepIds, ['phases', phase.id, 'steps'], id);
  for (const step of wf.steps) {
    for (const target of Object.values(step.routes)) {
      if (target !== '@complete') requireStep(ctx, stepIds, ['steps', step.id, 'routes'], target);
    }
  }
});
```

- **Lane Declaration Is Detached From Runs.** (Severity: HIGH)
  - **Claim.** The skeleton defines `LaneDeclaration`, but no run, workflow, event, snapshot, or step requires or records it.
  - **Evidence.** `LaneDeclaration` is standalone (`src/schemas/lane.ts:13-18`). `RunBootstrappedEvent` records `workflow_id`, optional `invocation_id`, `rigor`, and `goal`, but no lane (`src/schemas/event.ts:12-18`). `Snapshot` also omits lane (`src/schemas/snapshot.ts:17-28`). `Workflow` and `Step` omit lane framing entirely (`src/schemas/workflow.ts:21-34`, `src/schemas/step.ts:33-52`). The methodology requires every slice to declare lane, failure mode, acceptance evidence, and alternate framing before implementation (`CLAUDE.md:56-72`; `specs/methodology/decision.md:88-93`).
  - **Why it matters.** The core execution discipline becomes advisory prose. A run can parse and execute without the framing gate the methodology says is mandatory.
  - **Proposed fix.** Add lane framing to run bootstrap and snapshot at minimum; if workflows can encode default lane expectations, add `allowed_lanes` or `required_lane` at entry-mode or step level.

```ts
export const RunBootstrappedEvent = EventBase.extend({
  kind: z.literal('run.bootstrapped'),
  workflow_id: WorkflowId,
  invocation_id: InvocationId.optional(),
  rigor: Rigor,
  goal: z.string().min(1),
  lane: LaneDeclaration,
});
```

- **Event Log Cannot Replay Snapshot Unambiguously.** (Severity: HIGH)
  - **Claim.** The event union lacks enough facts to deterministically rebuild `Snapshot` from scratch, despite the abstraction inventory saying `state.json` is reducer-derived and regenerable from `events.ndjson`.
  - **Evidence.** Inventory states snapshot regeneration is required (`bootstrap/abstraction-inventory.md:184-190`). `Snapshot.steps[].status` includes `pending`, `in_progress`, `gate_failed`, `complete`, and `aborted` (`src/schemas/snapshot.ts:5-14`), but the event union has no `step.completed`, `step.aborted`, `route.selected`, or `workflow.manifest_recorded` event (`src/schemas/event.ts:89-99`). `GateEvaluatedEvent` has only generic `outcome`, optional `missing_sections`, and optional `reason` (`src/schemas/event.ts:37-44`), so replay cannot know which gate definition was evaluated. `DispatchCompletedEvent` has a verdict and duration, but no result path, receipt path, model, effort, skills, or output schema (`src/schemas/event.ts:73-79`).
  - **Why it matters.** Snapshot drift becomes structurally likely. Two reducers can interpret the same log differently; a rebuilt state can disagree with the live one without schema violation.
  - **Proposed fix.** Treat replay as a first-class contract. Add events for manifest identity, step completion, route selection, dispatch failure, checkpoint materialization, and gate definition/outcome. Include enough resolved selection and artifact/result paths to replay without reading mutable config.

```ts
export const StepCompletedEvent = EventBase.extend({
  kind: z.literal('step.completed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  route: z.string().min(1),
});

export const DispatchStartedEvent = EventBase.extend({
  kind: z.literal('dispatch.started'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  adapter: AdapterRef,
  role: Role,
  resolved_selection: ResolvedSelection,
});
```

- **Selection Policy Does Not Model Overrides.** (Severity: HIGH)
  - **Claim.** `SelectionPolicy` and config layers do not encode the precedence or merge semantics needed for "user-global defaults and overrides" plus per-step model, effort, and skills.
  - **Evidence.** User-facing goal says per-step model, effort, skills, invocation options with user-global defaults and overrides (`CLAUDE.md:7-11`). `SelectionPolicy.skills` defaults to `[]` (`src/schemas/selection-policy.ts:11-16`), which cannot distinguish "inherit skills" from "clear skills". `SelectionSource` includes `workflow`, `phase`, and `step` (`src/schemas/selection-policy.ts:19-27`), but `ConfigLayer` includes only `default`, `user-global`, `project`, and `invocation` (`src/schemas/config.ts:32-39`). `Phase` has no selection field (`src/schemas/phase.ts:15-20`). `Workflow` has `default_skills`, but not a full selection policy (`src/schemas/workflow.ts:21-34`).
  - **Why it matters.** The first implementation has to invent precedence rules outside the schema. Worse, empty skills will be a foot-gun: does it mean "no extra skills", "clear inherited skills", or "unspecified"?
  - **Proposed fix.** Split partial config input from resolved selection. Use explicit skill operations and record the full resolution chain.

```ts
export const SkillOverride = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('inherit') }),
  z.object({ mode: z.literal('replace'), skills: z.array(SkillId) }),
  z.object({ mode: z.literal('append'), skills: z.array(SkillId) }),
  z.object({ mode: z.literal('remove'), skills: z.array(SkillId) }),
]);

export const SelectionOverride = z.object({
  model: ModelRef.optional(),
  effort: Effort.optional(),
  skills: SkillOverride.default({ mode: 'inherit' }),
  invocation_options: z.record(z.string(), z.unknown()).default({}),
});
```

- **Adapter Config Schema Contradicts The Documented Config Surface.** (Severity: HIGH)
  - **Claim.** The new `DispatchConfig` cannot parse the documented previous config shape and also fails to model custom adapter registration.
  - **Evidence.** Existing config supports `dispatch.adapters.gemini.command` (`/Users/petepetrash/Code/circuit/circuit.config.example.yaml:32-37`) and role/circuit values as adapter names (`/Users/petepetrash/Code/circuit/circuit.config.example.yaml:23-31`). New `DispatchConfig` has only `default`, `roles`, and `circuits`, with no `adapters` registry (`src/schemas/config.ts:7-11`). `BuiltInAdapter` only includes `agent` and `codex` (`src/schemas/adapter.ts:3-4`), while the documented built-in surface includes `codex-isolated` as the real adapter and `codex` as an alias (`/Users/petepetrash/Code/circuit/circuit.config.example.yaml:16-20`; `bootstrap/abstraction-inventory.md:127-135`).
  - **Why it matters.** Users cannot express the adapter model the inventory says Circuit depends on. Implementation will either relax the schema immediately or create a second compatibility layer with different semantics.
  - **Proposed fix.** Add an adapter registry keyed by adapter name, separate `AdapterName` from `AdapterDescriptor`, and make role/circuit/default references point to names. Decide whether aliases are normalized at parse time or preserved.

- **Executor, Kind, Role, And Gate Are Under-Constrained.** (Severity: MED)
  - **Claim.** The one executor/kind refinement is good, but it leaves invalid dispatch/checkpoint combinations legal.
  - **Evidence.** `Step` only refines `orchestrator -> synthesis|checkpoint` and `worker -> dispatch` (`src/schemas/step.ts:53-64`). `role` is optional on all steps (`src/schemas/step.ts:44`). `Role` includes `orchestrator` (`src/schemas/role.ts:3-4`) even though the surface inventory names only `researcher`, `implementer`, and `reviewer` as dispatch roles (`bootstrap/abstraction-inventory.md:141-149`). `gate` is required but can be any gate kind on any step kind (`src/schemas/step.ts:42`; `src/schemas/gate.ts:24-28`).
  - **Why it matters.** A worker dispatch step can omit role; a worker can be assigned `orchestrator`; a checkpoint step can use a `result_verdict` gate; a dispatch step can use a `schema_sections` gate against an artifact it never writes. Those are invalid runtime states masquerading as valid manifests.
  - **Proposed fix.** Use a discriminated union for step variants instead of one object plus a weak refinement.

```ts
const OrchestratorCheckpointStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('checkpoint'),
  gate: CheckpointSelectionGate,
  role: z.never().optional(),
});

const WorkerDispatchStep = StepBase.extend({
  executor: z.literal('worker'),
  kind: z.literal('dispatch'),
  role: z.enum(['researcher', 'implementer', 'reviewer']),
  gate: ResultVerdictGate,
});
```

- **Gate Source Is An Opaque String Instead Of A Contract Reference.** (Severity: MED)
  - **Claim.** Gates name `source` as arbitrary strings and are not tied to the step's declared writes or artifact schemas.
  - **Evidence.** `SchemaSectionsGate.source`, `CheckpointSelectionGate.source`, and `ResultVerdictGate.source` are `z.string().min(1)` (`src/schemas/gate.ts:3-21`). `StepWrites` has separate optional paths but no invariant tying them to `gate.source` (`src/schemas/step.ts:19-25`).
  - **Why it matters.** Gates can point at files the step does not produce, can accidentally validate a stale artifact, and cannot express "the source is this step's artifact with schema X" at type level.
  - **Proposed fix.** Replace opaque `source` with a typed source union: `{ kind: 'artifact'; ref: 'writes.artifact' }`, `{ kind: 'checkpoint_response'; ref: 'writes.response' }`, `{ kind: 'dispatch_result'; ref: 'writes.result' }`, with a step-level refinement that the referenced write exists.

- **Rigor Semantics Are Hard-Coded And Wrong For Autonomy.** (Severity: MED)
  - **Claim.** `isConsequentialRigor` treats only `deep` and `tournament` as consequential, excluding `autonomous`.
  - **Evidence.** `isConsequentialRigor` returns true only for `deep` or `tournament` (`src/schemas/rigor.ts:6`). Existing workflow docs describe `autonomous` as auto-resolving checkpoints and doing unattended work in multiple workflows (`/Users/petepetrash/Code/circuit/CIRCUITS.md:140`, `/Users/petepetrash/Code/circuit/CIRCUITS.md:159`, `/Users/petepetrash/Code/circuit/CIRCUITS.md:180`, `/Users/petepetrash/Code/circuit/CIRCUITS.md:214`).
  - **Why it matters.** Any later guard that relies on this helper will under-gate the riskiest mode: unattended execution.
  - **Proposed fix.** Delete the helper from the skeleton until rigor semantics are specified, or rename it to the exact property it encodes. If it is intended for escalation, include `autonomous`.

- **Continuity Allows Contradictory Resume State.** (Severity: MED)
  - **Claim.** `ContinuityRecord` can say it is standalone while carrying a run reference, or run-backed without one. `ResumeContract.mode` can contradict `continuity_kind`.
  - **Evidence.** `continuity_kind` is an enum (`src/schemas/continuity.ts:31`), `run_ref` is optional regardless of kind (`src/schemas/continuity.ts:33-38`), and `resume_contract.mode` independently chooses `resume_run` or `resume_standalone` (`src/schemas/continuity.ts:20-24`). The inventory says continuity has two kinds, with run-backed anchored to an in-progress run (`bootstrap/abstraction-inventory.md:193-202`).
  - **Why it matters.** Resume can attach to the wrong execution path or silently drop a run anchor. Continuity is a recovery mechanism; contradictions here become expensive during exactly the sessions where context is already fragile.
  - **Proposed fix.** Make continuity a discriminated union on `continuity_kind`, with `run_ref` and `mode: 'resume_run'` required for run-backed records and forbidden for standalone records.

- **Branded IDs Do Not Protect The Dangerous Edges.** (Severity: MED)
  - **Claim.** Zod brands help at direct API boundaries, but most high-risk references are plain strings or JSON object keys where the brand provides little protection.
  - **Evidence.** `RouteMap` is `z.record(z.string(), z.string())`, not `StepId` targets (`src/schemas/step.ts:28-30`). `StepWrites` paths and gate sources are strings (`src/schemas/step.ts:19-25`; `src/schemas/gate.ts:3-21`). Config records key by branded `WorkflowId` (`src/schemas/config.ts:9-10`, `src/schemas/config.ts:23`), but JSON object keys are still unbranded strings at rest. `WorkflowId`, `PhaseId`, `StepId`, and `SkillId` all share the same slug regex (`src/schemas/ids.ts:3-24`).
  - **Why it matters.** The skeleton gives a false sense of type safety. It prevents passing a parsed `PhaseId` to a TypeScript function expecting `StepId`, but it does not prevent the manifest mistakes most likely to happen.
  - **Proposed fix.** Keep brands where useful, but add graph-level validation for cross-references and replace path/source strings with typed refs. Avoid branded keys in config records unless the parse layer normalizes them into `Map<WorkflowId, ...>` or validates key closure against workflow ids.

- **Phase Spine Is Too Loose To Defend Lane Discipline.** (Severity: MED)
  - **Claim.** `Phase.canonical` is optional and duplicate/missing canonical phases are legal. The skeleton cannot express whether a workflow intentionally omits a shared-spine phase or accidentally forgot it.
  - **Evidence.** `CanonicalPhase` enumerates the shared spine (`src/schemas/phase.ts:4-13`), but `Phase.canonical` is optional (`src/schemas/phase.ts:15-20`). The workflow docs rely on explicit omissions and renames, such as Build omitting Analyze and Explore omitting Act/Verify/Review (`/Users/petepetrash/Code/circuit/CIRCUITS.md:125-149`).
  - **Why it matters.** This preserves the organic "phase as label" ambiguity the rewrite should eliminate. A malformed workflow can silently skip review or verify while still claiming standard rigor.
  - **Proposed fix.** Add workflow-level `spine_policy`: `{ present: CanonicalPhase[]; omitted: { phase; reason }[]; renamed: ... }`, then validate phase canonicals against it.

- **Model And Effort Enums Are Overfit To Today's Marketing Names.** (Severity: MED)
  - **Claim.** `ModelTier` combines provider-specific marketing names and abstract tiers, while `Effort` has values that do not line up with all supported adapters.
  - **Evidence.** `ModelTier` is `haiku`, `sonnet`, `opus`, `gpt-5`, `gpt-5-pro`, `gemini-pro` (`src/schemas/selection-policy.ts:5`). `Effort` is `low`, `medium`, `high`, `max` (`src/schemas/selection-policy.ts:8`). The adapter inventory explicitly spans Claude Agent, Codex CLI, custom wrappers, OpenAI, Anthropic, and Gemini surfaces (`bootstrap/abstraction-inventory.md:127-139`).
  - **Why it matters.** This will break as soon as a provider changes model names or exposes non-matching effort values. The model field should not require a type release for every model release.
  - **Proposed fix.** Use provider-scoped model refs and adapter-specific option bags: `{ provider: 'openai'|'anthropic'|'gemini'|'custom'; model: string; effort?: string }`, then validate known built-ins in adapter-specific code.

- **Schema Parity Tests Ratify Weaknesses.** (Severity: LOW)
  - **Claim.** The contract test suite mostly proves permissiveness rather than invariants.
  - **Evidence.** It asserts `SelectionPolicy.safeParse({})` succeeds (`tests/contracts/schema-parity.test.ts:63-68`), a snapshot with a completed step and no corresponding event succeeds (`tests/contracts/schema-parity.test.ts:171-183`), and a workflow with a single phase/step succeeds (`tests/contracts/schema-parity.test.ts:119-155`). There are no negative tests for broken graph references, invalid gate/step combos, contradictory continuity records, or config precedence ambiguity.
  - **Why it matters.** The tests will make future tightening look like regressions unless the intended invariants are encoded now.
  - **Proposed fix.** Add negative contract tests for every cross-record invariant before implementation code depends on the permissive behavior.

## Hidden Assumptions Surfaced

- Workflow manifests are assumed to be tree-shaped arrays, not graphs requiring closure checks.
- Empty arrays are assumed to mean the same thing across defaults, overrides, and explicit clearing.
- Model names are assumed to be stable enough for a central enum.
- Gate evaluation is assumed to be local to files on disk, not part of replayable state.
- The orchestrator role is assumed to be both an executor and a dispatch role.
- Run bootstrap is assumed to happen after config resolution, but resolved config is not persisted.
- `autonomous` rigor is assumed less governance-relevant than `deep` or `tournament`.
- Event ordering is assumed to be valid if `sequence` is a nonnegative integer; monotonicity and contiguity are left out.
- Phase omissions are assumed obvious from human-readable titles rather than machine-checkable policy.
- Custom adapter names are assumed expressible inline at every reference point instead of through a registry.

## Missing Invariants

- **Workflow graph closure.** Every step id is unique; every reference resolves; every route target is `@complete` or a known step; every phase references known steps.

```ts
Workflow.superRefine(validateWorkflowGraph);
```

- **Lane framing attached to execution.** Every run has a lane declaration; `migration-escrow` requires an expiry and rollback/restoration plan; `break-glass` requires post-hoc ADR deadline.

```ts
const MigrationEscrowLane = LaneDeclaration.extend({
  lane: z.literal('migration-escrow'),
  expires_at: z.string().datetime(),
  restoration_plan: z.string().min(1),
});
```

- **Step variant legality.** Orchestrator synthesis writes artifacts and uses schema-section gates; orchestrator checkpoint writes request/response and uses checkpoint-selection gates; worker dispatch has a worker role, writes receipt/result, and uses result-verdict gates.

```ts
export const Step = z.discriminatedUnion('kind', [
  SynthesisStep,
  CheckpointStep,
  DispatchStep,
]);
```

- **Selection precedence and skill merge semantics.** Defaults, user-global, project, workflow, phase, step, and invocation layers need explicit order and explicit replace/append/remove behavior.

```ts
export const SelectionResolution = z.object({
  order: z.tuple([
    z.literal('default'),
    z.literal('user-global'),
    z.literal('project'),
    z.literal('workflow'),
    z.literal('phase'),
    z.literal('step'),
    z.literal('invocation'),
  ]),
  resolved: SelectionPolicy,
  applied: z.array(z.object({ source: SelectionSource, override: SelectionOverride })),
});
```

- **Event replay sufficiency.** A reducer should be able to reconstruct `Snapshot` without consulting mutable config or artifacts except where an event explicitly names an immutable content hash/path.

```ts
const EventBase = z.object({
  schema_version: z.literal(1),
  sequence: z.number().int().nonnegative(),
  previous_event_hash: z.string().optional(),
  event_hash: z.string(),
  recorded_at: z.string().datetime(),
  run_id: RunId,
});
```

- **Continuity discriminants.** `standalone` records must not carry `run_ref`; `run-backed` records must carry `run_ref` and `resume_run`.

```ts
export const ContinuityRecord = z.discriminatedUnion('continuity_kind', [
  StandaloneContinuityRecord,
  RunBackedContinuityRecord,
]);
```

- **Config adapter registry closure.** Role/circuit/default adapter refs must resolve to either built-ins or names in `dispatch.adapters`.

```ts
DispatchConfig.superRefine(validateAdapterRefs);
```

## Overfit to Existing Circuit

- The shared spine plus optional renamed phases carries forward the existing catalog's organic phase vocabulary instead of forcing a smaller state-machine model.
- Three gate kinds mirror current file artifacts, checkpoint responses, and worker verdicts; the skeleton does not ask whether "gate = predicate over typed output" would collapse all three.
- Roles are copied from the old researcher/implementer/reviewer surface and then `orchestrator` is added, muddying role versus executor.
- Dispatch resolution preserves the old role/circuit/default ladder, but the new selection-policy goal wants model/effort/skills at step granularity. Those should probably be one resolution system, not two parallel ones.
- Workflow `default_skills` plus config `circuits.*.skills` plus step `selection.skills` duplicates the existing skill injection channels instead of defining one canonical skill override contract.

## Things That Look Good

- The executor/kind refinement catches the most obvious impossible step combination (`src/schemas/step.ts:53-64`).
- The six methodology lanes are enumerated directly and named in implementation-friendly kebab case (`src/schemas/lane.ts:3-10`).
- Gate kinds are discriminated unions, which is the right direction for parse-first boundary validation (`src/schemas/gate.ts:24-28`).
- Runtime schemas and exported inferred types are co-located, reducing drift between compile-time and runtime contracts.
- `ProtocolId` includes an explicit version suffix, which is defensible for artifact/protocol evolution (`src/schemas/ids.ts:26-30`).

## What I Did NOT Review

- I did not read `bootstrap/evidence-draft-claude.md`, `bootstrap/evidence-draft-codex.md`, or any external-evidence file, per instruction.
- I did not read `~/Code/circuit/docs/` or implementation source under `~/Code/circuit`.
- I did not review generated schema JSON, package configuration, build settings, or runtime engine code.
- I did not run the test suite; this was a type-contract adversarial pass, not implementation verification.
- I did not attempt to patch the skeleton; the operator should decide which objections become changes.

## Cross-Model Failure-Mode Self-Audit

- I may be overvaluing type-level enforcement and undervaluing a deliberate plan to put graph validation in a compiler pass. Claude may share that bias because both models have been primed by the methodology's "Architecture-First types" language.
- I may be treating the skeleton as a near-public contract when the operator intended it as a disposable Phase 0 sketch. Claude could make the same category error if it reads "schema" as "contract."
- I may be underestimating the ergonomics cost of richer discriminated unions. Claude may also prefer elegant type machinery that makes authoring custom workflows harder.
- I may be too suspicious of old Circuit's abstractions and therefore attack useful continuity with the prior system. A Claude reviewer trained on the same artifacts may share the "rewrite should shed complexity" prior.
- I may miss plugin-host constraints that force looser schemas because I did not read Claude Code plugin docs or implementation source in this pass.
