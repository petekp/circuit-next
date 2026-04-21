---
contract: explore
status: draft
version: 0.1
schema_source: .claude-plugin/skills/explore/circuit.json (fixture; no dedicated src/schemas/ file at v0.1 — explore is a workflow-specific contract, not a new domain contract. Artifact schemas authored at P2.10.)
last_updated: 2026-04-21
depends_on: [workflow, phase, step, selection, rigor, lane, skill]
codex_adversarial_review: specs/reviews/explore-md-v0.1-codex.md
artifact_ids:
  - explore.brief
  - explore.analysis
  - explore.synthesis
  - explore.review-verdict
  - explore.result
invariant_ids: [EXPLORE-I1]
property_ids:
  - explore.prop.canonical_phase_set_is_correct
  - explore.prop.artifact_emission_ordered
  - explore.prop.review_after_synthesis
  - explore.prop.no_skip_to_close
  - explore.prop.reachable_close_only_via_review
---

# Explore Workflow Contract

The **Explore** workflow is circuit-next's first-parity target per
ADR-0007 CC#P2-1 (operator decision 2026-04-21 adopting Codex
challenger recommendation over in-session Claude methodology
recommendation of `review`). It exercises a full-spine investigation:
frame the investigation, analyze the subject, synthesize findings,
review the synthesis adversarially, and close with a final artifact.

Unlike the base domain contracts (`workflow.md`, `step.md`, `phase.md`,
etc.), which govern the shape of ANY workflow, this contract governs a
SPECIFIC workflow instance: `explore`. It binds the workflow's
canonical phase set, declares the artifact ids it emits, and names
the one runtime-enforced invariant (EXPLORE-I1) plus four deferred
properties that become enforceable at later slices.

## Scope note (explicit)

This is **not** a runtime-schema contract with its own `src/schemas/`
file. The `explore` fixture is validated by the base `Workflow`
schema (`src/schemas/workflow.ts`). This contract is the
**workflow-specific** discipline layer over that base schema — it
names one invariant (EXPLORE-I1) that the base schema cannot express
(because it is workflow-kind-specific, not workflow-general), plus
five artifact ids the workflow's phases emit, plus four property ids
tracking deferred semantic guarantees for later-slice enforcement.

If future refactoring introduces a workflow-kind concept at the Zod
layer (e.g., `kind: 'explore'` field), EXPLORE-I1 and the four
properties migrate into that layer as kind-specific checks, and this
contract becomes a pointer to the kind schema.

**Workflow-kind seam (Codex MED 8 fold-in).** P2.3 uses the fixture's
top-level `id` field (the string `'explore'`) as the kind signal. The
base `Workflow` schema has no `kind` field at v0.2. This is a
**temporary adapter** — the correct long-term shape is `Workflow.kind`
as a first-class field, resolved at P2-MODEL-EFFORT (workflow schema
v0.3) or a dedicated slice. Until then, `checkSpineCoverage`
hardcodes the `{id → canonical set}` map at `scripts/audit.mjs`
`WORKFLOW_KIND_CANONICAL_SETS`. Reopen triggers for this seam:
duplicate `id` across skill directories; an `explore-mini` or
`research` fixture with no `kind` binding to this contract; or
landing of the `Workflow.kind` field.

## Ubiquitous language

See `specs/domain.md#core-types` for canonical definitions of
**Workflow**, **Phase**, **Step**. This contract adds five artifact
ids:

- **Explore brief** (`explore.brief`): the framing artifact emitted by
  the Frame phase. Names the subject, the operator's task statement,
  and the success condition for the investigation.
- **Explore analysis** (`explore.analysis`): the artifact emitted by
  the Analyze phase. Decomposes the subject into named aspects with
  evidence citations.
- **Explore synthesis** (`explore.synthesis`): the artifact emitted by
  the Synthesize phase. Produces the investigation's primary output —
  a recommendation, decision candidate set, or investigation
  conclusion — with explicit mapping back to the brief's success
  condition.
- **Explore review verdict** (`explore.review-verdict`): the artifact
  emitted by the Review phase. Adversarial pass over the synthesis;
  reports objections, missed angles, and overall verdict.
- **Explore result** (`explore.result`): the aggregate artifact
  emitted by the Close phase. A summary + verdict-snapshot plus
  pointers to the four prior artifacts. The run's final return shape.

## Canonical phase set (ADR-0007 CC#P2-6 binding) — and the title-to-canonical translation

ADR-0007 CC#P2-6 names the explore canonical phase set using
**workflow-specific titles**: `{Frame, Analyze, Synthesize, Review,
Close}`. Those titles are human-readable and match the reference
Circuit explore workflow. They are **not** all canonical phase ids —
`Synthesize` in particular is not in the CanonicalPhase enum at
`src/schemas/phase.ts` (which is the seven-phase spine `frame,
analyze, plan, act, verify, review, close`).

