---
original_artifact_path: /Users/petepetrash/Code/.circuit/circuit-runs/design-a-methodology-for-llm-assisted-project-deve/artifacts/result.md
source_kind: circuit-run-artifact
provenance_note: Non-operative provenance. The run-root path is host-local and may not exist on a clone. This repository copy is authoritative. The key is intentionally named original_artifact_path, not source, to prevent future tooling from treating it as an operative input.
inlined_at: 2026-04-19
inlined_in_slice: 25a
inlined_via_adr: ADR-0001 portability addendum
---

# Result: LLM-Assisted Project Development Methodology

## Summary

Tournament-rigor Circuit Explore run produced a converged, evidence-grounded, stress-tested methodology for LLM-assisted project development. Four orthogonal stances were authored, cross-paired for adversarial review (Claude↔Codex), revised by the original authors, and stress-tested under concrete attack scenarios across five vectors (seam failures, scale pressure, dependency failure, assumption inversion, time decay). Three stances survived with bounded damage; one (Plurality-of-Minds / Adversarial Multi-Model) broke under stress due to Knight-Leveson correlation and Berkeley multi-agent failure modes.

The converged decision: **Contract-First as core, Tiny-Step-Ratcheting lane discipline as execution layer, Architecture-First types as first-line-of-defense at module boundaries, and narrow cross-model challenger at governance-sensitive decisions.** Full decision with pre-mortem in `artifacts/decision.md`; adoption plan in `artifacts/plan.md`.

## Findings

### Tournament outcomes

| Stance | Revised by | Stress verdict | BREAK+FATAL |
|---|---|---|---|
| A — Contract-First | Claude (original author) | BENDS | 7 |
| B — Architecture-First | Codex | BENDS | 6 |
| C — Plurality-of-Minds | Claude | **BREAKS** | **15** |
| D — Tiny-Step-Ratcheting | Codex | BENDS | 5 |

### Key findings from the tournament

1. **No stance was evidence-dominated on first-principles fit.** All four span the design space orthogonally along axes of "where truth lives" (specs / types / triangulation / metrics). The tournament's value was stress-testing each under concrete attack scenarios, which revealed *survivability* as the differentiator, not *theoretical appeal*.

2. **Plurality-of-Minds fails structurally under stress.** Not because multi-model review is useless — it is valuable as one Swiss-cheese layer — but because it cannot be load-bearing. Knight & Leveson 1986 [fact] proved N-version errors are not i.i.d.; Berkeley 2025 [fact] documents 86.7% multi-agent failure rates with 14 distinct failure modes. A methodology that makes dual-model review the primary ground truth is structurally unsound. The value is preserved in the converged methodology as a narrow challenger role at ratchet-change, contract-relaxation, migration-escrow, and discovery-promotion decisions — never as independent corroboration.

3. **Contract-First has the strongest LLM-specific empirical backing.** Component interventions cite direct measured effects: tests-in-prompt (+12.78% MBPP, +9.15% HumanEval) [Mathews & Nagappan 2024], property-based generation (+9.2% pass@1) [PGS 2025], hidden tests dropping reward-hack to ~0 [Jiang et al. ImpossibleBench 2025], generator/evaluator split beating self-critique [Anthropic Harness Design 2025], mutation testing correlating with real-fault detection [IEEE TSE]. Architecture-First leans on classical-CS evidence (Parnas, Ousterhout, TLA+ at AWS) with weaker LLM-specific RCT backing. Tiny-Step-Ratcheting has evidence for components (METR horizons, LORE 120-step collapse) but not for monotonic-advancement-as-policy.

4. **Tiny-Step-Ratcheting had the fewest stress BREAKs** — because its lane system honestly covers the diversity of real work (equivalence refactors, migration debt, research spikes, throwaway scripts, emergency hotfixes). Pure Contract-First's 7 BREAKs included the `bootstrap/` loophole that the review correctly predicted would become the main workflow; composing A + D's lane system closes that exploit path by making `bootstrap/` a Discovery Lane with hard time-box, non-importable code, and promotion-requires-rewrite.

