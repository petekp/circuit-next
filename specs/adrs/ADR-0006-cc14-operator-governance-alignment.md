---
adr: 0006
title: Phase 1.5 Close Criterion #14 — One-Time Waiver and Retarget (Product-Level Operator Check + Delegated LLM-Standin Comprehension)
status: Accepted
date: 2026-04-20
author: operator + claude-opus-4-7 (drafted) + gpt-5-codex (challenger, fold-ins incorporated)
supersedes: none
related: ADR-0001 (Addendum B §Phase 1.5 Close Criteria #14, §Reopen conditions); CC#13; CC#15
amends: ADR-0001 Addendum B §Phase 1.5 Close Criteria #14
---

# ADR-0006 — CC#14 One-Time Waiver and Retarget

## Context

ADR-0001 Addendum B (Slice 25d) installed Phase 1.5 Alpha Proof and
enumerated 16 close criteria. Criterion #14 reads:

> `specs/reviews/phase-1-close-reform-human.md` exists with `opened_scope`,
> `skipped_scope`, and at least one "I could not understand X" field.

The **structural intent** behind CC#14 (see `specs/plans/phase-1-close-revised.md`
§L3 fold-in) is a non-LLM human cold-read of the dense Phase 1 close reform
plan. That is a **structurally different mode of evidence** from the
adversarial-LLM-review passes that produced the plan's fold-ins; its
purpose is to catch the failure mode where dense planning prose becomes
legible only to the LLMs that produced it. The criterion's letter is
already satisfied (file exists, two LLM stand-in sections each carrying
`opened_scope` / `skipped_scope` / "I could not understand X"). Its
spirit — a canonical non-LLM human cold-read — is not.

On 2026-04-20 the operator self-assessed that the canonical non-LLM
cold-read is unattainable on this project: plan-doc density exceeds the
comprehension load a product-designer / self-taught engineer operator
can honestly absorb. A forced section would advertise fake comprehension
as the required forcing function — strictly worse evidence than honestly
recording the gap.

This ADR records an explicit **one-time waiver** of the canonical
non-LLM cold-read at Phase 1.5 close, and retargets CC#14 to a pair of
checks that are obtainable and traceable:

- (14a) a **product-level operator check** — operator-authored,
  durable, narrowly worded, captured in a dedicated artifact;
- (14b) the existing Claude + Codex LLM stand-in sections counted as
  **delegated technical comprehension**, with the F17 weaker-evidence
  flag carried explicitly on every authority surface.

Both 14a and 14b are weaker, in combination, than the canonical
non-LLM cold-read they replace. This ADR does not claim otherwise.
The compensation for the structural loss is (1) that CC#13 (non-LLM
evidence artifact) is already closed by a separate, genuinely
non-LLM mechanical probe (the property fuzzer landed at Slice 29),
providing a structurally-different evidence mode at Phase 1.5 close
even with CC#14 retargeted, and (2) that this ADR is a narrow,
guardrailed waiver rather than a standing relaxation.

## Decision

### 1. One-time waiver (recorded, not minimized)

The canonical non-LLM human cold-read that Phase 1.5 Close Criterion
#14 was originally designed to require is **not satisfied** at Phase
1.5 close. This ADR records an explicit one-time waiver of that
structural check, conditional on 14a + 14b below. **ADR-0006 does
not claim the original forcing function is preserved.** It is
substituted by weaker evidence of different shape, and the
substitution is acknowledged as weaker.

### 2. CC#14 retarget — 14a + 14b

**CC#14 (amended).** Both of the following hold:

