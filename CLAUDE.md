# Agent Guide — circuit-next

This file is agent-facing guidance for working on `circuit-next`. Keep under **300 lines**; anything longer goes in `specs/` with a pointer here.

## The one-paragraph mental model

`circuit-next` is a Claude Code plugin that turns common developer and creative
workflows (explore, build, repair, migrate, sweep, and user-authored custom
ones) into configurable automations. Configuration is declarative: per-step
you can set model, reasoning effort, skills to apply, and invocation options;
user-global config sets defaults and overrides. The plugin itself is being
built using the same methodology it exposes — contract-first specs,
architecture-first types at boundaries, tiny-step lane-disciplined slices,
and a narrow cross-model challenger.

## Core methodology (do not abbreviate)

The methodology is authoritative at `specs/methodology/decision.md`, with
Slice 7 amendments in `specs/adrs/ADR-0003-authority-graph-gate.md`. Every
agent slice must honor it. Four pillars:

1. **Contract-First core (conditional).** For **greenfield** surfaces,
   truth lives in executable specs + property tests authored before
   implementation. For **successor-to-live**, **legacy-compatible**,
   **migration-source**, or **external-protocol** surfaces, contract
   authorship is **blocked** until ADR-0003 authority-graph classification
   is complete. Before drafting any contract, classify every touched
   artifact in `specs/artifacts.json` and bind the contract frontmatter to
   `artifact_ids`. Clean break is allowed, but it must be explicit;
   **clean break does not mean greenfield**. See
   `specs/artifacts.md` for the graph and ADR-0003 for the full gate.
2. **Tiny-Step-Ratcheting lane discipline.** Every slice declares one of six
   lanes: Ratchet-Advance, Equivalence Refactor, Migration Escrow, Discovery,
   Disposable, Break-Glass. Slices are bounded to ≤30 min wall-clock.
3. **Architecture-First types at module boundaries.** Prefer types over tests
   when types can express the invariant. `tsc --strict` is the first line of
   defense against local-coherence/global-incoherence failures.
4. **Narrow cross-model challenger.** A different model (Codex) produces an
   objection list — not an approval — for: ratchet changes, contract-relaxation
   ADRs, migration escrows, discovery-decision promotion, and any request to
   loosen a gate. This is **adversarial lint, not independent corroboration**.
   Claude and Codex share training distribution; Knight & Leveson 1986
   shows correlated failures, not independent ones. The challenger cannot
   replace authority mapping, live/reference evidence, fixture parity
   where compatibility is required, or state-machine/property tests.

## Phase discipline

- **Phase 0 — Evidence Loop** (current). Prototype in `bootstrap/` under
  minimal constraints. Output: `specs/evidence.md`. Close with adversarial
  auditor review before entering Phase 1.
- **Phase 1 — Contract authorship.** Draft `specs/domain.md`, then
  `specs/contracts/<module>.md` with YAML frontmatter enumerating invariants,
  pre/postconditions, and `property_ids`. Behavioral concerns go in
  `specs/behavioral/<concern>.md`. Adversarial property-auditor (different
  model) emits prose tautology attacks; operator encodes each as a new
  property.
- **Phase 1.5 — Alpha Proof** (inserted by ADR-0001 Addendum B, Slice 25d).
  Executable product proof between contract authorship and full
  implementation. Runs `dogfood-run-0` end-to-end under the same lane
  discipline as Phase 2. Close criteria are authoritative in ADR-0001
  Addendum B.
- **Phase 2 — Implementation.** Lane-disciplined slices. Entry gated by
  Phase 1.5 close, not Phase 1 close. Implementer runs in a container with
  distinct UID; `specs/`, `tests/properties/visible/`, `tests/mutation/`,
  `specs/behavioral/`, CI configuration mounted read-only;
  `tests/properties/hidden/` not mounted at all.

Tier 2+ tooling (container isolation, mutation testing, property suites,
anti-Goodhart ratchet machinery, hidden test pool) is **explicitly deferred**
from Tier 0 scaffold.

## Lane discipline — framing gate

Before implementing, declare in the slice commit or slice PR:

