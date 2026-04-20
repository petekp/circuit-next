<!-- current_slice: 25d -->

# circuit-next

**Status: Tier 0 scaffold complete; Phase 1 contract authorship closing,
Phase 1.5 Alpha Proof semantics authorized by ADR-0001 Addendum B
(Slice 25d). Not yet functional.**

Claude Code plugin that automates common developer and creative workflows
through a configurable, evidence-based methodology.

## Why this exists

The first-generation [Circuit](../circuit) evolved organically and accreted
complexity. `circuit-next` is a from-scratch rewrite driven by a deliberate
methodology — **Contract-First + Tiny-Step-Ratcheting + Architecture-First +
narrow cross-model challenger** — that was itself designed through a
tournament-rigor Explore run.

The operator-facing value proposition is unchanged: a small number of
high-leverage workflow shapes (Explore, Build, Repair, Migrate, Sweep) with
per-step configurability of model, reasoning effort, skills applied, and
user-global defaults/overrides.

## Methodology

See [`specs/methodology/decision.md`](specs/methodology/decision.md) for the
tournament decision that defines the four methodological pillars, their
stress-test survival, accepted risks, and reopen conditions.

## Current phase

**Phase 1 — Contract authorship (closing); Phase 1.5 Alpha Proof
authorized by ADR-0001 Addendum B (Slice 25d).** Phase 0 Evidence Loop
closed. Phase 1 contracts authored: step, phase, run, selection, adapter,
skill, workflow-skeleton, continuity, config, plus three behavioral tracks
(session-hygiene, prose-yaml-parity, cross-model-challenger). Authority-graph
gate (Slice 7 / ADR-0003), invariant ledger, plane dimension, and
reverse-authority checks are exercised end-to-end. Slice 25d reopened
ADR-0001 and installed D3 — Phase 1.5 semantics are now authoritative;
Phase 1 closes and Phase 1.5 opens on the commit that lands the remaining
narrowed workflow contract (Slice 27). The remaining close arc is
sequenced by
[`specs/plans/phase-1-close-revised.md`](specs/plans/phase-1-close-revised.md):
Slice 27 (narrowed workflow contract, last Phase 1 slice) → 27a–27c
(baseline, runtime boundary) → 27d `dogfood-run-0` alpha product proof.
Phase 2 entry is gated by Phase 1.5 close, not Phase 1 close.

See [`PROJECT_STATE.md`](PROJECT_STATE.md) for a live snapshot of where the
project is, what was just decided, and what comes next.

## Layout

```
circuit-next/
├── CLAUDE.md                # Session hygiene + lane discipline for agents
├── PROJECT_STATE.md          # Live project state snapshot
├── bootstrap/                 # Phase 0 evidence drafts
├── specs/
│   ├── methodology/             # Tournament artifacts (inlined Markdown; provenance in frontmatter)
│   ├── evidence.md              # Phase 0 synthesized output
│   ├── domain.md                # Phase 1: ubiquitous language
│   ├── artifacts.json           # Authoritative authority graph (ADR-0003)
│   ├── artifacts.md             # Authority-graph companion doc
│   ├── contracts/               # Phase 1: per-module contracts
│   ├── reference/               # Live-surface characterizations
│   ├── behavioral/              # Phase 1: behavioral concerns
│   ├── adrs/                    # Architectural decision records
│   └── risks.md                 # Accepted + open risks ledger
├── src/
│   ├── types/                   # Architecture-First types at boundaries
│   └── schemas/                 # Zod contracts matching types
├── tests/
│   ├── contracts/               # Contract tests
│   ├── properties/visible/      # Visible property tests (Tier 2+)
│   ├── properties/hidden/       # Hidden pool (Tier 2+)
│   └── unit/                    # Unit tests
└── .claude-plugin/              # Plugin manifest (deferred to Phase 2+; implementation lands alongside runtime)
```

## License

TBD
