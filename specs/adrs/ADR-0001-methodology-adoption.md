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

## Addendum A — 2026-04-19 (Slice 25a): Methodology artifact portability

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

## Addendum B — 2026-04-20 (Slice 25d): D3 ADR-0001 Reopen — Phase 1.5 Alpha Proof

Installs **D3** from `specs/plans/phase-1-close-revised.md`. This addendum
is the explicit reopen/amendment of this ADR that D3 requires. Until it
landed, "Phase 1.5 Alpha Proof" was planning prose only, not authoritative
phase semantics.

**This addendum authorizes Phase 1.5 semantics. It does not itself close
Phase 1 or open Phase 1.5.** The phase transition is a later event that
occurs when Phase 1 close criteria below are all satisfied. Authorizing and
transitioning are deliberately separated: if this addendum also transitioned,
Phase 1 would close on a governance-only move, which D1 (Slice 25b) forbids
absent a D1 design-only proof with named next executable proof and expiry.
Keeping Phase 1 open at the 25d commit and transitioning it on a later
contract-authorship commit avoids that violation entirely.

### Reopen basis (one-time, Slice 25d)

None of the six original reopen conditions at §Reopen conditions above fired
for this amendment. The reopen basis is **operator directive, informed by
the in-session reflective pass between Claude and Codex recorded in
`specs/plans/phase-1-close-revised.md`**. That pass surfaced a specific
failure mode not anticipated when ADR-0001 was first accepted: **the
original Phase 1 → Phase 2 split leaves no room for executable product proof
between contract authorship and full implementation**, and the plan was
drifting toward closing Phase 1 on authored governance alone. D1
(installed Slice 25b) names that failure mode; D3 answers it with a
phase-graph amendment.

**This reopen basis is a one-time usage for Slice 25d and does not become
a standing seventh reopen condition.** A generic "plan reflection → phase
graph amendment" trigger would be a governance escape hatch: any future
planning session could claim a structural gap and amend phase topology.
Instead, this addendum adds condition 7 with concrete guardrails:

7. **Phase-graph amendment requested by operator** — acceptable only when
   all four hold: (a) a named failure mode the existing phase graph cannot
   absorb, (b) an explicit D1 impact analysis demonstrating the new phase
   does not itself re-introduce the failure D1 prevents, (c) a D10
   governance-class adversarial pass on the drafted addendum with opening
   verdict captured in the yield ledger, (d) a written statement in the
   addendum of why the failure cannot be handled inside an existing phase.
   Absent any of the four, the amendment is rejected and the phase graph
   stands.

### What changes — phase graph

**Before this addendum:** Phase 0 → Phase 1 → Phase 2.

- Phase 0 — Evidence Loop (time-boxed 1-5 days): prototype in `bootstrap/`,
  close with adversarial auditor review.
- Phase 1 — Contract authorship: author `specs/domain.md`,
  `specs/contracts/`, `specs/behavioral/`; property-auditor pass.
- Phase 2 — Implementation via lane discipline.

**After this addendum:** Phase 0 → Phase 1 → **Phase 1.5** → Phase 2.

Phase 0 and Phase 2 operational definitions are preserved verbatim from
the original Decision section. The Phase 1 definition is preserved; its
close condition is now precise (see §Phase 1 Close Inventory below). The
Phase 1 → Phase 2 transition becomes Phase 1 → Phase 1.5 → Phase 2.
Phase 2 no longer opens on contract-authorship close; Phase 2 opens only
when Phase 1.5 Alpha Proof closes.

**Phase 1.5 — Alpha Proof** (NEW, between Phase 1 and Phase 2):

**Purpose.** Prove the runner works end-to-end on a non-methodology
workflow before Phase 2 expands implementation. This is the phase in which
`dogfood-run-0` must succeed.

**Opens when** Phase 1 close criteria below are all satisfied. The
transition occurs on the commit that satisfies the last Phase 1 close
criterion (per the plan from HEAD 24b85d2, that is the Slice 27 narrowed
workflow contract slice, unless subsequent slices change the sequence).
**It does not occur on the commit that lands this addendum.**

