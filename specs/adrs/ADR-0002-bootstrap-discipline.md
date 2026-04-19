---
adr: 0002
title: Bootstrap circuit-next via existing Circuit as harness; discipline against design contamination
status: Accepted
date: 2026-04-18
author: operator
supersedes: none
related: ADR-0001
---

# ADR-0002 — Bootstrap Discipline

## Context

`circuit-next` is being built using the existing Circuit plugin (at
`~/Code/circuit`, v0.3.0) as the orchestration harness. Every slice so far has
been driven through `/circuit:run`, `/circuit:handoff`, `/circuit:explore`,
and the built-in worker/review machinery. The Phase 1 slice 1 run
(`.circuit/circuit-runs/phase-1-step-contract-authorship/`) was authored,
reviewed, and verified end-to-end through the Circuit tool running on its own
replacement.

This is a classic compiler-bootstrap pattern (GCC→GCC, Rust→Rust,
TypeScript→TypeScript). It is not inherently hypocritical: the methodology
Circuit implements is close enough to the methodology circuit-next formalizes
that using one to build the other provides live dogfooding evidence.

But the arrangement introduces four specific contamination paths that must
be actively defended against, not merely noted:

1. **Reference contamination.** Circuit is read-only reference
   (CLAUDE.md hard-invariant). Every `/circuit:*` call reads Circuit's
   behavior. That is fine for orchestration. It is not fine as a justification
   for design decisions in circuit-next. "Circuit does X" is never a valid
   citation.
2. **Silent methodology drift.** Circuit's internal heuristics (cross-model
   prompt shape, review-phase leniency, lane detection, worker dispatch
   semantics) do not necessarily match `specs/methodology/decision.md`.
   Dispatching through `/circuit:*` inherits Circuit's choices without
   flagging them.
3. **Artifact confusion.** `.circuit/circuit-runs/**` is tool-run state
   for the harness, not project history for circuit-next. The Phase 1 slice 1
   commit (4b6688e) tracked one such run directory into circuit-next's git
   history. Left unchecked, every future slice will bloat the repo with
   orchestration debris.
4. **Inherited-design capture.** Circuit has adapter abstractions, selection
   policies, and event shapes that reflect its own organic evolution. When
   authoring `adapter.md`, `selection.md`, or `event.ts` in circuit-next, the
   risk is writing from Circuit's shape rather than from `specs/evidence.md`
   + `specs/methodology/decision.md` + the blind-internal extraction.

## Decision

Adopt the following bootstrap discipline:

### 1. Citation rule

Every design decision committed to `circuit-next` cites **one or both** of:

- `specs/evidence.md` (with invariant ID or section reference), or
- `specs/contracts/<module>.md` (with invariant ID), or
- `specs/methodology/decision.md` (with §section reference).

"Because Circuit does it this way" is **never** a valid citation. If a
Circuit behavior looks right for circuit-next, the commit must independently
justify it from evidence; otherwise the behavior is treated as Circuit-
specific and the decision is deferred until evidence supports it.

### 2. Gitignore rule

`.circuit/` is added to circuit-next's `.gitignore` going forward. Tool-run
state lives in the outer workspace (`~/Code/.circuit/`), not in the
circuit-next repo. The one already-tracked run directory
(`.circuit/circuit-runs/phase-1-step-contract-authorship/`) is preserved
as historical audit trail of the first Phase 1 slice — it documents *how*
step.md was authored. No new runs are added to the repo.

### 3. Harness-vs-template distinction

Circuit is a **harness** (scaffolding used during construction) and **not a
template** (shape to copy). When circuit-next is done, the scaffolding is
discarded. During construction:

- `/circuit:*` commands may be freely used for orchestration (workflow
  dispatch, continuity, worker scheduling, review loops).
- Circuit's *implementation details* (how adapters are defined, how events
  are emitted, how continuity is serialized) are not privileged over
  alternatives that the methodology or evidence might favor.
- The Phase 0 blind-internal extraction (`bootstrap/evidence-draft-int-*.md`)
  is the sanctioned evidence source for how Circuit behaves today. Reading
  Circuit's source directly to inform a circuit-next design decision is
  discouraged; if required, that reading becomes a new evidence pass, not a
  shortcut.

### 4. Enforcement via audit

`npm run audit` (slice 2 of this autonomy arc) checks for:

- Commits citing Circuit behavior instead of evidence/contract.
- Any new files under `.circuit/` entering the git index.
- PROJECT_STATE.md drift vs HEAD.
- HIGH adversarial objections silently deferred without rationale.
- Ratchet floor regressions without ADR.

The discipline is self-enforcing once audit is wired in. Until then, it is
operator-enforced.

## Rationale

Contamination paths #1 and #4 are the most dangerous because they are
invisible: the code looks like evidence-driven design but is actually
inherited from Circuit's specific choices. Paths #2 and #3 are more
mechanical and catchable by tooling. The four rules above address all four
paths: the citation rule defuses #1 and #4, the gitignore rule defuses #3,
the harness-vs-template distinction names #2 and #4 as failure modes to
watch, and the audit enforces the citation rule at commit time.

The decision to *preserve* the already-tracked run directory rather than
`git rm` it follows the user preference against worrying about
backwards-compat cleanup on small projects, and it gives audit a concrete
pre-discipline artifact to reason about. Future runs stay out.

## Consequences

### Accepted

- One pre-discipline run directory lives in circuit-next history forever.
  Trade: forever bloat vs. clean audit trail of the bootstrap era.
- Commit messages are slightly longer (evidence/contract citation required).
- Some design decisions that "obviously" should follow Circuit's shape
  require explicit evidence before landing.
- Audit enforcement is delayed by one slice (slice 2 builds it).

### Enabling

- Citation rule gives reviewers (human or cross-model) a concrete thing to
  check: is every decision grounded in evidence or contract?
- Harness-vs-template distinction gives the operator explicit license to
  deviate from Circuit's design where the methodology or evidence favors
  another shape.
- Gitignore keeps circuit-next's git history clean for the long arc ahead.

## Reopen conditions

Re-examine this ADR if:

1. Three or more slices in a row find that the harness cannot be used
   without violating the citation rule (suggests the harness itself needs
   replacement or forking).
2. Audit flags systematic citation violations that are not actual
   contamination (suggests the rule is too strict).
3. A circuit-next design diverges from Circuit so far that the harness
   becomes hostile rather than supportive (suggests building a minimal
   bespoke orchestrator for the remaining slices).

## References

- `CLAUDE.md` — "Reference implementation: previous-generation Circuit at
  `~/Code/circuit` is read-only reference during circuit-next development."
- `specs/methodology/decision.md` — authoritative methodology decision
- `specs/evidence.md` — Phase 0 synthesis
- `bootstrap/evidence-draft-int-*.md` — blind-internal extraction evidence
- `bootstrap/prior-art-audit.md` — audit of in-repo Circuit docs against
  independent evidence
- `.circuit/circuit-runs/phase-1-step-contract-authorship/` — preserved
  pre-discipline run directory (historical)