| Lane | When | Merge semantics |
|---|---|---|
| **Ratchet-Advance** | New capability that advances a ratchet | All ratchets must not regress; this one must strictly advance |
| **Equivalence Refactor** | Pure restructuring, semantics preserved | Behavioral invariants preserved; characterization tests hold |
| **Migration Escrow** | Known-incomplete transition | Temporary floor reduction; hard expiry; renewal requires solo-approval protocol |
| **Discovery** | Research spike, answer unknown up front | Throwaway or promotion; no ratchet enforcement during slice |
| **Disposable** | One-off script, demo, throwaway | No contract or property requirements; never deployed |
| **Break-Glass** | Production incident only | Post-hoc ADR + evidence backfill within 48h |

**Every slice framing** must also name: the failure mode being addressed,
the acceptance evidence (what would prove it worked), and an **alternate
framing** (defense against anchoring — Nguyen 2024).

**Trajectory check (before the framing triplet).** Restate in one line each:
what arc goal this slice serves, what phase goal that arc serves, and whether
any earlier-completed slice has made this one smaller, obsolete, or
mis-sequenced. Alternate framing guards against anchoring within the slice;
the trajectory check guards against arc-level drift when earlier slices shift
the terrain. Three sentences at slice open, no new artifact.

## Session hygiene

- `CLAUDE.md` stays under 300 lines; longer content goes to `specs/` with a
  pointer here.
- Compaction is **disabled** on this repo. Treat session as long-horizon;
  artifact-based resume is the recovery path.
- `PROJECT_STATE.md` is the live snapshot. Update it when phase state
  changes, when a decision is recorded, or when a session ends.
- Slices ≤ 30 min wall-clock. Coordinated edits compose under a single ADR.

## After-slice operator summary

After each slice lands, give the operator a plain-English wrap-up.
Three short beats, in order:

1. **What got done.** One or two sentences on what the slice actually
   accomplished.
2. **What's next.** The next concrete thing to do.
3. **How much is left.** Roughly — near the end of this phase, middle,
   or a lot to go.

**Write it like you'd explain it to someone walking up to your desk.**
No project-internal shorthand — no lane names, close-criterion numbers
(`CC#14`, `D10`, `F17`), ADR ids, slice codenames (`DOG+2`, `P2-MODEL-
EFFORT`), phase-transition terminology (`ceremony commit`), or
gate/ratchet/audit vocabulary. If a name matters, describe what it *is*
in plain words. Pointers to plan files are fine when the operator might
want to verify, but make them optional reading rather than the summary
itself.

Keep the audit numbers (pass counts, test delta) as a one-liner before
the summary so the operator gets status at a glance — then the
plain-English beats carry the meaning.

## Verification commands (Tier 0)

```bash
npm run check   # tsc --noEmit (architecture check)
npm run lint    # biome check
npm run test    # vitest (contract tests)
npm run verify  # all of the above
npm run audit   # drift-visibility audit across recent commits
```

The first four gates must all pass before any commit in a Ratchet-Advance
or Equivalence Refactor lane.

`npm run audit` reports on discipline health: lane declaration, framing
triplet (failure mode / acceptance evidence / alternate framing), citation
rule (ADR-0002), Circuit-as-justification smell, `.circuit/` gitignore
compliance, contract test ratchet, PROJECT_STATE.md freshness, and the
verify gate. It exits non-zero on any red finding. Run it whenever
confidence needs a cheap sanity check, or when onboarding a fresh session.

## Where things live