**Scope.** Executable product proof: the runner loads a plugin-shipped
workflow fixture, writes an append-only event log, derives a snapshot by
replay, writes a manifest snapshot with byte-match semantics, and produces
a user-visible `result.json`. The slice sequence from HEAD 24b85d2 is
25d → 27 (narrowed contract authorship, last Phase 1 slice) → 27a
(read-only mining, Discovery) → 27b (baseline inventory) → 27c (runtime
boundary, Phase 1.5 begins here) → 27d (`dogfood-run-0`), per
`specs/plans/phase-1-close-revised.md`.

**Execution controls.** Phase 1.5 runs under the same lane discipline as
Phase 2: every slice declares one of the six lanes (Ratchet-Advance,
Equivalence Refactor, Migration Escrow, Discovery, Disposable,
Break-Glass); every slice passes `npm run verify` (tsc --strict + biome +
vitest) and `npm run audit` at current-tier enforcement; every
contract or governance edit lands in its own slice, not mixed with
runtime substrate work. Container isolation remains Tier 2+ deferred as
in Phase 2 — Phase 1.5 does not lower that bar. Cross-model challenger
dispatches per CHALLENGER-I5 remain in force. Product Reality Gate (D1)
applies at Phase 1.5 close: the phase cannot close on authored governance
alone; executable `dogfood-run-0` evidence is the product proof.

**Closes when** the §Phase 1.5 Close Criteria below are all satisfied.
Those criteria are the authoritative close terms — the plan at
`specs/plans/phase-1-close-revised.md` §Phase 1.5 Alpha Proof Close
Criteria is a mirror of this section, not the authority. If the two ever
disagree, this addendum wins and the plan must be corrected.

**Exit.** Phase 1.5 close opens Phase 2. Phase 2 operates exactly as
defined in the original Decision section — implementation via the six
lanes — with one refinement: anything structurally pre-requisite to
`dogfood-run-0` (runtime-boundary gate, append-only writer, reducer
snapshot, manifest byte-match) lands in Phase 1.5, not Phase 2, so that
Phase 2's first product slices inherit a safe runtime substrate rather
than laying one down.

### Phase 1 Close Inventory

Phase 1 close requires **both** (a) and (b) below:

**(a) Governance installed.** All of D1, D3, D4, D9, D10 are authoritatively
installed. At HEAD 24b85d2 + this addendum, that state is:

- D1 — installed via `specs/methodology/decision.md` §Methodology
  Amendments (2026-04-20, Slice 25b).
- D3 — installed via this addendum.
- D4 — installed via `specs/methodology/decision.md` §Methodology
  Amendments (2026-04-20, Slice 25b).
- D9 — installed via repo-root `TIER.md` (claim matrix), landed in
  Slice 25b.
- D10 — installed via `specs/methodology/decision.md` §Methodology
  Amendments (2026-04-20, Slice 25b) and
  `specs/reviews/adversarial-yield-ledger.md`.

D2, D5, D6, D7, D8 install triggers are scheduled post-Phase-1 per
`specs/plans/phase-1-close-revised.md` §Methodology Deltas; their absence
at Phase 1 close is not a Phase 1 close failure. They are Phase 1.5 or
Phase 2 concerns.

**(b) Contract authorship completed.** The remaining Phase 1 contract
scope at HEAD 24b85d2 is the Slice 27 narrowed workflow contract
(`specs/contracts/workflow.md` v0.2 narrowed to the subset needed for
`dogfood-run-0`). All other Phase 1 contracts (step, phase, run,
selection, adapter, skill, continuity, config) are already authored and
are not re-opened by this addendum. When Slice 27 lands, (b) is
satisfied; combined with (a), Phase 1 closes on that commit and Phase 1.5
opens on the same commit.

If the plan's slice sequence later identifies additional contract-authorship
work before Phase 1 close (e.g., a fold-in from a broader adversarial pass
that surfaces a missing contract), that work is added to (b) here by a
follow-up addendum, not by editing `decision.md` alone.

### Phase 1.5 Close Criteria (authoritative)

Phase 1.5 Alpha Proof closes when **all** of the following hold. The plan
at `specs/plans/phase-1-close-revised.md` mirrors this list; this list is
the authority.

1. D1, D3, D4, D9, and D10 are authoritatively installed; D2, D5, D6, D7,
   D8 are either installed according to their triggers or explicitly not
   yet triggered with the reason recorded.
