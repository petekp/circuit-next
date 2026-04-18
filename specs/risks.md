# Risks Ledger

Risks from `specs/methodology/decision.md` imported here for ongoing tracking.
Update when a risk is realized, mitigated, or reopened.

## Accepted Risks

| ID | Risk | Mitigation | Signal to watch |
|---|---|---|---|
| AR1 | 15-25% steady-state calendar-time tax; 3-5 days front-loaded Phase 0+1 | Tier 0-3 staged adoption; Disposable/Discovery lanes allow lighter touch | Ratio of Ratchet-Advance to Disposable/Equivalence slices trending up |
| AR2 | Cognitive load of property authorship above example tests | LLM-draft-then-auditor-attack workflow | Contract/property authoring time exceeds 2× expected for first 3 features |
| AR3 | Cross-model reviewer correlation (Knight & Leveson 1986) | Swiss-cheese framing; challenger = objection list, not independent corroboration | Claude/Codex convergence rate ≥95% on ADRs over N≥20 samples |
| AR4 | Container-tooling prerequisite; fallback to distinct-UID is strictly weaker | Flagged as compliance gap, not parity | Time in degraded mode |
| AR5 | Contract-gap domains (novel research, taste judgments, UI polish) forced into contracts = over-engineering | Explicit Discovery/Disposable lane carve-outs | Features abandoning the methodology mid-slice |
| AR6 | Metric laundering by determined repo-admin collusion | Git visibility + periodic out-of-band audit | Meta-ratchet drift in audit frequency |
| AR7 | Cross-contract emergent bugs not anticipated by contract graph | Complementary TLA+/model-checking available (not baseline) | Integration-level failures not caught at property level |
| AR8 | Slow-tier check latency → bad merges before expensive checks complete | Affected-scope blocking + bisection | Bisection frequency |

## Open Risks

| ID | Risk | Current posture | Signal |
|---|---|---|---|
| OR1 | Operator burnout on Phase 1 authorship during first feature | No amortization claim made | Retrospective feedback at end of first feature |
| OR2 | Hidden-pool enumeration over time if pool is small or rotation predictable | Pool substantially larger than visible; opaque rotation | Reward-hack rate on hidden tests |
| OR3 | ADR-channel reward hack (implementer constructs diff that makes property look like a contract problem) | Auditor's "who silently breaks?" question | Pattern detection in relaxation ADRs |
| OR4 | Methodology applied to projects wrong for it | Tier 0-3 adoption gives lighter touch | Methodology abandonment events |
| OR5 | Behavioral gate subjectivity on UX/aesthetic concerns | Checkbox discipline forces judgment; cannot guarantee correctness | UX regressions after green behavioral gates |
| OR6 | Meta-process drift: closure audits as rubber-stamps; lane declarations as boilerplate | Periodic Goodhart audit on meta-process; skipped-audit age meta-ratchet | Skipped-audit age trending up |

## Reopen Conditions

Re-examine the methodology decision if any of:

1. First pilot project exceeds 40% calendar-time overhead (structural breach of 25% ergonomic bound).
2. Hidden-pool attack reproducibly demonstrated (enumeration through filesystem, timing, or rotation analysis).
3. Cross-model reviewer correlation ≥95% on production tasks over N≥20 samples.
4. Frontier model behavioral shift invalidates load-bearing citations (reward-hacking rates drop OOM, self-correction reliable, hallucination rates shift).
5. Operator role changes (team grows past one human, or switches to single-agent tool).
6. Tooling unavailability: container isolation becomes structurally unavailable.

See `specs/methodology/decision.md` §Reopen Conditions for authoritative language.

## Pre-mortem failure modes

From `specs/methodology/decision.md` §Pre-mortem — imported for watchfulness.

- **P1** — Phase 1 bureaucracy crushes velocity
- **P2** — Property tests become tautological despite the auditor
- **P3** — Ratchet laundering through quarantine
- **P4** — Container isolation abandoned
- **P5** — Cross-model challenger produces correlated objections
- **P6** — Goodhart-on-gaps realized (unmeasured risks grow silently)
- **P7** — Methodology applied to a project it was wrong for
- **P8** — First-time operator gives up during Phase 1
- **P9** — Migration escrow becomes permanent state
- **P10** — Critical published study invalidates a load-bearing citation

Each has a mitigation in the decision doc. Watch the signal column during operations.
