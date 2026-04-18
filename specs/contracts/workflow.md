---
contract: workflow
status: draft
version: 0.1
schema_source: src/schemas/workflow.ts
last_updated: 2026-04-18
depends_on: [step, phase, rigor, lane, selection-policy]
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
  `specs/contracts/phase.md` (future).
- **rigor**: `EntryMode.rigor` must be a valid `Rigor` value.
- **lane**: `EntryMode.default_lane` is optional; when present, must be
  a valid `Lane` literal.
- **selection-policy**: `Workflow.default_selection` is a
  `SelectionOverride` and obeys selection precedence (see
  `specs/contracts/selection.md`, future).

## Failure modes (carried from evidence)

- `carry-forward:verdict-enum-bloat` — Existing Circuit uses per-protocol
  verdict conditionals. circuit-next's Step discriminated union constrains
  verdicts per step kind, not per protocol.
- `carry-forward:prose-yaml-drift` — Existing Circuit's SKILL.md can
  silently disagree with `circuit.yaml`. A Phase 1 contract test
  (prose-yaml-parity, see `specs/behavioral/prose-yaml-parity.md` — future)
  must prevent this for circuit-next.
- `carry-forward:spine-policy-too-loose` — `Phase.canonical` is optional;
  a malformed workflow can silently skip Review. Phase 1 contract
  authorship should decide whether to add a workflow-level `spine_policy`
  (adversarial-review MED #11).

## Gate source tightening (Phase 1 open)

Adversarial-review MED objection #7: `Gate.source` is an opaque string.
Phase 1 should decide whether to replace it with a typed reference like
`{ kind: 'artifact'; ref: 'writes.artifact' }`. The current schema accepts
arbitrary strings; a superRefine at workflow level could validate that
every `gate.source` resolves to a `writes.*` slot of the same step.

## Evolution

- **v0.1 (this draft)**: initial contract with graph-closure invariants.
- **v0.2 (Phase 1)**: add ratified property ids; decide gate source
  tightening (MED #7); decide spine policy (MED #11).
- **v1.0 (Phase 2)**: ratified invariants + property tests + operator
  documentation.
