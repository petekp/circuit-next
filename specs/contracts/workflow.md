---
contract: workflow
status: draft
version: 0.1
schema_source: src/schemas/workflow.ts
last_updated: 2026-04-19
depends_on: [step, phase, rigor, lane, selection-policy]
codex_adversarial_review_grandfathered: authored as a Phase 1 kickoff skeleton before the specs/reviews/ convention existed; adversarial findings against the skeleton were recorded in bootstrap/adversarial-review-codex.md (6 HIGH + 3 MED incorporated at tier-0). v0.2 will promote to a proper specs/reviews/workflow-md-v<version>-codex.md when the contract gains non-skeleton invariants.
grandfathered_source_ref: path:bootstrap/adversarial-review-codex.md
grandfathered_scope: workflow.md v0.1 skeleton only — WF-I1 through WF-I7 (closed-reference invariants across step ids, entry modes, phase ids, route targets, plus schema_version=2) in src/schemas/workflow.ts. Any addition of non-skeleton invariants, any change to the Workflow structural shape beyond the current v2 schema, or any promotion of the contract past v0.1 exits the grandfather and requires specs/reviews/workflow-md-v0.2-codex.md.
grandfathered_scope_ids: WF-I1 WF-I2 WF-I3 WF-I4 WF-I5 WF-I6 WF-I7
expires_on_contract_change: true
artifact_ids:
  - workflow.definition
invariant_ids: [WF-I1, WF-I2, WF-I3, WF-I4, WF-I5, WF-I6, WF-I7]
property_ids: [workflow.prop.entry_mode_reachability, workflow.prop.no_dead_steps, workflow.prop.phase_step_closure, workflow.prop.route_target_closure, workflow.prop.terminal_target_coverage]
---

# Workflow Contract

A **Workflow** is a typed, versioned definition of a multi-step automation.
It compiles to a stable execution graph the runtime can replay from events.

## Ubiquitous language

See `specs/domain.md#core-types` for canonical term definitions.

## Invariants

The runtime MUST reject any Workflow that violates these. All invariants are
enforced via `src/schemas/workflow.ts` `superRefine` and tested in
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
  one entry mode (modulo `disposable`-lane workflows).
- `workflow.prop.terminal_target_coverage` — Every step's routes either
  include a terminal target or every route target is itself a step whose
  routes eventually include one.

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

- **v0.1 (this draft)**: initial contract with graph-closure invariants.
- **v0.2 (Phase 1)**: add ratified property ids; fold in any follow-ups
  from the Phase 1 adversarial property-auditor pass. Gate source
  tightening (MED #7) **closed in step.md v0.1** — see the "Gate source
  tightening" section above. Spine policy (MED #11) **closed in phase.md
  v0.1** — `Workflow.spine_policy` is a required discriminated union
  enforced in the Workflow `superRefine`. See
  `specs/contracts/phase.md` PHASE-I4.
- **v1.0 (Phase 2)**: ratified invariants + property tests + operator
  documentation.
