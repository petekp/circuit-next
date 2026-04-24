---
contract: explore
status: draft
version: 0.4
schema_source: .claude-plugin/skills/explore/circuit.json (fixture) + src/schemas/artifacts/explore.ts (explore.brief / explore.analysis; remaining explore artifacts still pending P2.10 follow-ons)
last_updated: 2026-04-24
depends_on: [workflow, phase, step, selection, rigor, lane, skill, adapter]
codex_adversarial_review: specs/reviews/explore-md-v0.1-codex.md
codex_adversarial_review_v0_2: specs/reviews/arc-slice-38-dispatch-granularity-adr-0008-codex.md
codex_adversarial_review_v0_3: specs/reviews/arc-slices-35-to-40-composition-review-codex.md (arc-close composition review; subsumes retroactive Slice 39 Codex pass per Claude MED 2 + Codex LOW 2 convergent fold-in — the arc-close Codex prong explicitly covers the path-split decision, opts.knownCollisions API shape, and vacuous-on-empty regression smell)
adr_bindings:
  - specs/adrs/ADR-0008-dispatch-granularity-modeling.md (v0.2 amendment — Synthesize and Review are dispatch steps; Review weaker-substitute rationale retired)
  - specs/reviews/p2-foundation-composition-review.md §HIGH 4 (v0.3 amendment — explore.result path-split from run.result)
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

The `explore` fixture is validated by the base `Workflow` schema
(`src/schemas/workflow.ts`). This contract is the **workflow-specific**
discipline layer over that base schema — it names one invariant
(EXPLORE-I1) that the base schema cannot express (because it is
workflow-kind-specific, not workflow-general), plus five artifact ids
the workflow's phases emit, plus four property ids tracking deferred
semantic guarantees for later-slice enforcement.

Slice 89 starts P2.10 by adding runtime schemas for `explore.brief` and
`explore.analysis` at `src/schemas/artifacts/explore.ts` and wiring the
default runtime synthesis writer to produce those shapes. The
dispatch-produced `explore.synthesis` / `explore.review-verdict` and
close-phase `explore.result` shapes remain on the existing
minimal/fallback path until their own schema-specific slices land.

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
  pointers to the four prior artifacts. The workflow-specific
  "what the explore run produced." Persisted at
  `<run-root>/artifacts/explore-result.json`. This is **distinct**
  from the universal `run.result` artifact (at
  `<run-root>/artifacts/result.json`, authored by the engine at
  run.closed) — see §Path-split rationale below.

## Path-split rationale (v0.3 amendment — HIGH 4 fold-in)

At v0.1/v0.2 drafting, `explore.result` and `run.result` both
registered their `backing_path` at `<run-root>/artifacts/result.json`.
The composition review at `specs/reviews/p2-foundation-composition-
review.md §HIGH 4` flagged this as a two-writers-one-file collision
that Check 25 tracked under `ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS`
with Slice 39 as the closing slice.

**v0.3 resolution — option (b) path split.** Slice 39 moves
`explore.result` to `<run-root>/artifacts/explore-result.json`.
`run.result` retains `<run-root>/artifacts/result.json`. The two
artifacts now live at distinct paths. Check 25 is green on the live
repo with zero tracked collisions.

**Why (b) not (a).** The composition review named two candidate fixes:
- **(a)** make `explore.result` a *payload field* inside `run.result`
  (envelope). Rejected: `run.result` is engine-authored with a
  universal strict Zod shape (`RunResult` at `src/schemas/result.ts`);
  `src/runtime/result-writer.ts` RESULT-I1 declares the engine as the
  single writer to `result.json`. Collapsing `explore.result` into a
  payload field would either force the engine writer to depend on a
  workflow-authored aggregate (reversed dependency direction) or
  require a schema-envelope ADR widening `RunResult`. Both are
  architectural decisions that belong in their own slice.
- **(b)** distinct backing path with a `<kind>-result.json` sibling
  pattern. Chosen: narrower scope, preserves the single-writer
  invariant on `result.json`, generalizes cleanly to future
  workflow-specific aggregates (`build-result.json`,
  `repair-result.json`, `migrate-result.json`, `sweep-result.json`)
  with their own divergent close-phase shapes.