2. The Product Gate exemption ledger at
   `specs/methodology/product-gate-exemptions.md` carries the Slice 25b
   seed row as a consumed one-time operator waiver (bootstrap exception),
   with `phase_id: phase-1.5-alpha-proof` (post-rewrite from
   `phase-1-pre-1.5-reopen`). No exemption row may consume a waiver for
   amending D1 or D3.
3. ADR-0001 is explicitly reopened/amended (this addendum) before any
   authoritative Phase 1 → Phase 1.5 or Phase 1.5 → Phase 2 semantic
   claim is made.
4. `dogfood-run-0` has run successfully at least twice from clean
   checkout state using two different fixtures or goals with differing
   `result.json` artifacts.
5. CLI loading of `.claude-plugin/skills/dogfood-run-0/circuit.json` is
   tested; the CLI verifiably loads a file the slice creates, not a
   file that existed before `dogfood-run-0` landed.
6. `state.json` is reducer-derived from `events.ndjson`; deleting one
   event creates a snapshot mismatch.
7. `events.ndjson` parses as `RunLog`; the event sequence is contiguous;
   `run.closed` appears once and last.
8. Manifest snapshot byte-match uses a named hash algorithm (SHA-256 over
   the exact persisted manifest snapshot bytes unless a stricter ADR
   names another) and fails on byte corruption.
9. Pinned ratchet floor (`specs/ratchet-floor.json`) and structured
   `current_slice` / `status_epoch` audit checks (Checks 17-19) are
   green before `dogfood-run-0` evidence is accepted. `npm run audit` at
   the close-evaluation commit exits 0.
10. README, PROJECT_STATE, and TIER cannot all be stale in the same way
    and still pass. This is enforced by Check 18 (Status docs current).
11. Every `TIER.md` claim names an enforcing file path, a planned slice,
    or an explicit `not claimed` declaration.
12. Any design-only Product Reality Gate proof during Phase 1.5 has an
    ADR naming the next executable proof and an expiry date bounded by
    D1 (2 slices or 14 calendar days from the recording ADR, whichever
    is sooner).
13. A broader adversarial pass includes at least one non-LLM evidence
    artifact.
14. (Amended by ADR-0006 as a one-time waiver + retarget.) Both
    (14a) operator product-direction check in durable artifact
    `specs/reviews/phase-1.5-operator-product-check.md`, and (14b)
    delegated LLM stand-in technical comprehension in
    `specs/reviews/phase-1-close-reform-human.md` with F17 weaker-
    evidence flag carried openly. The original non-LLM cold-read
    forcing function is **not** satisfied; ADR-0006 records this as
    a one-time waiver and substitutes weaker evidence of different
    shape. CC#15 preservation and reopen basis: see ADR-0006. The
    literal field requirements (`opened_scope`, `skipped_scope`,
    "I could not understand X") remain in force and are satisfied by
    the existing LLM stand-in sections.
15. No Phase 1.5 close criterion depends solely on Claude + Codex
    agreement.
16. Remaining 28a / 28b / 32 work is tagged Phase 2+ or v0.2 and not
    falsely claimed in `TIER.md`.

If any criterion is moved, relaxed, or deleted, the move lands here in
this addendum (or a superseding ADR), not in the plan alone. D4 binds
this direction.

### Authority clause — phase-graph semantics live in ADR-0001

**For phase-graph semantics only**, ADR-0001 is canonical. Specifically:

- If this addendum and `decision.md` disagree on Phase 1, Phase 1.5, or
  Phase 2 semantics or close criteria, this addendum wins. `decision.md`
  must be corrected to mirror.
- A future amendment to phase semantics (adding Phase 1.75, collapsing
  Phase 1.5 into Phase 2 close, retiring Phase 1.5 after one successful
  `dogfood-run-0`, etc.) must land in a new ADR addendum or a new ADR
  that supersedes this one. An edit to `decision.md` alone is not
  sufficient and must be rejected on review.
- **`decision.md` alone cannot redefine Phase 1, Phase 1.5, or Phase 2.**
  This is the acceptance clause the plan's Slice 25d deliverable names.

This clause is scoped to phase-graph semantics. Other standing methodology
rules (D1–D10 themselves, lane definitions, ratchet rules, audit-gate
semantics, etc.) may still be authored in `decision.md` per D4 —
`decision.md` is not demoted to a pure mirror surface.

