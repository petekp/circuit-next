---
review_target: adr-0001-methodology-adoption-addendum-b
target_kind: adr
reviewer_model: gpt-5-codex via codex exec
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: adversarial design review
review_date: 2026-04-20
verdict: REJECT PENDING FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS
opening_verdict: REJECT PENDING FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
authored_by: operator + claude-opus-4-7
---

# Codex Challenger Pass — Slice 25d ADR-0001 Addendum B

Initial pass triggered before commit per CHALLENGER-I5 ADR-authorship
discipline. Pass counter resets per D10 Mode-cycle rule because this is a
new governance artifact (Addendum B of ADR-0001). Pass 1 of 3 governance-class
cap.

## Verdict

- **Opening:** REJECT PENDING FOLD-INS
- **Closing (after fold-ins):** ACCEPT-WITH-FOLD-INS
- HIGH count: 5 (all folded in)
- MED count: 7 (all folded in)
- LOW count: 4 (all folded in)
- META count: 1 (search-scope note)

## HIGH findings and fold-ins

### HIGH 1 — Phase 1 closes on governance prose, violating D1
**Finding.** The draft said "Phase 1.5 enters on the commit that lands this
addendum," which would close Phase 1 on a governance-only move. D1 (Slice
25b) forbids phase close solely on authored governance artifacts absent a
D1 design-only proof with named next executable proof + expiry.
**Disposition:** FOLDED IN. Rewritten: the addendum **authorizes** Phase 1.5
semantics but **does not itself close Phase 1 or open Phase 1.5**. Phase 1
close is a separate future event (lands at the slice that completes
remaining contract authorship); Phase 1.5 opens on that commit. This
avoids the D1 violation entirely — no phase transition happens at 25d.

### HIGH 2 — Phase 1 close conditions internally contradictory
**Finding.** The draft simultaneously required "remaining Phase 1 contracts
authored" before Phase 1.5 opens AND automatic entry at the 25d commit,
with Slice 27 (Workflow v0.2) scheduled after 25d as a remaining contract.
**Disposition:** FOLDED IN together with HIGH 1. Addendum now inventories
Phase 1 close precisely: (a) D1/D3/D4/D9/D10 governance installed (D1/D4/D9/D10
in Slice 25b; D3 via this addendum); (b) contract authorship completed,
specifically including the Slice 27 narrowed workflow contract; (c) both
conditions together are Phase 1 close. Slice 27 is explicitly named as the
last Phase 1 contract slice; Phase 1.5 opens on that slice's commit, not
on this one.

### HIGH 3 — Phase 1.5 close criteria delegated to plan (D4 violation)
**Finding.** Draft delegated Phase 1.5 close criteria to the plan. D4 forbids
standing rules living only in plans.
**Disposition:** FOLDED IN. Authoritative Phase 1.5 close criteria now live
inline in this addendum as §Phase 1.5 Close Criteria. The plan's close
criteria section is downgraded to a mirror of the ADR with an explicit
"authoritative source is ADR-0001 Addendum B" caveat added in a later
commit or this slice.

### HIGH 4 — `phase_id` rewrite breaks existing audit + tests
**Finding.** `scripts/audit.mjs:747-750` hard-requires the pre-rewrite
`phase-1-pre-1.5-reopen` value; `tests/contracts/governance-reform.test.ts:381-384`
asserts the same. Rewriting the ledger row without updating these makes
audit/tests red.
**Disposition:** FOLDED IN. This slice also updates
`checkProductRealityGateVisibility` and its tests to accept
`phase-1.5-alpha-proof` as the canonical Slice 25b seed row `phase_id`,
coordinated with the ledger edit.

### HIGH 5 — Phase 1.5 smuggles implementation without Phase 2 safeguards
**Finding.** Phase 1.5 now hosts append-only writer, reducer snapshot,
manifest byte-match, and result output — runtime implementation. Draft did
not say which Phase 2 safeguards apply in Phase 1.5.
**Disposition:** FOLDED IN. Added execution-control clause: Phase 1.5 runs
under normal lane discipline (six lanes), current Tier enforcement
(scaffold + strict TS + contract tests + audit), `npm run verify` and
`npm run audit` gates, and contract/governance edits must land in their
own slices (not mixed with runtime substrate work). Container isolation
remains Tier 2+ deferred as in Phase 2.