**What this does NOT change.** `RunResult` still owns
`<run-root>/artifacts/result.json`. Dogfood smoke tests that expect
the four-file run directory (`events.ndjson`, `state.json`,
`manifest.snapshot.json`, `artifacts/result.json`) still pass —
`explore-result.json` is an *additional* sibling artifact when the
explore workflow's close-step runs, not a replacement.

**Reopen trigger for this decision.** A second workflow whose
close-step aggregate shape is identical to `explore.result`'s
structure (summary + verdict-snapshot + prior-artifact pointers)
would re-open the (a)-vs-(b) question: if `<kind>.result` rows
collapse into a shared envelope, option (a) might win retroactively.
Captured as Reopen condition #10 below.

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

### Executor and kind per phase (ADR-0008 binding, v0.2 amendment)

ADR-0008 locks the executor + kind for each phase in the v0.2
amendment. The canonical phase set above is unchanged; what this
subsection adds is the per-phase dispatch-granularity binding.

| Phase (title / canonical) | executor        | kind        | role           | writes shape                                                                 | gate               |
|---------------------------|-----------------|-------------|----------------|------------------------------------------------------------------------------|--------------------|
| Frame / `frame`           | `orchestrator`  | `synthesis` | —              | `{artifact}`                                                                 | `schema_sections`  |
| Analyze / `analyze`       | `orchestrator`  | `synthesis` | —              | `{artifact}`                                                                 | `schema_sections`  |
| Synthesize / `act`        | `worker`        | `dispatch`  | `implementer`  | `{artifact, request, receipt, result}`                                       | `result_verdict`   |
| Review / `review`         | `worker`        | `dispatch`  | `reviewer`     | `{artifact, request, receipt, result}`                                       | `result_verdict`   |
| Close / `close`           | `orchestrator`  | `synthesis` | —              | `{artifact}`                                                                 | `schema_sections`  |

**Why Synthesize and Review are dispatch steps.** Synthesis IS the
investigation output (the model doing the work); Review IS the
adversarial pass (the model doing the checking). If the orchestrator
model does both, explore produces same-model self-review —
LLM-on-LLM corroboration the methodology rejects (CLAUDE.md
§Cross-model challenger protocol; ADR-0001 Addendum B CC#15
structural-separation grounds).

Flipping these two phases to worker-dispatch makes the
**dispatch-machinery routing** a contract-visible surface: the
step schema carries a `role` tag, a request/receipt/result
transcript, and a `ResultVerdictGate` that every
orchestrator-synthesis step lacks. **The v0.2 schema layer does
NOT enforce that the implementer-role adapter and the reviewer-
role adapter are distinct** (Codex Slice 38 HIGH 1 weaker-evidence
disclosure per ADR-0007 §6.4): `src/schemas/config.ts`
`DispatchConfig.roles` permits both roles to bind to the same
adapter. Distinct-adapter / distinct-model enforcement lands as
evidential guarantee at P2.4 (real adapter) + P2.5 (end-to-end
parity test asserting distinct receipt-ids / request-hashes across
roles). The v0.2 contract widens the *precondition* for that
enforcement; the enforcement itself is deferred. See ADR-0008
§Decision.2 (iii) and §Decision.3 for the full four-ground
analysis and the weaker-evidence disclosure.

**Why Frame, Analyze, Close stay orchestrator-synthesis.** Framing
(stating the subject and success condition), decomposition
(producing aspects with evidence), and aggregation (composing prior
artifacts into a run result) are bookkeeping the orchestrator does.
They do not benefit from crossing a model boundary; their output is
deterministic given the inputs.

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

