---
original_artifact_path: /Users/petepetrash/Code/.circuit/circuit-runs/design-a-methodology-for-llm-assisted-project-deve/artifacts/plan.md
source_kind: circuit-run-artifact
provenance_note: Non-operative provenance. The run-root path is host-local and may not exist on a clone. This repository copy is authoritative. The key is intentionally named original_artifact_path, not source, to prevent future tooling from treating it as an operative input.
inlined_at: 2026-04-19
inlined_in_slice: 25a
inlined_via_adr: ADR-0001 portability addendum
---

# Plan: Adoption of the Converged LLM-Assisted Project Methodology

This plan operationalizes `decision.md` into the first-project pilot. The methodology's converged form is **Contract-First + Tiny-Step-Ratcheting lane discipline + Architecture-First type layer + narrow cross-model challenger**.

## Approach

Adoption is staged across four phases paralleling the methodology's Tier 0-3 from the ratcheting execution layer. The pilot project is a new greenfield project the operator owns end-to-end; it is the first surface on which the methodology is applied and the retrospective feedback loop calibrates the cost/benefit before extending to subsequent projects.

### Phase 0 — Tooling + Project Scaffold (Week 1, Day 1-2)

Install the minimum tooling to instantiate Hard Invariants 1-10 [analysis.md]:

**Container isolation (or degraded fallback)**
- Docker or Podman on the operator's machine. Implementer runs in a container with distinct UID.
- Read-only mounts: `specs/`, `tests/properties/visible/`, `tests/mutation/`, `specs/behavioral/`, `ACCEPTANCE.md`, `ratchets/`, CI config (`.github/workflows/` or equivalent).
- Not mounted into implementer container: `tests/properties/hidden/`.
- Degraded fallback (if container unavailable): distinct Unix account `impl@` with OS file permissions + sudo-gated commits. Flag as compliance gap in `specs/risks.md`.

**Property-based + mutation testing**
- Per language: Hypothesis (Python) / fast-check (JS/TS) / PropTest (Rust) / Hedgehog (Haskell/Scala) / QuickCheck (Erlang/Elixir).
- Mutation: Mutmut (Python), Stryker (JS/TS), Pitest (JVM), Cargo-Mutants (Rust), Mull (C/C++). Freeze operator list at init.

**Registry-lookup + API-grounding**
- `pip` / `npm` / `cargo` wrapper that queries the package registry before install. Sole install path inside container; raw network to PyPI/npm/crates firewalled.
- API-grounding script: log new external identifiers to `.grounding-log`; CI cross-checks against installed type stubs / d.ts / docstrings.

**Directory scaffold**
```
specs/
  domain.md            (authored Phase 1)
  contracts/           (YAML-frontmatter contracts per seam)
  adr/                 (append-only decision records)
  behavioral/          (per-concern: performance, accessibility, ux, security)
  evidence.md          (Phase 0 output)
  risks.md             (running ledger with reopen conditions)
  INDEX.md             (auto-generated from contract frontmatter)
bootstrap/             (Phase 0 prototype; non-importable; 5-day time-box)
tests/
  properties/
    visible/           (mounted read-only)
    hidden/            (never mounted into implementer)
  mutation/
    config.*           (protected; frozen operator list)
  examples/            (regression witnesses)
  behavioral/          (per-concern gate artifacts)
ratchets/
  manifest.yaml        (versioned metric definitions)
  history.jsonl        (append-only per-commit evidence)
  versions/            (immutable snapshots)
  escrow/              (active migration debt)
  quarantine/          (records for harmful metrics)
  audits/              (Goodhart audits)
scripts/
  ratchet-check        (JSON-emitting repo-local runner)
  api-grounding-check
  registry-lookup
verification/
  protected-files.yaml (generated list of protected verification inputs)
docs/
  decisions/
    drafts/            (implementer-drafted; unprotected)
    accepted/          (post-challenge; protected)
  spikes/              (discovery artifacts)
  acceptance/          (UI acceptance packets)
incidents/             (break-glass records + normalization evidence)
CLAUDE.md              (<300 lines, universally applicable, top of prompt)
ACCEPTANCE.md          (per-feature; amendable via ADR)
PROJECT_STATE.md       (lane status, escrows, risks, decisions)
SESSION.md             (auto-generated from git log + operator-appended notes)
```