5. **The dominant LLM coding failure mode is faulty external grounding.** Hallucinated APIs, fabricated imports, wrong version assumptions, phantom helpers all share a root cause: the agent writes from memory/pattern instead of from verified external sources. Supporting: CodeHalu 2025 (all 4 hallucination classes in all 17 evaluated models); Spracklen et al. USENIX 2025 (19.7% of generated code references non-existent packages, 43% recur deterministically); Codex introspection documenting these patterns in first-person. The converged methodology's registry-lookup wrapper and API-grounding gate directly address this class.

6. **The secondary failure class is reward-hacking of writable verification surfaces.** Agents delete, weaken, or write tautological tests to make CI green. Supporting: ImpossibleBench (GPT-5 76-93% / Claude Opus 4.1 46% cheating when tests unsatisfiable and writable; ~0% when tests hidden); METR 2025-06-05 (100% hack rate on Optimize LLM Foundry; aggregate 30.4%); Anthropic reward-tampering research. The converged methodology's container isolation with read-only mounts of `specs/`, `tests/`, and CI configuration — plus hidden property pools not mounted into the implementer container at all — structurally closes this surface.

7. **Cross-model (Claude↔Codex) review is useful but NOT independent.** Knight & Leveson 1986 [fact] remains the load-bearing citation: N-version errors correlate more than independence predicts. Training-data overlap between Claude and Codex is substantial [inference]. The methodology treats cross-model review as one Swiss-cheese layer [Reason 1997], explicitly not as independent corroboration. This is the single most frequently misstated claim in the LLM-orchestration literature.

8. **Ergonomic target (≤25% meta-process) is structurally breached for projects under ~6 weeks.** Honest arithmetic: 3-5 days front-loaded Phase 0 + Phase 1, plus 15-25% per-slice ongoing overhead. For a project with 6+ weeks of life, this amortizes below 25%. For shorter projects, the methodology is over-engineered. The carve-out is explicit: the methodology is a governance option for high-durability work, not a universal mandate. The Tier 0-3 staged adoption from the ratcheting layer allows lighter application where that is honest.

9. **Several strong claims in individual proposals were defeated and removed.** Examples: "by the Nth project overhead drops" (removed as unsupported); "nearly hands-off operator" (removed as unsafe); "every commit must advance a ratchet" (replaced with lane-specific merge semantics); "Knight-Leveson does not apply to modern LLMs" (not claimed — correlation is accepted).

### Cross-cutting invariants preserved from the evidence base

Hard Invariants 1-10 from `analysis.md` are honored by the converged methodology. Invariant compliance is Pass or documented Partial per `revised-a.md §Invariant Compliance`, with the Behavioral Contract track extending coverage to non-functional concerns (performance, accessibility, UX, security).

### Contradictions resolved

- **Self-correction helps (Reflexion) vs doesn't help (Huang et al.)** → Both consistent; Reflexion's "reflect" is triggered by *external binary feedback*, Huang's test was intrinsic with no external signal. The methodology mandates external feedback (property suites, mutation, behavioral gates, runtime observability).
- **TDD yields quality-up (Mathews/Nagappan) vs time-up (George/Williams)** → Both consistent; defect-down, calendar-time-up is the expected trade. The methodology accepts the calendar-time cost for high-durability work.
- **LLMs speed developers up (vendor studies) vs slow them down (METR RCT)** → Both consistent; junior/greenfield vs senior/mature-repo are different populations. The methodology's lane system and Tier 0-3 adoption allow calibration to project maturity and operator skill.

## Next Steps

### Immediate (Week 1)