**Rationale for `verify` omission (v0.2 amendment — ADR-0008
widening; retires the v0.1 "weaker substitute" wording; Codex
Slice 38 HIGH 1 weaker-evidence disclosure folded in).** Explore
produces investigation output (not executable artifacts), so there
is no mechanical verification step analogous to `build`'s test-run
gate. The Review phase is the adversarial pass that IS in scope,
and per ADR-0008 v0.2 it is now a **worker-dispatch review step
with `role: "reviewer"`** — a contract-visible routing change
(from v0.1's orchestrator-synthesis).

**What the widening guarantees at v0.2.** Review has `executor:
"worker"`, `kind: "dispatch"`, `role: "reviewer"`; it emits a
`ResultVerdictGate` with `source: dispatch_result` distinct from
the SchemaSectionsGate used at orchestrator-synthesis phases; it
emits the five-event dispatch transcript per ADR-0007 CC#P2-2
+ §Amendment (Slice 37).

**What the widening does NOT guarantee at v0.2 (weaker-evidence
disclosure per ADR-0007 §6.4; Codex Slice 38 HIGH 1 fold-in).**
The `role: "reviewer"` tag binds to
`DispatchConfig.roles.reviewer` at runtime. The v0.2 schema layer
does NOT enforce that the reviewer-role adapter is distinct from
the implementer-role adapter that wrote the synthesis —
`src/schemas/config.ts` `DispatchConfig.roles` permits both roles
to bind to the same adapter, and `ResolvedAdapter` at
`src/schemas/adapter.ts:59-63` carries no
"differs-from-prior-dispatch" field. Distinct-adapter /
Knight-Leveson-boundary enforcement is therefore an **evidential
guarantee that lands at P2.4 (real adapter implementation) + P2.5
(end-to-end parity test)**, not a contract-level guarantee at
v0.2. The widening gives us a contract-visible precondition;
evidential enforcement comes later.

**The v0.1 "weaker substitute" wording is explicitly retired.** It
was honest about v0.1 (Review was `executor: "orchestrator"`,
`kind: "synthesis"`, same model in a loop). The v0.2 dispatch
flip lifts Review out of same-model synthesis and into the
dispatch-machinery-routed surface where distinct-adapter
enforcement BECOMES POSSIBLE at P2.4/P2.5. `verify` remains
omitted not because Review is a weaker substitute, but because
explore output is not executable and does not admit mechanical
verification regardless of adapter dispatch. The omission stands
for a different reason than before.

**What would reintroduce `verify`.** A future variant of explore
that emits executable artifacts (e.g., a generated migration
script) would need `verify` to hold a mechanical check. That would
be a different workflow kind (e.g., `explore-codegen`) with its
own canonical set, not an amendment to this contract. This
contract is stable for investigation output.

## Invariant (single — EXPLORE-I1)

The runtime MUST reject any `explore`-kinded workflow that violates
EXPLORE-I1. Other semantic guarantees are recorded as **deferred
properties** (see §Deferred properties below). This single-invariant
shape is the Codex HIGH 1 fold-in: EXPLORE-I2..I5 from v0.1-draft
were demoted from "MUST reject at runtime" to "property-tracked
obligations satisfied by later slices" because the v0.1 contract-
surface-enforced-at-runtime layer cannot express them without
implementing enforcement that belongs to later slices.

**Runtime rejection delivery window (v0.3 amendment — Slice 40
arc-close fold-in per convergent Claude HIGH 1 + Codex HIGH 1).**
The "MUST reject at runtime" prose above names the invariant's
target. The delivery path has two layers, staged across slices:
(1) **Fixture-level rejection via `checkSpineCoverage` (Check 24)**
— landed at Slice 34 / P2.3; rejects fixtures whose top-level
`id='explore'` violates the canonical-set or spine-policy clause by
hand-parsing `fixture.phases[].canonical`. Already in force.
(2) **Runtime-level rejection via `validateWorkflowKindPolicy`**
— scheduled for P2.5 per `specs/plans/phase-2-implementation.md
§P2.5` HIGH 5 retargeting. Extracts a helper that runs
`Workflow.safeParse(workflow)` first and then applies kind-specific
policy on the parsed value; both `scripts/audit.mjs` Check 24 and
the runtime fixture loader (`src/cli/dogfood.ts:125` or its P2.5
equivalent) call the helper. At P2.5 landing, the EXPLORE-I1
headline fully matches its enforcement path; pre-P2.5, the
fixture-level delivery is the operative rejection mechanism and
the §Scope of EXPLORE-I1 enforcement subsection below discloses
the gap honestly. No enforcement silently regresses at the v0.3
contract bump — enforcement strictly widens as P2.5 lands.

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
  to what is actually enforced; v0.2 ADR-0008 amendment adds Check
  27 coverage).** `checkSpineCoverage` (Check 24) enforces (1) and
  (2) above. It does **not** currently enforce:
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

  **Executor/kind shape is enforced by `Workflow.safeParse`, not by
  Check 24 or EXPLORE-I1.** After ADR-0008, Synthesize and Review
  must be `DispatchStep`-shaped (`executor: "worker"`, `kind:
  "dispatch"`, `role` present, `writes: {artifact?, request,
  receipt, result}`, `gate: ResultVerdictGate`). This is enforced at
  the base-schema layer via
  `src/schemas/step.ts` `DispatchStep` and
  `src/schemas/gate.ts` `ResultVerdictGate` — a fixture that fails
  these shape constraints fails `Workflow.safeParse` before Check 24
  runs.

  **Adapter-binding coverage is enforced by Check 27.** Per ADR-0008
  §Decision.4 and `scripts/audit.mjs` `checkAdapterBindingCoverage`,
  any workflow fixture whose `id` is in `WORKFLOW_KIND_CANONICAL_SETS`
  (today: `explore`) must exercise at least one `kind: "dispatch"`
  step. A fixture with zero dispatch steps is red.

  Enforced by `checkSpineCoverage` (Check 24 at P2.3 landing),
  `checkAdapterBindingCoverage` (Check 27 at Slice 38 — ADR-0008
  landing), and `tests/contracts/spine-coverage.test.ts` +
  `tests/contracts/adapter-binding-coverage.test.ts`.

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

