---
adr: 0008
title: Dispatch Granularity Modeling — Explore's Synthesize and Review Are Dispatch Steps
status: Accepted
date: 2026-04-21
author: claude-opus-4-7 (drafted + fold-ins incorporated) + gpt-5-codex (challenger, objections folded in)
supersedes: none
related:
  - ADR-0007 (Phase 2 close criteria; CC#P2-1 first-parity workflow = `explore`; CC#P2-2 real-agent dispatch transcript)
  - specs/reviews/p2-foundation-composition-review.md §HIGH 1 (the boundary-seam finding this ADR closes — explore has no step that dispatches; adapter would land and never be invoked)
  - specs/plans/phase-2-foundation-foldins.md §Slice 38 (the plan slot this ADR lands in)
  - specs/contracts/explore.md (the v0.1 contract this ADR amends — Review phase rationale widens; canonical phase set unchanged)
  - src/schemas/step.ts:60 (DispatchStep — the existing schema surface option (a) binds to)
amends:
  - specs/contracts/explore.md §Canonical phase set (Synthesize/Review executor + kind flip; canonical mapping unchanged)
  - specs/contracts/explore.md §Invariant EXPLORE-I1 / §Deferred properties (widen Review rationale — no longer a "weaker substitute for verify"; now a distinct-adapter review dispatch)
  - .claude-plugin/skills/explore/circuit.json (fixture: Synthesize + Review become `kind: "dispatch"` + `executor: "worker"` with `role: implementer` / `role: reviewer`; gate flips from SchemaSectionsGate to ResultVerdictGate on both)
  - scripts/audit.mjs (new Check 27 — workflows targeting an adapter in P2.5+ must exercise at least one adapter-binding step)
---

# ADR-0008 — Dispatch Granularity Modeling (Explore's Synthesize and Review Are Dispatch Steps)

## Context

The Phase 2 foundation composition review
(`specs/reviews/p2-foundation-composition-review.md`, 2026-04-21)
surfaced five HIGH boundary-seam failures that no individual slice
owned. HIGH 1 was this: **explore has no step that dispatches.**

Every step in the v0.1 `explore` fixture at
`.claude-plugin/skills/explore/circuit.json` is
`executor: "orchestrator"` + `kind: "synthesis"`. Runtime dispatch
authority, per `src/schemas/step.ts:60`, is
`executor: "worker"` + `kind: "dispatch"` — a different step variant
with a different gate shape (`ResultVerdictGate` rather than
`SchemaSectionsGate`) and a different writes shape (`{request,
receipt, result, artifact?}` rather than `{artifact}`).

This is a cross-slice design gap, not a slice bug. P2.3 (explore
contract + fixture) locked the canonical phase set per ADR-0007
CC#P2-6; it did not settle the *executor-and-kind* choice for each
phase. P2.4 (real agent adapter) would have to make that choice
under pressure during adapter implementation, smuggling an
architectural decision into the first privileged runtime slice. The
composition review's HIGH 1 fix hint named two candidate models
explicitly:

- **(a) Dispatch-kind flip.** Rewrite the fixture so
  Synthesize (and Review) become `executor: "worker"` +
  `kind: "dispatch"`. This uses the existing `DispatchStep` variant
  unchanged.
- **(b) Orchestrator-synthesis-uses-adapter contract.** Keep
  `kind: "synthesis"` but add a new step-level affordance — a new
  field or a new step variant — for declaring an adapter binding on
  a synthesis step.

This ADR picks option (a) and closes the modeling gap at governance
level, so P2.4 lands bounded to adapter implementation.

**Why a governance ratchet and not just a fixture edit.** The choice
between (a) and (b) is not a cosmetic fixture rewrite. It binds
CC#P2-1 enforcement (the byte-shape parity test at P2.5 runs against
whichever model this ADR picks), it determines whether the five-
event dispatch transcript from Slice 37 has a single path or two
parallel paths, and it decides whether Synthesize and Review cross
a Knight-Leveson model boundary or remain same-model synthesis.
All three of those are authority surfaces that a fixture edit
cannot speak to. The ADR is the right tool.

**Why this ADR is not an ADR-0007 amendment (and explicit §6
applicability checklist — Codex Slice 38 MED 1 fold-in).**
ADR-0007 §6 precedent firewall applies to "retarget, waive, relax,
substitute, re-defer, or aggregate" any Phase 2 close criterion.
This ADR does none of those; it **widens** what CC#P2-1's
enforcement surface expects (Synthesize and Review gain dispatch
semantics; the byte-shape parity test at P2.5 runs against a
stricter model than the v0.1 contract described). To make the
applicability analysis auditable rather than a prose escape hatch,
the seven §6 clauses are addressed explicitly:

1. **§6.1 — Identify the original criterion being replaced or
   amended.** CC#P2-1 (one-workflow parity; target = `explore`)
   is the close criterion this ADR's amendment touches. CC#P2-6
   (spine policy coverage) is adjacent but unchanged. No other
   CC#P2-N is touched. The enforcement binding at CC#P2-1 —
   `tests/runner/explore-e2e-parity.test.ts` (P2.5) — runs
   against a stricter fixture post-ADR-0008.
2. **§6.2 — Prove the amendment is necessary, not merely
   convenient.** The necessity is named in the composition review
   §HIGH 1: without this slice, P2.4 either smuggles the modeling
   decision into the first privileged runtime slice or lands the
   adapter against zero-dispatch fixture. Evidence emerged *after*
   2026-04-21 ADR-0007 authoring (composition review 2026-04-21).
   Scope-reducing pivots are not available here; the amendment is
   structural.