- **14a. Operator product-direction check (durable artifact).** A
  signed note exists at
  `specs/reviews/phase-1.5-operator-product-check.md` with:

  ```yaml
  ---
  name: phase-1.5-operator-product-check
  description: Operator product-direction confirmation closing Phase 1.5 Close Criterion #14a.
  type: review
  review_kind: operator-product-direction-check
  target_kind: phase-close
  review_target: phase-1.5-alpha-proof
  review_date: <ISO date>
  operator: <operator name>
  scope: product-direction-only
  confirmation: <verbatim operator statement — see §14a canonical wording>
  not_claimed: [list of things explicitly NOT claimed by this check]
  authored_by: <operator name>
  adr_authority: ADR-0006
  ---
  ```

  Canonical 14a wording (may be restated in operator's own words
  provided the structure is preserved): *"The Phase 1.5 Alpha Proof
  is directionally compatible with the product goal of a substantially
  simplified Circuit that can pursue full feature parity — potentially
  more effective via the new architecture. This is a direction-of-travel
  check, not evidence that parity exists, that real agent dispatch
  works, that workflow parity is achieved, that methodology is
  validated, or that the original non-LLM cold-read of CC#14 was
  satisfied."*

- **14b. Delegated LLM stand-in technical comprehension (weaker
  substitute).** The existing Claude + Codex LLM stand-in sections in
  `specs/reviews/phase-1-close-reform-human.md` (Reviewer 1 and
  Reviewer 2, both ACCEPT-WITH-FOLD-INS, 17 fold-ins F1–F17 applied)
  constitute the delegated technical comprehension required to
  discharge CC#14's surviving literal field requirements (`opened_scope`,
  `skipped_scope`, "I could not understand X"). The review file
  carries a §Delegation acknowledgment section openly stating that
  this is strictly weaker than a canonical non-LLM zero-context human
  drill (F17 flag). **14b is not equivalent to human review.** No
  authority surface may describe 14b that way.

### 3. CC#15 narrow-path preservation (explicit)

ADR-0001 Addendum B CC#15 requires that no Phase 1.5 close criterion
depends solely on Claude + Codex agreement. Under this retarget:

- **CC#14's technical-comprehension component (14b) does depend
  solely on LLM stand-in evidence.**
- **CC#15 as a whole remains satisfied** only by two separable
  structural facts: (i) CC#14 in its retargeted form requires 14a,
  which is an operator human signal of a different shape; and
  (ii) CC#13 is closed at Phase 1.5 by a separate, genuinely non-LLM
  mechanical probe (the property fuzzer landed at Slice 29 under
  `tests/properties/visible/`), providing a structurally-different
  evidence mode at Phase 1.5 close.
- Future retargets of other close criteria must preserve CC#15 by
  this same two-part test: the close-criterion set as a whole must
  carry at least one non-LLM evidence source of a different
  structural type, and at least one operator signal of a different
  structural type, independent of the LLM-delegated criterion.

### 4. Reopen basis — explicit one-time exception (NOT condition 5)