**CC#P2-1 placeholder-parity epoch (Slice 44 arc-close fold-in,
convergent Claude HIGH 2 + Codex HIGH 2).** At Slice 43c landing,
the `explore.result` artifact is written as a deterministic
placeholder body by `src/runtime/runner.ts::writeSynthesisArtifact`
(body is a function of `step.gate.required` section names; no
dispatch output is consumed into it). The CC#P2-1 golden at
`tests/fixtures/golden/explore/result.sha256` therefore pins the
placeholder shape, not a reference-Circuit artifact composition.
The placeholder epoch is authoritative per ADR-0007 §Decision.1
CC#P2-1 Slice 44 amendment; CC#P2-1 is satisfied at placeholder-
parity until P2.10 replaces the placeholder with real orchestrator
output and a fresh composition review re-verifies
orchestrator-parity. A future slice that changes the placeholder
body without regenerating the golden MUST fail the self-consistency
test at `tests/runner/explore-e2e-parity.test.ts` (that test's
title explicitly names the placeholder-parity epoch; see also the
§Placeholder epoch test rename landed at ceremony commit).

**Deferred property promotion re-defer (post-Slice-44, Codex HIGH 5
fold-in).** P2.5 (Slices 43a/43b/43c) landed the `explore` end-to-end
fixture run, but did NOT promote the four deferred properties
(`artifact_emission_ordered`, `review_after_synthesis`,
`no_skip_to_close`, `reachable_close_only_via_review`) from
`phase2-property` to `test-enforced`. The arc-close review
(`specs/reviews/arc-slices-41-to-43-composition-review-codex.md
§HIGH 5`) flagged that this fires §Reopen conditions item 5 per the
contract's own terms.

**Disposition at Slice 44 ceremony (operator decision).** The four
properties are **re-deferred** to a named post-P2.5 slice
(**P2.5.1 — explore deferred-property promotion**, not yet
scheduled), with the following rationale: (a) the Slice 43c run
exercises the happy path only; negative-path enforcement tests need
property-id-bearing fixtures that mutate the explore fixture to
skip synthesis, review before synthesis, or close without review —
that is a test-authorship slice, not an arc-close ceremony fold-in;
(b) promoting the properties requires test titles that contain the
property-id tokens (per prior Codex MED 6 fold-in on
`canonical_phase_set_is_correct`) and corresponding `binding_refs`
updates in `specs/invariants.json` — each property carries ~3-5
property-id-token-bearing test titles, so four properties land
12-20 new tests with explicit invariant-binding surface; (c) the
current Slice 44 ceremony commit is already large (two prong
review files + Check 26 generalization + three HIGH fold-ins +
plan amendments). Landing the property promotion inline would
exceed the ≤30-min-wall-clock slice discipline.