## MED findings and fold-ins

### MED 1 — Addendum letter wrong
**Finding.** Draft labelled the new section "Addendum C" but ADR-0001 has
only one prior addendum (2026-04-19 Slice 25a, unlettered). Correct label
is B.
**Disposition:** FOLDED IN. New section labelled **Addendum B**; prior
2026-04-19 Slice 25a addendum retroactively labelled **Addendum A**.
Internal cross-references updated.

### MED 2 — Reopen condition 7 too broad
**Finding.** "Phase-graph amendment by operator directive" would let any
future plan reflection claim a structural gap.
**Disposition:** FOLDED IN. Condition 7 narrowed: one-time reopen basis
scoped to this Slice 25d amendment; future phase-graph amendments must
satisfy concrete guardrails — named failure mode, D1 impact analysis,
D10 governance review pass, explicit statement why existing phases cannot
absorb the change.

### MED 3 — Authority clause overcorrects against decision.md generally
**Finding.** Draft clause "phase semantics live in ADR-0001; decision.md
mirrors, does not author" overreached; D4 permits standing rules to be
authored in decision.md.
**Disposition:** FOLDED IN. Clause narrowed to phase-graph semantics only:
other standing methodology rules continue to be authorable in decision.md
when D4 permits.

### MED 4 — Review-time-only mirror enforcement too weak
**Finding.** The exact failure mode D3 was installed to prevent (silent
phase mutation via decision.md alone) remains alive if decision.md
Phase 1.5 prose drifts without ADR update.
**Disposition:** FOLDED IN. New audit check (Check 20) added:
`checkPhaseAuthoritySemantics` — if decision.md mentions "Phase 1.5", it
must cite ADR-0001 Addendum B; if README or PROJECT_STATE claim Phase 1.5
but ADR-0001 lacks Addendum B heading, red.

### MED 5 — Cross-artifact stale refs larger than named
**Finding.** CLAUDE.md `§Phase discipline` describes Phase 0/1/2 only;
plan caveat at phase-1-close-revised.md §Phase 1.5 close criteria heading
becomes false after this addendum lands.
**Disposition:** FOLDED IN. CLAUDE.md updated with a Phase 1.5 bullet; plan
caveat rewritten to identify the section as a mirror of ADR-0001
Addendum B §Phase 1.5 Close Criteria.

### MED 6 — Ratchet-Advance lane under-justified
**Finding.** Slice declared Ratchet-Advance but no ratchet named.
**Disposition:** FOLDED IN. Ratchet named explicitly in addendum and commit
body: **phase-graph authority ratchet** — Phase 1.5 cannot be claimed
unless ADR-0001 Addendum B, decision.md mirror, and README/PROJECT_STATE
phase line all agree. Machine-enforced by the new Check 20 plus existing
Check 9 (checkPhaseDrift).

### MED 7 — Backwards citations to Phase 1 and Phase 2 ambiguous
**Finding.** Pre-addendum references to "Phase 1 close" and "Phase 2 entry"
will read ambiguously after the addendum lands.
**Disposition:** FOLDED IN. Compatibility note added: pre-addendum
"Phase 1 close" → "Phase 1 contract-authorship close"; "Phase 2 entry"
→ requires Phase 1.5 close.

## LOW findings

- **LOW 1 — Historical "Addendum A" references malformed.** Folded in via
  retroactive relabeling (MED 1).
- **LOW 2 — Review filename wrong after rename.** Folded in: this file is
  named `adr-0001-addendum-b-codex.md`.
- **LOW 3 — README layout still says methodology artifacts are symlinks.**
  Folded in: README layout prose updated.
- **LOW 4 — README "Six Phase 1 contracts" prose stale.** Folded in: prose
  rewritten to avoid count drift.

## META

Search scope noted — Codex read ADR-0001, decision.md, revised plan,
product-gate-exemptions, README / PROJECT_STATE / TIER / CLAUDE, audit
code, and related tests; grepped for phase identifiers and addendum
labels; did not run the test suite (static governance review).
Acknowledged; fold-ins include concrete tests where machine enforcement
is added.