This ADR does **not** claim ADR-0001 §Reopen condition 5 ("Operator
role change — team or single-agent tool"). That condition's plain
text describes a structural change in operator composition, not a
role-boundary clarification within a solo-operator + dual-LLM setup.
Retrofitting condition 5 to a capacity clarification would create a
precedent future amendments could abuse — any capability mismatch
could be recast as a "clarification" and used to reopen a gate.

**Reopen basis for ADR-0006 is an explicit one-time exception,
patterned after ADR-0001 Addendum B's guardrailed condition 7.** The
exception requires all four of the following to hold, each recorded
in this ADR:

- **(a) Named failure mode the existing criterion cannot absorb.** The
  canonical non-LLM cold-read of a plan this operator cannot honestly
  absorb would produce fake comprehension. CC#14 as originally drafted
  does not admit that failure mode. See §Rationale below.
- **(b) D1 impact analysis.** Retargeting CC#14 does not re-introduce
  the methodology-instead-of-product failure D1 was installed to
  prevent: the retarget does not claim new governance work substitutes
  for executable product evidence; Phase 1.5 Alpha Proof closure still
  requires `dogfood-run-0` evidence (CC#4, #5, #6, #7) and non-LLM
  mechanical evidence (CC#13), neither of which this ADR touches. The
  retarget is narrow to CC#14.
- **(c) Cross-model challenger pass.** Codex pass on this ADR lands at
  `specs/reviews/adr-0006-codex.md`. Opening verdict: REJECT PENDING
  FOLD-INS (5 HIGH / 5 MED / 1 LOW / 1 META). All HIGH + MED + LOW +
  META folded in before close. Closing verdict: recorded on fold-in
  completion.
- **(d) Written explanation why the existing criterion cannot be
  satisfied honestly.** The operator's honest comprehension of
  `specs/plans/phase-1-close-revised.md` (638 lines, dense methodology
  delta schedule) cannot be obtained without performative compliance.
  This is a capacity observation, not a criticism of the plan's
  authors; it is recorded in the durable governance clarification at
  §Appendix A below.

**This four-part basis is not a new standing reopen condition.** It
is a one-time exception for ADR-0006. Future methodology amendments
claiming the same basis must re-authenticate each of (a)–(d) freshly
and cannot cite ADR-0006 as precedent; see §Precedent firewall below.

### 5. Precedent firewall

Any future ADR proposing to retarget, waive, relax, or substitute a
Phase-close criterion (including but not limited to Phase 1.5, Phase
2 close, or any successor phase gate) **must** clear all of the
following to be accepted:

1. **Identify the original evidence mode being replaced** with its
   structural type (non-LLM human, mechanical probe, operator signal,
   cross-model challenger, etc.).
2. **Prove the original mode is unobtainable** — not merely
   inconvenient, not merely expensive, but structurally unavailable
   given the project's actual governance or constraints.
3. **Name compensating evidence of a different structural type** —
   not LLM-on-LLM delegation alone. If the only compensation is
   cross-model or LLM stand-in evidence, the retarget must be
   rejected.
4. **Carry weaker-evidence wording openly** on every authority
   surface the retargeted criterion touches (ADR body, close-criteria
   list, review file, PROJECT_STATE, README). "This is a weaker
   substitute" must be recorded in-line, not as an appendix pointer.
5. **Add expiry or reopen trigger** — a concrete condition under
   which the weaker substitute is revisited.
6. **Get a cross-model challenger pass with an objection list** per
   `specs/methodology/decision.md` cross-model challenger protocol;
   HIGH and MED objections must be folded in before close.
7. **Explicit non-precedent clause** stating that ADR-0006 is not
   being cited as precedent, and re-authenticating (1)–(6) on fresh
   grounds.

An amendment claiming ADR-0006 as precedent — citing its existence,
its retarget pattern, or its use of delegated LLM evidence as
permission for a similar move — is rejected on precedent-firewall
grounds alone.

## Rationale

Three independent lines of reasoning support the one-time waiver +
retarget.

1. **Honest recorded gap beats performative compliance.** A cold-read
   the reader cannot honestly absorb generates no signal. A faked
   "I understood this" section silently advertises fake comprehension
   as if it were the required forcing function; the review file then
   becomes worse than empty — it is actively misleading to downstream
   readers who take the operator's presence at face value. Recording
   the gap explicitly (this ADR + the review file's §Delegation
   acknowledgment + the 14a `not_claimed` field) preserves the audit
   trail where a forced section would corrupt it.

2. **The LLM stand-in passes did produce real defects.** F1–F17 in
   the review file are concrete fold-ins the stand-ins surfaced —
   ambiguous slice identity `25d / 26.5`, two-vs-one audit check,
   exemption-ledger file-path ambiguity, unbounded D1 expiry,
   `circuit.json` authored-by-which-slice confusion. These are real
   comprehension snags a canonical human would also have hit. The
   stand-in passes are lower-weight evidence but not zero-weight.

3. **The governance clarification is real but narrow.** This project's
   operator is a product designer and self-taught engineer; fluency
   on methodology-execution artifacts (lane discipline, authority
   graphs, ratchet ledgers, yield ledgers, challenger protocols)
   sits with the LLM pair (Claude + Codex) who draft and review
   those artifacts. **The operator remains the authority for
   accepting methodology changes and product-direction tradeoffs**;
   LLM pair *execution* of methodology does not mean LLM pair
   *ownership* of methodology governance. The governance clarification
   is recorded durably at §Appendix A below.

## What changes

### 1. ADR-0001 Addendum B §Phase 1.5 Close Criteria #14

Existing text at `specs/adrs/ADR-0001-methodology-adoption.md`
§Phase 1.5 Close Criteria #14:

> 14. `specs/reviews/phase-1-close-reform-human.md` exists with
>     `opened_scope`, `skipped_scope`, and at least one "I could not
>     understand X" field.

**Amended by ADR-0006 to:**

> 14. (Amended by ADR-0006 as a one-time waiver + retarget.) Both
>     (14a) operator product-direction check in durable artifact
>     `specs/reviews/phase-1.5-operator-product-check.md`, and (14b)
>     delegated LLM stand-in technical comprehension in
>     `specs/reviews/phase-1-close-reform-human.md` with F17 weaker-
>     evidence flag carried openly. The original non-LLM cold-read
>     forcing function is **not** satisfied; ADR-0006 records this
>     as a one-time waiver and substitutes weaker evidence of
>     different shape. CC#15 preservation and reopen basis: see
>     ADR-0006. The literal field requirements (`opened_scope`,
>     `skipped_scope`, "I could not understand X") remain in force
>     and are satisfied by the existing LLM stand-in sections.

The ceremony commit landing this ADR also edits ADR-0001 Addendum B
in place to carry the amendment inline (not as a pointer), per D4
authority-graph rule. ADR-0001 §Reopen conditions is **not** amended
by this ADR.

### 2. `specs/reviews/phase-1-close-reform-human.md`

- **Frontmatter update** (MED #7 fold-in). Change the `description`
  field and `operator_delegation_note` to final disposition: the
  original non-LLM cold-read was not completed; ADR-0006 accepts a
  weaker substitute; no operator cold-read section is expected for
  Phase 1.5 close.
- **Residual items update** (MED #7 fold-in). Rewrite the bullet
  "Operator delivers a genuine non-LLM L3 cold-read" to mark it as
  **resolved by waiver under ADR-0006**, not as pending follow-up.
- **§Delegation acknowledgment** (already appended in the same
  authoring session as this ADR) stands, with minor edits to match
  this ADR's final waiver-framing language (no "preserved" language;
  explicit "weaker substitute" wording).

### 3. `specs/reviews/phase-1.5-operator-product-check.md` (NEW, 14a artifact)

Authored by the operator as part of the ceremony commit landing this
ADR. Frontmatter shape per §Decision.2.14a above. Contents: the
canonical 14a wording (verbatim or in the operator's own words
preserving structure) + a `not_claimed` enumeration covering the
forbidden-wording list below.

### 4. Ceremony commit body — forbidden-wording list

The ceremony commit that flips Phase 1.5 → Phase 2 **must not** say
any of (MED #9 fold-in):

- "product proven" / "product broadly proven" / "Circuit proven"
- "Circuit parity achieved" / "workflow parity complete" / "full
  parity"
- "real agent dispatch works" (dry-run adapter only; real dispatch
  is Phase 2+)
- "methodology validated"
- "non-LLM cold-read satisfied" (it is not; see this ADR)
- "Phase 2 ready because governance is complete" (governance is a
  *precondition* for Phase 2 entry; it is not the product substance
  Phase 2 will build)

The ceremony commit body **must** say, positively:

> Phase 1.5 Alpha Proof close opens Phase 2. The alpha proof is a
> 2-step dry-run runner on a fixture (`dogfood-run-0`); it is enough
> executable proof to start Phase 2 implementation. Real agent
> dispatch, workflow parity, hardening, container isolation, hidden
> test pool, and the 15–25 slices to one-workflow parity remain
> Phase 2+ work.

### 5. Cross-model concurrence language — not independent corroboration (MED #6)

Wording in this ADR does not describe Claude + Codex concurrence on
the retarget decision as "independent." The Claude + Codex pair
shares training distribution (Knight & Leveson 1986); any concurrence
between them is **same-distribution advisory context only, not
justification for the retarget**. The justification for the retarget
rests on (a)–(d) of §4 Reopen basis above, not on the pair's
concurrence.

### 6. D6 / non-LLM citation corrections (MED #8)

`specs/methodology/decision.md` §D6 is scheduled, not authoritatively
installed; the authoritative surfaces for non-LLM evidence discipline
at Phase 1.5 close are (i) `decision.md` §D10 (adversarial review
discipline; non-LLM mode requirement for pass 3 on tournament-class
artifacts) and (ii) ADR-0001 Addendum B §Phase 1.5 Close Criteria
#13 (non-LLM evidence artifact). The review file's §Delegation
acknowledgment is updated in the same slice to cite (i) and (ii)
rather than §D6 scheduled-text.

### 7. Audit check for 14a + 14b presence (HIGH #4)

A new audit check is added to `scripts/audit.mjs` as part of the
ceremony slice scope: verifies that
`specs/reviews/phase-1.5-operator-product-check.md` exists with the
required frontmatter fields before any surface (PROJECT_STATE, README,
decision.md, ADR-0001 Addendum B) claims Phase 1.5 closed or Phase 2
open. Also verifies the review file's §Delegation acknowledgment
section is present and cites ADR-0006. This advances the audit-
coverage ratchet as a dimension separate from the phase-graph
authority ratchet — independent ratchet tracking per CLAUDE.md hard
invariant #8.

### 8. Yield ledger

A row is appended to `specs/reviews/adversarial-yield-ledger.md`
recording the Codex challenger pass on this ADR. Row class:
governance. Opening verdict: REJECT PENDING FOLD-INS. Closing
verdict: ACCEPT-WITH-FOLD-INS (all HIGH + MED + LOW + META folded
in, this ADR is the fold-in receipt). Rigor: concrete per saved
memory constraint (not grandfather sentinel; grandfather rows are
capped at Phase 2 close).

### 9. Phase 2 follow-up (META #13)

A Phase 2 follow-up is registered: create an operator-readable
"plain-language governance brief" template for major methodology
moves going forward. Shape: size-capped (≤ 300 lines, matching
CLAUDE.md's own cap), with explicit sections for
*what changed / what is not claimed / what the operator must decide*.
Goal: the operator's cold-read is obtainable on the brief, even if
not on the underlying dense plan. This follow-up does not retroactively
apply to Phase 1.5 close; it is a standing Phase 2+ practice. The
follow-up is tracked in `PROJECT_STATE.md` under the Phase 2 open
items list that the ceremony commit authors.

## Consequences

### Accepted (with weakening explicitly recorded)

- **Structural loss on CC#14.** The canonical non-LLM human cold-read
  is replaced by weaker evidence. The F17 flag, the review file's
  §Delegation acknowledgment, and the `not_claimed` enumeration in
  the 14a artifact are all that prevent future readers from treating
  the substitute as equivalent to the original. The evidence weight
  is lower; the audit trail carries the weight explicitly.
- **CC#13 is load-bearing for CC#15 preservation.** If CC#13's
  non-LLM mechanical probe (the property fuzzer at Slice 29) were
  removed or stopped running, CC#15 preservation under this
  retarget would break. Slice 29's evidence artifact is now a
  cross-criterion dependency; see §Reopen conditions below.
- **14a weight depends on operator honesty.** A signed
  product-direction note is a single-source operator signal; it is
  strictly weaker than a signal produced under structurally
  different conditions. The `not_claimed` field is the main
  protection against 14a being read as stronger than it is.
- **Phase 2 opens with known debt.** Rough one-workflow-parity
  estimate (conversation-level, not spec): ~25–30% of the way to one
  Build workflow from the old Circuit at `~/Code/circuit`. Runtime
  engine + schemas exist; six step protocols, real agent adapter,
  router, entry-mode behavior, session hooks, and six artifact
  schemas remain unbuilt. Phase 2 plan authorship will refine.

### Enabling

- CC#14 closure is obtainable via 14a + 14b + the ADR-0006 waiver.
  The ceremony commit can land.
- The new audit check provides machine enforcement for 14a + 14b
  artifact presence.
- The precedent firewall at §5 prevents ADR-0006 from being used as
  permission for future retargets without re-authentication.
- The §Appendix A governance clarification is a durable repo artifact
  (not ephemeral saved memory) and is discoverable by future readers.

### Deferred / Not changed

- D1, D3, D4, D9, D10 methodology-delta installations: unchanged.
- D2, D5, D6, D7, D8 triggers: unchanged (D6 specifically remains
  scheduled, non-authoritatively installed).
- Phase 1.5 Close Criteria #1–#13, #15, #16: unchanged.
- Authority clause (ADR-0001 canonical for phase-graph semantics):
  unchanged.
- Addendum A (methodology-artifact portability, Slice 25a): unchanged.
- Addendum B other contents: unchanged except for CC#14 text
  amendment per §What changes 1 above.
- ADR-0001 §Reopen conditions 1–7: unchanged. This ADR's reopen
  basis is an explicit one-time exception per §4, not a new
  standing condition.
- `specs/plans/phase-1-close-revised.md` §L3 fold-in residual: the
  plan is historical; the residual item in the plan stays as
  historical record of the original intent. Plans are not
  retroactively rewritten; §Delegation acknowledgment in the review
  file carries the waiver forward.

## Reopen conditions (for ADR-0006 specifically)

This ADR is reopened if any of:

1. **CC#13 evidence is removed or fails.** The Slice 29 property
   fuzzer under `tests/properties/visible/` is load-bearing for
   CC#15 preservation under this retarget. If the fuzzer is deleted,
   disabled, or determined post-hoc to not constitute genuine
   non-LLM evidence, CC#14's retarget loses its CC#15 compensation
   and this ADR must be re-authored.
2. **Operator fluency changes.** A later project phase restores
   methodology-execution fluency to the operator role, or brings in
   a co-operator / team with that fluency. The canonical non-LLM
   cold-read becomes obtainable; retarget CC#14 back (or install an
   equivalent check in a later phase's close).
3. **LLM stand-in pattern shown to miss structural defects.**
   Evidence emerges that the F1–F17 fold-ins missed a structurally-
   important defect a canonical human cold-read would have caught.
   Classify per D10 correlated-miss protocol and retarget or re-run
   the check.
4. **Governance clarification revised.** The §Appendix A governance
   clarification is reversed, revised, or retired. Revisit CC#14
   retarget in light of the new role definition.
5. **Future phase-graph amendment mirrors this pattern without
   re-authentication.** If a future ADR proposes a similar retarget
   without freshly clearing the precedent firewall at §5,
   re-litigate the firewall language here to strengthen it.

## Provenance

This ADR was drafted by Claude (opus-4-7) after a 2026-04-20
conversation with the operator in which the operator self-assessed
as unable to perform the canonical CC#14 cold-read and requested
guidance. Claude and Codex were both consulted during the
conversation; both advised delegation over performative compliance.

**Claude/Codex concurrence on the retarget direction is recorded as
same-distribution advisory context only, not as justification for
the retarget.** Claude and Codex share training distribution (Knight
& Leveson 1986); concurrence between them is not epistemically
independent and cannot be laundered as independent verification. The
retarget's justification rests on §4 Reopen basis (a)–(d) and the
Codex adversarial challenger pass + fold-ins, not on the advisory
concurrence.

Cross-model challenger dispatch: required per CLAUDE.md hard
invariant #6 and `specs/methodology/decision.md` cross-model
challenger protocol (gate loosening). Dispatched via `/codex` skill.
Codex's objection list at `specs/reviews/adr-0006-codex.md`.
Opening verdict: REJECT PENDING FOLD-INS (5 HIGH / 5 MED / 1 LOW / 1
META). Disposition: all HIGH + MED + LOW + META folded in via this
ADR's revision (same authoring session, incorporating Codex's entire
remediation list). Closing verdict on the fold-in receipt: ACCEPT-
WITH-FOLD-INS (Codex's opening remediations addressed; any new
objections on the folded version require a fresh pass).

## References

- `specs/adrs/ADR-0001-methodology-adoption.md` §Addendum B §Phase
  1.5 Close Criteria #14 (the criterion this ADR amends)
- `specs/reviews/phase-1-close-reform-human.md` (the review file
  whose LLM stand-in sections constitute 14b)
- `specs/reviews/phase-1.5-operator-product-check.md` (the 14a
  artifact, authored in the ceremony commit)
- `specs/reviews/adr-0006-codex.md` (Codex challenger pass)
- `specs/reviews/adversarial-yield-ledger.md` (Codex pass row)
- `specs/methodology/decision.md` §D10 (adversarial review
  discipline, non-LLM-mode requirement for pass 3) and cross-model
  challenger protocol
- ADR-0001 Addendum B CC#13 (non-LLM evidence artifact — Slice 29
  property fuzzer) and CC#15 (no close criterion solely on Claude +
  Codex agreement)
- `specs/plans/phase-1-close-revised.md` §L3 fold-in (historical
  origin of CC#14)
- `tests/properties/visible/` — Slice 29 property fuzzer, the
  non-LLM evidence artifact load-bearing for CC#15 under this
  retarget

## Lane and ratchet declaration (for the ceremony slice that lands this ADR)

Lane: **Ratchet-Advance**. Ratchets advanced (independently tracked
per hard invariant #8):

- **Phase-graph authority ratchet** — Phase 1.5 → Phase 2 transition,
  first authoritative Phase 1.5 close. Enforced by existing Check 9
  (`checkPhaseDrift`) and Check 20 (`checkPhaseAuthoritySemantics`).
- **Audit-coverage ratchet** — new audit check added for 14a + 14b
  artifact presence (see §What changes 7).

---

## Appendix A — Operator role clarification (durable record, 2026-04-20)

This appendix is the authoritative durable record of the operator /
LLM-pair role clarification that motivates this ADR. It replaces
citations to the ephemeral auto-memory
`project_circuit_next_governance.md` in earlier ADR drafts; the
memory file may continue to exist as a private operational cache,
but is **not** load-bearing for any governance claim. This appendix
is.

### Role clarification

On 2026-04-20 the operator made the following governance
clarification explicit:

- **Operator owns product direction.** Product-level judgments —
  what Circuit should do for users, whether a given architectural
  direction serves the product goal, whether a simplification
  preserves feature parity, whether a rigor level matches the
  situation — are operator decisions. The operator retains
  authority for accepting methodology changes and product-direction
  tradeoffs.
- **Claude and Codex assist with methodology execution.** The LLM
  pair drafts and reviews methodology artifacts (ADRs, contracts,
  plans, lane declarations, ratchet changes, audit checks); runs
  cross-model challenger passes; surfaces objections; implements
  slices under lane discipline. The LLM pair does not own
  methodology governance — it executes methodology work at
  operator direction and under operator acceptance.
- **Operator-grade signals on methodology artifacts.** The operator
  is a product designer and self-taught software engineer with
  UI/frontend strength and weaker backend/architecture /
  methodology-execution depth. Expecting the operator to cold-read
  dense methodology plan prose at the same grade the LLM pair can
  produces performative compliance, not genuine review. Where an
  obtainable operator signal is needed, it should be framed at
  product-direction grade — direction-of-travel, goal compatibility,
  simplification-and-parity judgment — not at methodology-execution
  grade.

### What this clarification is not

- **Not a handover of governance authority.** The operator does not
  delegate methodology governance to the LLM pair. The pair
  executes; the operator accepts or rejects.
- **Not a standing waiver of human-in-the-loop checks on
  methodology.** Future checks that produce obtainable operator
  signals (product direction, simplification judgment, rigor
  calibration, priority setting) remain in force. Only CC#14 in its
  original form, whose check was structurally unobtainable from this
  operator's role, is waived — and only by the one-time exception
  basis at §4 above.
- **Not a claim that the LLM pair is independent or correlated-
  failure-free.** Claude and Codex share training distribution.
  Operator acceptance of LLM-executed methodology work does not
  confer independence on that work.
- **Not operator-in-the-loop erasure.** The 14a product-direction
  check is the concrete preserved operator-in-the-loop signal at
  Phase 1.5 close under this retarget.

### Why durable here, not in auto-memory

Auto-memory files are a private operational cache for a specific
Claude Code session lineage. They are not part of the repo, may be
rotated or cleared, are not present on a fresh clone, and are not
discoverable by Codex or by a human reader who is not the operator.
A governance clarification load-bearing for an ADR must live in the
repo. This appendix is the durable record; the auto-memory file is
a convenience cache only.

Provenance: authored by Claude + operator on 2026-04-20, incorporating
Codex HIGH #3 fold-in (saved-memory citation was not durable /
discoverable; move into durable repo artifact).
