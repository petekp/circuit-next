---
original_artifact_path: /Users/petepetrash/Code/.circuit/circuit-runs/design-a-methodology-for-llm-assisted-project-deve/artifacts/brief.md
source_kind: circuit-run-artifact
provenance_note: Non-operative provenance. The run-root path is host-local and may not exist on a clone. This repository copy is authoritative. The key is intentionally named original_artifact_path, not source, to prevent future tooling from treating it as an operative input.
inlined_at: 2026-04-19
inlined_in_slice: 25a
inlined_via_adr: ADR-0001 portability addendum
---

# Brief: Design a methodology for LLM-assisted project development

## Objective

Design a durable, evidence-grounded methodology that governs how a human operator
(product designer / self-taught engineer) collaborates with coding agents (Claude
Code and Codex CLI) on software projects. The methodology must dramatically
improve outcomes relative to ad-hoc agent-driven development by directly
compensating for the architectural and empirical weaknesses of current LLM-based
coding agents.

The methodology is intended as the foundation for many future important
projects. It must be defensible, operational (not aspirational), and
stress-tested against adversarial critique.

## Scope

- The end-to-end collaboration process between human operator and coding agents
  across the lifecycle of a software project: framing, exploration, decision,
  planning, execution, verification, review, and closure.
- Context engineering (what the agent sees, when, in what order, with what
  provenance).
- Test and verification discipline, including deliberate test design and the
  epistemic role of tests as ground truth.
- Task decomposition, sizing, and pacing of agent units of work.
- Human-in-the-loop checkpoints (what, when, with what artifact).
- Multi-model orchestration (Claude vs Codex, when each is used, and how their
  outputs are triangulated).
- Mechanisms for preventing common LLM failure modes:
  premature closure, hallucination, pattern-matched-but-wrong solutions,
  tautological tests, sycophancy, reward-hacking of verification gates,
  context drift across sessions, local-coherence-but-global-incoherence,
  over-engineering, and anchoring on initial framing.
- Artifacts: what persistent documents must exist, where they live, who writes
  them, who reads them, and how they decay.

## Output Types

**Primary: decision** -- choose a methodology among competing adversarially
evaluated proposals (Tournament rigor).

**Secondary: plan** -- an adoption plan for applying the chosen methodology to
the next project, including concrete artifacts, helper scripts, and a
first-project pilot design.

Both may emit. Close emits a single unified `result.md` that summarizes the
decision and the transition to Build.

## Success Criteria

The methodology is sufficient if it:

1. **Is grounded in evidence.** Every load-bearing claim about LLM behavior
   traces to one of: published research (papers, benchmarks, evals),
   first-party vendor documentation on model behavior, or a well-documented
   community failure mode with citations. Introspective claims about Claude and
   Codex are allowed but must be labeled `[inference]` not `[fact]`.
2. **Names the failure modes it defends against.** For every process element
   (checkpoint, artifact, test class, review gate), the methodology states
   which specific failure mode it exists to prevent. Process elements without
   a named failure mode are cut.
3. **Has operational mechanics.** The methodology is a set of concrete steps,
   artifacts, and gates a human plus two agents can follow. Not aspirational
   principles.
4. **Survives adversarial critique.** All four tournament proposals undergo
   red-team review, revision, and stress testing. The converged decision
   documents the attack vectors it survives, the failure modes it accepts,
   and the mitigations it mandates.
5. **Is test/validation-driven at every step.** Tests and validation are not a
   downstream concern -- they are designed before code, scrutinized for
   tautology, and treated as the primary ground truth against which agent
   output is judged.
6. **Explicitly leverages both Claude and Codex.** Multi-model triangulation
   is a first-class methodology element, not an optional tool choice. The
   methodology specifies when each model is used, why, and how their outputs
   reconcile.
7. **Passes a pre-mortem.** The closing decision includes a written pre-mortem
   from the perspective of "six months from now, this failed." The failure
   modes identified are mapped to mitigations already in the methodology, or
   accepted as known risks.
8. **Is durable across sessions and projects.** The methodology does not
   depend on a single session's context being intact. Artifacts, tripwires,
   and enforced conventions survive session boundaries.

## Constraints

- **Evidence discipline.** No untraceable claim about LLM capabilities or
  limits enters the decision. Label every analysis item `[fact]`,
  `[inference]`, or `[assumption]`.
- **Dual-model requirement.** Proposal divergence, adversarial review, and
  stress testing must all include contributions from both Claude and Codex.
  Cross-pairing (Claude reviews Codex, Codex reviews Claude) is required for
  the adversarial phases so the critique comes from a different cognitive
  prior than the author.
- **Practical ergonomics.** The methodology's operator is a human who ships
  real projects. A methodology that is theoretically perfect but demands more
  than ~25% of project time on meta-process is too expensive. Mechanics must
  be cheap enough to run on every project without negotiation.
- **No backwards-compat obligation.** This is a new methodology. It does not
  need to preserve any prior workflow.
- **No unit economics concerns.** The user explicitly relaxed token-cost and
  time-budget constraints for the tournament itself. The *resulting*
  methodology is still subject to the ergonomic constraint above.

## Verification Commands

Because this is a methodology design rather than a code change, verification is
artifact-based rather than command-based. The artifacts that evidence
correctness of this run:

- `artifacts/brief.md` -- present, Success Criteria non-empty (this file).
- `artifacts/analysis.md` -- present, every item labeled, Facts and Unknowns
  non-empty, External and Internal evidence sources both reflected.
- `phases/diverge-{a,b,c,d}/reports/` -- four distinct proposals, each with
  required schema sections.
- `phases/review-{a,b,c,d}/reports/` -- four adversarial reviews, each
  cross-paired across models.
- `phases/revise-{a,b,c,d}/reports/` -- four revised proposals with explicit
  diffs.
- `phases/stress-{a,b,c,d}/reports/` -- four stress tests, each with attack
  surface and verdict.
- `artifacts/decision.md` -- present, with Options Considered, Decision,
  Rationale, Accepted Risks, Mitigations, Open Risks, Reopen Conditions, and a
  Pre-mortem section.
- `artifacts/result.md` -- present, Findings and Next Steps non-empty.

Spot-check: each tournament worker's final message trace (`last-messages/`)
cites at least one of the evidence items from `analysis.md`. Proposals that
assert capabilities without evidence linkage are rejected at review.

## Out of Scope

- Specific tech stacks (frameworks, languages, cloud providers). The
  methodology is stack-agnostic though it can recommend properties a stack
  should have.
- Hiring, team structure, and organizational design beyond the one-human +
  two-agents operator model.
- Legal, compliance, and data governance concerns beyond the general
  "don't exfiltrate secrets" class of constraints.
- Security review methodology in depth (standalone topic).
- Non-LLM automation (pure CI/CD, testing frameworks, deployment pipelines)
  except insofar as the methodology specifies how LLM collaboration hooks into
  them.
- Evaluating specific agent products (e.g., "Cursor vs Claude Code vs
  Codex"). The methodology assumes Claude Code + Codex CLI as the dual-model
  operator surface.
