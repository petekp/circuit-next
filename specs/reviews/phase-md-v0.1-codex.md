---
contract_target: phase
contract_version: 0.1
reviewer_model: gpt-5 via codex exec
review_kind: adversarial property-auditor
review_date: 2026-04-18
verdict: NEEDS ADJUSTMENT → incorporated → ACCEPT (after fold-in)
authored_by: operator + claude-opus-4-7
---

# phase.md v0.1 — Codex Adversarial Property-Auditor Review

This record captures the cross-model challenger pass on
`specs/contracts/phase.md` v0.1 + `src/schemas/phase.ts` + `src/schemas/workflow.ts`
+ the Phase/spine_policy contract tests. The reviewer's task was an
**objection list**, not approval; incorporation decisions were made by the
operator per the narrow-cross-model-challenger protocol (Knight-Leveson
Swiss-cheese, not independent corroboration).

## Objection list (as returned by Codex)

**1. HIGH — Canonical presence is only a label receipt, not a methodology
guarantee.** Attack: a strict workflow declares all seven canonical phases,
but every phase points at the same harmless `frame` synthesis step. The
spine_policy superRefine only builds a set of `Phase.canonical` labels, so
"review exists" means "some phase is named review," not "a review gate can
run."

**2. HIGH — "Silent skip is rejected" is false for execution skips.**
Attack: include a `review` phase + `review` step to satisfy spine_policy,
but route `frame` directly to `@complete`. Reachability is not enforced.

**3. HIGH — Operational steps can bypass the Phase contract entirely.**
Attack: 7 tiny canonical placeholder phases; real work routes through steps
not listed in any phase. Workflow validates that phase-step references
resolve but does not require every Step to belong to a Phase.

**4. MED — Multi-instance canonical phases create ambiguity.** Attack: two
phases both declaring `canonical: 'review'`. Set-based enforcement collapses
both to one bit.

**5. MED — Partial-mode rationale is a Goodhart slot.** Attack:
`rationale: 'aaaaaaaaaaaaaaaaaaaa'` satisfies `min(20)`. The 20-char bar is
a structural minimum, not a real-rationale check.

**6. MED — `omits` behaves like "not required," not "omitted."** Two
sub-attacks: (a) `omits: ['review']` while a `canonical: 'review'` phase is
also declared — self-contradictory bookkeeping, silently accepted;
(b) duplicates like `['review', 'review']` pass.

**7. MED — Phase-level selection missing despite `phase` being a selection
layer.** `domain.md` says selection precedence includes `phase`, and
`SelectionSource` includes `'phase'`, but `Phase` has no `selection` field.

**8. LOW — WorkflowBody not `.strict()`.** Top-level surplus keys on
Workflow get silently stripped.

**9. LOW — Closure status inconsistent across ledger.** `phase.md` and
`workflow.md` mark MED #11 closed, but `specs/evidence.md` still says
deferred.

**Verdict: NEEDS ADJUSTMENT.**

## Operator response (incorporated vs deferred)

### Incorporated

- **HIGHs #1/#2/#3** — Weakened PHASE-I4 prose to stop over-claiming
  closure. Added explicit "Scope caveat" admitting the invariant is a
  label-level check, not a semantic or reachability guarantee. Created a
  "Reserved for Phase 2" property-id block listing `review_semantic_adequacy`,
  `verify_semantic_adequacy`, `canonical_phase_reachability`,
  `every_step_has_a_phase` with explicit mapping back to HIGH #1/2/3.
  Rationale: these invariants require the property-test harness + event-log
  seams (Phase 2 scope per methodology's staged-adoption plan); writing
  stubs now without the harness would be prose-only, exactly the
  prose-tautology attack Codex warned about.
- **MED #4** — Added **PHASE-I5** (canonical uniqueness). Schema: Workflow
  `superRefine` rejects two phases sharing a defined canonical. Phases with
  `canonical: undefined` remain unrestricted in count. Test coverage: two
  new test cases (reject duplicate-review-canonical; accept multiple
  undefined-canonical phases).
- **MED #6 (both sub-attacks)** — Schema: Workflow `superRefine` enforces
  (a) disjointness between `spine_policy.omits` and declared canonicals,
  (b) pairwise uniqueness within `omits`. Contract: property_ids
  `omits_disjoint_from_declared` and `omits_pairwise_unique` added. Test
  coverage: two new test cases.
- **LOW #8** — Added **PHASE-I6** (Workflow-level `.strict()`). Schema:
  `WorkflowBody` now `.strict()`, `Workflow.entry` subtree also `.strict()`.
  Test coverage: one new test case (reject top-level surplus `audit_notes`).
- **LOW #9** — Updated `specs/evidence.md` to mark MED #11 closed with
  pointer into `specs/contracts/phase.md` PHASE-I4. Also retroactively
  updated MED #7 closure (was mislabeled "Deferred" after step.md v0.1
  landed; now correctly "Closed" with pointer into step.md STEP-I3/I4).

### Deferred (documented)

- **MED #5 (Goodhart rationale)** — Current 20-char minimum is a
  structural *minimum*, not a Goodhart-proof discipline gate. Contract
  prose now says so explicitly. Phase 1 v0.2 may upgrade `rationale` to
  a structured record (`accepted_risk_ref` into `specs/risks.md`,
  `substitute_phase_id?`) if evidence from real workflows justifies the
  cost. Audit layer (`npm run audit`) + reviewer-human pairing catches
  gaming out-of-band. **Not closed in v0.1; tracked in phase.md Evolution
  v0.2.**
- **MED #7 (phase selection layer)** — `Phase.selection` belongs in
  `selection.md` ratification (not yet authored), where the full
  selection-layer design is ratified. Adding a standalone `Phase.selection`
  field in v0.1 risks prose-tautology contamination — we'd be authoring
  per-phase override semantics without the surrounding selection
  contract. Cross-reference added to phase.md "Cross-contract
  dependencies" section with an explicit suspicion-of-`'phase'`-source
  note. **Not closed in v0.1; closure depends on selection.md.**

## Invariants added in this fold-in

- PHASE-I5: canonical uniqueness (MED #4)
- PHASE-I6: Workflow-level strict (LOW #8)
- Schema-level uniqueness + disjointness on `spine_policy.omits` (MED #6)

## Test count delta

Before Codex pass: 61 tests (47 + 14 phase/spine).
After fold-in: 66 tests (+5 for MED #4, MED #6.a, MED #6.b, LOW #8 coverage
+ one positive case for PHASE-I5 with undefined canonicals).

## Methodology note

This review is one Swiss-cheese layer, not statistical independence with
the authoring model (Knight & Leveson 1986). A future Phase 1 v0.2 pass
should run a third-model challenger (e.g., Gemini or another Claude
generation) if the closure gates warrant it, specifically on the "Reserved
for Phase 2" property-ids where semantic adequacy cannot yet be asserted.
