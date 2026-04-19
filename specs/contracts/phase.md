---
contract: phase
status: ratified-v0.1
version: 0.1
schema_source: src/schemas/phase.ts
last_updated: 2026-04-19
depends_on: [ids, step]
closes: [adversarial-review-med-11-spine-policy]
codex_adversarial_review: specs/reviews/phase-md-v0.1-codex.md
artifact_ids:
  - phase.definition
---

# Phase Contract

A **Phase** is a named, ordered grouping of **Steps** within a **Workflow**.
Phases may optionally align with the **canonical spine** —
`frame → analyze → plan → act → verify → review → close` — or be workflow-
specific. A Phase is an organizational layer over Steps; it does not own
execution semantics. Step invariants (routing, gating, writes) live in
`specs/contracts/step.md`.

## Ubiquitous language

See `specs/domain.md#core-types` for canonical definitions of **Phase**,
**Step**, and the seven canonical-phase labels. Do not introduce synonyms;
new vocabulary must land in `specs/domain.md` before use here.

## Invariants

The runtime MUST reject any Phase that violates these. All invariants are
enforced via `src/schemas/phase.ts` + `src/schemas/workflow.ts` and tested
in `tests/contracts/schema-parity.test.ts`.

- **PHASE-I1 — Non-empty steps.** `Phase.steps` contains at least one
  `StepId`. Enforced at `src/schemas/phase.ts` via `z.array(StepId).min(1)`.

- **PHASE-I2 — Strict surplus-key rejection.** `Phase` is declared with
  `.strict()`. Surplus keys are rejected at parse time, not silently
  stripped. This closes the same defense-in-depth gap adversarial-review
  MED #4 raised for `Step` and applies it to `Phase`: a YAML workflow with
  a typo (e.g., `conanical: 'review'`) fails parse rather than silently
  dropping the canonical binding.

- **PHASE-I3 — Canonical label closed to enum.** When present,
  `Phase.canonical` MUST be one of the seven `CanonicalPhase` values
  (`frame`, `analyze`, `plan`, `act`, `verify`, `review`, `close`).
  Enforced by `z.enum` in `src/schemas/phase.ts`.