**First ADR**: `specs/adr/0001-adopt-methodology.md` records the decision, references `artifacts/decision.md`, names the reopen conditions, and lists the first project this methodology is applied to.

**First `CLAUDE.md`**: <300 lines [fact; Anthropic Claude Code docs], universally applicable. Points at `specs/` rather than embedding domain detail. Prompt caching [fact; 85% latency, 90% cost reduction] will treat this as stable prefix.

### Phase 1 — Evidence Loop (Week 1, Day 3-5)

Time-boxed to 5 calendar days. Extensions require an ADR [mitigation for pre-mortem P1].

Implementer and operator run in `bootstrap/` with minimal constraints (single rule: do not touch `specs/` or `tests/`). Goal: run real data, hit real APIs, wire real UI, surface the invariants the domain actually has.

At close:
- Operator authors `specs/evidence.md`: what was learned; what invariants the prototype revealed; what framings were rejected; what ontology the domain actually has.
- Adversarial auditor (running on the *other* model from the implementer — if implementer is Claude, auditor is Codex, and vice versa) reviews `specs/evidence.md` and the `bootstrap/` code.
- Checkpoint question: "What did reality teach us that we did not know on day 1?" If nothing substantial, extend or conclude `bootstrap/` was premature.

### Phase 2 — Contract Authorship (Week 2, Day 1-4)

**Day 1-2 — Domain contracts.** Operator + LLM-draft authors `specs/domain.md` using `specs/evidence.md` as input. Adversarial auditor attacks each invariant in prose ("name an implementation that satisfies your reading while violating the spirit").

**Day 3-4 — Per-feature contracts + properties + behavioral specs.**
For the first feature, author:
- `ACCEPTANCE.md` — declared before implementation, amendable only via ADR.
- `specs/contracts/<module>.md` — YAML frontmatter with `invariants:`, `preconditions:`, `postconditions:`, `property_ids:`.
- `tests/properties/visible/*` and `tests/properties/hidden/*` — property-based tests. Implementer will never see the hidden pool.
- `specs/behavioral/<concern>.md` for each non-functional concern with merge-blocking authority (performance, accessibility, ux, security).

**Property audit (adversarial, prose-only):** property-auditor (different model, isolated context) describes — in prose, not code — the most plausible wrong implementations that would still pass each property and the input domain that would exploit each. Operator encodes each as an additional hidden property. The auditor never writes code [revised-a.md role cleanup].

**Types-first principle** [borrowed from Stance B]: at module boundaries, encode invariants in the type system before writing a property. A compiling program is cheaper than a test run [inference; Parnas; Ousterhout]. Properties cover what types cannot reach.

### Phase 3 — Implementation via Lane Discipline (Week 2, Day 5 onward)

Every slice declares one of six lanes at the Framing Gate [revised-d.md §Work Lanes]:

**1. Ratchet-Advance** — normal feature / bug / hardening / debt-payoff work.
Declaration: goal, alternate-framing, failure-mode-reduced, files-expected-to-change, acceptance-evidence, expected-ratchet-advancement, rollback-path.
Pass criteria: all required ratchets preserve floors; declared ratchet advances in a way eligible for the declared failure mode; grounding gate passes; visible + hidden property suites pass; mutation score threshold met on touched modules; behavioral gates green.

**2. Equivalence Refactor** — pure-internals refactors preserving observable behavior.
Declaration: old behavior surface, equivalence checks, structural reason, maximum scope.
Pass criteria: equivalence holds; required ratchets do not regress; surface being used to prove equivalence is not weakened.

**3. Migration Escrow** — large changes with temporary, bounded regression.
Pre-approved plan required: target behavior, ratchets expected to regress + by how much, escrow limit, expiry date, rollback command, user-impact containment (feature flag / shadow mode), closing condition.
Regressing ratchets are marked "escrowed" — not silently lowered. Each commit inside the window must either preserve old/new equivalence, reduce migration checklist, or close an escrow item. Expiry = merges blocked in affected scope until closed, renewed with cooling-off, or rolled back.