| Artifact | Path | Phase |
|---|---|---|
| Tournament methodology artifacts | `specs/methodology/` (symlinks) | Pre-Phase-0 |
| Phase 0 evidence drafts | `bootstrap/evidence-draft-*.md` | Phase 0 |
| Prior-art audit of in-repo docs | `bootstrap/prior-art-audit.md` | Phase 0 |
| External prior-art synthesis | `bootstrap/external-evidence-synthesis.md` | Phase 0 |
| Phase 0 final synthesis | `specs/evidence.md` | Phase 0 close |
| Ubiquitous-language glossary | `specs/domain.md` | Phase 1 |
| Module contracts | `specs/contracts/<module>.md` | Phase 1 |
| Behavioral concerns | `specs/behavioral/<concern>.md` | Phase 1 |
| Risks ledger | `specs/risks.md` | All phases |
| ADRs | `specs/adrs/ADR-<nnnn>-<slug>.md` | All phases |
| Type skeleton | `src/types/` | Architecture-First |
| Zod schemas | `src/schemas/` | Contract-First runtime |
| Contract tests | `tests/contracts/` | Phase 1+ |
| Property tests (visible) | `tests/properties/visible/` | Tier 2+ |
| Property tests (hidden) | `tests/properties/hidden/` | Tier 2+ (not mounted to implementer) |
| Unit tests | `tests/unit/` | All phases |
| Plugin manifest | `.claude-plugin/plugin.json` | Phase 1+ |

## Cross-model challenger protocol

When you need a challenger pass — for any ratchet change, ADR, escrow,
discovery promotion, or gate loosening — dispatch the challenger through
`/codex` skill (pipes to `codex exec` via the shared wrapper script). Never
use the `codex:rescue` subagent. The challenger's job is an **objection
list**, not approval. Document the response in the originating commit or ADR.

## Cross-slice composition review cadence

Per-slice challenger passes are necessary but not sufficient: each slice
is locally honest about its own scope, but boundary seams between slices
only surface in the aggregate. Empirical basis: the Phase 2 foundation
composition review (`specs/reviews/p2-foundation-composition-review.md`,
2026-04-21) found five HIGH boundary-seam failures that no individual
slice owned — after every slice passed its own challenger pass.

**Rule.** At the close of any arc spanning ≥ 3 slices, commission a
composition review **before** the next privileged runtime slice opens.
Same two-prong protocol as per-slice review: fresh-read Claude
composition-adversary pass + Codex cross-model challenger via `/codex`.
Same verdict vocabulary: REJECT-PENDING-FOLD-INS / ACCEPT-WITH-FOLD-INS /
ACCEPT. Verdict must land in `specs/reviews/` with authoritative scope.

**Privileged runtime slice** means: any slice that lands or modifies a
runtime adapter, an event-writing code path, a dispatch boundary, or a
gate/audit-check that admits or rejects privileged operations. The arc
preceding such a slice is where silent cross-slice drift compounds.

**First instance.** The pre-P2.4 fold-in arc at
`specs/plans/phase-2-foundation-foldins.md` (Slices 35–40) carries its
own arc-close composition review before P2.4 reopens. Enforced by
`scripts/audit.mjs` Check 26 (`checkArcCloseCompositionReviewPresence`):
once `PROJECT_STATE.md` `current_slice` advances to 40 or beyond, a
file under `specs/reviews/` matching the arc-close naming pattern must
exist with closing verdict ACCEPT or ACCEPT-WITH-FOLD-INS. Check 26 is
narrow to this first arc; subsequent arcs either extend the check or
land a generalized arc-ledger gate.

## Hard invariants

These are non-negotiable without reopening the methodology decision:

1. Container isolation or distinct-UID sandboxing for implementer (deferred
   Tier 2; when landed, enforced).
2. `specs/` and `tests/properties/visible/` read-only to implementer
   container.
3. `tests/properties/hidden/` never mounted to implementer container.
4. No `--no-verify`, `--no-gpg-sign`, or skip-hooks flags without a
   Break-Glass lane declaration.
5. ADR required for any relaxation of a contract, ratchet floor, or gate.
6. Cross-model challenger required for any ratchet change.
7. Every external-package identifier backed by installed type stubs,
   docstrings, `.d.ts`, or an end-to-end call test.
8. No aggregate scoring across ratchets; each dimension tracked
   independently.
9. Versioned ratchet floors with overlap windows on metric replacement.
10. `CLAUDE.md` ≤ 300 lines.

See `specs/risks.md` for the full accepted/open risks ledger.

## Current status

See `PROJECT_STATE.md`. Treat that file as authoritative over any recollection
you have from a prior session.

## Reference implementation

The previous-generation Circuit is at `~/Code/circuit`. It is **read-only**
reference during circuit-next development. Do not modify it. If an insight
requires modifying Circuit itself, defer to a post-circuit-next migration
plan.