3. **§6.3 — Name compensating evidence of a different structural
   type if weakening.** This ADR is **widening**, not weakening,
   at the contract surface — Synthesize and Review gain
   enforcement via `DispatchStep`, `ResultVerdictGate`, and the
   five-event dispatch transcript the runtime must materialize.
   §6.3 is therefore N/A in its literal text. The *weaker-evidence
   disclosure* it anticipates applies only to the specific v0.2
   claim that "distinct-adapter separation is a contract
   guarantee" — which is the Codex Slice 38 HIGH 1 fold-in that
   explicitly downgrades that claim to evidential-at-P2.4/P2.5
   (see §Decision.2 (iii) and §Decision.3). That downgrade is
   inline across ADR-0008, `specs/contracts/explore.md`, and both
   `trust_boundary` fields in `specs/artifacts.json` per §6.4.
4. **§6.4 — Carry weaker-evidence wording openly on every
   authority surface.** The weaker-evidence disclosure from Codex
   Slice 38 HIGH 1 lands inline at: ADR-0008 §Decision.2 (iii) +
   §Decision.3; `specs/contracts/explore.md §Canonical phase set`
   + §verify-omission rationale + §Artifact reader/writer graph;
   `specs/artifacts.json` `explore.synthesis.trust_boundary` +
   `explore.review-verdict.trust_boundary`. PROJECT_STATE.md
   slice-38 block carries the disclosure as well. Appendix-style
   pointers are avoided; the disclosure is in the authority surface
   prose.
5. **§6.5 — Add expiry or reopen trigger.** See §5 of this ADR
   (six triggers, each with a concrete condition). Trigger #5
   specifically names the distinct-adapter enforcement path:
   "role-adapter decoupling" reopens this ADR if
   `DispatchConfig.roles` or `DispatchRole` changes shape.
6. **§6.6 — Cross-model challenger pass with objection list;
   HIGH + MED folded in; class = `governance`.** Codex challenger
   pass at `specs/reviews/arc-slice-38-dispatch-granularity-adr-0008-codex.md`
   — opening verdict REJECT-PENDING-FOLD-INS, 3 HIGH / 3 MED / 3
   LOW. All HIGH + MED folded in before ceremony commit per this
   §6 applicability analysis + §6.4 inline disclosure. Yield-
   ledger row class = `governance`.
7. **§6.7 — Explicit non-precedent clause.** See §6 of this ADR.
   Split into allowed and forbidden citations per Codex Slice 38
   MED 3 fold-in.

The widening framing is therefore auditable, not a bypass. The
firewall's discipline — challenger pass, non-precedent, inline
disclosure — is honored; the specific clauses about substitution
or weaker-substitute evidence are N/A to this widening amendment,
with the one weaker-evidence claim (distinct-adapter) explicitly
disclosed per §6.4.

## Decision

### 1. Dispatch granularity model — option (a): dispatch-kind flip on Synthesize and Review

The `explore` workflow's canonical phase set is unchanged
(`{frame, analyze, act, review, close}` per ADR-0007 CC#P2-6 and
`specs/contracts/explore.md §Canonical phase set`). The
title-to-canonical translation is unchanged. The `plan` + `verify`
omissions are unchanged.

What changes is the **executor and kind** for two specific phases.
After this ADR, the `explore` fixture's five steps land as:

| Phase (title / canonical) | executor        | kind        | role           | writes                                                                 | gate               |
|---------------------------|-----------------|-------------|----------------|------------------------------------------------------------------------|--------------------|
| Frame / `frame`           | `orchestrator`  | `synthesis` | —              | `{artifact: brief.json}`                                               | `schema_sections`  |
| Analyze / `analyze`       | `orchestrator`  | `synthesis` | —              | `{artifact: analysis.json}`                                            | `schema_sections`  |
| Synthesize / `act`        | `worker`        | `dispatch`  | `implementer`  | `{artifact: synthesis.json, request: …, receipt: …, result: …}`        | `result_verdict`   |
| Review / `review`         | `worker`        | `dispatch`  | `reviewer`     | `{artifact: review-verdict.json, request: …, receipt: …, result: …}`   | `result_verdict`   |
| Close / `close`           | `orchestrator`  | `synthesis` | —              | `{artifact: result.json}`                                              | `schema_sections`  |

**Frame / Analyze / Close stay orchestrator-synthesis.** Framing
(stating the subject and success condition), decomposition
(producing aspects with evidence), and aggregation (composing prior
artifacts into a run result) are bookkeeping work the orchestrator
does. They do not benefit from crossing a model boundary; their
output is deterministic given the inputs.