**4. Discovery** — research spikes, ambiguous design, unspecifiable work.
Declaration: question, evidence that would answer it, options compared, stop criterion, artifact.
Ends in: decide / discard / extend-once-narrower / convert-to-implementation-plan.
Production code from spike is not merged directly — goes through Disposable or Ratchet-Advance lane for promotion.
Decision promotion requires non-implementing-model objection list.

**5. Disposable** — one-hour demos, throwaway scripts, sketches.
Isolated from production paths, secrets, real user data, deployment.
Expiration trigger: time, reuse, user exposure, dependency by durable code.
Promotion checklist: owner declares delete/archive/promote; dependencies registry-checked; minimal build/run captured; at least one behavioral or property check; test-smell gate for new tests; secrets review.

**6. Break-Glass** — emergency production repair.
Record: incident ID, operator, time, minimal diff, skipped gates, rollback path, observed production signal.
Normalization window: 24h (critical) / 72h (lower-risk). Convert to ratcheted change or next non-emergency merge in affected scope is blocked.

**Slice bound**: ≤30 min wall-clock for implementer portion [METR horizon findings]; decomposition via intermediate contract if exceeded.

**Framing Gate (mandatory)**: implementer writes slice brief before coding. Alternate-framing line required — for bugs, ≥1 alternate root cause; for features, the "do less" alternative; for refactors, the "do not refactor" risk. Anchoring defense [Nguyen 2024].

**Commit Gate**: machine-generated evidence block in commit message: Lane, Ratchet-Status, Acceptance-Evidence, Smell-Evidence, Protected-Surface, Escrow-ID (if applicable). Ledger generates; agent cannot.

**Independent Challenge Gate** (narrow cross-model layer): non-implementing model produces an objection list for ratchet changes, migration escrows, metric retirements, discovery decision promotions, UI acceptance packets, and any gate-loosening request. Output is objections + missing checks, not approval. Agreement between models is not independent proof [Knight & Leveson 1986].

**Closure Audit** (moderate, 30-60 min): operator compares `git diff` to `ACCEPTANCE.md`, reads auditor final report, validates each behavioral gate checkbox. Not line-by-line; not rubber-stamp.

### Phase 4 — First-Project Retrospective (end of Week N, project close)

At project close, operator writes `specs/retrospective-<project>.md`:
- Actual vs. projected time cost per phase (Phase 0, Phase 1, Phase 2, per-slice ongoing).
- How often each lane was used; lane mis-declarations caught by auditor.
- Tautological properties the auditor missed (discovered post-ship).
- Reward-hack attempts the methodology caught; any it missed.
- Goodhart-on-gaps incidents: failure modes that surfaced in production which had no ratchet.
- Pre-mortem signal readings: which P1-P10 signals lit up; which mitigations held.

Retrospective is required before applying the methodology to project N+1. If the retrospective signals an overrun of the 40% ergonomic ceiling (Reopen Condition #1 threshold), re-examine the decision.

## First-Project Artifacts (Deliverables)

At project close, the following artifacts must exist and be complete:

- `specs/domain.md` — stable synthesis of domain invariants.
- `specs/contracts/<module>.md` — one per seam; YAML frontmatter diff-checkable.
- `specs/adr/*.md` — decisions with reopen conditions.
- `specs/behavioral/<concern>.md` — one per merge-blocking non-functional concern.
- `specs/evidence.md` — Phase 0 historical record.
- `specs/risks.md` — accepted risks with reopen conditions.
- `tests/properties/visible/*` + `tests/properties/hidden/*` — property suites.
- `tests/mutation/config.*` — frozen mutation config.
- `ratchets/manifest.yaml` + `ratchets/history.jsonl` — versioned metrics + ledger.
- `ACCEPTANCE.md` + `PROJECT_STATE.md` + `CLAUDE.md` — operator-authored top-of-prompt artifacts.
- `specs/retrospective-<project>.md` — post-project honest evaluation.

## Transition to Build

This Explore run completes at `artifacts/result.md`. The first pilot project is treated as a Build circuit run with the methodology established by this decision governing the slice-level execution. The Build circuit's Frame → Plan → Act → Verify → Review → Close phases map naturally onto the methodology's Phase 0-3 structure; the methodology is the rulebook that governs what "Plan" and "Verify" mean at slice granularity.