**P2.5.1 scope (named, not scheduled).** One slice that promotes
all four properties: authors negative-path fixtures under
`tests/contracts/explore-properties/*.test.ts` (or similar), each
with property-id-token test titles matching
`specs/invariants.json` `binding_refs`; updates the four
invariant ledger entries from `phase2-property` to `test-enforced`
with `binding_refs` arrays; amends this §Deferred properties
subsection to record the promotion. Estimated: +15-20 static test
declarations; ratchet-advance lane. Expected Codex challenger pass
because it's a contract-enforcement-state change.

**Reopen implication.** §Reopen conditions item 5 (above) is now
satisfied by this re-defer subsection: the contract records the
P2.5-landing-without-promotion outcome explicitly. Item 5's
reopen-to-re-evaluate mandate is discharged by this operator
decision. A future slice that lands P2.5.1 and promotes the
properties WILL amend this subsection (converting it from "re-
deferred" to "promoted at Slice N") and flip the ledger entries.
A future slice that tries to close CC#P2-1 more substantively
(e.g., P2.10 orchestrator-parity per ADR-0007 Slice 44 amendment)
without also advancing these four properties re-fires item 5.

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
| `explore.result`         | Close / close-step  | *(none — terminal artifact at `<run-root>/artifacts/explore-result.json`; consumed by the run result consumer only; distinct from the engine-authored `run.result` at `<run-root>/artifacts/result.json` per v0.3 Path-split rationale)* |

**Close reads synthesis + review-verdict only** (not brief or
analysis). The rationale: the synthesis artifact encapsulates the
investigation output; the review verdict encapsulates the
adversarial pass. The brief + analysis are upstream inputs already
composed into the synthesis; re-reading them at Close would
duplicate input rather than add value. A future slice may widen
Close to read all prior artifacts if the aggregate result shape
requires it — that is an explicit amendment trigger.

**ADR-0008 provenance note (v0.2 amendment).** After the Slice 38
dispatch-kind flip, the `explore.synthesis` and
`explore.review-verdict` artifacts are **dispatch-step outputs**,
not orchestrator-synthesis outputs. Their content shape is
unchanged; their provenance is now model-authored via adapter
dispatch (implementer-role adapter at Synthesize, reviewer-role
adapter at Review — distinct-adapter enforcement is evidential at
P2.4/P2.5 per §verify-omission rationale; see Codex Slice 38
HIGH 1 disclosure). The five-event dispatch transcript
(`dispatch.started` → `dispatch.request` → `dispatch.receipt` →
`dispatch.result` → `dispatch.completed`) is recorded per ADR-0007
CC#P2-2 + ADR-0007 §Amendment (Slice 37). The dispatch transcript
write slots (`request`, `receipt`, `result`) live alongside the
artifact in the step's writes shape.

**Dispatch result-to-artifact materialization (ADR-0008
§Decision.3a; Codex Slice 38 HIGH 2 fold-in).** The dispatch step's
`writes.result` path (the raw adapter output) and the
`writes.artifact.path` (the canonical downstream-read artifact) are
**distinct on disk but bound by the materialization rule**: at
dispatch step completion, after the `ResultVerdictGate` passes,
the runtime MUST write the artifact at `writes.artifact.path` by
schema-parsing the `result` payload against `writes.artifact.schema`.
Downstream steps reading the artifact path observe the validated
artifact, not the raw transcript.

The explore fixture satisfies the fixture-level precondition for
this rule: both dispatch steps declare `writes.artifact` alongside
`writes.result`. Check 27 asserts this structurally; the runtime
invariant binds at P2.4 (adapter implementation) + P2.5
(end-to-end parity test).

**Dispatch gate-evaluation semantics (Slice 53 Codex H14 fold-in).**
The `ResultVerdictGate` declared on each dispatch step is evaluated
by the runtime against the adapter's `result_body`. The evaluation
rule at v0:

1. `JSON.parse(dispatchResult.result_body)` — must yield a JSON
   object (not array, not null, not a primitive).
2. The parsed object MUST carry a top-level `verdict` field whose
   value is a non-empty string. The membership check is **exact
   string equality, no trimming, no case folding** — `"OK"` is not
   `"ok"`, `" ok "` is not `"ok"`. Adapter prompts (see
   `composeDispatchPrompt` in `src/runtime/runner.ts`) include the
   accepted-verdicts list verbatim so the adapter can match against
   the canonical strings.
3. The verdict string MUST appear in `step.gate.pass`.

If all three hold, the runtime sets `dispatch.completed.verdict` to
the parsed verdict, materializes the canonical artifact at
`writes.artifact.path` (when declared), emits `gate.evaluated` with
`outcome: 'pass'`, and follows `routes.pass`. If ANY fail, the
runtime emits `gate.evaluated` with `outcome: 'fail'` and a
human-readable `reason` naming the cause (parse error, missing /
non-string verdict field, or verdict-not-in-gate.pass with the
observed verdict recorded), then emits `step.aborted` with the same
reason, then emits `run.closed` with `outcome: 'aborted'` and the
reason carried on the close event. The user-visible
`<run-root>/artifacts/result.json` mirrors the same outcome and
reason on `RunResult.outcome` and `RunResult.reason` (RESULT-I4 —
Slice 53 Codex H1 fold-in). The dispatch step does NOT advance —
`step.completed` is not emitted for the aborted step, and
`routes.pass` is not taken.

**Event ordering at v0.** When the adapter invocation returns a result,
the runtime sequences events in this order on every dispatch step
(verdict pass or verdict/schema fail):

1. `step.entered`
2. The five-event dispatch transcript via `materializeDispatch`:
   `dispatch.started` → `dispatch.request` → `dispatch.receipt` →
   `dispatch.result` → `dispatch.completed`. The transcript writes
   the `request`, `receipt`, and `result` files unconditionally
   (durable evidence).
3. THEN, on the runner side: `gate.evaluated` (outcome=pass on
   admission; outcome=fail on rejection).
4. On pass: `step.completed` with `route_taken='pass'`. On fail:
   `step.aborted` with the same reason as `gate.evaluated.reason`.

The verdict-evaluation decision happens inside the runner BEFORE
the materializer is invoked (so `dispatch.completed.verdict`
carries the parsed verdict on pass and the observed verdict on
verdict-not-in-pass-set rejection); the on-disk artifact write is
gated on pass per ADR-0008 §Decision.3a (Slice 53 Codex HIGH 2
fold-in: the canonical artifact at `writes.artifact.path` is NOT
written when the gate fails — only the transcript persists).

**Adapter invocation failure ordering (Runtime Safety Floor Slice 3).**
If the adapter invocation itself throws or fails before returning a
receipt/result body, the runtime records the pre-await dispatch context
instead of stranding the run after `step.entered`:

1. `step.entered`
2. `dispatch.started`
3. `dispatch.request` with the SHA-256 of the request payload submitted
   to the adapter
4. `dispatch.failed` carrying adapter identity, role, resolved selection,
   resolved-from provenance, the same request hash, and the failure
   reason
5. `gate.evaluated outcome=fail` with the same reason
6. `step.aborted` with the same reason
7. `run.closed outcome=aborted` with the same reason

`<run-root>/artifacts/result.json` mirrors the aborted outcome and
reason. No `dispatch.receipt`, `dispatch.result`, `dispatch.completed`,
or `step.completed` event is emitted for that failed dispatch attempt,
because no adapter result exists.

**Runtime sentinels on `dispatch.completed.verdict`.**
`DispatchCompletedEvent.verdict` is `z.string().min(1)` so the
slot must always carry a non-empty string. On gate fail with no
observable verdict (unparseable JSON or parseable JSON without a
string `verdict` field), the runtime injects the sentinel literal
`'<no-verdict>'`. **This sentinel is runtime-injected, not
adapter-declared.** A consumer that reads
`dispatch.completed.verdict` SHOULD treat the
`'<no-verdict>'` literal as "no verdict was observable from
adapter output." The sentinel is honest at v0 (the alternative —
omitting the field — would require a schema bump that is out of
Slice 53 scope); a future schema iteration may distinguish
adapter-declared vs runtime-injected verdicts via an additional
`verdict_source` discriminator. This is the Codex MED 1
disclosure for Slice 53 and is registered as a deferred-with-
named-trigger item for Slice 55 arc-close (the trigger is the
first downstream consumer that needs to disambiguate the two
provenances).

