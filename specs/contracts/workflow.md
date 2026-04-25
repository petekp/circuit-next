---
contract: workflow
status: draft
version: 0.3
schema_source: src/schemas/workflow.ts
last_updated: 2026-04-24
depends_on: [step, phase, rigor, lane, selection-policy]
codex_adversarial_review: specs/reviews/workflow-md-v0.3-codex.md
artifact_ids:
  - workflow.definition
  - workflow.primitive_catalog
invariant_ids: [WF-I1, WF-I2, WF-I3, WF-I4, WF-I5, WF-I6, WF-I7, WF-I8, WF-I9, WF-I10, WF-I11]
property_ids: [workflow.prop.entry_mode_reachability, workflow.prop.no_dead_steps, workflow.prop.phase_step_closure, workflow.prop.route_target_closure, workflow.prop.terminal_target_coverage]
---

# Workflow Contract

A **Workflow** is a typed, versioned definition of a multi-step automation.
It compiles to a stable execution graph the runtime can replay from events.

## Ubiquitous language

See `specs/domain.md#core-types` for canonical term definitions.

## Invariants

The runtime MUST reject any Workflow that violates these. All invariants
are enforced by the `Workflow` Zod schema — some as literal fields on
`WorkflowBody` (e.g. WF-I7's `schema_version` literal), the remainder
inside `Workflow.superRefine` — and tested in
`tests/contracts/schema-parity.test.ts`.

- **WF-I1 — Unique step ids.** No two steps in `Workflow.steps` share an `id`.
- **WF-I2 — Closed entry references.** Every `EntryMode.start_at` must be the
  `id` of an existing step.
- **WF-I3 — Closed phase references.** Every `StepId` in `Phase.steps` must
  be the `id` of an existing step.
- **WF-I4 — Closed route targets.** Every route target in `Step.routes`
  must be either a terminal label (`@complete`, `@stop`, `@escalate`,
  `@handoff`) or the `id` of an existing step.
- **WF-I5 — Unique entry mode names.** No two `EntryMode`s share a `name`.
- **WF-I6 — Unique phase ids.** No two `Phase`s share an `id`.
- **WF-I7 — Schema version is 2.** The literal `schema_version: '2'` is
  required. v1 manifests are not accepted; migration is a future Phase 2
  concern.
- **WF-I8 — Terminal reachability.** For every step in `Workflow.steps`,
  at least one chain of `routes` starting at that step eventually reaches
  a terminal route target (`@complete`, `@stop`, `@escalate`, `@handoff`).
  A workflow that contains a step unable to reach any terminal is rejected
  at parse time. In particular, every `EntryMode.start_at` step reaches a
  terminal, so a bootstrapped Run is always capable of closing. Without
  this invariant, a plugin-authored workflow fixture could bootstrap a Run
  but never emit `run.closed`, producing a hung run state.
- **WF-I9 — No dead steps.** For every step in `Workflow.steps`, there is
  at least one chain of `routes` from some `EntryMode.start_at` that
  reaches that step. A workflow that declares a step unreachable from any
  entry mode is rejected at parse time. Unreachable steps are a silent
  declaration bug (the author believes the step will execute but it
  never will), not a feature; WF-I9 fails the fixture fast rather than
  letting it pass and then puzzling the operator.
- **WF-I10 — Pass-route presence.** Every step's `routes` map must
  contain the key `pass`. The `GateEvaluatedEvent.outcome` field in
  `src/schemas/event.ts` is `z.enum(['pass', 'fail'])` — uniform across
  all three gate kinds (`schema_sections`, `checkpoint_selection`,
  `result_verdict`) — so the runtime's route pick on a successful gate
  outcome looks up `routes['pass']`. A fixture whose routes use
  author-friendly aliases like `{ success: '@complete' }` would satisfy
  WF-I8 (the edge labelled `success` reaches a terminal) and still
  stall at runtime because `routes['pass']` is undefined. WF-I10 is
  the parse-time version of that binding. `fail`-route presence is
  **deferred** to v0.3 / Phase 2 — failure-path handling is not part of
  the narrow dogfood-run-0 proof and the runtime abort-vs-stall
  behaviour on a missing `fail` route is not yet specified.
- **WF-I11 — Pass-route terminal reachability.** For every step in
  `Workflow.steps`, following only `routes.pass` must eventually reach a
  terminal route target (`@complete`, `@stop`, `@escalate`, `@handoff`).
  WF-I8 remains the broad graph sanity check: a step must have at least
  one route chain to a terminal. WF-I11 is the runtime-liveness binding:
  the current runner follows only successful `pass` routes after gates
  pass, so a workflow where `routes.pass` cycles while `routes.fail`
  points to `@complete` is rejected at parse time instead of hanging a
  run.

## Pre-conditions

- Workflow YAML (or equivalent JSON) must parse under `Workflow.safeParse`.
- The Workflow's declared `default_skills` must exist in the skill
  registry at load time (validated by the runtime, not the schema).

## Post-conditions

After a Workflow is accepted:

- The Workflow's `id` is globally unique within the plugin's catalog.
- The Workflow's `version` is monotonically increasing within its `id`
  (enforced by catalog compiler, not by schema).
- The Workflow's step graph is closed under `WF-I1..4`.
- The Workflow is referentially serializable to `circuit.manifest.yaml`.

## Property ids (reserved for Phase 2 testing)

Property-based tests will cover:

- `workflow.prop.route_target_closure` — For any valid Workflow, all route
  targets resolve.
- `workflow.prop.phase_step_closure` — For any valid Workflow, all phase
  step references resolve.
- `workflow.prop.entry_mode_reachability` — For every entry mode, the
  `start_at` step is reachable by at least one sequence of routes leading
  to a terminal target.
- `workflow.prop.no_dead_steps` — Every step is reachable from at least
  one entry mode. (Note: now also enforced structurally at parse time
  as **WF-I9**; this property id remains reserved for Slice 29's
  property-harness fast-check generation around the same semantics.
  The earlier "modulo `disposable`-lane workflows" carveout is
  **removed in v0.2** — WF-I9 is unconditional, and the v0.1
  disposable-lane exception was never reflected in the schema.)
- `workflow.prop.terminal_target_coverage` — Every step's routes either
  include a terminal target or every route target is itself a step whose
  routes eventually include one.
  **Scope note:** this is the broad WF-I8 property. Pass-route-only
  terminal reachability is a separate parse-time invariant, WF-I11,
  because runtime success flow follows only `routes.pass`.

## Cross-contract dependencies

- **step**: Workflow embeds `Step[]`. Step variant invariants (WF-depends-
  on-Step) are in `specs/contracts/step.md`.
- **phase**: Workflow embeds `Phase[]`. Phase invariants in
  `specs/contracts/phase.md` (ratified v0.1; PHASE-I1..I5 + spine_policy enforcement).
- **rigor**: `EntryMode.rigor` must be a valid `Rigor` value.
- **lane**: `EntryMode.default_lane` is optional; when present, must be
  a valid `Lane` literal.
- **selection-policy**: `Workflow.default_selection` is a
  `SelectionOverride` and obeys selection precedence (see
  `specs/contracts/selection.md`).

## Failure modes (carried from evidence)

- `carry-forward:verdict-enum-bloat` — Existing Circuit uses per-protocol
  verdict conditionals. circuit-next's Step discriminated union constrains
  verdicts per step kind, not per protocol.
- `carry-forward:prose-yaml-drift` — Existing Circuit's SKILL.md can
  silently disagree with `circuit.yaml`. A Phase 1 contract test
  (prose-yaml-parity, see `specs/behavioral/prose-yaml-parity.md` — future)
  must prevent this for circuit-next.
- `carry-forward:spine-policy-too-loose` — **Closed in phase.md v0.1.**
  `Workflow.spine_policy` is a required discriminated union with two
  modes: `strict` (all seven canonical phases required) and `partial`
  (explicit `omits` + rationale ≥20 chars). Silent skip of `review` or
  `verify` is now rejected at parse time. See
  `specs/contracts/phase.md` PHASE-I4. Adversarial-review MED #11 is
  closed.

## Gate source tightening

Adversarial-review MED objection #7 is **closed in step.md v0.1**. Gate
sources are typed per gate variant: `SchemaSectionsGate.source` is
`ArtifactSource`, `CheckpointSelectionGate.source` is
`CheckpointResponseSource`, `ResultVerdictGate.source` is
`DispatchResultSource`. The `Step` discriminated union validates
`gate.source.ref` against the step variant's `writes` slots via
`superRefine`. See `specs/contracts/step.md` invariants STEP-I3 and
STEP-I4.

## Evolution

- **v0.1 (skeleton)**: initial contract with graph-closure invariants
  WF-I1..I7. Grandfathered via `bootstrap/adversarial-review-codex.md`
  (6 HIGH + 3 MED incorporated at tier-0) before the
  `specs/reviews/` convention existed.
- **v0.2 (Phase 1, Slice 27)**: narrowed to what
  `dogfood-run-0` (Phase 1.5 Alpha Proof) structurally needs beyond the
  skeleton. Adds **WF-I8** (terminal reachability) and **WF-I9** (no
  dead steps) — both promoted from `workflow.prop.*` reserved properties
  into parse-time invariants enforced by `Workflow.superRefine`. Adds
  **WF-I10** (pass-route presence) as a Codex challenger HIGH #1
  fold-in — binds every step's `routes` map to the
  `GateEvaluatedEvent.outcome` enum at the parse layer so a fixture
  using author-friendly route aliases like `{ success: '@complete' }`
  cannot pass WF-I8 and then stall at runtime. Rationale for promoting
  graph semantics to parse-time invariants rather than property tests:
  preferring types over tests where the type can express the invariant
  (CLAUDE.md §Architecture-First types). Exits the skeleton grandfather
  and binds to a proper review record at
  `specs/reviews/workflow-md-v0.2-codex.md`.
- **v0.3 (Runtime Safety Floor Slice 4, this version)**: adds
  **WF-I11** (pass-route terminal reachability) after runtime evidence
  showed WF-I8's broad
  graph rule was not enough for liveness. A workflow can satisfy WF-I8 by
  routing `fail` to `@complete` while `pass` loops forever; because the
  current runner follows `routes.pass` after successful gates, WF-I11
  follows only pass edges and rejects self-cycles and multi-step
  pass-cycles at parse time. Binds to the canonical contract review at
  `specs/reviews/workflow-md-v0.3-codex.md` and the runtime-safety floor
  Slice 72 challenger review at `specs/reviews/arc-slice-72-codex.md`.
  Gate source tightening
  (v0.1 adversarial MED #7) **closed in step.md v0.1** — see the "Gate
  source tightening" section above. Spine policy (v0.1 adversarial
  MED #11) **closed in phase.md v0.1** — `Workflow.spine_policy` is a
  required discriminated union enforced in `Workflow.superRefine`. See
  `specs/contracts/phase.md` PHASE-I4. **Deferred to v0.3 / Phase 2:**
  (a) ratified property-test harness registration for the five reserved
  `workflow.prop.*` ids (Slice 29 property registry scaffold);
  (b) `fail`-route presence — not part of the narrow dogfood-run-0
  proof and runtime failure-path behaviour is not yet specified;
  (c) exact-one-phase step membership (v0.1 bootstrap adversarial
  HIGH #1 subfinding, not closed in this slice — `Phase.steps` closure
  is enforced, but "every `Workflow.steps[]` id appears in exactly one
  phase" is left for Phase 2 per `specs/contracts/phase.md` §Evolution
  and will be revisited when manifest compilation starts consuming
  `Phase.steps` as an ordered execution plan).
- **v1.0 (Phase 2)**: ratified invariants + property tests + operator
  documentation.
