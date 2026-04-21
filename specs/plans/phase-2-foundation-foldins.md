---
name: phase-2-foundation-foldins
description: Pre-P2.4 foundation repair arc — folds in the five HIGH findings of the Phase 2 foundation composition review (specs/reviews/p2-foundation-composition-review.md) before the real agent adapter crosses into runtime dispatch authority. Six named slices plus a methodology upgrade opener and an arc-close cross-slice composition review. P2.4 remains DEFERRED until this arc closes.
type: plan
date: 2026-04-21
authored_by: claude-opus-4-7
base_commit: 7d65f8b02b81f237ee5d3d2b1e576c6238451014
supersedes_scope:
  - (none — arc-level plan; does not supersede specs/plans/phase-2-implementation.md, adds a pre-P2.4 arc ahead of P2.4's listed slot)
does_not_supersede:
  - specs/plans/phase-2-implementation.md §P2.4 (P2.4 scope gains the HIGH 3 capability-boundary constraint but the slice itself is unchanged in position)
  - specs/plans/phase-2-implementation.md §P2.5+ (downstream slices unchanged)
status: active — drafted 2026-04-21 post-composition-review (REJECT-PENDING-FOLD-INS); operator accepted Codex second-opinion plan (widen-over-weaken for HIGH 2 / CC#P2-2); P2.4 formally DEFERRED until this arc closes
review_authority:
  - specs/reviews/p2-foundation-composition-review.md (Claude self-review + Codex challenger; 5 HIGH / 5 MED / 2 LOW / 2 META; closing verdict REJECT-PENDING-FOLD-INS)
  - Codex session 019db094-5cfa-7383-a8ca-fcb0d0ed1e44 (second-opinion sequencing; 6-step arc + widen-over-weaken recommendation)
---

# Phase 2 foundation — pre-P2.4 fold-in arc (2026-04-21)

## Why this plan exists

The Phase 2 foundation — three slices landed overnight 2026-04-21 (P2.1
ADR-0007 governance, P2.2 plugin surface, P2.3 explore contract +
fixture) — passes slice-individual review but fails **composition
review**. The aggregate exposes five HIGH boundary-seam failures that
no individual slice owned. Running P2.4 (real agent adapter) on this
foundation would either smuggle architectural decisions into the first
privileged runtime slice, or produce an adapter the target `explore`
workflow cannot actually dispatch to.

This plan names the fold-in arc that closes those HIGHs **before** P2.4
reopens. It also folds in the methodology upgrade the review itself
surfaced: the composition view was the right move, so the mechanism
for running it at arc boundaries needs to land in the discipline
surface, not stay one-off.

Operator decision 2026-04-21 (continuity record
`continuity-8634130a`): widen-over-weaken for HIGH 2 (widen the event
schema to match ADR-0007 CC#P2-2 rather than amend the ADR down to
schema); methodology upgrade lands **before** the first fold-in slice
ships; P2.4 deferred.

## The five HIGH findings this arc closes

Full evidence and fix hints are authoritative in
`specs/reviews/p2-foundation-composition-review.md §HIGH 1..5`.
One-line summaries only:

1. **HIGH 1 — explore has no step that dispatches.** Every fixture
   step is `executor: "orchestrator"` + `kind: "synthesis"`; runtime
   dispatch authority is `kind: "dispatch"` + `executor: "worker"`.
   P2.4's adapter would land correctly-tested and never be invoked.
2. **HIGH 2 — ADR-0007 CC#P2-2 names four event kinds the schema
   doesn't define.** `dispatch.request`, `dispatch.receipt`,
   `dispatch.result` are referenced in ADR but absent from
   `src/schemas/event.ts`. CC#P2-2 is literally unsatisfiable today.
3. **HIGH 3 — trigger #6 is defeatable by incantation.** Capability
   check is a commit-body string match, not a tool-use permission
   audit. P2.4 could land with file-write capability and stay audit-
   green.
4. **HIGH 4 — `explore.result` and `run.result` collide on the same
   backing path.** Both registered at `<run-root>/artifacts/result.json`;
   two writers, one file.
5. **HIGH 5 — Check 24 passes structurally broken fixtures.**
   EXPLORE-I1 says "runtime MUST reject" but Check 24 hand-parses JSON
   without calling `Workflow.safeParse`; runtime fixture loading also
   skips the kind-policy check.

## Entry state — what landed before this arc

Base commit: `7d65f8b` (post-slice-34 = P2.3). Green audit: 23 green /
1 yellow (pre-existing docs framing warning) / 0 red. Tests: 793.
Working tree: `specs/reviews/p2-foundation-composition-review.md`
untracked (the review file itself — ceremony commit lands in Slice 36).
Codex composition-review transcript lives at `/tmp/codex-composition-
review/output.md` (14,895 lines; 269,716 tokens; session
019db094-5cfa-7383-a8ca-fcb0d0ed1e44) and must be archived in Slice 36
before reboot.

## The fold-in arc — six slices plus arc-close review

Slices numbered in intended execution order. Each slice authors its
own framing at landing per lane discipline; this plan locks scope,
authority, and acceptance evidence only. Re-ordering is permitted if
an earlier slice exposes surface that makes a later slice smaller,
obsolete, or mis-sequenced (per CLAUDE.md §Lane discipline trajectory
check).

### Slice 35 — Methodology upgrade + tracked review opener (merged at slice framing)

**Lane:** Ratchet-Advance (discipline ratchet + audit-coverage ratchet;
authoring the discipline the rest of this arc will be graded against,
in the same commit that tracks the review triggering the arc).

**Merge rationale (fold-in Slice 35 Codex HIGH 5).** Originally planned
as Slices 35 and 36. Codex challenger objected that Slice 35 cites
authority (`specs/reviews/p2-foundation-composition-review.md`) that is
not yet tracked; a fresh checkout would contain code + discipline text
pointing at a missing file. Merge resolves the citation gap while
preserving the "methodology upgrade before any HIGH-fix slice" operator
constraint — the review is not a HIGH-fix, it is the evidence authority
that the methodology upgrade cites.

**Why first.** Per operator constraint (continuity debt-markdown entry
7): "methodology upgrade should land BEFORE the first foundation fold-in
slice ships. Reason: otherwise we author the fold-ins under the same
discipline that let the HIGHs through originally." The composition
review was valuable because no single slice owned the boundary seams;
the mechanism that triggers such a review at arc boundaries belongs in
the discipline surface, not in the operator's head.

**Deliverable:**
- **Backing-path integrity audit check** in `scripts/audit.mjs` (new
  Check 25 — renamed from "registry-transitive" per Codex LOW 1; that
  phrase overstated coverage). Walks the artifact graph in
  `specs/artifacts.json` and flags any two artifacts whose normalized
  `backing_paths` collide. Normalization collapses template-prefix
  synonyms (e.g. `<circuit-next-run-root>` → `<run-root>`), path-segment
  redundancies (`/./`, doubled slashes), and trailing parenthetical
  comments.
- **Container-path allowlist** with collision-class-specific entries
  (fold-in Codex HIGH 3): each container path carries a closed
  `allowed_artifact_ids` set; sharers outside that set are red even
  for container paths.
- **Tracked-collision allowlist** with lifecycle enforcement (fold-in
  Codex HIGH 2): stale entries (no matching live collision) → red,
  forcing deletion when the closing slice resolves the collision.
  Malformed artifact rows → red (fold-in Codex MED 3): fail closed, do
  not silently skip.
- **Arc-close composition-review audit binding** (fold-in Codex HIGH 4)
  in `scripts/audit.mjs` (new Check 26). Narrow to this arc: once
  `PROJECT_STATE.md` `current_slice` advances to Slice 40 or beyond, an
  arc-close composition review file must exist under `specs/reviews/`
  with closing verdict ACCEPT or ACCEPT-WITH-FOLD-INS.
- **Arc-close composition-review cadence** as a discipline rule in
  `CLAUDE.md §Cross-slice composition review cadence` (new section):
  at the close of any arc spanning ≥3 slices, commission a composition
  review before the next privileged runtime slice opens. Cites this
  arc as the first instance.
- **Tracked review opener (merged from originally-planned Slice 36):**
  `git add specs/reviews/p2-foundation-composition-review.md` +
  archive `/tmp/codex-composition-review/output.md` (14,895-line
  challenger transcript) to
  `specs/reviews/p2-foundation-composition-review-codex-transcript.md`
  as a tracked sibling. Main review's transcript citation updated to
  the in-repo archive location.
- Contract test suite under `tests/contracts/
  artifact-backing-path-integrity.test.ts` exercising normalize helper,
  check function (all green/yellow/red paths including stale-allowlist,
  container-id gating, malformed rows, re-introduction class), check 26
  arc-close presence gate, and allowlist structure invariants. Also
  regression guard on live repo artifact graph.
- Append row to `specs/reviews/adversarial-yield-ledger.md` (per
  convention established slices 32/33/34).

**Acceptance evidence:**
- Check 25 may return **yellow** on live repo for the pre-existing
  tracked HIGH 4 collision ({explore.result, run.result} at
  `<run-root>/artifacts/result.json`, closing slice 39). Acceptance
  criterion is **red-free**, not green-only. Arc-close acceptance
  requires Check 25 **green** (no tracked collisions remaining) — see
  §Acceptance evidence for arc close. (Plan text amendment fold-in
  Codex MED 2 / HIGH 1: the original "green on live repo" acceptance
  bar was stricter than the implementation; this amendment reconciles.)
- Check 26 green on live repo (arc still in progress, so gate is
  informational-pass until Slice 40 lands).
- Contract tests pass end-to-end, including stale-allowlist and
  unauthorized-container-sharer negative fixtures.
- CLAUDE.md amendment with cadence rule + Check 26 binding citation.
- `specs/reviews/p2-foundation-composition-review.md` + transcript
  sibling tracked.
- Adversarial-yield-ledger row present.

**Alternate framing:** defer methodology upgrade to arc-close (after
all five HIGHs fold in), on the theory that a clean signal from the
fold-in slices is worth more than a discipline upgrade mid-flight.
Rejected because the operator constraint is explicit: "otherwise we
author the fold-ins under the same discipline that let the HIGHs
through originally." The cheaper discipline upgrade (two audit checks
+ one doc amendment + tracked review ceremony) is worth landing first.

**Codex challenger pass:** **required** per CLAUDE.md §Hard invariants
#6 (ratchet change). Landed as
`specs/reviews/arc-slice-35-methodology-upgrade-codex.md`; opening
verdict REJECT-PENDING-FOLD-INS (5 HIGH / 3 MED / 2 LOW / META);
closing verdict ACCEPT-WITH-FOLD-INS after all HIGH/MED/LOW folded in.

**Authority:** CLAUDE.md §Hard invariants #6 + #8; composition review
§META 2 (layer-boundary failures are the recurring mode) + §HIGH 4
(backing-path collision is the class this check catches).

### Slice 37 — HIGH 2 fold-in: widen event schema + ADR-0007 CC#P2-2 amendment

**Lane:** Ratchet-Advance (schema-coverage ratchet + governance-
amendment ratchet).

**Deliverable:**
- Add `dispatch.request`, `dispatch.receipt`, `dispatch.result`
  discriminated variants to `src/schemas/event.ts` (alongside existing
  `dispatch.started` and `dispatch.completed`).
- Update the `Event` discriminated union at
  `src/schemas/event.ts:139` to include the three new kinds.
- Update `specs/contracts/run.md:256` event sequence to reflect the
  full ADR-0007 CC#P2-2 ordering: `dispatch.started` →
  `dispatch.request` (payload hash) → `dispatch.receipt` (receipt id)
  → `dispatch.result` (result hash) → `dispatch.completed`.
- **ADR-0007 amendment** to CC#P2-2: the binding is now tightened to
  name the five-event sequence explicitly and cite `src/schemas/event.ts`
  lines for the new variants. Amendment is a new §Amendment block in
  ADR-0007, not a silent edit (per CLAUDE.md §Hard invariants #5: ADR
  required for any relaxation; widening is the opposite of relaxation
  but the same governance surface applies).
- Contract tests under `tests/contracts/` exercising each new event
  kind.

**Acceptance evidence:** five-event sequence parseable end-to-end;
ADR-0007 §Amendment block committed; contract test count advances
(floor increments in same slice per Codex MED 7 precedent from
slice-33).

**Alternate framing:** weaken ADR-0007 CC#P2-2 to refer to the info-
equivalent data already carried by `dispatch.started` +
`dispatch.completed` (the composition review's option (b) at §HIGH 2
fix hint). **Rejected by operator** 2026-04-21: widen-over-weaken.
Reason: dispatch semantics are going to get richer (P2.6 `codex`
adapter, P2.8 router dispatch, P2.11 skill-invocation dispatch); the
richer schema is architecturally cleaner even if the ADR amendment is
the lighter fix today.

**Codex challenger pass:** **required** per CLAUDE.md §Cross-model
challenger protocol (ADR amendment is itself a governance ratchet;
§6 precedent firewall applies).

**Authority:** composition review §HIGH 2 + ADR-0007 CC#P2-2 +
`src/schemas/event.ts` + `specs/contracts/run.md`.

### Slice 38 — HIGH 1 fold-in: explore dispatch wiring + modeling ADR

**Lane:** Ratchet-Advance (dispatch-wiring ratchet + modeling-authority
ratchet).

**Why this is not P2.4.** The composition review's HIGH 1 fix hint
names the *design choice* this slice settles: "does circuit-next
dispatch per-step (`kind: "dispatch"` steps) or per-phase (canonical
signals)?" That's not a P2.4 implementation detail; it's the modeling
decision P2.4 would otherwise make by accident. Landing it first keeps
P2.4 bounded to adapter implementation.

**Deliverable:**
- **New ADR (ADR-0008 or successor)** answering the dispatch-
  granularity question authoritatively. Two candidate models (named in
  composition review §HIGH 1 fix hint):
  - **(a)** explore's Synthesize (and optionally Review) phases become
    `dispatch` steps (i.e., fixture rewrites `executor: "orchestrator"`
    → `executor: "worker"` + `kind: "synthesis"` → `kind: "dispatch"`
    on those phases);
  - **(b)** a first-class "orchestrator synthesis uses adapter"
    contract — a new step-level affordance where a synthesis step can
    declare an adapter binding without flipping to dispatch kind.
  ADR picks one, cites the rejected alternative, and binds the decision
  to ADR-0007 CC#P2-1 (one-workflow parity target=`explore`).
- Update `specs/contracts/explore.md` + `.claude-plugin/skills/explore/
  circuit.json` to match the ADR's chosen model. The fixture must
  exercise at least one adapter-binding step (so P2.5 has a real
  dispatch path to verify).
- New audit check or extend Check 24: for workflows targeting an
  adapter in P2.5+, the fixture must exercise at least one adapter-
  binding step. (Prevents the "locally green, globally disconnected"
  class of failure from recurring.)

**Acceptance evidence:** ADR-0008 ACCEPTED post-Codex-fold-in;
`explore` fixture exercises an adapter-binding path; new audit check
green; explore contract updated to match.

**Alternate framing:** defer the modeling decision to P2.4 landing
time and pick whichever is cheapest at that moment. Rejected because
that's exactly the smuggling the composition review flagged — P2.4
would quietly pick a model under pressure from adapter implementation,
and the model choice is architectural, not implementation-detail.

**Codex challenger pass:** **required** per CLAUDE.md §Cross-model
challenger protocol (ADR + ratchet change).

**Authority:** composition review §HIGH 1 + ADR-0007 CC#P2-1 +
`specs/contracts/explore.md` + `src/schemas/step.ts:60` (dispatch
authority).

### Slice 39 — HIGH 4 fold-in: split `explore.result` from `run.result`

**Lane:** Ratchet-Advance (artifact-registry ratchet + duplicate-
backing-path audit ratchet).

**Deliverable:** pick one of the two fixes from composition review
§HIGH 4 fix hint:
- **(a)** make `explore.result` a *payload field* inside `run.result`
  (so it's a shape description for the runtime artifact's
  `result_artifact` field, not a sibling artifact); OR
- **(b)** move the workflow-specific artifact to `<run-root>/artifacts/
  explore-result.json` and have the close-step write both files.

Decision at slice time based on whether other workflows (build,
repair, etc.) will emit similar `<kind>.result` artifacts (favors (a))
or per-workflow result shapes are genuinely divergent (favors (b)).

**Also:** the duplicate-backing-path audit check from Slice 35 is
either already preventing this recurrence (if Slice 35 landed first)
or this slice lands the check. (Expectation: Slice 35 landed the
check, so this slice's work is the artifact remediation only.)

**Acceptance evidence:** no two artifacts in `specs/artifacts.json`
share a `backing_path`; updated `specs/contracts/explore.md` +
fixture; duplicate-backing-path audit green on live repo.

**Alternate framing:** accept the collision because only one writer
actually runs (the runtime always runs after the workflow close-step,
or vice versa). Rejected because "which runs last" is not a
specification; it's an accident of implementation ordering that P2.5+
dispatch wiring can invert.

**Codex challenger pass:** not required (no ADR amendment, no ratchet
*weakening*; registry ratchet *advances* either direction).

**Authority:** composition review §HIGH 4 + `specs/artifacts.json` +
`src/runtime/result-writer.ts:5`.

**Slice 40 arc-close fold-in (MED 4 — plan text amendment).** The
Slice 40 arc-close composition review found the option-(b) phrasing
above ("and have the close-step write both files") is superseded by
the landed resolution. The engine owns `<run-root>/artifacts/result.json`
per `src/runtime/result-writer.ts` RESULT-I1 single-writer invariant;
the close-step writes only the workflow-specific sibling
`<run-root>/artifacts/explore-result.json`. The "both files" wording
was imprecise at plan authorship time. The `specs/contracts/explore.md`
v0.3 §Path-split rationale documents the landed resolution
authoritatively. Superseded wording retained here for audit trail.

### Slice 40 — Arc-close cross-slice composition review (ceremony slice)

**Lane:** Ratchet-Advance (review-authority ratchet + governance-gate
ratchet + test-ratchet for the synthetic-shape fold-in).

**Retargeting note — HIGH 5 scope moved to P2.5 (operator decision,
2026-04-21).** Originally planned as Slice 40 per §Slice 40 above
(renamed §Slice 40 — HIGH 5 validator helper extraction — and
preserved in a §Retargeted scope subsection further below for audit
trail). Between Slice 39 landing and Slice 40 framing, the operator
interim-retargeted HIGH 5 (`validateWorkflowKindPolicy` helper
extraction) to P2.5 where the end-to-end dispatch path and deferred-
property promotion natively compose with the helper's scope. The
retargeting is recorded in `specs/plans/phase-2-implementation.md
§P2.4`/§P2.5 amendment (landed alongside Slice 40 arc-close commit)
and in `specs/contracts/explore.md §EXPLORE-I1` scope disclosure
(EXPLORE-I1's "runtime MUST reject" prose is scoped to the P2.5
delivery window; Check 24 hand-parse + fixture-level rejection
remains the current audit binding).

**Deliverable (arc-close ceremony):**
- Two prong review files under `specs/reviews/` matching Check 26's
  naming pattern (`arc-slices-35-to-40-*` / `phase-2-foundation-foldins-arc-close*`
  / `foldins-arc-close*`):
  - `specs/reviews/arc-slices-35-to-40-composition-review-claude.md`
    (fresh-read Claude composition-adversary pass).
  - `specs/reviews/arc-slices-35-to-40-composition-review-codex.md`
    (Codex cross-model challenger pass via `/codex`).
- Both files carry `closing_verdict: ACCEPT-WITH-FOLD-INS` after the
  inline fold-ins described below land.
- Inline fold-ins addressing the two convergent HIGH findings both
  reviewers identified and the MED findings that don't require a
  second fold-in bundle:
  - **HIGH 1 (plan-vs-state drift / HIGH 5 retargeting invisible).**
    This §Slice 40 rewrite. Plus `specs/plans/phase-2-implementation.md
    §P2.4` amendment to cite the HIGH 3 capability-boundary constraint
    + a new §P2.5 anchor naming HIGH 5 (validateWorkflowKindPolicy
    helper) as the P2.5 scope owner.
  - **HIGH 2 (Check 26 chicken-and-egg + prong gap).** Tighten
    `scripts/audit.mjs` Check 26 to require BOTH a Claude-prong file
    AND a Codex-prong file matching the naming pattern with both
    carrying ACCEPT* closing verdicts (Claude HIGH 2 fix (b) + Codex
    HIGH 2). Plus CLAUDE.md §Cross-slice composition review cadence
    amendment documenting the same-commit staging discipline (the
    two prong review files + the `current_slice` bump + the
    ceremony-slice advance land in one commit; the slice-ceremony
    preflight stages everything before audit runs).
  - **Claude MED 1 + Codex LOW 2 (vacuous-on-empty allowlist).** Add
    a synthetic shape fixture to `tests/contracts/artifact-backing-
    path-integrity.test.ts` so the entry-shape invariant is exercised
    against a synthetic VALID entry even when the live allowlist is
    empty.
  - **Claude MED 3 (ADR-0008 §6 non-precedent enforcement prose-only).**
    Add a reopen trigger to ADR-0008 §5 covering forbidden-citation
    form in future workflow-kind ADRs.
  - **Claude MED 2 + Codex LOW 2 (missing Slice 39 Codex / v0.3
    review link).** The arc-close Codex prong at
    `specs/reviews/arc-slices-35-to-40-composition-review-codex.md`
    subsumes a retroactive Slice 39 Codex pass — it explicitly covers
    the path-split decision, `opts.knownCollisions` API shape, and
    the vacuous-on-empty regression smell. `specs/contracts/explore.md`
    frontmatter gains a `codex_adversarial_review_v0_3` key pointing
    to the arc-close Codex prong.
  - **MED 4 (plan §Slice 39 option-(b) "both files" prose).**
    Addressed inline via the amendment note appended to §Slice 39
    above.
  - **LOWs.** Claude LOW 2 reviewer_model naming consistency: normalized
    to `gpt-5.4` across prong files where reviewer was gpt-5.4.
    Claude LOW 3 terminal-state comment: added as a test-file
    comment. LOW 1 (`specs/artifacts.md` staleness): deferred to a
    docs-drift sweep.
- MED findings explicitly deferred from Slice 40 (scoped to next
  workflow-kind slice or P2.5):
  - Codex MED 1 (Check 27 fixture→registry path binding) — scoped to
    the next workflow-kind landing.
  - Codex MED 3 (HIGH 3 capability-boundary in P2.4 plan) — landed in
    `specs/plans/phase-2-implementation.md §P2.4` amendment at Slice
    40 ceremony commit.
  - Codex MED 4 (Check 27 unknown-kind severity) — scoped to the next
    workflow-kind slice; design rule documented here for continuity.

**Acceptance evidence:**
- Both prong review files present under `specs/reviews/` with naming
  matching Check 26's regex + both carrying `closing_verdict: ACCEPT-
  WITH-FOLD-INS`.
- Check 26 green on live repo post-ceremony (with the two-prong
  tightening landed, green requires both prongs + both verdicts).
- Contract tests pass end-to-end; new synthetic shape test exercises
  entry-level invariants against a valid injected entry.
- ADR-0008 §5 contains the forbidden-citation reopen trigger.
- `specs/plans/phase-2-implementation.md §P2.4` cites the HIGH 3
  capability constraint; §P2.5 anchors the HIGH 5
  `validateWorkflowKindPolicy` helper.
- CLAUDE.md §Cross-slice composition review cadence amendment
  documents same-commit staging + two-prong requirement.
- `PROJECT_STATE.md` + `README.md` + `TIER.md` advance to
  `current_slice=40`.
- `specs/reviews/adversarial-yield-ledger.md` row appended (class =
  governance; this slice is a governance ratchet per §6 precedent
  firewall).

**Alternate framing:** defer the inline fold-ins to a second fold-in
bundle (Slices 41/42) before P2.4 reopens, land Slice 40 as a
ceremony-only commit that advances `current_slice` + stages the
review files. Rejected because both prong reviews explicitly
disposition every HIGH/MED finding as "fold-in inline in the Slice 40
arc-close commit" — the fold-ins are small, coherent, and incorporable
into the same commit that lands the reviews; a second bundle
introduces an extra ceremony surface without additional gate strength.

**Codex challenger pass:** the Slice 40 arc-close commit IS the Codex
challenger pass for the arc at the cross-slice level. Per CLAUDE.md
§Hard invariants #6, ratchet changes require cross-model challenger
review — the arc-close Codex prong at
`specs/reviews/arc-slices-35-to-40-composition-review-codex.md` is
that pass, scaled to arc-level per the cadence rule's "same two-prong
protocol" text.

**Authority:** `specs/reviews/p2-foundation-composition-review.md`
(triggering review); CLAUDE.md §Cross-slice composition review
cadence; `scripts/audit.mjs` Check 26; both arc-close prong review
files under `specs/reviews/arc-slices-35-to-40-*`; operator interim
decision 2026-04-21 (HIGH 5 → P2.5 retarget).

#### §Retargeted scope — original Slice 40 (HIGH 5) preserved for audit trail

The original plan authorship at plan file commit `e62a5c5` named
Slice 40 as the HIGH 5 fold-in extracting `validateWorkflowKindPolicy`
to `src/runtime/workflow-policy.ts`, refactoring `scripts/audit.mjs`
Check 24 + `src/cli/dogfood.ts:125` to call the helper, and flipping
the `steps: []` audit-fixture regression to red. That scope moved to
P2.5 per operator interim retargeting 2026-04-21 (reasoning: P2.5
natively composes the helper with end-to-end dispatch and deferred-
property promotion; extracting the helper pre-P2.4 without the
runtime wiring it enables is premature and risks a second refactor
at P2.5 landing).

### Arc close — Slice 40 IS the arc-close ceremony (merged per arc-close composition review)

Originally planned as a separate "not a slice" ceremony event. Merged
into Slice 40 per the arc-close composition review's convergent HIGH
1 finding (plan/state drift): treating the arc-close review as
ceremony-not-slice leaves `current_slice` unable to advance to 40 via
the normal slice-commit flow + leaves Check 26 unable to fire cleanly
on the ceremony. Slice 40 is now the arc-close ceremony slice that
stages the two prong review files, lands the inline fold-ins listed
above, advances `current_slice` to 40, and trips Check 26 green.
Check 26's two-prong tightening + CLAUDE.md's staging-discipline
amendment close the chicken-and-egg that HIGH 2 surfaced.

If the Slice 40 arc-close review (inclusive of fold-ins) lands
`closing_verdict: ACCEPT-WITH-FOLD-INS`, P2.4 reopens at a future
slice. If either prong had landed `REJECT-PENDING-FOLD-INS` as the
closing verdict, a second fold-in bundle (Slices 41/42) would have
preceded P2.4; the actual outcome is ACCEPT-WITH-FOLD-INS on both
prongs after inline incorporation.

## P2.4 scope update (not a slice in this arc)

HIGH 3 (trigger #6 defeatable by incantation) is addressed as a
**scope constraint on P2.4** rather than a pre-P2.4 slice. Per
composition review §HIGH 3 fix hint option (a) and operator
acceptance: **P2.4 v0 ships with no repo-write tool capability**, and
the P2.4 commit body explicitly cites the capability boundary
(ADR-0007 trigger #6 context). Option (b) — a capability-aware audit
check that inspects what the adapter can actually do — is deferred to
a post-P2.4 slice once the capability descriptor surface exists.

This is a scope update to `specs/plans/phase-2-implementation.md §P2.4`
but does not change its position in the sequence; when P2.4 reopens
after this arc closes, it carries the capability-boundary citation
requirement as a slice-framing pre-condition.

## Dependency graph

```
Slice 35 (methodology + tracked review opener) ← no deps (opens arc; merged
                                                  per Codex HIGH 5 fold-in)
   ↓
(Slice 36 reserved — originally "tracked review opener"; now absorbed into
Slice 35. Next substantive slice uses the next natural slice number.)
   ↓
Slice 37 (HIGH 2: event schema + ADR)       ← depends on Slice 35 ceremony
                                              (review tracked as authority)
   ↓
Slice 38 (HIGH 1: dispatch wiring + ADR)    ← depends on Slice 37 (new event
                                              variants inform the dispatch
                                              model decision)
   ↓
Slice 39 (HIGH 4: artifact split)           ← depends on Slice 35 Check 25
                                              (resolves its tracked collision;
                                              deletes allowlist entry)
   ↓
Slice 40 (HIGH 5: helper + audit/runtime    ← depends on Slice 38 (dispatch
           parity)                            model may change kind-policy
                                             surface). Closing this slice
                                             trips Check 26: arc-close
                                             composition review required.
   ↓
Arc-close composition review                ← consumes Slices 35–40 as
                                              aggregate; Check 26 gate
   ↓
P2.4 (reopens with HIGH 3 scope constraint)
```

## Acceptance evidence for arc close

All of the following must be true before P2.4 reopens:

- All five HIGH findings in
  `specs/reviews/p2-foundation-composition-review.md` are closed (each
  slice above cites the HIGH it resolves).
- Registry-transitive audit check green on live repo (no duplicate
  `backing_path` collisions).
- ADR-0007 §Amendment block for CC#P2-2 merged post-Codex-pass.
- ADR-0008 (dispatch-granularity modeling) ACCEPTED post-Codex-pass.
- Arc-close cross-slice composition review verdict is ACCEPT or
  ACCEPT-WITH-FOLD-INS (with folded-in evidence).
- Audit green / test count advances tracked per slice; no ratchet
  regressions.
- `PROJECT_STATE.md` updated at each slice per convention; continuity
  record updated when the arc closes (not per slice).

## Review fold-ins

This plan itself is authored under the composition-review discipline
being upgraded in Slice 35. When Slice 35 lands the cadence rule, the
arc-close review IS the first application of that rule. The plan
therefore does not require its own Codex challenger pass pre-landing
— it inherits challenger-pass obligations per-slice (Slices 35, 37,
38 carry their own) and per-arc (arc-close review).

## Open questions

1. **Slice 35 boundary — is the registry-transitive audit check a
   single `backing_path` check or a broader transitivity audit?** The
   minimum-viable check is the duplicate-backing-path check; broader
   transitivity (reader/writer consistency, artifact graph cycle
   detection) could fold in but is not required by any HIGH. Decision
   at slice-35 framing time.
2. **Slice 38 model choice — (a) dispatch-kind flip or (b)
   orchestrator-synthesis-uses-adapter contract?** ADR-0008 settles
   this at slice time. Operator preference: TBD (Codex recommended
   the dispatch-kind flip as the cleaner architectural move, but the
   adapter-binding-on-synthesis approach preserves more of the
   existing fixture shape).
3. **Slice 39 model choice — (a) payload field in `run.result` or
   (b) distinct backing path?** Decision depends on whether
   `<workflow>.result` artifacts are structurally similar across
   workflows or genuinely divergent. Resolve at slice-39 framing time;
   evidence from Slice 38 (dispatch model) may inform this.
4. **MED findings — do any fold in alongside these HIGH slices, or
   do they wait for their natural slice?** Composition review §MED
   1/2/3/4/5 and §LOW 1/2 are all "not independent blockers." Default:
   fold each into the next slice that touches its area. No MED/LOW
   gates arc close.
5. **Arc-close composition review — same reviewers (Claude + Codex) or
   a third voice?** Per CLAUDE.md §Hard invariants: no third voice
   required. Default to the two-prong protocol that produced this
   arc's review.

## Authority chain

- `specs/reviews/p2-foundation-composition-review.md` (the review this
  arc folds in).
- `specs/plans/phase-2-implementation.md` (parent plan; this arc is
  a pre-P2.4 insertion).
- `specs/adrs/ADR-0007-phase-2-close-criteria.md` (CC#P2-1, CC#P2-2,
  CC#P2-6 touchpoints).
- `CLAUDE.md §Core methodology` + `§Hard invariants` #5 #6 #8.
- Operator continuity record `continuity-8634130a` (widen-over-weaken
  decision + 6-step arc acceptance + methodology-upgrade-first
  constraint).
