---
adr: 0011
title: CLAUDE.md Cap 300 → 450 + ADR Decision/Appendix Split Convention
status: Accepted (post-methodology-trim-arc Slice 64 Codex challenger pass)
date: 2026-04-23
author: claude-opus-4-7 (methodology-trim-arc, Slice 64) + gpt-5-codex (challenger — slice-level whole-slice pass)
supersedes: none
related:
  - CLAUDE.md §Hard-invariant #10 (the cap amended here)
  - specs/reviews/arc-slice-61-codex.md (forcing evidence: HIGH-1 + HIGH-2 semantic loss under 300-line cap)
  - specs/behavioral/session-hygiene.md §SESSION-I1 (behavioral-contract coverage of the CLAUDE.md line budget)
  - tests/contracts/session-hygiene.test.ts (runtime cap enforcement)
  - specs/plans/methodology-trim-arc.md §2.5 + §2.3 (this ADR is the contract-relaxation authority for the arc)
amends:
  - CLAUDE.md §Hard-invariant #10 (cap 300 → 450)
  - CLAUDE.md §Session-hygiene prose at line 99 (cap wording)
  - CLAUDE.md header §Keep-under line at line 3 (cap wording)
  - specs/behavioral/session-hygiene.md §Failure-modes and §Planned-test entries (cap wording)
  - tests/contracts/session-hygiene.test.ts SESSION-I1 tests (runtime threshold + self-naming regex)
---

# ADR-0011 — CLAUDE.md Cap 300 → 450 + ADR Decision/Appendix Split Convention

## Decision

1. **Raise the CLAUDE.md hard-invariant line cap from 300 to 450.**
   The new cap applies at the moment this ADR lands. Hard Invariant #10
   in CLAUDE.md is amended in the same slice; the contract test
   `tests/contracts/session-hygiene.test.ts` SESSION-I1 threshold is
   bumped to 450; the self-naming regex accepts either literal.
   Existing prose that cites "300" as a factual historical number
   (e.g., `specs/methodology/analysis.md` citing Anthropic's
   recommendation) is preserved verbatim — the fact is that Anthropic
   recommended <300; the decision here is that `circuit-next` runs a
   looser local ceiling than that recommendation, and the ADR carries
   the justification.

2. **Adopt a Decision/Appendix split convention for ADRs ≥ 0011.**
   Every ADR from this one forward uses `## Decision` capped at ≤80
   lines (the operator-facing surface that must fit in head in one
   read) and an unlimited `## Appendix` for derivation, evidence,
   alternatives considered, and long-form context. ADRs 0001–0010 are
   grandfathered; reshaping them is explicitly out of scope.
   Enforcement is review-level (no audit check); this ADR is the
   first worked example of the convention.

3. **Contract-relaxation declaration.** Per CLAUDE.md Hard Invariant
   #6, raising a ratchet floor or relaxing a contract requires a
   cross-model Codex challenger pass. This ADR is a cap *raise* — a
   relaxation of a line-count ceiling. The Slice 64 whole-slice Codex
   challenger pass (artifact under `specs/reviews/`) is the required
   challenger covering this ADR.

## Rationale

Evidence for the cap raise comes from `specs/reviews/arc-slice-61-codex.md`:

- **HIGH-1**: CLAUDE.md, under the 300-line cap, compressed ADR-0010's
  onboarding summary in a way that dropped the `successor-to-live`
  applicability trigger — a load-bearing semantic that exists in
  ADR-0010 §7 but not in the agent-facing methodology surface after
  the Slice 61 compaction. Fix required re-expanding the sentence.
- **HIGH-2**: The adjacent memory-checklist paragraph, also compressed
  under cap pressure, taught a weaker rule than ADR-0010's
  challenger-cleared state ("HIGH fold-ins only" where the authoritative
  rule is "all reviewer-designated fold-ins"). Fix required re-expanding.

Both are direct evidence that the cap — not the content — was the
forcing constraint. The methodology surface is now dense enough that
compressing further deletes load-bearing semantics. Raising the cap
to 450 preserves 50% headroom (current state: 279 lines) without
retargeting the discipline: it stays a single in-head surface, just
with room for the full expression of the rules it governs.

The ADR Decision/Appendix split is a complementary measure: it keeps
the *operator-facing* surface small (the thing the operator reads to
audit a decision) while allowing derivation and evidence to live in
the same file under a clear boundary. A reader who wants the decision
reads Decision; a reader who wants the receipts reads Appendix.

## Consequences

- Hard Invariant #10 in CLAUDE.md now reads "450" where it read "300".
- Contract test threshold updated; regex accepts either 300 or 450 as
  the self-named invariant during the transition (defensive; can be
  tightened post-arc once all authority surfaces settle on 450).
- Specs prose that cites the old 300 as a historical fact stays; prose
  that cites it as the current rule is updated.
- Future ADRs (≥ 0011) use ## Decision ≤80 / ## Appendix convention.
- No authority-graph change; ADR-0001 and ADR-0003 are untouched.

## Appendix

### Decision-surface line audit for this ADR

The Decision section above is 42 lines including headings and blank
lines. Under the ≤80 convention this passes with 38 lines of margin,
which is the right kind of headroom for a cap change: the rule should
be expressible in well under half the budget.

### Why 450, not 400 or 500

450 is 50% over the current 300. 400 would give only 33% headroom;
500 would extend into territory where prompt-cache cost-benefit starts
to degrade (the Anthropic recommendation basis cited in
`specs/methodology/analysis.md:54`). 450 is the smallest number that
absorbs the observed Slice 61 semantic loss plus a modest safety
margin, without straying far from the recommended ceiling.

### Why review-only enforcement of the §Decision ≤80 rule

The rule is a writing-style heuristic, not a semantic invariant. A
mechanical line-count check would catch the wrong thing (e.g., a
well-formatted decision with necessary tables) and miss the right
thing (a short decision that elides the decision itself and hides the
real rule in the appendix). Review is the right level.

### Forcing-function linkage

The methodology-trim-arc (SLICE 64 opening commit) carries the
forcing function "P2.9 restart -a rate < 15% after arc lands".
ADR-0011 is the arc's first contract-relaxation and the only one
requiring a Codex challenger pass (Hard Invariant #6). The remaining
arc slices (65–68) are rule cuts, lifecycle set-splits, live-state
helpers, and arc-close; none require a Hard-Invariant #6 challenger.

### Sibling amendments in the same slice

This ADR lands coupled with:

- `CLAUDE.md` text at lines 3, 99, 242 updated to cite 450 + ADR-0011.
- `tests/contracts/session-hygiene.test.ts:47-62` updated to
  `toBeLessThanOrEqual(450)` and a regex that matches the new literal.
- `specs/behavioral/session-hygiene.md` §Failure-modes and
  §Planned-test references updated.

The `.gitmessage` template (§2.4 of the arc) and the
`_template-exception-report.md` (§2.2) and the plan-lint rule #23
(§2.1) land in the same slice commit as this ADR; the Codex
challenger pass covers the whole slice.
