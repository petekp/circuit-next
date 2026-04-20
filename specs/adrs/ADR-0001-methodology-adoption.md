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
ran a tournament-rigor Circuit Explore (originally at
`.circuit/circuit-runs/design-a-methodology-for-llm-assisted-project-deve/`
and symlinked into `specs/methodology/`; inlined as committed Markdown
copies by the 2026-04-19 Slice 25a addendum — see below) evaluating four
orthogonal methodological stances under adversarial stress-testing.

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

## Addendum — 2026-04-19 (Slice 25a): Methodology artifact portability

Closes **FUP-1** from `specs/plans/arc-remediation-plan-codex.md §Slice 25a`.
Q2 council disposition binding: artifacts inlined as committed Markdown, not
externally referenced.

### What changed

The five files under `specs/methodology/` — `analysis.md`, `brief.md`,
`decision.md`, `plan.md`, `result.md` — were tracked as absolute symlinks into
`/Users/petepetrash/Code/.circuit/circuit-runs/.../artifacts/`. On any clone
(including a fresh checkout on the author's own machine in a different
working copy) those links resolved to broken paths and the methodology
artifacts stopped being readable.

Slice 25a replaced the five symlinks with committed Markdown copies. Each
copy carries a YAML frontmatter block whose body content matches the
original artifact (the frontmatter block plus a single trailing blank line
precede the body; everything after the second `---` delimiter is
byte-identical to the source). The frontmatter key is
`original_artifact_path`, intentionally not `source`, to prevent future
tooling from treating the path as an operative input. The path is
**non-operative provenance** — host-local, possibly nonexistent on any
other machine, preserved only for audit trail. The repository copy is
authoritative.

### Policy: inline over symlink for any authored surface under `specs/`

1. **No absolute symlinks may exist under `specs/`**, AND no relative
   symlinks whose resolved target escapes the repository root. Both are
   rejected by `scripts/audit.mjs::checkSpecsPortability` (Check 11 of the
   audit) and exercised by `tests/contracts/specs-portability.test.ts`. The
   test constructs both an absolute-target fixture and a repo-escaping
   relative-target fixture and asserts each is flagged. Fail reason is
   carried on each violation (`absolute` vs `escapes-repo`).
2. **Repo-contained relative symlinks are permitted** but should be
   justified; inline copies remain the default. The guard distinguishes
   `./sibling.md` (allowed) from `../../../host/path` (rejected) via
   `path.relative(repoRoot, resolvedTarget)` containment.
3. **External provenance is frontmatter-only.** If a file under `specs/` is
   derived from an out-of-tree artifact (Circuit run, external research,
   vendored spec), the absolute run-root path goes in the frontmatter as
   `original_artifact_path` with a `provenance_note` disclaimer. Body
   content is authoritative; the path is an audit trail only.
4. **Regenerating from the run-root is not a recovery path.** The
   circuit-runs directory is not part of the repo's authority surface and
   may be pruned at any time. The repository copy is canonical.

### Scope: why `specs/` and not the whole repo

The portability guard targets `specs/` because `specs/` is the authority
surface for Phase 2 implementation (see ADR-0003 on the authority graph).
A clone that cannot read the contracts, domain model, methodology, or
ADRs cannot be a downstream authority source. Other directories — `tests/`,
`scripts/`, `src/` — are enforcement surfaces whose portability matters
differently and whose regression mode is immediately visible (verify or
CI fails). The audit does not today scan beyond `specs/`, and at the
current state of the repo `git ls-files -s | awk '$1==120000'` returns
empty across the tree.

**Expansion condition.** Extend the portability guard to other directories
if any of: (a) an absolute symlink regression appears outside `specs/`;
(b) a future slice introduces symlinks under `scripts/` or `tests/` as a
pattern; (c) Phase 2 substrate work (containerization, sandbox harness)
makes non-`specs/` portability load-bearing. Until one of those triggers
fires, the narrower scope is the slice's minimal-viable portability fence.

### Scope: what Slice 25a did NOT inline