**Pre-Slice-53 dishonesty disclosure (closed by Slice 53 for
verdict admissibility; artifact-side closed by Slice 54).** Prior
to Slice 53, `src/runtime/runner.ts::dispatchVerdictForStep`
returned `step.gate.pass[0]` unconditionally, and the runner
emitted `gate.evaluated` with `outcome: 'pass'` immediately after
materialization regardless of what the adapter said. Dispatch
steps advanced by construction. Slice 53 closes the verdict-
admissibility half: the explore fixture's two dispatch steps
(synthesize-step `gate.pass=["accept"]`; review-step
`gate.pass=["accept", "accept-with-fold-ins"]`) now require the
agent adapter to declare a verdict in their respective pass set
to advance. Slice 54 (Codex H15) closes the artifact-side half:
the canonical artifact at `writes.artifact.path` is materialized
ONLY when the adapter `result_body` schema-parses successfully
against `writes.artifact.schema`. Parse failures (including
unknown schema names — fail-closed default per the §Dispatch
artifact schema-parse subsection below) are surfaced through the
same `gate.evaluated outcome=fail` → `step.aborted` →
`run.closed outcome=aborted` sequence Slice 53 landed for the
verdict-admissibility half. This content/schema-failure path does
not emit `dispatch.failed`; that event is reserved for adapter
invocation exceptions, where no adapter result exists. The
content/schema failure-path event surface is uniform across both
halves of the ADR-0008 §Decision.3a gate.
This is a behavior-visible change for any AGENT_SMOKE end-to-end
run (`tests/runner/explore-e2e-parity.test.ts`): the real
`claude` subprocess MUST emit a single raw JSON object with a
string `verdict` field drawn from the accepted-verdicts list
(the `composeDispatchPrompt` instruction in
`src/runtime/runner.ts` was tightened at Slice 53 — Codex MED 4
fold-in — to forbid Markdown fences and prose around the JSON
object so adapter outputs round-trip cleanly through
`JSON.parse`).