This contract records the **title-to-canonical translation** as
follows. The translation is the authoritative reading of CC#P2-6 for
v0.1 — any future ADR amending CC#P2-6 or this translation must clear
ADR-0007 §6 Precedent firewall:

| Workflow-specific title | Canonical phase id | Role |
|---|---|---|
| Frame                  | `frame`    | State the subject and success condition. |
| Analyze                | `analyze`  | Decompose the subject into aspects with evidence. |
| Synthesize             | `act`      | Produce the investigation's primary output. |
| Review                 | `review`   | Adversarial pass over the synthesis. |
| Close                  | `close`    | Final aggregate artifact + closure. |

**Canonical set:** `{frame, analyze, act, review, close}`.
**Omits:** `{plan, verify}` (partial spine).

**Rationale for `Synthesize → act` (Codex HIGH 4 fold-in — rejected
alternative).** The contentious mapping is `Synthesize`. Two
candidate canonicals are reasonable:

- **`act`** (chosen): Synthesize is the primary work-producing phase.
  It consumes the brief + analysis and emits the explore.synthesis
  artifact (the investigation's output). In the canonical seven-phase
  spine, `act` is the "do the work" phase — the place where the
  workflow's primary deliverable is produced. This matches.
- **`plan`** (rejected): Synthesize could be read as producing a plan
  for downstream action. This reading would imply the explore
  workflow's primary output IS a plan (to be executed elsewhere).
  That is one legitimate use case, but it is narrower than the
  general explore contract: an explore workflow whose synthesis is a
  decision artifact (not a plan) would be miscategorized. Picking
  `plan` would also leave the `act` canonical unfilled, producing a
  different partial-spine shape (omits = {act, verify}) that would
  not match PHASE-I4 semantic-adequacy expectations for the act
  phase.

**Rationale for `plan` omission:** explore is an investigation
workflow. Investigation-planning is folded into the Frame phase
(where the subject, success condition, and investigation scope are
stated). There is no separate plan-mode producing a plan artifact;
the explore.brief serves that role.

**Rationale for `verify` omission (Codex MED 9 fold-in — weaker-
substitute wording).** Explore produces investigation output (not
executable artifacts), so there is no mechanical verification step
analogous to `build`'s test-run gate. The Review phase provides an
adversarial pass over the synthesis that is a **weaker substitute**
for verify, not a full replacement: the v0.1 Review phase has
`executor: "orchestrator"` and `kind: "synthesis"` — it is not a
distinct-adapter review dispatch, does not cross a Knight-Leveson
model boundary, and does not emit a result-verdict gate distinct
from the phase gate. A future variant that wants stronger review
(e.g., dispatching Codex as the reviewer via the P2.4 agent adapter)
would either strengthen the Review phase semantics in a subsequent
slice or introduce a `verify` canonical with a mechanical check. v0.1
is scoped narrower than that.

## Invariant (single — EXPLORE-I1)

The runtime MUST reject any `explore`-kinded workflow that violates
EXPLORE-I1. Other semantic guarantees are recorded as **deferred
properties** (see §Deferred properties below). This single-invariant
shape is the Codex HIGH 1 fold-in: EXPLORE-I2..I5 from v0.1-draft
were demoted from "MUST reject at runtime" to "property-tracked
obligations satisfied by later slices" because the v0.1 contract-
surface-enforced-at-runtime layer cannot express them without
implementing enforcement that belongs to later slices.

- **EXPLORE-I1 — Canonical phase set matches kind, spine_policy is
  partial with omits {plan, verify}.** Any workflow fixture whose
  top-level `id` equals the string `'explore'` MUST:
  1. Declare phases whose `canonical` fields collectively equal the
     set `{frame, analyze, act, review, close}`. Extra canonicals
     (e.g. `plan`, `verify`) are rejected; missing canonicals are
     rejected.
  2. Declare `spine_policy.mode = 'partial'` with `omits = [plan,
     verify]` (order-independent set equality).

  **Scope of EXPLORE-I1 enforcement (Codex HIGH 3 fold-in — narrowed
  to what is actually enforced).** `checkSpineCoverage` (Check 24)
  enforces (1) and (2) above. It does **not** currently enforce:
  - Rationale length or rationale-content (the phase.md PHASE-I4
    rationale ≥20 chars is a schema-level check, not an
    explore-specific semantic check).
  - The `id`-vs-filename convention (e.g. a fixture at
    `.claude-plugin/skills/explore-mini/` with `id: 'explore'` would
    pass Check 24 today; that would need a directory-binding check
    in a later slice).
  - Full `Workflow.safeParse` validation (Check 24 hand-parses the
    canonical phase set from `fixture.phases` without running the
    base schema; malformed fixtures pass Check 24 if their phase
    canonicals match, even when their steps/entry-modes/routes are
    broken).

  These scope-gaps are recorded honestly here. A stricter variant
  of EXPLORE-I1 (parsing the fixture through `Workflow.safeParse`
  + enforcing rationale content) is deferred to P2.5.

  Enforced by `checkSpineCoverage` (Check 24 at P2.3 landing) and
  `tests/contracts/spine-coverage.test.ts`.

## Deferred properties (enforcement-deferred, ledger-phase2-property)

The following properties describe semantic guarantees the contract
intends the `explore` workflow to satisfy but that are not runtime-
enforced at v0.1. Each is recorded in `specs/invariants.json` as
`enforcement_state: phase2-property` with a concrete
`reopen_condition`. When P2.5 (end-to-end fixture test) lands, these
properties gain test bindings; the contract amends at that slice to
reflect the new enforcement state.

- **`explore.prop.canonical_phase_set_is_correct`** — (test-enforced
  via `tests/contracts/spine-coverage.test.ts`). Property-id sibling
  of EXPLORE-I1 for ledger addressability. One or more test titles
  in the spine-coverage suite contain this property-id token so the
  ledger binding is honest (Codex MED 6 fold-in).
- **`explore.prop.artifact_emission_ordered`** — The five phases
  emit artifacts in order: Frame → `explore.brief`, Analyze →
  `explore.analysis`, Synthesize → `explore.synthesis`, Review →
  `explore.review-verdict`, Close → `explore.result`. A fixture that
  routes Analyze→Review (skipping Synthesize) or whose Frame step
  emits no `explore.brief` violates this property. Deferred to P2.5.
- **`explore.prop.review_after_synthesis`** — The Review phase MUST
  execute after the Synthesize phase in every viable execution path.
  Reviewing a synthesis that doesn't exist is structurally incoherent.
  Deferred to P2.5.
- **`explore.prop.no_skip_to_close`** — No execution path from any
  `EntryMode.start_at` reaches `@complete` without passing through
  the Review phase. Deferred to P2.5.
- **`explore.prop.reachable_close_only_via_review`** — Symmetric to
  `no_skip_to_close`; stated for emphasis. Deferred to P2.5.

**Enforcement consolidation (Codex MED 7 fold-in).** The
`target_slice` in `specs/invariants.json` for these properties is
P2.5 (the end-to-end fixture run, currently planned as slice 38+
depending on P2.2→P2.4 drift). References to "property harness Slice
29" in prior draft ledger entries were carried over from
`workflow.prop.*` property ids and are not the right milestone for
`explore.prop.*` — they were amended at P2.3 landing.

## Pre-conditions

- The fixture file at `.claude-plugin/skills/explore/circuit.json`
  parses under the base `Workflow.safeParse`.
- The fixture's `id` equals the string literal `'explore'`.
- All five artifact ids under §artifact_ids are registered in
  `specs/artifacts.json` with appropriate writers and readers.

## Post-conditions

After an `explore` fixture is accepted:

- The fixture's phase set covers `{frame, analyze, act, review,
  close}` with `spine_policy.mode = 'partial'` and
  `omits = [plan, verify]`.
- The fixture emits five named artifacts in phase order
  (enforcement at P2.5).
- The fixture exposes at least one entry mode (`default` or
  `explore`) starting at the Frame phase's step.
- No execution path reaches `@complete` without passing through the
  Review phase (enforcement at P2.5).

## Artifact reader/writer graph (normative — Codex MED 5 fold-in)

The following table is the **authoritative reader/writer graph** for
v0.1. `specs/artifacts.json` writers/readers lists and
`.claude-plugin/skills/explore/circuit.json` step `reads` arrays
MUST match this table exactly; any divergence is a ratchet violation.

| Artifact                 | Writer (phase/step) | Readers (phase/step)                                                                 |
|--------------------------|---------------------|--------------------------------------------------------------------------------------|
| `explore.brief`          | Frame / frame-step  | Analyze / analyze-step; Synthesize / synthesize-step; Review / review-step           |
| `explore.analysis`       | Analyze / analyze-step | Synthesize / synthesize-step; Review / review-step                                |
| `explore.synthesis`      | Synthesize / synthesize-step | Review / review-step; Close / close-step                                     |
| `explore.review-verdict` | Review / review-step | Close / close-step                                                                  |
| `explore.result`         | Close / close-step  | *(none — terminal artifact; consumed by the run result consumer only)*               |

**Close reads synthesis + review-verdict only** (not brief or
analysis). The rationale: the synthesis artifact encapsulates the
investigation output; the review verdict encapsulates the
adversarial pass. The brief + analysis are upstream inputs already
composed into the synthesis; re-reading them at Close would
duplicate input rather than add value. A future slice may widen
Close to read all prior artifacts if the aggregate result shape
requires it — that is an explicit amendment trigger.

## `schema_sections` gate placeholder note (Codex MED 10 fold-in)

The fixture's `schema_sections` gates declare required field names
(e.g. `subject`, `success_condition`, `recommendation`) that are
**provisional field-name guards**, not references to any schema
source. The artifact schemas these gate names reference do not yet
exist; they are deferred to P2.10 (artifact schema set, plan
§Mid-term slices).

This means:

- At v0.1, the gate checks produce a pass/fail on "does the artifact
  JSON contain the named top-level keys?" — not on "does the
  artifact validate against a typed schema?".
- A future P2.10 slice reconciles the gate `required` arrays with
  the concrete artifact schemas and the `specs/artifacts.json`
  `schema_exports` fields in one slice. Any drift between the three
  is a ratchet violation at P2.10 landing.

## Property ids (reserved; some enforced now, most deferred)

Registered in `specs/invariants.json`. See §Deferred properties
above for semantics.

- `explore.prop.canonical_phase_set_is_correct` — **test-enforced at
  P2.3** via `tests/contracts/spine-coverage.test.ts` describe title.
- `explore.prop.artifact_emission_ordered` — deferred to P2.5.
- `explore.prop.review_after_synthesis` — deferred to P2.5.
- `explore.prop.no_skip_to_close` — deferred to P2.5.
- `explore.prop.reachable_close_only_via_review` — deferred to P2.5.

## Reopen conditions

This contract is reopened if any of:

1. **Target retarget.** Per ADR-0007 §4b retarget checklist, if the
   operator reselects `review` as the first-parity target, this
   contract is deprecated in place (status → `retargeted`) and a new
   `specs/contracts/review.md` replaces it as CC#P2-1's binding.
2. **Canonical phase set change.** If a future slice amends the
   canonical phase set for `explore` (e.g., adds `plan` back in, or
   maps Synthesize to `plan` instead of `act`), this contract must
   be amended and re-reviewed by Codex per ADR-0007 §6 Precedent
   firewall. The title-to-canonical translation table is the
   authoritative surface; any change to it is an ADR-level decision.
3. **Artifact-schema refactor.** If the five artifact ids gain
   concrete Zod schemas at P2.10, this contract amends §artifact
   id section with schema file pointers and the artifact
   round-trip invariant.
4. **Workflow-kind concept introduced.** If the base Workflow
   schema gains a `kind` field (projected at P2-MODEL-EFFORT or
   dedicated slice), EXPLORE-I1 and the deferred properties migrate
   into that layer as kind-specific checks, and this contract
   becomes a pointer to the kind schema. The workflow-kind seam
   note in §Scope note records this migration target.
5. **P2.5 lands without enforcing deferred properties** (Codex LOW
   12 fold-in). If P2.5 end-to-end fixture test lands but
   `explore.prop.artifact_emission_ordered`,
   `explore.prop.review_after_synthesis`,
   `explore.prop.no_skip_to_close`, and
   `explore.prop.reachable_close_only_via_review` are not promoted
   from `phase2-property` to `test-enforced`, reopen this contract
   to re-evaluate the deferral plan.
6. **Artifact reader/writer graph drift** (Codex LOW 12 fold-in).
   If the §Artifact reader/writer graph table diverges from
   `specs/artifacts.json` or the fixture, reopen to resolve the
   divergence — the contract table is authoritative.
7. **Gate/schema reconciliation skipped at P2.10** (Codex LOW 12
   fold-in). If P2.10 lands without reconciling the fixture's
   `schema_sections` `required` arrays with concrete artifact
   schemas and `specs/artifacts.json` `schema_exports`, reopen to
   hold P2.10 accountable.
8. **`explore.result` needs a dedicated schema** (Codex LOW 12
   fold-in). If downstream consumers (run-result readers, operator
   summaries) depend on a richer `explore.result` shape than the
   current `{summary, verdict_snapshot}` placeholder, reopen to
   author the result schema explicitly and update the artifact
   registry row.

## Authority

- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1
  CC#P2-1` (one-workflow parity — `explore` target)
- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1
  CC#P2-6` (spine policy coverage — canonical set
  {frame, analyze, act, review, close} mapped from workflow-
  specific titles Frame/Analyze/Synthesize/Review/Close; Open
  Question #5 resolved to full-spine Standard rigor)
- `specs/plans/phase-2-implementation.md §P2.3` (slice framing)
- `specs/plans/phase-2-implementation.md §Target workflow for first
  parity` (operator decision + Codex rationale preserved verbatim)