Machine enforcement: `scripts/audit.mjs` Check 20
(`checkPhaseAuthoritySemantics`, added in this slice) — if `decision.md`
mentions "Phase 1.5", it must cite ADR-0001 Addendum B; if README or
PROJECT_STATE claim Phase 1.5 but ADR-0001 lacks an Addendum B heading,
the check goes red. This is the phase-graph authority ratchet advanced
by this slice.

### What this addendum does NOT change

- Original Decision section (Contract-First + Tiny-Step-Ratcheting +
  Architecture-First + Narrow Cross-Model Challenger) is unchanged.
- Original §Rationale, §Tournament outcome, §Consequences (Accepted,
  Enabling, Deferred) are unchanged.
- Original §Reopen conditions 1–6 are preserved verbatim; this addendum
  appends condition 7 with guardrails, above.
- Addendum A (methodology artifact portability, 2026-04-19 Slice 25a) is
  unchanged.
- D1, D4, D9, D10 installed in Slice 25b via
  `specs/methodology/decision.md` §Methodology Amendments (2026-04-20,
  Slice 25b) are unchanged. D3 is installed via this addendum.

### Backwards-compatibility note for pre-addendum citations

Pre-addendum references in the codebase to "Phase 1 close" now resolve to
"Phase 1 contract-authorship close" (governance + remaining contracts per
§Phase 1 Close Inventory). Pre-addendum references to "Phase 2 entry" now
resolve to "Phase 2 entry, which requires Phase 1.5 close." These are
rewording rules for reading the older prose; the older prose is not
edited retroactively unless it becomes materially misleading. Slices
touching such prose for other reasons should update in passing.

### Consequences

**Accepted.** An additional phase transition extends the Phase 1 → Phase 2
calendar; this is the cost of honest alpha-proof gating. Planning prose
across `specs/plans/`, `TIER.md`, README, PROJECT_STATE, CLAUDE.md, and
`product-gate-exemptions.md` must now spell "Phase 1.5" where it
previously said "Phase 1 pre-1.5-reopen". Those edits land in the same
slice as this addendum, coordinated so the phase-line audit (Check 9)
stays green.

**Enabling.** `specs/methodology/product-gate-exemptions.md` `phase_id`
column now takes the value `phase-1.5-alpha-proof`; the Slice 25b seed
row's `phase_id` is rewritten in this slice from `phase-1-pre-1.5-reopen`
to `phase-1.5-alpha-proof`, with `scripts/audit.mjs` Check 10
(`checkProductRealityGateVisibility`) and
`tests/contracts/governance-reform.test.ts` updated in the same commit
to accept the new canonical value. The authoritative Phase 1.5 Close
Criteria above become the binding acceptance terms for Phase 1.5 close
review.

**Deferred.** D2, D5, D6, D7, D8 install triggers are unchanged
(`specs/plans/phase-1-close-revised.md` §Methodology Deltas). Adding them
without their triggers would re-create the "install methodology instead
of shipping product" failure D1 was installed to prevent.

### Lane and ratchet declaration

Slice 25d lane: **Ratchet-Advance**. Ratchet advanced: **phase-graph
authority ratchet** — Phase 1.5 cannot be claimed unless ADR-0001 Addendum
B, `decision.md` mirror section, and README / PROJECT_STATE phase lines
all agree. Machine-enforced by new Check 20
(`checkPhaseAuthoritySemantics`) and existing Check 9 (`checkPhaseDrift`).
The ratchet is first established in this slice; future regression
(deleting Addendum B while `decision.md` still claims Phase 1.5, or
decision.md drifting from ADR) is caught at audit-time.

### Provenance

This addendum is authored by Claude + operator, reviewed by Codex via the
`/codex` skill per CHALLENGER-I5 ADR-authorship discipline. Codex's
objection list lands at `specs/reviews/adr-0001-addendum-b-codex.md` —
opening verdict REJECT PENDING FOLD-INS with 5 HIGH / 7 MED / 4 LOW / 1
META; all HIGH, MED, and LOW incorporated; closing verdict ACCEPT-WITH-FOLD-INS.
The pass is recorded in `specs/reviews/adversarial-yield-ledger.md` as a
governance-class pass on a new artifact
(`specs/adrs/ADR-0001-methodology-adoption.md` Addendum B); pass counter
resets per D10 "new artifact" rule.