The `specs/artifacts.json` `trust_boundary` + `dangerous_sinks`
fields for `explore.synthesis` and `explore.review-verdict` were
updated at Slice 38 to reflect adapter-computed provenance and
the new dispatch-result-promotion risk surface. This contract
remains authoritative on the reader/writer graph.

## Dispatch artifact schema-parse (Slice 54 Codex H15 fold-in)

Complement to the gate-evaluation subsection above. Slice 53
closes the verdict-admissibility half of the ADR-0008 §Decision.3a
materialization rule (gate-fail leaves `writes.artifact.path`
absent on disk). Slice 54 closes the symmetric artifact-shape half.

**The parse rule at v0.3.** When a dispatch step declares
`writes.artifact` and the Slice 53 verdict gate admits the
adapter's declared verdict, the runtime parses `result_body`
against a Zod schema looked up by `writes.artifact.schema` from
the registry at `src/runtime/artifact-schemas.ts`. The canonical
artifact at `writes.artifact.path` is materialized ONLY when BOTH
(a) the verdict gate passes and (b) the schema parse succeeds.
Parse failure leaves `writes.artifact.path` absent and surfaces
the error through `gate.evaluated outcome=fail` + reason →
`step.aborted` (same reason) → `run.closed outcome=aborted` (same
reason), with `RunResult.reason` mirroring the close-event reason
on the user-visible `result.json` (RESULT-I4, from Slice 53
Codex HIGH 1). This is the same shape Slice 53 landed for the
verdict-admissibility half. It does not emit `dispatch.failed`;
that event is reserved for adapter invocation exceptions, where no
adapter result exists. The content/schema failure-path event surface
is uniform across both halves of the gate.