Slice 25a inlines only the five top-level authored artifacts under
`specs/methodology/`: `analysis.md`, `brief.md`, `decision.md`, `plan.md`,
`result.md`. The Circuit run that produced them also contains a
`phases/{diverge,review,revise,stress}-{a,b,c,d}/reports/` tree of
tournament-phase artifacts (proposals, adversarial reviews, author
revisions, stress tests). Those are **explicitly out of scope** for this
slice — they are deep evidence for the decision already captured in the
five inlined files, and inlining them would balloon the slice well past
the 30-minute lane bound for negligible authority-surface gain. Any
future slice that needs to cite a specific proposal/review/revise/stress
artifact should inline that artifact the same way (frontmatter with
`original_artifact_path`) or introduce a repo-contained reference
directory at that time.

Consequently, the inlined files contain prose references (e.g., to
`phases/diverge-{a,b,c,d}/reports/proposal-*.md`, `artifacts/decision.md`)
that resolved within the original Circuit run but have no counterpart in
the repository. These are treated as historical citation markers, not as
operative cross-links.

### Authority-graph classification

The five inlined files are **governance/reference surfaces**, not runtime
contract surfaces under the ADR-0003 authority graph. They do not appear
in `specs/artifacts.json` and are not bound to Zod schemas or module
contracts. Their role is to anchor the methodology itself; the authority
graph concerns runtime artifacts and their persisted shapes. If a future
slice promotes methodology content into a runtime contract (for example,
encoding lane definitions as a machine-readable manifest), that content
moves into the authority graph at that point — the inlined files remain
as historical record.

### Why not keep symlinks?

- The repo is expected to serve as an authority surface for Phase 2
  implementation (see ADR-0003). An authority surface that cannot be cloned
  intact invalidates the methodology's "persistent project-scope artifacts
  bridge session boundaries" hard invariant (`specs/methodology/analysis.md`
  Hard Invariant 5).
- "Regenerate the Circuit run on demand" is not honest portability — it
  requires the original Claude/Codex session and external tool configuration
  that no longer exists in reproducible form.
- External-reference models (git submodule, separate provenance registry)
  were rejected at Q2 council disposition: they solve a problem the repo
  does not have (content size), at the cost of the one the repo does have
  (cloneability).

### Enforcement

- `npm run audit` Check 11 (Specs portability) reports red if any absolute
  or repo-escaping symlink appears under `specs/`.
- `tests/contracts/specs-portability.test.ts` asserts four things:
  (a) `specs/` is portable today; (b) `specs/methodology/` holds exactly
  five entries tracked as regular blobs (mode `100644`, never `120000`);
  (c) `findAbsoluteSymlinks()` flags constructed fixtures for both
  violation reasons (`absolute` and `escapes-repo`); (d) a wiring-parity
  check that `scripts/audit.mjs::main()` calls `checkSpecsPortability` and
  pushes its result into `findings`, preventing silent removal of the
  dimension while the helper tests stay green.
- A fifth test asserts the frontmatter shape on each of the five inlined
  files: `original_artifact_path`, `source_kind`, `provenance_note`,
  `inlined_at`, `inlined_in_slice`, `inlined_via_adr` must all be
  present, and `source_kind` must be `circuit-run-artifact`.
- `git ls-files -s specs/methodology` reports mode `100644` for every
  entry — no `120000` symlink blobs.

### Provenance mapping

| Repo path | `original_artifact_path` (non-operative) |
|---|---|
| `specs/methodology/analysis.md` | `.circuit/circuit-runs/design-a-methodology-for-llm-assisted-project-deve/artifacts/analysis.md` |
| `specs/methodology/brief.md` | same run-root / `brief.md` |
| `specs/methodology/decision.md` | same run-root / `decision.md` |
| `specs/methodology/plan.md` | same run-root / `plan.md` |
| `specs/methodology/result.md` | same run-root / `result.md` |

The run-root itself is not part of the repository and may not exist on a
clone. The frontmatter `original_artifact_path` field records the path
for audit trail purposes only. The key name is deliberately not `source`
to avoid implying an operative derivation relationship.
