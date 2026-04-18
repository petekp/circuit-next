---
adr: 0001
title: Adopt Contract-First + Tiny-Step-Ratcheting + Architecture-First + Narrow Cross-Model Challenger as circuit-next Methodology
status: Accepted
date: 2026-04-17
author: operator + tournament (Claude + Codex)
supersedes: none
---

# ADR-0001 — Methodology Adoption

## Context

`circuit-next` is a ground-up rewrite of Circuit (a Claude Code plugin that
automates developer workflows) under a deliberately chosen methodology. The
first-generation Circuit evolved organically and accreted complexity that
became hard to reason about. To avoid repeating that trajectory, the operator
ran a tournament-rigor Circuit Explore (artifacts at
`.circuit/circuit-runs/design-a-methodology-for-llm-assisted-project-deve/`,
symlinked into `specs/methodology/`) evaluating four orthogonal methodological
stances under adversarial stress-testing.

## Decision

Adopt the synthesis:

**Contract-First core + Tiny-Step-Ratcheting lane discipline + Architecture-First types at module boundaries + narrow cross-model challenger.**

Operationally:

- **Phase 0** — Evidence Loop (time-boxed 1-5 days): prototype in `bootstrap/`
  under minimal constraints. Output: `specs/evidence.md`. Closes with
  adversarial auditor review before Phase 1.
- **Phase 1** — Contract authorship: operator + LLM draft `specs/domain.md`,
  then `specs/contracts/<module>.md` with YAML frontmatter enumerating
  invariants, pre/postconditions, `property_ids`. `specs/behavioral/<concern>.md`
  for non-specifiable concerns. Adversarial property-auditor (different model)
  emits prose tautology attacks; operator encodes each as a new property.
- **Phase 2** — Implementation via lane discipline. Six lanes (Ratchet-Advance,
  Equivalence Refactor, Migration Escrow, Discovery, Disposable, Break-Glass)
  with lane-specific merge semantics. Implementer runs in container with
  distinct UID; `specs/`, `tests/properties/visible/`, `tests/mutation/`,
  `specs/behavioral/`, CI configuration mounted read-only;
  `tests/properties/hidden/` not mounted at all.

At module boundaries, prefer types over tests when types can express the
invariant. A compiling program is a first-line-of-defense against
local-coherence/global-incoherence failures. Tests defend what types cannot
reach.

Cross-model adversarial review is used **narrowly**: ratchet changes,
contract-relaxation ADRs, migration escrows, discovery-decision promotion,
and any request to loosen a gate. The challenger produces an **objection
list**, not an approval. It is one Swiss-cheese layer, explicitly not
independent corroboration (Knight & Leveson 1986).

## Rationale

Summarized from `specs/methodology/decision.md` §Rationale:

1. **First-principles fit to the dominant failure class.** The dominant
   coding-agent error class is faulty external grounding (hallucinated APIs,
   fabricated imports, wrong version assumptions, phantom helpers; CodeHalu
   2025; Spracklen et al. USENIX 2025). Contract-First addresses this most
   directly — contracts ARE the external grounding.
2. **Strongest LLM-specific empirical backing among surviving stances.**
   Tests-in-prompt +12.78% MBPP / +9.15% HumanEval (Mathews & Nagappan ASE
   2024); Property-Generated Solver +9.2% pass@1 (PGS 2025); hidden tests drop
   reward-hack rate to ~0 (Jiang et al. 2025); generator/evaluator split across
   models beats self-critique (Anthropic *Harness Design* 2025); mutation
   testing correlates with real-fault detection.
3. **Survivability via D's lane discipline.** D had the fewest stress BREAKs
   (5) because lane semantics honestly cover equivalence refactors, migration
   debt, research spikes, throwaway scripts, emergency hotfixes. Composing
   A+D closes the "bootstrap/ as loophole" exploit path.
4. **Anti-Goodhart controls from D strengthen A's weakest point** (mutation
   score theater via operator-implementer collusion). D's quarantine protocol,
   versioned ratchet floors, fingerprinted commands/configs/datasets, overlap
   windows on metric replacement, and meta-ratchets give Contract-First's
   mutation gate concrete governance.

## Tournament outcome

| Stance | Survived | Break count |
|---|---|---|
| A — Contract-First (Claude-author, Codex-review) | Bends | 7 |
| B — Architecture-First (Codex-author, Claude-review) | Bends | 6 |
| C — Plurality-of-Minds | **Breaks** | 15 (BREAK + FATAL) |
| D — Tiny-Step-Ratcheting (Codex-author, Claude-review) | Bends | 5 |

Stance C was eliminated at stress-test: Knight-Leveson correlation means
cross-model review is not statistically independent, and the Berkeley
multi-agent failure study (86.7% failure rate) confirms role-design is
load-bearing — a claim C could not defend against 15 concrete attack
scenarios.

## Consequences

### Accepted

- 15-25% steady-state calendar-time tax; 3-5 days front-loaded Phase 0+1
- Cognitive load of property authorship above example-based testing
- Cross-model reviewer correlation (Knight & Leveson 1986)
- Container-tooling prerequisite (fallback to distinct-UID strictly weaker)
- Contract-gap domains carved out as Discovery/Disposable lanes
- Metric laundering by determined collusion — structurally undefeatable; audit only
- Cross-contract emergent bugs not fully defended by contract graph alone
- Slow-tier check latency — mitigated by affected-scope blocking, not eliminated

See `specs/risks.md` for the full ledger with signals to watch.

### Enabling

- `tsc --strict` + Zod schemas at module boundaries from day 1
- Contract tests under `tests/contracts/` before implementation
- Lane-declared slices with framing gate (failure mode, acceptance evidence, alternate framing)
- Narrow cross-model challenger via `/codex` skill for ratchet changes, ADRs, escrows
- CLAUDE.md ≤ 300 lines; session hygiene protocol
- Staged adoption: Tier 0 (scaffold + types) → Tier 1 (contracts + visible properties) → Tier 2 (container + hidden pool + mutation) → Tier 3 (behavioral tracks, anti-Goodhart machinery)

### Deferred to Tier 2+

- Container isolation with read-only mounts
- `tests/properties/hidden/` pool + opaque rotation
- Mutation testing gate
- Anti-Goodhart ratchet machinery (quarantine protocol, versioned floors, fingerprinting, meta-ratchets)
- Solo-approval protocol for ratchet weakening
- Registry-lookup install wrapper (firewalled network)

## Reopen conditions

Re-examine this ADR if any trigger in `specs/risks.md` §Reopen Conditions fires:

1. First pilot exceeds 40% calendar-time overhead
2. Hidden-pool enumeration demonstrated
3. Cross-model reviewer correlation ≥95% over N≥20 samples
4. Frontier model behavioral shift invalidates load-bearing citations
5. Operator role change (team or single-agent tool)
6. Container isolation structurally unavailable

## References

- `specs/methodology/decision.md` — authoritative tournament decision
- `specs/methodology/analysis.md` — Phase Analyze synthesis
- `specs/methodology/plan.md` — Phase Plan (adoption roadmap)
- `specs/methodology/result.md` — Phase Close summary
- `specs/risks.md` — risks ledger with accepted + open risks + signals