- **PHASE-I4 — Spine policy declaration enforcement (closes
  adversarial-review MED #11 at the *declaration* layer only).** Every
  `Workflow` MUST declare a `spine_policy` discriminated union. Two modes
  are accepted:

  - `mode: 'strict'` — every one of the seven canonical phases MUST appear
    as the `canonical` field on at least one `Phase` in `Workflow.phases`.
  - `mode: 'partial'` — the Workflow explicitly declares an
    `omits: CanonicalPhase[]` array (non-empty, pairwise unique, disjoint
    from declared `Phase.canonical` values) plus a `rationale: string`
    (≥20 characters). Every canonical phase NOT in `omits` still MUST
    appear as a `Phase.canonical`.

  **Scope caveat — what this invariant does NOT guarantee.** PHASE-I4 is
  a *label-level* check. It guarantees that a canonical phase has been
  *named* in the manifest. It does not guarantee that the named phase
  contains a semantically-adequate step (for example, that a `review`
  phase actually dispatches a reviewer, or that a `verify` phase runs a
  gate). It also does not guarantee that the named phase is reached by
  any entry-mode execution path. A determined author can satisfy the
  label bar while routing around review or verify at runtime. The
  Codex adversarial property-auditor (2026-04-18) flagged these as
  HIGH #1-3; they are tracked as property ids for Phase 2 enforcement
  (see `phase.prop.*_semantic_coverage` and
  `phase.prop.*_reachability` below) and NOT claimed closed by this
  invariant.

  The 20-character rationale requirement is a structural *minimum* (a
  non-empty human-readable note), not a Goodhart-proof discipline gate
  (`aaaaaaaaaaaaaaaaaaaa` satisfies it). Rationale quality is audited
  out of band (`npm run audit` + Phase 1 reviewer-human pairing); v0.2
  may upgrade `rationale` to a structured record with
  `accepted_risk_ref` pointing into `specs/risks.md`.

  Enforced in `src/schemas/workflow.ts` `superRefine` + `src/schemas/phase.ts`
  (SpinePolicy discriminated union); negative coverage in
  `tests/contracts/schema-parity.test.ts`.

- **PHASE-I5 — Canonical uniqueness within a workflow.** No two
  `Phase`s in the same `Workflow` may share the same defined
  `canonical` value. (Phases with `canonical: undefined` — workflow-
  specific phases — are permitted in unlimited number.) A workflow that
  declares two `canonical: 'review'` phases is structurally ambiguous
  about which is "the" review for audit/dispatch purposes; rather than
  pick a silent convention, circuit-next rejects the ambiguity at
  parse time. Closes Codex adversarial-auditor MED #4. Enforced in
  `src/schemas/workflow.ts` `superRefine`; negative coverage in
  `tests/contracts/schema-parity.test.ts`.

- **PHASE-I6 — Workflow-level strict surplus-key rejection.** The
  `Workflow` schema itself is `.strict()`, so top-level surplus keys
  (e.g., misspelled `spine_plicy`, stray `audit_notes`, or alternate-
  spine smuggling under a different name) are rejected at parse time.
  This is defense-in-depth against the same typo class PHASE-I2 handles
  at the Phase level. Closes Codex adversarial-auditor LOW #8. Enforced
  at `src/schemas/workflow.ts`.

## Pre-conditions

- `Phase` objects must parse under `Phase.safeParse`.
- Every `StepId` in `Phase.steps` must be the `id` of a `Step` in the
  enclosing `Workflow.steps` (enforced at the Workflow level by WF-I3).
- The `Phase.id` must be unique within the enclosing Workflow (WF-I6).

## Post-conditions

After a Phase is accepted in a Workflow:

- `Phase.steps.length >= 1` (PHASE-I1).
- `Phase.canonical`, when present, is a valid `CanonicalPhase` value
  (PHASE-I3).
- The enclosing Workflow's spine-policy contract is satisfied (PHASE-I4).
- `Phase.id` is unique within the Workflow (WF-I6).
- Every `StepId` in `Phase.steps` resolves to a known Step (WF-I3).

## Property ids (reserved for Phase 2 testing)

Property-based tests will cover:

- `phase.prop.steps_closure` — For any valid Workflow, every `StepId` in
  any Phase's `steps` list resolves to a sibling Step.
- `phase.prop.unique_ids` — For any valid Workflow, Phase ids are
  pairwise distinct (covered at the Workflow level; restated here for
  cross-contract clarity).
- `phase.prop.unique_canonicals` — For any valid Workflow, defined
  `Phase.canonical` values are pairwise distinct (PHASE-I5).
- `phase.prop.canonical_set_is_enum` — For any valid Phase, if `canonical`
  is present it is an element of `CanonicalPhase`.
- `phase.prop.spine_strict_covers_all_seven` — For any valid Workflow
  with `spine_policy.mode === 'strict'`, the set of
  `Phase.canonical` values (ignoring undefined) is a superset of the seven
  canonical labels.
- `phase.prop.spine_partial_covers_complement` — For any valid Workflow
  with `spine_policy.mode === 'partial'` and `omits = O`, the set of
  `Phase.canonical` values is a superset of `CanonicalPhase \ O`.
- `phase.prop.omits_disjoint_from_declared` — For any valid Workflow
  with `spine_policy.mode === 'partial'`, `omits ∩ declaredCanonicals
  === ∅`. A canonical cannot be both omitted and declared (closes Codex
  MED #6.a).
- `phase.prop.omits_pairwise_unique` — For any valid Workflow with
  `spine_policy.mode === 'partial'`, `omits` has no duplicate entries
  (closes Codex MED #6.b).
- `phase.prop.partial_requires_rationale` — Any Workflow with
  `spine_policy.mode === 'partial'` and `rationale.length < 20` is
  rejected.

### Reserved for Phase 2 (HIGH gaps from Codex adversarial-auditor pass)

These are the invariants PHASE-I4 is *not* strong enough to guarantee
alone. They land when the property-test harness + event-log seams
exist in Phase 2:

- `phase.prop.review_semantic_adequacy` — For any valid Workflow whose
  spine declares `review`, at least one Step in the review phase MUST
  be a `DispatchStep` with `role: 'reviewer'`, or a `CheckpointStep`
  that dispatches a human reviewer. (Closes Codex HIGH #1 for
  `review`; analogous properties for other canonicals are tracked but
  not listed separately until Phase 2 design lands.)
- `phase.prop.verify_semantic_adequacy` — For any valid Workflow whose
  spine declares `verify`, at least one Step in the verify phase MUST
  carry a verification gate or protocol. (Closes Codex HIGH #1 for
  `verify`.)
- `phase.prop.canonical_phase_reachability` — For every non-omitted
  canonical phase, at least one Step in that phase MUST be reachable
  from at least one Workflow entry mode along a valid route sequence.
  A workflow cannot satisfy spine_policy and then route from `frame`
  directly to `@complete`, skipping all declared canonicals. (Closes
  Codex HIGH #2.)
- `phase.prop.every_step_has_a_phase` — For every Step in
  `Workflow.steps`, exactly one `Phase` in `Workflow.phases` lists the
  Step's id in its `steps` array. No Step may execute outside the Phase
  structure. (Closes Codex HIGH #3. A `utility: true` escape hatch for
  cross-phase helpers may be added in Phase 2 if evidence justifies it,
  but is not granted in v0.1.)

## Cross-contract dependencies

- **workflow** (`src/schemas/workflow.ts`) — Workflow embeds `Phase[]`.
  Spine enforcement, Phase-id uniqueness (WF-I6), Phase-step closure
  (WF-I3), canonical uniqueness (PHASE-I5), Workflow-level strict surplus
  rejection (PHASE-I6) all live on the Workflow schema; they reference
  Phase shape but are owned by workflow.md.
- **step** (`src/schemas/step.ts`) — Phase holds `StepId[]`. No direct
  Step-shape dependency from Phase itself; Phase just groups existing
  Steps.
- **selection-policy** (`src/schemas/selection-policy.ts`) —
  `domain.md#configuration-vocabulary` lists `phase` as a selection
  layer, and `SelectionSource` includes `'phase'`. `Phase.selection:
  SelectionOverride.optional()` landed in `selection.md` v0.1 (SEL-I9),
  closing phase.md v0.1 Codex MED #7. Any `SelectionResolution.applied`
  entry claiming a `phase` source now resolves to an explicit
  `Phase.selection` field on the named phase.
- **ids** (`src/schemas/ids.ts`) — `PhaseId` and `StepId` branded slugs.

## Failure modes (carried from evidence)

- `carry-forward:spine-policy-too-loose` — Prior to this contract,
  `Phase.canonical` was optional with no cross-workflow check that
  required canonical labels were present. A malformed workflow could
  silently skip `review`, short-circuiting the cross-model-challenger
  gate. `specs/contracts/workflow.md` v0.1 flagged this as
  `carry-forward:spine-policy-too-loose`, and `specs/evidence.md`
  §Adversarial MED #11 lists it among the open Tier 0 ratchets. Closed
  by PHASE-I4.

- `carry-forward:surplus-key-silent-strip` — Prior to this contract,
  `Phase` was not `.strict()`, so a typo like `conanical` (three-char
  swap of `canonical`) parsed as a legal Phase with `canonical:
  undefined`, silently losing the spine binding. Closed by PHASE-I2.

## Evolution

- **v0.1 (this draft)** — PHASE-I1..I6 enforced: non-empty steps, strict
  surplus-key rejection on Phase, canonical enum closure,
  spine-policy declaration enforcement (PHASE-I4, MED #11 closed *at
  the declaration layer*; see scope caveat in the invariant), canonical
  uniqueness within a workflow (PHASE-I5, closes Codex MED #4),
  Workflow-level `.strict()` (PHASE-I6, closes Codex LOW #8). `omits`
  now enforces uniqueness + disjointness from declared canonicals
  (closes Codex MED #6). HIGH semantic/reachability/coverage objections
  from the Codex adversarial pass are honestly scoped as property_ids
  for Phase 2 (see "Reserved for Phase 2" section above); PHASE-I4
  prose was tightened to stop over-claiming closure. Full adversarial-
  review record at `specs/reviews/phase-md-v0.1-codex.md`.

- **v0.2 (Phase 1)** — Ratify `property_ids` above by landing the
  corresponding property-test harness. Upgrade `SpinePolicy.rationale`
  from a min(20) string to a structured record (`accepted_risk_ref`
  into `specs/risks.md`, `substitute_phase_id?`) if evidence from real
  workflows justifies the cost. Author `selection.md` and decide whether
  `Phase.selection: SelectionOverride` lands on Phase or derives from
  `Workflow.default_selection` conditioned on `canonical` (closes Codex
  MED #7). Consider `spine_policy.renames` if a workflow needs to
  rename `analyze` → `explore` (cosmetic; not a structural gap).

- **v1.0 (Phase 2)** — Ratified invariants + property tests + semantic-
  adequacy + reachability + every-step-has-a-phase (the three Codex
  HIGH gaps) + operator-facing error-message catalog + mutation-score
  floor contribution.