**Schema absent → fail closed.** If `writes.artifact.schema`
names a schema that is NOT in the registry, the runtime treats
the lookup miss as a parse failure (reason: "artifact schema
'<name>' is not registered in the artifact-schema registry
(fail-closed default)"). No artifact is written; the step is
aborted. Fail-closed is mandatory at v0.3 — the contract MUST
does not admit a "schema unknown → pass" path, and any future
slice that lands a schema authoring surface (P2.10 artifact
schema set) MUST preserve fail-closed as the default for unknown
schema names.

**Registered schemas at v0.3.** The registry at
`src/runtime/artifact-schemas.ts` carries minimal-shape
`{ verdict: z.string().min(1) }.passthrough()` schemas for
`dogfood-canonical@v1`, `explore.synthesis@v1`, and
`explore.review-verdict@v1`. These match what Slice 53's gate
evaluator already requires from the same body (Codex MED 4
fold-in: adapter prompts tightened to emit a raw JSON object
with a verdict field), so the schema parse is structurally
redundant with gate-eval at v0.3 — the seam is live so P2.10
can widen to contract-bound real shapes without another runtime
amendment. A fourth registered schema (`dogfood-strict@v1`) is
test-only and used by `tests/runner/materializer-schema-parse.test.ts`
to exercise the gate-pass + schema-fail independent failure
path.

**`dispatch.completed.verdict` on schema-fail.** When the gate
admits the verdict but the artifact body fails schema parse,
`dispatch.completed.verdict` carries the observed verdict (same
invariant as Slice 53 verdict-not-in-pass rejection — durable
transcript reflects what the adapter said). The runtime sentinel
`'<no-verdict>'` is NOT used on this path because the adapter
DID declare a parseable verdict; the body shape, not the
verdict, is what failed.

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
9. **ADR-0008 reopens** (v0.2 amendment — mirror reopen trigger).
   If any of ADR-0008's six reopen conditions fires (target
   retarget, workflow-kind concept lands, dispatch transcript shape
   changes, role-adapter decoupling, a second workflow-kind picks
   option (b), or Check 27 misfires on a legitimate zero-dispatch
   fixture), this contract reopens to re-evaluate the §Canonical
   phase set executor/kind table and the `verify` omission
   rationale alongside the ADR.
10. **`<kind>.result` envelope consolidation** (v0.3 amendment —
    Slice 39 HIGH 4 fold-in). If a second workflow's close-phase
    aggregate (e.g., `build.result`, `repair.result`) has a shape
    structurally identical to `explore.result` (summary +
    verdict-snapshot + prior-artifact pointers), reopen §Path-split
    rationale to re-evaluate option (a) envelope-in-run.result
    against option (b) per-workflow sibling files. The path-split
    pattern is not precedent for "workflow-specific result shapes
    are divergent" — it is conditioned on divergence actually
    holding.

## Authority

- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1
  CC#P2-1` (one-workflow parity — `explore` target)
- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1
  CC#P2-6` (spine policy coverage — canonical set
  {frame, analyze, act, review, close} mapped from workflow-
  specific titles Frame/Analyze/Synthesize/Review/Close; Open
  Question #5 resolved to full-spine Standard rigor)
- `specs/adrs/ADR-0008-dispatch-granularity-modeling.md` (v0.2
  amendment — Synthesize and Review are dispatch steps; Check 27
  adapter-binding-coverage gate)
- `specs/plans/phase-2-implementation.md §P2.3` (slice framing)
- `specs/plans/phase-2-implementation.md §Target workflow for first
  parity` (operator decision + Codex rationale preserved verbatim)
- `specs/plans/phase-2-foundation-foldins.md §Slice 38` (v0.2
  amendment slice framing)