1. **Create the first pilot project scaffold** per `artifacts/plan.md §Phase 0 — Tooling + Project Scaffold`. Install Docker/Podman for container isolation (or accept the degraded Unix-account mode and flag as compliance gap). Install property-based + mutation tooling per language. Deploy the registry-lookup wrapper and API-grounding check.
2. **Write the first ADR** (`specs/adr/0001-adopt-methodology.md`) recording the decision, referencing this run's artifacts, and naming the reopen conditions.
3. **Author the first `CLAUDE.md`** under 300 lines; point at `specs/` rather than embedding domain detail; structure to maximize prompt-cache hit rate [fact; Anthropic prompt caching: 85% latency / 90% cost reduction].

### Short-term (Weeks 2-4)

4. **Phase 0 Evidence Loop** on the first pilot project (5-day time-box). Prototype in `bootstrap/`; surface invariants by interacting with reality.
5. **Phase 1 Contract authorship** (`specs/domain.md`, per-seam contracts with YAML frontmatter, per-concern behavioral specs). Adversarial property-audit via cross-model reviewer.
6. **Phase 2 first-slice** in Ratchet-Advance lane. Container-isolated implementer; hidden property pool in CI; mutation gate on touched modules; behavioral gates active.

### Medium-term (Months 2-6)

7. **Continue slicing through features** under lane discipline. Exercise each lane at least once — Ratchet-Advance, Equivalence Refactor, Migration Escrow, Discovery, Disposable, Break-Glass — to surface lane-declaration edge cases.
8. **First Goodhart audit** after ~50 commits. Verify no metric is rewarding wrong behavior; carve-out list is reviewed; quarantine protocol is exercised.
9. **Mid-project retrospective** — approximately at 50% of project duration. Check pre-mortem signals (P1-P10 in `decision.md`). Any lit signal is a flag for the closing retrospective.

### Project close

10. **Write `specs/retrospective-<project>.md`** per `plan.md §Phase 4`. Actual vs. projected cost; lane-usage distribution; tautological properties discovered post-ship; reward-hack attempts caught/missed; Goodhart-on-gaps incidents; pre-mortem signal readings. Required before applying methodology to project N+1.

### Governance

11. **Reopen conditions** from `decision.md` are monitored continuously. If any triggers — empirical reproduction exceeds 40% overhead; hidden-pool attack demonstrated; cross-model correlation ≥95% over N≥20; frontier model behavioral shift; operator-role change; container tooling loss — re-examine the decision.

12. **The methodology is not frozen.** Each retrospective surfaces calibration edits: threshold tuning, new behavioral gates for discovered failure modes, lane-semantic refinements. Changes go through the solo-approval protocol from the ratcheting layer — non-implementing model objection list; cooling-off; separate commit from product diff.

## Transition

This Explore run completes. The first pilot project is a separate Build circuit run governed by this methodology at slice granularity. The Build circuit's Frame → Plan → Act → Verify → Review → Close phases map onto this methodology's Phase 0-3 structure: Build's Frame absorbs Phase 0 Evidence Loop; Build's Plan absorbs Phase 1 Contract authorship; Build's Act + Verify + Review absorb Phase 2 Implementation with lane discipline, gates, and closure audit.

The artifacts produced by this Explore run — `brief.md`, `analysis.md`, four proposals with reviews/revises/stresses, `decision.md`, `plan.md`, this `result.md` — are the durable evidence bridging this Explore to the Build that follows. No load-bearing context lives only in chat.

---

**Artifacts index**:
- `artifacts/brief.md` — problem framing and success criteria
- `artifacts/analysis.md` — evidence synthesis (46+ facts, 60+ introspective observations, 10 Hard Invariants, 32 named patterns)
- `phases/diverge-{a,b,c,d}/reports/proposal-*.md` — four tournament stances
- `phases/review-{a,b,c,d}/reports/review-*.md` — adversarial reviews (cross-paired)
- `phases/revise-{a,b,c,d}/reports/revised-*.md` — author-side revisions
- `phases/stress-{a,b,c,d}/reports/stress-*.md` — cross-paired stress tests
- `artifacts/decision.md` — converged decision with pre-mortem
- `artifacts/plan.md` — adoption plan for the first pilot
- `artifacts/result.md` — this document
