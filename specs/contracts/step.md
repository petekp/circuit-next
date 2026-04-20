---
contract: step
status: draft
version: 0.1
schema_source: src/schemas/step.ts
last_updated: 2026-04-19
depends_on: [ids, gate, selection-policy]
codex_adversarial_review_grandfathered: authored in Slice 2 before the specs/reviews/ convention existed; inline review body (MED #7 gate.source as typed reference) lives in commit f5a6241 + PROJECT_STATE.md §Slice 2 "Adversarial-review MED #7 closed" with the Gate.source discriminated union + superRefine landing evidence. Any v0.2 modification to step.md re-opens this slot — land a proper specs/reviews/step-md-v<version>-codex.md at that point.
grandfathered_source_ref: commit:4b6688e
grandfathered_scope: step.md v0.1 only — the Slice 2 surface comprising the Step discriminated union (SynthesisStep / CheckpointStep / DispatchStep) in src/schemas/step.ts, the Gate.source typed reference in src/schemas/gate.ts, and the gate-superRefine coupling of kind ↔ gate ↔ writes. Any change to schema_source src/schemas/step.ts or src/schemas/gate.ts that adds, removes, or renames a Step variant or a Gate variant, or any addition/relaxation of a numbered invariant in this contract, exits the grandfather and requires specs/reviews/step-md-v<version>-codex.md. (Slice 24 Codex MED #8 fold-in — scope now names src/schemas/gate.ts alongside src/schemas/step.ts since STEP-I3/I4 evidence lives primarily in gate.ts.)
grandfathered_scope_ids: STEP-I1 STEP-I2 STEP-I3 STEP-I4 STEP-I5 STEP-I6 STEP-I7
expires_on_contract_change: true
artifact_ids:
  - step.definition
invariant_ids: [STEP-I1, STEP-I2, STEP-I3, STEP-I4, STEP-I5, STEP-I6, STEP-I7]
property_ids: [step.prop.budget_bounds, step.prop.dispatch_role_presence, step.prop.gate_kind_source_kind_pairing, step.prop.gate_source_ref_closure, step.prop.writes_shape_per_variant]
---

# Step Contract

A **Step** is the atomic unit of execution inside a **Phase**. Every Step
belongs to exactly one of three variants, discriminated by `kind`:

- **SynthesisStep** — orchestrator writes a single artifact; gated by
  `schema_sections` against an `ArtifactSource`.
- **CheckpointStep** — orchestrator pauses for selection (human or
  auto-resolver); gated by `checkpoint_selection` against a
  `CheckpointResponseSource`.
- **DispatchStep** — worker executes remotely under a `DispatchRole`; gated
  by `result_verdict` against a `DispatchResultSource`.

The shape of `writes` and `gate` is coupled to `kind` at the Zod
`discriminatedUnion` layer (`src/schemas/step.ts:L68-L83`), so
`tsc --strict` rejects any Step literal that pairs a variant with a
non-matching gate or writes shape.

## Ubiquitous language

See `specs/domain.md#core-types` for canonical definitions of **Step**,
**Gate**, **DispatchRole**, **ArtifactRef**, and the three step variants.
Do not introduce synonyms; new vocabulary must land in `specs/domain.md`
before use here.

## Invariants

The runtime MUST reject any Step that violates these. All invariants are
enforced via `src/schemas/step.ts` + `src/schemas/gate.ts` and tested in
`tests/contracts/schema-parity.test.ts`.

- **STEP-I1 — Kind-variant binding.** `kind`, `executor`, `gate.kind`, and
  the shape of `writes` are coupled per variant. A `synthesis` step MUST
  have `executor: 'orchestrator'`, `gate.kind: 'schema_sections'`, and
  `writes: { artifact: ArtifactRef }`. A `checkpoint` step MUST have
  `executor: 'orchestrator'`, `gate.kind: 'checkpoint_selection'`, and
  `writes: { request, response, artifact? }`. A `dispatch` step MUST have
  `executor: 'worker'`, `gate.kind: 'result_verdict'`, and
  `writes: { request, receipt, result, artifact? }`. Enforced at
  `src/schemas/step.ts:L32-L66`.

- **STEP-I2 — Non-empty routes.** Every Step declares at least one route
  target. The `routes` record is refined at `src/schemas/step.ts:L20-L22`
  (`Object.keys(m).length > 0`). Route target closure is enforced at the
  Workflow level (see `specs/contracts/workflow.md` WF-I4), not in the
  Step contract.

- **STEP-I3 — Gate source closure (adversarial-review MED #7 closed).**
  `gate.source.ref` MUST name a usable slot in the step's `writes`
  object. Enforced *primarily* at the Zod schema layer: `ref` is a
  literal per source kind (`ArtifactSource.ref = z.literal('artifact')`,
  `CheckpointResponseSource.ref = z.literal('response')`,
  `DispatchResultSource.ref = z.literal('result')` — see
  `src/schemas/gate.ts`). Combined with STEP-I1's per-variant `writes`
  shape, the ref necessarily names a required slot. Defense-in-depth:
  the `Step = z.discriminatedUnion(...).superRefine(...)` at
  `src/schemas/step.ts` rejects any step whose `gate.source.ref`
  (a) fails `Object.hasOwn(step.writes, ref)` — forbids prototype-chain
  keys like `toString`, `__proto__` — or (b) resolves to `undefined`
  even though the key is present (guards the CheckpointStep/DispatchStep
  optional-`artifact` corner). Negative coverage in
  `tests/contracts/schema-parity.test.ts`: prototype-chain refs,
  cross-slot refs (`checkpoint_response` pointing at `request`;
  `dispatch_result` pointing at `receipt`), and the historical
  missing-slot rejections.

- **STEP-I4 — Gate kind, source kind, and ref slot are all structurally
  bound per variant.** Each gate variant constrains exactly one source
  schema: `SchemaSectionsGate.source` is `ArtifactSource`,
  `CheckpointSelectionGate.source` is `CheckpointResponseSource`,
  `ResultVerdictGate.source` is `DispatchResultSource`
  (`src/schemas/gate.ts`). Within each source, `kind` is a `z.literal`
  and `ref` is a `z.literal` — so the TypeScript-inferred `source.kind`
  literal is constrained, and a cross-kind source fails Zod's
  discriminated-union parse at runtime. (TypeScript structural typing
  may allow surplus fields on variables that flow through loose
  interfaces; that is what STEP-I6's `.strict()` catches at parse time.)
  Paired with STEP-I1, this gives type-layer binding on literal fields
  plus parse-time rejection on everything else.

- **STEP-I5 — Budget bounds.** When `budgets` is present,
  `budgets.max_attempts` is an integer in `[1, 10]` and, if set,
  `budgets.wall_clock_ms` is a positive integer. Enforced at
  `src/schemas/step.ts:L24-L29`.

- **STEP-I6 — Role only on dispatch; surplus keys rejected.** Only
  `DispatchStep` carries a `role` field, and it is a required
  `DispatchRole` (`researcher | implementer | reviewer`).
  `SynthesisStep` and `CheckpointStep` have no `role` field in their
  schema, and because every Step variant, every `writes` object, every
  gate variant, and every gate `source` object is explicitly
  `.strict()`, a surplus key (including `role` on a non-dispatch step)
  is **rejected**, not stripped. This closes adversarial-review
  MED #4: the Zod-strict enforcement story is now backed by explicit
  `.strict()` calls at `src/schemas/step.ts` and `src/schemas/gate.ts`.
  `orchestrator` is an executor, not a role; see
  `specs/domain.md#dispatch-vocabulary`.

- **STEP-I7 — Protocol required.** Every Step carries a `ProtocolId`
  (`protocol:` field) — no default, no optional. Enforced at
  `src/schemas/step.ts:L18` by `StepBase`. The `ProtocolId` brand is
  defined in `src/schemas/ids.ts`.

## Pre-conditions

- Step objects must parse under `Step.safeParse`.
- The referenced `ProtocolId` must exist in the running plugin's protocol
  registry at load time (validated by the runtime, not by the Zod schema).
- The `gate.source.ref` slot must be writable by the step's kind —
  enforced structurally by STEP-I1 (writes shape) + STEP-I3 (ref closure).

## Post-conditions

After a Step is accepted:

- The Step's `id` is unique within its Workflow (enforced at the Workflow
  level; see WF-I1).
- The Step's `routes` record contains only terminal labels
  (`@complete | @stop | @escalate | @handoff`) or ids of sibling Steps
  (enforced at the Workflow level; see WF-I4).
- The Step's `writes` slot named by `gate.source.ref` is guaranteed to
  exist — the runtime may resolve `gate.source` without a nil check.
- The Step's `gate.kind` uniquely determines the shape of
  `gate.source` — no runtime reconciliation of source-kind vs gate-kind
  is needed after parse.

## Property ids (reserved for Phase 2 testing)

Property-based tests will cover:

- `step.prop.gate_source_ref_closure` — For any valid `Step`, the
  `gate.source.ref` names a key in `step.writes`. (Generator should
  include adversarial refs sampled from non-writes strings.)
- `step.prop.gate_kind_source_kind_pairing` — For any valid `Step`, the
  `gate.kind → source.kind` map is the fixed pairing in STEP-I4, with no
  exceptions across the full variant space.
- `step.prop.dispatch_role_presence` — For any valid `Step` where
  `kind === 'dispatch'`, `role` is present and is a valid `DispatchRole`;
  for any other variant, `role` is absent.
- `step.prop.writes_shape_per_variant` — For any valid `Step`, the
  `writes` object is exhaustively one of the three variant shapes — no
  extra keys, no missing required keys.
- `step.prop.budget_bounds` — For any valid `Step` with `budgets`
  present, `max_attempts ∈ [1, 10]`.

## Cross-contract dependencies

- **gate** (`src/schemas/gate.ts`) — Step embeds one gate per variant;
  the gate's kind-bound source schema is what makes STEP-I4 a
  type-layer invariant rather than a runtime refinement.
- **selection-policy** (`src/schemas/selection-policy.ts`) — Step's
  optional `selection: SelectionOverride` participates in the selection
  layer stack defined in `specs/domain.md#configuration-vocabulary`.
- **workflow** (`src/schemas/workflow.ts`) — Workflow-level invariants
  (WF-I1 unique step ids, WF-I4 closed route targets) reference Step
  identity; they are not repeated here.
- **ids** (`src/schemas/ids.ts`) — `StepId` and `ProtocolId` branded
  slugs.

## Failure modes (carried from evidence)

- `carry-forward:verdict-enum-bloat` — Existing Circuit uses a global
  verdict enum + per-protocol conditionals (see
  `bootstrap/adversarial-review-codex.md`). circuit-next constrains the
  verdict vocabulary **per step kind** through the gate variant
  (`ResultVerdictGate.pass`, `CheckpointSelectionGate.allow`,
  `SchemaSectionsGate.required`). Adding a new protocol does not expand
  the verdict enum.
- `carry-forward:role-executor-confusion` — Existing Circuit allowed
  `orchestrator` as both an executor and a dispatch role (see
  adversarial-review MED #1). circuit-next's `DispatchRole` excludes
  `orchestrator` and STEP-I6 forbids `role` on synthesis/checkpoint
  steps. The confusion is structurally eliminated.
- `carry-forward:gate-source-opacity` — Prior to this contract, gate
  sources were opaque strings (adversarial-review MED #7). Closed by
  STEP-I3 + STEP-I4; see `specs/contracts/workflow.md` "Gate source
  tightening" for the transition record.

## Evolution

- **v0.1 (this draft)** — initial contract: STEP-I1..I7, kind-bound
  source schemas with **literal `ref` per source kind** (artifact →
  `'artifact'`, checkpoint_response → `'response'`, dispatch_result →
  `'result'`), strict surplus-key rejection via `.strict()` on every
  variant, writes-slot closure via Step-union `superRefine` with
  `Object.hasOwn` + undefined guard as defense-in-depth. MED #7 closed.
  Codex adversarial property-auditor pass completed — HIGH #1
  (prototype-chain `in` attack), HIGH #2 (cross-slot drift), HIGH #3
  (optional undefined slot), MED #4 (strict-mode prose), LOW #7 (TS
  exactness prose) all incorporated.
- **v0.2 (Phase 1)** — ratify `property_ids` above by landing the
  corresponding property-test harness; introduce a disambiguator only
  if a new dispatch step emerges that writes multiple result-like
  slots (current `dispatch_result.ref = 'result'` is the v0.1 answer);
  absorb any future Codex challenger findings.
- **v1.0 (Phase 2)** — ratified invariants + property tests + mutation
  score floor + operator-facing error-message catalog.
