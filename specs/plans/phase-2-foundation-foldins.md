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

### Slice 35 — Methodology upgrade (registry-transitive audit + arc-close composition-review cadence)

**Lane:** Ratchet-Advance (discipline ratchet; authoring the discipline
the rest of this arc will be graded against).

**Why first.** Per operator constraint (continuity debt-markdown entry
7): "methodology upgrade should land BEFORE the first foundation fold-in
slice ships. Reason: otherwise we author the fold-ins under the same
discipline that let the HIGHs through originally." The composition
review was valuable because no single slice owned the boundary seams;
the mechanism that triggers such a review at arc boundaries belongs in
the discipline surface, not in the operator's head.

**Deliverable:**
- **Registry-transitive audit check** in `scripts/audit.mjs` (new
  Check 25 or equivalent) that walks the artifact graph in
  `specs/artifacts.json` and flags any two artifacts registered at the
  same `backing_path` (HIGH 4's structural form). This is the simplest
  mechanism that would have caught HIGH 4 at slice-34 authorship time.
- **Arc-close composition-review cadence** recorded as a discipline
  rule in `CLAUDE.md §Session hygiene` (or a new §Cross-slice review
  section): at the close of any arc spanning 3+ slices, commission a
  composition review before the next privileged runtime slice opens.
  The rule cites this arc as the first instance.

**Acceptance evidence:** Check 25 (or equivalent) green on live repo;
at least one negative-fixture test in `tests/contracts/` asserting
duplicate `backing_path` triggers red; `CLAUDE.md` amendment with
cadence rule; 23+ green audit checks.

**Alternate framing:** defer methodology upgrade to arc-close (after
all five HIGHs fold in), on the theory that a clean signal from the
fold-in slices is worth more than a discipline upgrade mid-flight.
Rejected because the constraint is explicit: "otherwise we author the
fold-ins under the same discipline that let the HIGHs through
originally." The cheaper discipline upgrade (one audit check + one
doc amendment) is worth landing first.

**Codex challenger pass:** **required** per CLAUDE.md §Hard invariants
#6 (ratchet change).

**Authority:** CLAUDE.md §Hard invariants #6 + #8; composition review
§META 2 (layer-boundary failures are the recurring mode).

### Slice 36 — Tracked review opener (commit review file + archive Codex transcript)

**Lane:** Ratchet-Advance (audit-coverage ratchet carries the ceremony
commit for the review; review-evidence ratchet advances with tracked
archive).

**Deliverable:**
- `git add specs/reviews/p2-foundation-composition-review.md` + commit
  (ceremony commit for the review that triggered this arc).
- Archive `/tmp/codex-composition-review/output.md` to
  `specs/reviews/p2-foundation-composition-review-codex-transcript.md`
  as a sibling of the review file. Reason: `/tmp` wipes on reboot; the
  challenger transcript is audit evidence, not ephemeral.
- Frontmatter tying the two files: main review already cites the
  transcript path at line 218; update that line to point to the in-
  repo archive location.
- Append row to `specs/reviews/adversarial-yield-ledger.md` (per
  convention established slices 32/33/34).

**Acceptance evidence:** both files tracked; transcript archive
parseable as markdown; ledger row present; audit green.

**Alternate framing:** skip the transcript archive; cite the Codex
session id + prompt and trust the session database. Rejected because
(a) `/tmp` is volatile, (b) the session-id lookup requires live
infrastructure not available at slice-review time years out, (c) 14,895
lines of challenger reasoning are exactly the audit trail that future
challenger passes on THIS arc will want to cross-reference.

**Codex challenger pass:** not required (evidence-archiving slice,
no ratchet change beyond audit-coverage on tracked evidence).

**Authority:** composition review (the file being committed) + CLAUDE.md
§Cross-model challenger protocol (governance for challenger transcripts).

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

### Slice 40 — HIGH 5 fold-in: extract `validateWorkflowKindPolicy` helper

**Lane:** Equivalence Refactor (semantics-preserving extraction + one
new enforcement binding that was claimed but absent).

**Deliverable:**
- New helper `validateWorkflowKindPolicy(workflow)` exported from
  `src/runtime/workflow-policy.ts` (or equivalent location). Helper
  runs `Workflow.safeParse(workflow)` first, then applies kind-
  specific policy (canonical phase set, spine-policy omits) on the
  parsed value.
- `scripts/audit.mjs` Check 24 (`checkSpineCoverage`) refactored to
  call the helper instead of hand-parsing JSON.
- `src/cli/dogfood.ts:125` (runtime fixture loading) extended to call
  the helper after `Workflow.parse`.
- The deferred-property test stub that previously only asserted
  `target_slice` and `reopen_condition` (MED 1 in the review) is
  **not** in scope for this slice — that's a P2.5 concern.

**Acceptance evidence:** the invalid fixture at
`tests/contracts/spine-coverage.test.ts:34` (`steps: []`) that
currently passes Check 24 at line 70 now **fails** (red path); live-
repo fixture still passes green; runtime rejects a hand-crafted
invalid explore-kind fixture with a clear error.

**Alternate framing:** weaken EXPLORE-I1's "runtime MUST reject" prose
to match what Check 24 actually enforces (scope-narrow). Rejected
because the composition review §HIGH 5 fix hint is explicit: "makes
EXPLORE-I1 mean what it says" — widening enforcement to match prose
is the structurally cleaner fix and closes the audit-vs-runtime gap
the composition view surfaced.

**Codex challenger pass:** **not required** (Equivalence Refactor lane
with enforcement widening, not weakening; no ratchet floor change
beyond test-count floor advance from new tests).

**Authority:** composition review §HIGH 5 + `specs/contracts/explore.md
:161,180` (EXPLORE-I1 prose) + `scripts/audit.mjs:2783-2788` +
`tests/contracts/spine-coverage.test.ts:34,70`.

### Arc close — cross-slice composition review (mechanism from Slice 35)

Not a slice in the fold-in count; a cadence checkpoint per Slice 35's
discipline upgrade. Before P2.4 reopens, commission another
composition review over Slices 35–40 (this arc). Same two-prong
protocol: fresh-read Claude composition-adversary pass + Codex cross-
model challenger via `/codex`. Acceptance gate is the same verdict
vocabulary (REJECT-PENDING-FOLD-INS / ACCEPT-WITH-FOLD-INS / ACCEPT).

If the arc-close review is ACCEPT, P2.4 reopens. If REJECT, a second
fold-in bundle lands before P2.4.

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
Slice 35 (methodology)                      ← no deps (opens arc)
   ↓
Slice 36 (tracked review opener)            ← depends on Slice 35 cadence rule
   ↓
Slice 37 (HIGH 2: event schema + ADR)       ← depends on Slice 36 ceremony
   ↓
Slice 38 (HIGH 1: dispatch wiring + ADR)    ← depends on Slice 37 (new event variants
                                               inform the dispatch model decision)
   ↓
Slice 39 (HIGH 4: artifact split)           ← depends on Slice 35 audit check
                                               (OR lands the check if Slice 35
                                               deferred it)
   ↓
Slice 40 (HIGH 5: helper + audit/runtime    ← depends on Slice 38 (dispatch
           parity)                             model may change kind-policy surface)
   ↓
Arc-close composition review                ← consumes Slices 35–40 as aggregate
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