**Synthesize / Review flip to worker-dispatch.** The synthesis IS
the investigation output — the model doing the work. Review IS the
adversarial pass — the model doing the checking. If the orchestrator
model does both of those, the explore workflow produces same-model
self-review, which the methodology explicitly rejects as
LLM-on-LLM corroboration (CLAUDE.md §Cross-model challenger
protocol; ADR-0001 Addendum B CC#15 structural-separation grounds).
Flipping these two phases to dispatch makes the Knight-Leveson
boundary crossing a contract-level guarantee rather than an
implementation-time coincidence.

### 2. Rationale — why option (a), not option (b)

The composition review named two candidate models. Option (a) wins
on four independent grounds:

**(i) Uses existing schema surface.** `DispatchStep` at
`src/schemas/step.ts:60` already carries the exact shape the flip
requires: `executor: "worker"`, `kind: "dispatch"`, `role:
DispatchRole` (enum `{researcher, implementer, reviewer}`), `writes:
{artifact?, request, receipt, result}`, and `gate:
ResultVerdictGate` with `source: {kind: "dispatch_result", ref:
"result"}`. No new schema work. Option (b) would invent either a
new optional `adapter` field on `SynthesisStep` or a new step
variant `SynthesisWithAdapter` — in either case, new schema
complexity for a relationship an existing variant already models.

**(ii) Single path for the five-event dispatch transcript.** Slice
37 widened `src/schemas/event.ts` with `DispatchRequestEvent`,
`DispatchReceiptEvent`, and `DispatchResultEvent` variants — the
five-event dispatch transcript ADR-0007 CC#P2-2 names. Those events
discriminate on `kind: "dispatch.request" | "dispatch.receipt" |
"dispatch.result"` and carry hashes bound to the *dispatch* step
surface. Option (a) produces exactly one transcript path — every
Synthesize or Review execution emits the canonical five-event
sequence against a `kind: "dispatch"` step. Option (b) would
either (i) fire those events against a `kind: "synthesis"` step
(violating the transcript-step discriminator the composition review
helped author), or (ii) invent a parallel transcript for synthesis-
with-adapter (two code paths for the same observable behavior).

**(iii) Role-tagged worker-dispatch boundary is contract-visible
at v0.2; distinct-adapter/distinct-model enforcement is deferred
(Codex Slice 38 HIGH 1 fold-in).** The methodology's core
justification for cross-model evidence (CLAUDE.md §Cross-model
challenger protocol; ADR-0001 Addendum B CC#15) rests on one claim:
same-model corroboration is structurally weaker than distinct-model
corroboration. Option (a) makes Synthesize's and Review's
*worker-dispatch* boundary fall out of the step schema itself — a
worker-executor dispatch step has a `role` tag, a request/receipt/
result transcript shape, and a `ResultVerdictGate` that every
orchestrator-synthesis step lacks. That is a **contract-visible
boundary**. What the v0.2 schema layer does *not* enforce is that
the adapter resolving `DispatchConfig.roles.implementer` and the
adapter resolving `DispatchConfig.roles.reviewer` are distinct —
`src/schemas/config.ts:34-99` permits both roles to bind to the
same adapter, and `ResolvedAdapter` at `src/schemas/adapter.ts:59-63`
does not carry a "differs-from-prior-dispatch" field.

**Option (a) is still the right choice for this reason:** the
contract-visible boundary is the *precondition* for distinct-adapter
enforcement. At v0.2, authors can introspect the fixture and see
"Synthesize + Review go through worker dispatch with role tags";
they cannot see that under option (b), which leaves the dispatch
decision entirely at the runtime layer. When P2.4 lands the real
`agent` adapter and P2.5 lands the end-to-end parity test, the
distinct-adapter / distinct-model guarantee becomes evidentially
enforceable (via config test + golden-parity assertion on distinct
receipt-id / request-hash values). Option (b) would make that
evidential enforcement harder because the dispatch decision would
be invisible at the contract layer.

The cleaner phrasing, per the Codex fold-in: option (a)
*contract-visibly* routes the evidence-producing work through the
dispatch machinery; the evidence itself (distinct adapter, distinct
model, distinct receipt) is enforced at P2.4/P2.5 landing. Option
(b) leaves even the routing invisible.

**(iv) P2.4 is bounded to adapter implementation.** With option
(a), P2.4 ships `src/runtime/adapters/agent.ts` and the adapter is
invoked from the Synthesize and Review steps via the existing
dispatch machinery — no new modeling decisions at P2.4 time. With
option (b), P2.4 has to either invent the new affordance (pushing
scope back into a privileged runtime slice) or land against a
fixture that doesn't exercise the affordance (reintroducing the
HIGH 1 failure mode).

### 3. Consequence for the Review phase — the "weaker substitute" rationale is retired

The v0.1 `specs/contracts/explore.md §Canonical phase set` contains
the following Codex MED 9 fold-in rationale for omitting the
`verify` canonical from the explore spine:

> Explore produces investigation output (not executable artifacts),
> so there is no mechanical verification step analogous to `build`'s
> test-run gate. The Review phase provides an adversarial pass over
> the synthesis that is a **weaker substitute** for verify, not a
> full replacement: the v0.1 Review phase has `executor:
> "orchestrator"` and `kind: "synthesis"` — it is not a distinct-
> adapter review dispatch, does not cross a Knight-Leveson model
> boundary, and does not emit a result-verdict gate distinct from
> the phase gate.

That rationale was honest about v0.1. **It is retired by this ADR,
with the weaker-evidence wording explicitly disclosed per ADR-0007
§6.4 (Codex Slice 38 HIGH 1 + MED 1 fold-in).** After the flip:

- Review IS a worker-dispatch step with `role: "reviewer"`
  (`executor: "worker"`, `kind: "dispatch"`, `role: "reviewer"`).
  This is a contract-visible routing change: Review now goes
  through the dispatch machinery rather than orchestrator-synthesis.
- Review's `role: "reviewer"` tag binds to
  `DispatchConfig.roles.reviewer` at runtime. The v0.2 schema layer
  does NOT enforce that the reviewer-role adapter is distinct from
  the implementer-role adapter that wrote the synthesis —
  `src/schemas/config.ts:34-99` permits both roles to bind to the
  same adapter, and `src/schemas/adapter.ts:59-63` `ResolvedAdapter`
  carries no "differs-from-prior-dispatch" field. **Distinct-
  adapter / Knight-Leveson-boundary enforcement is therefore an
  evidential guarantee that lands at P2.4 (the adapter
  implementation) + P2.5 (the end-to-end parity test asserting
  distinct receipt-ids or request-hashes per role), not a contract-
  level guarantee at v0.2.** This is a weaker-evidence disclosure:
  the dispatch-machinery routing is contract-visible; the
  distinct-model separation is deferred evidential enforcement.
- Review DOES emit a result-verdict gate distinct from the phase
  gate (`ResultVerdictGate` with `source: dispatch_result`, `pass:
  [list of verdict tokens]`). This is unambiguously stronger than
  v0.1's SchemaSectionsGate on the orchestrator-synthesis step.

**The `verify` canonical remains omitted.** Review is now a real
adversarial pass rather than a weaker substitute, but it still is
not mechanical verification analogous to `build`'s test-run gate.
Explore produces investigation output, and there is no
executable-artifact check that would constitute `verify` for that
output. The rationale for omitting `verify` changes from "Review is
a weaker substitute" to "explore output is not executable and does
not admit mechanical verification; Review is the adversarial pass
that IS in scope." This is a widening, not a weakening.

`specs/contracts/explore.md` is amended inline to reflect this
(§Canonical phase set rationale prose + §Invariant EXPLORE-I1
scope note + §Deferred properties — no property changes, but the
Review-phase executor/kind flip is noted in the artifact
reader/writer graph table).

### 3a. Dispatch result-to-artifact materialization rule (Codex Slice 38 HIGH 2 fold-in)

A worker-dispatch step's `writes` shape carries two distinct
surfaces (per `src/schemas/step.ts:60-72`):

- `writes.{request, receipt, result}` — the dispatch **transcript**
  slots. These record the opaque adapter-exchange payload/identifier/
  output. `request` is the payload submitted to the adapter;
  `receipt` is the adapter-assigned identifier for the in-flight
  dispatch; `result` is the adapter's raw response. The
  `ResultVerdictGate` gates on `source: dispatch_result, ref:
  "result"` — i.e., on the raw adapter output.
- `writes.artifact` (optional) — the **downstream artifact** slot.
  When present, it declares the canonical `{path, schema}` for a
  validated artifact that downstream steps read.

**The binding rule (contract-level at v0.2; runtime-enforced at
P2.4).** When a DispatchStep declares `writes.artifact`, the
runtime MUST, after the gate passes, materialize the artifact file
at `writes.artifact.path` by schema-parsing the `result` payload
against `writes.artifact.schema`. Downstream steps reading
`writes.artifact.path` observe the validated artifact, not the raw
dispatch transcript. The `writes.result` path and the
`writes.artifact.path` remain distinct on disk: `result` is the
dispatch transcript record (auditable by replay); `artifact` is
the canonical downstream-consumed value.

**Why this rule is needed (Codex evidence).** Without the rule,
the fixture shape permits a split where `synthesize-step` writes
`result = artifacts/dispatch/synthesize.result.json` (gate passes
on this) but `artifact = artifacts/synthesis.json` (Review step
reads this). The gate says the dispatch succeeded; Review reads a
file that was never written. The contract needs a binding that
ties the two paths together at the materialization step.

**Fixture-level obligation at v0.2.** Every dispatch step in a
registered workflow fixture that produces a downstream-read
artifact (i.e., another step in the same fixture reads the
artifact path) MUST declare both `writes.result` (required by
DispatchStep) AND `writes.artifact` (the materialization target).
The explore fixture post-Slice-38 satisfies this for both
Synthesize (`writes.artifact = artifacts/synthesis.json`) and
Review (`writes.artifact = artifacts/review-verdict.json`).

**Check 27 enforcement (see §Decision.4).** Check 27 asserts this
fixture-level obligation by requiring every `kind: "dispatch"`
step in a registered workflow fixture to declare `writes.artifact`
whenever that fixture is an explore-kind fixture (policy row in
`WORKFLOW_KIND_DISPATCH_POLICY`). Other workflow kinds at their
landing slices may opt in to this rule or substitute an
equivalent binding.

**P2.4 runtime enforcement.** When the real `agent` adapter lands
at P2.4, the runtime's dispatch completion handler MUST execute
the materialization step above. A dispatch step whose `result`
parses successfully against `writes.artifact.schema` but whose
`writes.artifact.path` is not written is a runtime invariant
violation; a runtime contract test at P2.5 binds this.

### 4. The adapter-binding-coverage audit check (Check 27)

To prevent the HIGH 1 class of failure from recurring at any
future workflow-kind landing (when `build`, `repair`, `migrate`, or
`sweep` each land their own fixture), this ADR mandates a new audit
check. Check 27 (`checkAdapterBindingCoverage` at
`scripts/audit.mjs`) enforces the following per-fixture rules.

**Scope (Codex Slice 38 MED 2 fold-in — strengthened from the initial
"any-dispatch-step" gate).**

- **Applies to:** fixtures whose `id` appears in
  `WORKFLOW_KIND_CANONICAL_SETS`. Today that is `explore`; future
  workflow kinds are added as they land.
- **Exempt:** fixtures in `EXEMPT_WORKFLOW_IDS` (today:
  `dogfood-run-0`, the Phase 1.5 Alpha Proof partial-spine
  scaffold which does not target an adapter).
- **Unregistered (unknown workflow kinds):** yellow finding with
  "if this is a P2.5+ enforcement target, add to
  `WORKFLOW_KIND_CANONICAL_SETS` and ensure at least one
  adapter-binding step per ADR-0008 §Decision.4" — not green
  pass-through. This catches the "new workflow-kind lands but
  forgot to register it" recurrence path.

**Enforcement (per registered workflow kind).**

1. **Minimum dispatch coverage.** The fixture MUST exercise at
   least one step with `kind: "dispatch"`. Red on zero.
2. **Kind-specific dispatch step-id binding (from
   `WORKFLOW_KIND_DISPATCH_POLICY`).** For kinds with a policy row
   (today: `explore` with `require_dispatch_step_ids:
   ['synthesize-step', 'review-step']`), every listed step id MUST
   be present and have `kind: "dispatch"`. Red on missing or
   wrong-kind. This binding is the Codex MED 2 strengthening: the
   fixture cannot satisfy the gate by flipping only one of
   Synthesize/Review.
3. **Dispatch result-to-artifact materialization (from §Decision.3a
   + `WORKFLOW_KIND_DISPATCH_POLICY.require_writes_artifact_on_dispatch`).**
   For kinds with the policy flag set (today: `explore`), every
   `kind: "dispatch"` step MUST declare `writes.artifact` alongside
   the required `writes.result`. Red on any dispatch step missing
   `writes.artifact`. This binding is the Codex HIGH 2 fold-in —
   the fixture-level precondition that the materialization rule at
   §Decision.3a has an artifact target to materialize to.

**Green semantics.** All three rules pass for every registered
fixture.

**Future workflow kinds.** When a new workflow kind lands, the
authoring slice:

- Adds its canonical-set entry to `WORKFLOW_KIND_CANONICAL_SETS`.
- Decides whether to add a policy row to
  `WORKFLOW_KIND_DISPATCH_POLICY`. If yes, it names the required
  dispatch step ids and sets the artifact-materialization flag as
  appropriate to its own dispatch model (which may differ from
  option (a); see §6 non-precedent clause).
- Adds or amends tests accordingly.

### 5. Reopen conditions for this ADR

This ADR is reopened if any of:

1. **CC#P2-1 target retarget.** If ADR-0007 §4b retarget checklist
   reselects the first-parity target away from `explore`, this ADR
   is re-evaluated against the new target. Dispatch granularity is
   a per-workflow-kind choice; the modeling decision may differ for
   a different target (e.g., `review` if operator invokes the
   CC#P2-1 scope-reducing fallback).
2. **Workflow-kind concept lands.** If the base `Workflow` schema
   gains a first-class `kind` field at P2-MODEL-EFFORT or a
   dedicated slice, the ADR's "Synthesize and Review are dispatch
   for explore" binding migrates into the kind-specific layer and
   this ADR amends to point there.
3. **Dispatch transcript shape changes.** If a future slice amends
   the five-event dispatch transcript sequence (e.g., adds a
   `dispatch.retry` variant, changes the pair-order invariant),
   the compatibility of option (a) with the new transcript is
   re-verified; if compatibility breaks, this ADR amends the model
   or option (b) is revisited.
4. **Role-adapter decoupling.** If
   `src/schemas/step.ts` `DispatchRole` is amended (new roles, role
   enum removed, or role-adapter mapping changes in
   `src/schemas/config.ts` `DispatchConfig.roles`), the implementer/
   reviewer role assignments in the explore fixture are re-verified
   against the new surface.
5. **A second workflow-kind chooses option (b).** If `build`,
   `repair`, `migrate`, or `sweep` lands a fixture where
   orchestrator-synthesis-with-adapter-binding is genuinely the
   better model (e.g., a workflow where the orchestrator's role
   truly is synthesis and the adapter provides tool calls rather
   than full dispatch), this ADR is re-opened to distinguish the
   `explore` option-(a) binding from the new workflow's option-(b)
   binding; the current ADR does not claim option (a) is universal.
6. **Check 27 misfires on a legitimate zero-dispatch fixture.** If
   a future workflow-kind lands that genuinely has zero dispatch
   steps (e.g., a pure-orchestrator utility workflow that still
   registers a canonical-set entry), Check 27's applicability rule
   is re-examined. The current rule — "fires on any canonical-set
   entry with zero dispatch" — is correct for today's one-kind set
   but may need per-kind opt-out at a larger set.

### 6. Non-precedent clause (Codex Slice 38 MED 3 fold-in — split into allowed vs forbidden)

The precedent-firewall posture of this ADR is explicitly split so
the clause is load-bearing rather than prose-only.

**Allowed citations.** A future ADR authoring a dispatch-
granularity decision for a different workflow kind (`build`,
`repair`, `migrate`, `sweep`, or any custom kind) MAY cite ADR-0008
for:

- The **four-ground analysis frame** in §Decision.2 as the canonical
  test a workflow-kind ADR must answer. Citation form: "the
  four-ground analysis from ADR-0008 §2 is applied here to
  [workflow-kind]." The citing ADR must then produce its OWN
  answers to the four grounds against its own fixture — not
  copy-paste ADR-0008's explore-specific answers.
- The **§6 applicability checklist pattern** (the seven-clause
  §6-style applicability analysis from §Context) as a template for
  how to address ADR-0007 §6 for a widening amendment. Citation
  form: "the §6-applicability-checklist shape from ADR-0008 §Context
  is reused here." The citing ADR produces its own clause-by-clause
  analysis, not a copy of ADR-0008's.
- The **dispatch result-to-artifact materialization rule** in
  §Decision.3a as a reusable binding. Citation form: "ADR-0008
  §Decision.3a materialization rule applies to this workflow's
  dispatch steps." This binding is genuinely reusable because it
  applies at the step-schema level; the citing ADR inherits the
  rule for its own dispatch steps without further analysis.

**Forbidden citations.** A future ADR MUST NOT cite ADR-0008 for:

- The **specific answer for `explore`** — option (a) over option
  (b). Citation forms explicitly rejected: "the explore ADR-0008
  pattern applies here," "extending ADR-0008's approach,"
  "option (a) per ADR-0008," or any phrasing that treats
  ADR-0008's *conclusion* rather than its *analysis frame* as
  transferable. The four-ground analysis produced option (a) for
  explore because explore's phases have specific properties
  (investigation output, adversarial review, orchestrator
  bookkeeping at Frame/Analyze/Close). A different workflow with
  different phase properties may reach option (b) or a third
  model; the conclusion is not precedent.
- The **non-precedent clause itself as a template for not writing
  a non-precedent clause**. Every workflow-kind ADR authors its
  own non-precedent clause with its own allowed/forbidden split.

**Enforcement (prose-level at v0.2; auditable at a future slice).**
This clause is authoritative prose at v0.2. A future slice MAY
add an audit check over new ADRs for forbidden citation phrases
("ADR-0008 pattern applies", "extending ADR-0008") absent an
explicit fresh four-ground analysis subsection. Until that audit
lands, the clause is enforced at challenger-pass review time:
any ADR citing ADR-0008 must disclose which kind of citation
(allowed vs forbidden) it is making, and the challenger's
objection list gates acceptance.

**Relationship to ADR-0007 §6.** ADR-0007's §6 precedent firewall
remains in force for any ADR that proposes to amend CC#P2-1
through CC#P2-8. ADR-0008 does neither — it widens CC#P2-1's
enforcement surface without amending the criterion text. See
§Context §6 applicability checklist for the clause-by-clause
analysis.

## Rationale

The composition review's HIGH 1 finding is structurally sharp: "no
step in the target explore fixture dispatches, so the P2.4 real-
adapter slice lands correctly-tested and never actually invoked."
The review named two candidate fixes and declined to pick between
them, leaving the modeling decision for a follow-up.

The choice between (a) and (b) is not evenly matched. Option (b)
preserves more of the existing fixture shape, which is a real
value for a contract that has already cleared one Codex challenger
pass (Slice 34). But preservation-of-shape is not a structural
ground — it's a churn-minimization preference. The four structural
grounds in §2 all favor (a): existing schema surface, single
transcript path, Knight-Leveson as contract guarantee, and P2.4
scope boundedness. Preservation of shape does not outweigh any of
them.

A second question — why this decision is authoritative at ADR level
rather than at contract-amendment level — turns on the
cross-workflow stakes. Even though ADR-0008 speaks directly only to
`explore`, it establishes the four-ground analysis (§2) as the
canonical test for future workflow kinds. A contract-amendment-only
decision would leave future kinds without a precedent-agnostic
analysis frame; an ADR with an explicit non-precedent clause
installs the analysis frame and simultaneously prohibits lazy
copy-paste application of the frame's *conclusion* to future kinds.

## What changes

### 1. `specs/contracts/explore.md` §Canonical phase set + §Invariant + §Artifact reader/writer graph

- **§Canonical phase set** gains a subsection titled "Executor and
  kind per phase (ADR-0008 binding)" with the table from §Decision.1
  above. The title-to-canonical translation table is unchanged.
- **§Invariant EXPLORE-I1 scope of enforcement** note is amended to
  mention that Synthesize and Review now have `kind: "dispatch"`
  shape constraints enforced by the base `Workflow.safeParse` (via
  `DispatchStep` and `ResultVerdictGate`), not by Check 24. Check
  24 remains the canonical-set + spine-policy enforcer.
- **§Rationale for `verify` omission** is amended inline: the
  "weaker substitute" wording is retired (with explicit "widened by
  ADR-0008" notation); the new rationale is "explore output is not
  executable and does not admit mechanical verification; Review is
  the adversarial pass that IS in scope, and is now a distinct-
  adapter review dispatch per ADR-0008."
- **§Artifact reader/writer graph** gains a note that Synthesize
  and Review write their artifacts via dispatch steps (so their
  write path includes the request/receipt/result transcript slots
  alongside the artifact).
- **§Reopen conditions** gains one new trigger: "ADR-0008 reopens"
  (per §5 of this ADR) as a mirror reopen for the contract.

### 2. `.claude-plugin/skills/explore/circuit.json`

Synthesize-step and Review-step rewritten per §Decision.1 table.
Specifically:

- `synthesize-step`:
  - `executor: "worker"` (was `"orchestrator"`)
  - `kind: "dispatch"` (was `"synthesis"`)
  - `role: "implementer"` (new required field)
  - `writes: {artifact: {path: "artifacts/synthesis.json", schema:
    "explore.synthesis@v1"}, request:
    "artifacts/dispatch/synthesize.request.json", receipt:
    "artifacts/dispatch/synthesize.receipt.txt", result:
    "artifacts/dispatch/synthesize.result.json"}` (widened)
  - `gate: {kind: "result_verdict", source: {kind:
    "dispatch_result", ref: "result"}, pass: ["accept"]}` (was
    `schema_sections`)
- `review-step`:
  - `executor: "worker"`, `kind: "dispatch"`, `role: "reviewer"`
  - `writes: {artifact: {path: "artifacts/review-verdict.json",
    schema: "explore.review-verdict@v1"}, request:
    "artifacts/dispatch/review.request.json", receipt:
    "artifacts/dispatch/review.receipt.txt", result:
    "artifacts/dispatch/review.result.json"}`
  - `gate: {kind: "result_verdict", source: {kind:
    "dispatch_result", ref: "result"}, pass: ["accept",
    "accept-with-fold-ins"]}`

Frame, Analyze, and Close steps are unchanged.

### 3. `scripts/audit.mjs` — new Check 27 `checkAdapterBindingCoverage`

Takes the next-available-slot number after Check 26
(`checkArcCloseCompositionReviewPresence` from Slice 35). Exported
for import by contract tests. Check 27 iterates
`.claude-plugin/skills/<kind>/circuit.json` fixtures, selects
those whose `id` is in `WORKFLOW_KIND_CANONICAL_SETS` and not in
`EXEMPT_WORKFLOW_IDS`, and asserts that the fixture's `steps` array
contains at least one entry with `kind === "dispatch"`. Red on
missing dispatch; green on present.

### 4. `tests/contracts/adapter-binding-coverage.test.ts`

Contract-test suite for Check 27. Covers: green path (explore
fixture after this slice), red path (synthetic fixture with zero
dispatch steps), exempt path (`dogfood-run-0` passes through),
unknown-kind pass-through, and live-repo regression.

### 5. `specs/reviews/adversarial-yield-ledger.md`

Row appended per convention established slices 32–37. Class =
`governance` (this is an ADR + ratchet change).

### 6. `specs/invariants.json`

No new invariant IDs introduced by this ADR. EXPLORE-I1 scope note
amendment is a prose-level change in `specs/contracts/explore.md`;
the ledger row for EXPLORE-I1 retains its existing
`enforcement_state` and `target_slice`.

### 7. `PROJECT_STATE.md` update per slice-landing convention

`current_slice: 38` comment updated; Last-updated block appended
with slice summary + plain-English operator summary per CLAUDE.md
§After-slice operator summary.

### 8. Ratchet floor advance

`specs/ratchet-floor.json` floor advances by the count of new
static test declarations added in
`tests/contracts/adapter-binding-coverage.test.ts`. `last_advanced_in_slice`
→ `'38'`.

## Consequences

### Accepted (widening-disclosure)

**Two phases of `explore` now require a distinct adapter at
runtime.** With the flip, Synthesize and Review cannot run under
pure orchestrator-synthesis (the runtime would reject the fixture
at `Workflow.safeParse` time because the steps now require
`role`, `request`/`receipt`/`result` write slots, and a
`ResultVerdictGate`). This is a contract strengthening; it
eliminates a failure mode the v0.1 contract admitted (same-model
synthesis masquerading as distinct-adapter synthesis) but it also
means the `explore` workflow cannot run end-to-end until P2.4
ships a real adapter. That matches CC#P2-1's own binding — P2.5 is
the end-to-end run, P2.4 is the adapter that makes it possible —
so the widening does not introduce new upstream dependencies.

**The `explore.review-verdict` and `explore.synthesis` artifacts
are now dispatch-step outputs, not orchestrator outputs.** Their
content shape is unchanged; their provenance changes. Anywhere in
the repo that asserts on the provenance of these artifacts (today:
`specs/artifacts.json`'s `trust_boundary` fields — see §Deferred
work below) must be amended at this slice or at a follow-up slice
to reflect the dispatch-kind provenance. **Deferred work: §Deferred
below names the specific artifact-registry amendments that must
land either in this slice or at Slice 39.**

### Enabling

**P2.4 scope is now bounded to adapter implementation.** When P2.4
reopens after this arc, the target fixture exercises two
adapter-binding steps; the adapter implementation is the
pressure-bearing slice, not the modeling decision. This closes
HIGH 1 structurally.

**P2.5 golden-artifact set has a real dispatch path to verify.**
The byte-shape parity test at CC#P2-1's enforcement binding
`tests/runner/explore-e2e-parity.test.ts` can assert on dispatch
transcript entries (request payload hash, receipt id, result
artifact hash) as part of the golden comparison — not just on the
four content artifacts.

**Future workflow kinds inherit the four-ground analysis frame.**
When `build`, `repair`, `migrate`, `sweep`, or a custom kind lands
its fixture, the authoring slice runs the §2 four-ground analysis
against its own phases, writes its own ADR, and gets a Codex
challenger pass. This ADR's non-precedent clause (§6) prohibits
copy-paste of the conclusion; the analysis frame itself is the
durable contribution.

### Deferred / Not changed (Codex Slice 38 LOW 1 fold-in — rewritten to reflect actually-landed amendments)

**`specs/artifacts.json` provenance amendments — LANDED in Slice 38.**
`trust_boundary` for `explore.synthesis` and `explore.review-verdict`
was amended in this slice to reflect the dispatch-kind provenance
(model-authored via adapter dispatch, with `role` binding to
`DispatchConfig.roles.{implementer, reviewer}`, plus the five-event
dispatch transcript recording per ADR-0007 CC#P2-2). The
`writers` field was amended to name the new dispatch semantics
(`explore synthesize-step (worker dispatch, role=implementer per
ADR-0008)`; similarly for review-step). The distinct-adapter
weaker-evidence disclosure (Codex Slice 38 HIGH 1 fold-in) is
inline in both `trust_boundary` fields per §6.4.

**`specs/artifacts.json` `dangerous_sinks` widening — LANDED in
Slice 38** (Codex Slice 38 LOW 2 fold-in). The
`dangerous_sinks` fields for `explore.synthesis` and
`explore.review-verdict` were widened to mention the new risk
surface introduced by the dispatch flip: adapter-authored
`writes.result` payloads that are promoted into the canonical
artifact via the materialization rule at §Decision.3a. A
malicious or adversarial adapter output is a new trust-boundary
concern that downstream readers (review gate, close-phase
aggregation) now inherit from the dispatch transcript.

**Deferred — not amended in Slice 38.**

- **`origin_token_policy` field.** Not touched. Origin-token
  enforcement is satisfied by `model-authored` at the start of both
  `trust_boundary` strings; the canonical-token audit
  (`trustBoundaryHasOriginToken`) passes green.
- **Schema files for `explore.synthesis.v1` /
  `explore.review-verdict.v1`.** Still empty string; artifact
  schemas are planned at P2.10 per plan `§Mid-term slices`. This
  is unchanged from v0.1.
- **P2.5 runtime-enforcement binding for the materialization rule**
  at §Decision.3a. The fixture-level obligation lands at Slice 38
  via Check 27; the runtime invariant (adapter-result parses against
  `writes.artifact.schema`; artifact materializes at
  `writes.artifact.path`) binds to
  `tests/runner/explore-e2e-parity.test.ts` when P2.5 lands.
- **`run.result` / `explore.result` backing-path collision.**
  Tracked at Slice 35 Check 25 yellow; closing at Slice 39 (HIGH 4
  artifact-path split). Not touched in Slice 38.

**Check 24 (`checkSpineCoverage`) behavior does not change.** The
canonical-set + spine-policy enforcement is independent of the
executor/kind choice. Check 24 reads `phases[*].canonical` and
`spine_policy.{mode, omits}`; those fields are unchanged by this
ADR. Check 27 is additive.

**No change to CC#P2-2's five-event dispatch transcript.** Slice 37
landed the schema; this slice lands a workflow that consumes it.
The transcript shape is unchanged.

**No change to ADR-0007.** ADR-0007's §6 precedent firewall, its
eight close criteria, and its no-aggregate-scoring rule are all
unchanged. This ADR is scoped narrower than any CC#P2-N amendment.

## Reopen conditions (for ADR-0008 specifically)

See §5 above. Six triggers listed. Summarized here for audit cross-
reference: target retarget, workflow-kind concept landing, dispatch
transcript shape change, role-adapter decoupling, a second
workflow-kind picking option (b), and Check 27 misfire on a
legitimate zero-dispatch fixture.

## Provenance

- Composition review: `specs/reviews/p2-foundation-composition-review.md`
  §HIGH 1 (the boundary-seam finding this ADR closes).
- Arc plan: `specs/plans/phase-2-foundation-foldins.md` §Slice 38
  (plan slot for this ADR's landing).
- Existing schema surface: `src/schemas/step.ts:60` (DispatchStep),
  `src/schemas/gate.ts:67` (ResultVerdictGate),
  `src/schemas/event.ts:78-173` (five-event dispatch transcript
  variants, landed at Slice 37).
- Codex challenger pass:
  `specs/reviews/arc-slice-38-dispatch-granularity-adr-0008-codex.md`
  (this slice); opening REJECT-PENDING-FOLD-INS or ACCEPT-WITH-
  FOLD-INS per objection-list content; closing ACCEPT-WITH-
  FOLD-INS or ACCEPT per post-fold-in verdict.
- Operator authorization: overnight full-autonomy session
  2026-04-21 + continuity record `continuity-22267f47` (debt
  entry: "Slice 38 ADR-0008 authoring REQUIRES Codex challenger
  pass per §6 precedent firewall").

## References

- ADR-0007 (Phase 2 close criteria; CC#P2-1 target = `explore`,
  CC#P2-2 real-agent dispatch transcript, §6 precedent firewall).
- ADR-0001 Addendum B (Phase 1.5 → Phase 2 transition; CC#15
  structural-separation grounds for cross-model evidence).
- `specs/contracts/explore.md` v0.1 (the contract this ADR amends).
- `specs/reviews/p2-foundation-composition-review.md` §HIGH 1.
- `specs/plans/phase-2-foundation-foldins.md` §Slice 38.
- `src/schemas/step.ts`, `src/schemas/gate.ts`,
  `src/schemas/event.ts` (the schema surfaces this ADR binds to).
- CLAUDE.md §Cross-model challenger protocol + §Hard invariants
  #5–#8.

## Lane and ratchet declaration (for the ceremony slice landing this ADR)

**Lane:** Ratchet-Advance.

**Ratchets advanced independently (per CLAUDE.md §Hard invariants
#8 — no aggregate scoring):**

1. **Dispatch-wiring ratchet** — `explore` fixture now exercises
   two `kind: "dispatch"` steps (advance from zero at v0.1).
2. **Modeling-authority ratchet** — ADR-0008 installs the
   four-ground analysis frame as the canonical test for workflow-
   kind dispatch-granularity decisions.
3. **Audit-coverage ratchet** — Check 27
   (`checkAdapterBindingCoverage`) added.
4. **Contract-test ratchet** — `specs/ratchet-floor.json` floor
   advances by the count of new static test declarations in
   `tests/contracts/adapter-binding-coverage.test.ts`;
   `last_advanced_in_slice` → `'38'`.

**None of these ratchets regress any other.** The independence
assertion is tracked per CLAUDE.md §Hard invariants #8; this ADR
does not compose them into a single aggregate.

## Appendix A — Option (b) rejected-alternative record

For future-authors' benefit, the full shape of the rejected
alternative:

### Option (b) — orchestrator-synthesis-uses-adapter

**Schema change.** Either:

- **(b.i)** Add an optional `adapter: AdapterRef` field to
  `SynthesisStep` at `src/schemas/step.ts:34`. A synthesis step
  whose `adapter` is present is interpreted as "orchestrator
  dispatches body to adapter, receives tokens back, writes
  artifact." Transcript behavior: unclear — either fire `dispatch.*`
  events against a `kind: "synthesis"` step (violates the
  transcript step-kind discriminator) or invent a parallel
  transcript.
- **(b.ii)** Add a new step variant `SynthesisWithAdapter` to the
  discriminated union at `src/schemas/step.ts:86`, with shape
  `{executor: "orchestrator", kind: "synthesis-with-adapter",
  role: DispatchRole, writes: {...}, gate: ...}`. New transcript
  path against the new kind.

**Fixture shape.** `synthesize-step` and `review-step` gain
`adapter: {...}` references; `executor` stays `"orchestrator"`;
`kind` stays `"synthesis"` (b.i) or becomes `"synthesis-with-
adapter"` (b.ii).

**Rejection grounds (four, from §2):**

1. Invents new schema surface for a relationship `DispatchStep`
   already models.
2. Two parallel paths for the five-event dispatch transcript
   (or a parallel transcript invention).
3. Knight-Leveson boundary crossing becomes runtime promise, not
   contract guarantee.
4. P2.4 either invents the new affordance (scope creep) or lands
   against zero-dispatch fixture (reintroduces HIGH 1).

**If option (b) is ever re-visited for a different workflow kind**
(per §5 reopen trigger #5), the author of that ADR runs their own
four-ground analysis against their own phases; ADR-0008's
rejection of (b) for `explore` does not bind their analysis.
