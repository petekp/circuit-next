<!-- current_slice: 122 -->

# circuit-next

**Status: Tier 0 scaffold complete; Phase 1 contract authorship closed at
Slice 27 (`workflow.md` v0.2); Phase 1.5 Alpha Proof closed at Slice 31a
(ceremony commit, 2026-04-21) per ADR-0001 Addendum B as amended by
ADR-0006; Phase 2 — Implementation closed at Slice 101 (2026-04-24) for the
first working workflow product spine. Full first-generation Circuit parity
remains future work. CC#14 closure is a one-time waiver + retarget per
ADR-0006: (14a) operator product-direction check at
`specs/reviews/phase-1.5-operator-product-check.md`, (14b) existing
Claude + Codex LLM stand-in sections in
`specs/reviews/phase-1-close-reform-human.md` with F17 weaker-evidence
flag. The canonical non-LLM human cold-read is **not** satisfied; weaker
evidence of different shape is substituted. ADR-0006 §Precedent firewall
governs any future retarget.**

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

**Phase 2 — Implementation (closed for the first working workflow, 2026-04-24
at Slice 101).** Phase 0 Evidence Loop closed; Phase 1 contract authorship
closed at Slice 27; Phase 1.5 Alpha Proof closed at Slice 31a. Phase 2
proved the product spine: Claude Code plugin commands reach the runtime,
Explore runs through the canonical workflow, Review is wired as a second
workflow shape, Claude and Codex subprocess dispatch both have current live
smoke fingerprints, strict JSON artifacts are the accepted successor shape
for step state, and config can select model and effort. This does **not**
claim full first-generation Circuit parity. Build, repair, migrate, sweep,
custom workflow authoring, and a polished workflow-configuration experience
remain future work. `specs/parity-map.md` records the current gap map and
recommends opening Build next; `specs/plans/build-workflow-parity.md` is the
operator-signed Build plan now being implemented. CC#14 was amended by ADR-0006 as a one-time
waiver + retarget (see Status above); the canonical non-LLM cold-read is **not**
satisfied, and weaker evidence of different shape is substituted — carried
openly on every authority surface. CC#15 preservation rests on (i) the 14a
operator product-direction check and (ii) CC#13 closure by the Slice 29
property fuzzer at `tests/properties/visible/`, a structurally-different
non-LLM mechanical probe.

See [`PROJECT_STATE.md`](PROJECT_STATE.md) for the live snapshot of where
the project is. Per-slice narrative history is in
[`PROJECT_STATE-chronicle.md`](PROJECT_STATE-chronicle.md) (split from
PROJECT_STATE.md at Slice 67; the chronicle is non-authoritative history,
live state lives at `## §0` of PROJECT_STATE.md).

## Layout

```
circuit-next/
├── CLAUDE.md                # Session hygiene + lane discipline for agents
├── PROJECT_STATE.md          # Live project state (§0 Live state section is authoritative)
├── PROJECT_STATE-chronicle.md # Non-authoritative narrative history (per-slice log)
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
