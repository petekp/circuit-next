---
name: arc-slices-35-to-40-composition-review-claude
description: Fresh-read Claude composition-adversary pass over Slices 35/37/38/39 of the pre-P2.4 foundation fold-in arc. Looks for boundary-seam failures no individual slice owned — things the per-slice Codex passes could not see because the seam is cross-slice. Paired with the Codex challenger prong to be commissioned at arc close.
type: review
reviewer_model: claude-opus-4-7
reviewer_model_id: claude-opus-4-7
authorship_role: auditor
review_kind: composition-review
review_date: 2026-04-21
verdict: REJECT-PENDING-FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS
authored_by: claude-opus-4-7
review_target: arc-slices-35-to-40-pre-p2.4-foldin-arc
target_kind: arc
target: pre-p2.4-foundation-foldin-arc
target_version: "HEAD=848f51a (post-Slice-39)"
arc_target: phase-2-foundation-foldins-slices-35-to-40
arc_version: "e62a5c5..848f51a"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  HIGH: 2
  MED: 4
  LOW: 3
  META: 2
commands_run:
  - Read specs/plans/phase-2-foundation-foldins.md (arc plan end-to-end)
  - Read specs/reviews/p2-foundation-composition-review.md (triggering review for calibration)
  - Read specs/reviews/arc-slice-35-methodology-upgrade-codex.md
  - Read specs/reviews/arc-slice-37-high-2-widen-event-schema-codex.md
  - Read specs/reviews/arc-slice-38-dispatch-granularity-adr-0008-codex.md
  - Read specs/adrs/ADR-0008-dispatch-granularity-modeling.md
  - Read specs/contracts/explore.md (v0.3)
  - Read specs/contracts/run.md §dispatch_event_pairing §Amendment
  - Read src/schemas/event.ts (five-event sequence + superRefine)
  - Read .claude-plugin/skills/explore/circuit.json (post-slice-38 + 39)
  - Read specs/artifacts.json (explore.* rows + run.result)
  - Read scripts/audit.mjs (Checks 25 / 26 / 27 + WORKFLOW_KIND_DISPATCH_POLICY + PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE)
  - Read tests/contracts/artifact-backing-path-integrity.test.ts
  - Read CLAUDE.md §Cross-slice composition review cadence
  - Read PROJECT_STATE.md (Slice 39 Last-updated block)
  - Read specs/ratchet-floor.json
  - Grep on 'current_slice' in PROJECT_STATE.md
  - Grep on 'HIGH 5 | validateWorkflowKindPolicy | Slice 40' across specs/
  - Grep on 'EXPLORE-I1 | runtime MUST reject' across specs/contracts/explore.md + specs/invariants.json
opened_scope:
  - specs/plans/phase-2-foundation-foldins.md
  - specs/reviews/p2-foundation-composition-review.md
  - specs/reviews/arc-slice-35-methodology-upgrade-codex.md
  - specs/reviews/arc-slice-37-high-2-widen-event-schema-codex.md
  - specs/reviews/arc-slice-38-dispatch-granularity-adr-0008-codex.md
  - specs/adrs/ADR-0008-dispatch-granularity-modeling.md
  - specs/contracts/explore.md (v0.3 post-Slice-39)
  - specs/contracts/run.md (§Amendment Slice 37)
  - src/schemas/event.ts
  - .claude-plugin/skills/explore/circuit.json
  - specs/artifacts.json (explore.* + run.result rows)
  - scripts/audit.mjs (Checks 25/26/27 + policy tables)
  - tests/contracts/artifact-backing-path-integrity.test.ts
  - CLAUDE.md §Cross-slice composition review cadence
  - PROJECT_STATE.md (Slice 39 block)
  - specs/ratchet-floor.json
  - specs/invariants.json (EXPLORE-I1 row)
skipped_scope:
  - tests/contracts/adapter-binding-coverage.test.ts (Codex Slice-38 review already opened this file; cross-referenced via audit.mjs Check 27 instead)
  - src/runtime/reducer.ts (Slice 37 no-op arms verified via Codex Slice-37 HIGH/MED fold-in record; not re-opened)
  - src/runtime/runner.ts (dry-run behavior cited by Slice 37 Codex LOW 6; not a cross-slice seam)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md body outside §Amendment block (amendment block read; §6 firewall text re-verified via ADR-0008 §Context §6 checklist quotations)
  - src/cli/dogfood.ts (runtime fixture loading path — Slice 40 scope, not this arc's)
  - specs/plans/phase-2-implementation.md (parent plan; no edits in this arc's diff range e62a5c5..848f51a)
authority:
  - specs/plans/phase-2-foundation-foldins.md
  - specs/reviews/p2-foundation-composition-review.md
  - CLAUDE.md §Cross-slice composition review cadence
fold_in_disposition: Two HIGH findings require fold-in before P2.4 reopens; recommended fold-in vehicle is the Slice 40 arc-close commit (same commit that lands this review file's Codex sibling + adjusts Slice 40's scope). Three MEDs and three LOWs can fold inline into Slice 40 or defer to a follow-up micro-slice at operator discretion. Closing verdict ACCEPT-WITH-FOLD-INS on the theory that the arc produced the right work and the seam-level drifts are incorporable into the arc-close commit rather than requiring a second fold-in bundle.
---

# Pre-P2.4 foundation fold-in arc (Slices 35/37/38/39) — Claude composition-adversary review

## Scope

Fresh-read composition-adversary pass over the four HIGH-fix slices
landed in the pre-P2.4 foundation fold-in arc (commit range
`e62a5c5..848f51a`, `current_slice=39`), paired with the arc-opening
methodology upgrade that landed in Slice 35. Each slice passed its own
Codex challenger pass (three of four — Slice 39 was declared challenger-
not-required per plan §Slice 39). The purpose of this review is to
surface boundary-seam failures the per-slice reviewers could not see
because the seam is cross-slice. Calibration target: the five HIGH
findings the prior composition review
(`specs/reviews/p2-foundation-composition-review.md`) surfaced after
every slice had passed its own per-slice review.

## Opening verdict

**REJECT-PENDING-FOLD-INS.** Two HIGH findings surfaced on first read:
(1) the plan file and the live state disagree on what Slice 40 *is*
(plan still names Slice 40 as the HIGH 5 `validateWorkflowKindPolicy`
helper extraction; PROJECT_STATE.md Slice-39 block already names Slice
40 as the arc-close composition review), and (2) Check 26's
`current_slice = 40` trigger has a chicken-and-egg problem if Slice 40
is itself the composition-review ceremony commit.

## Closing verdict

**ACCEPT-WITH-FOLD-INS.** Both HIGH findings are real cross-slice
seam drifts — not slice-internal bugs — and both are incorporable
into the arc-close commit that lands this review and its Codex
sibling. The arc produced the right work: Slice 37 widened the event
schema correctly, Slice 38's ADR-0008 is clean on its own terms with
honest weaker-evidence disclosures, Slice 39's path-split is the
right architectural choice. The cross-slice drifts are governance-
surface (plan vs state) and check-semantics (Check 26 trigger vs its
own ceremony slice), not implementation drifts. Landing them as
inline fold-ins in the Slice 40 arc-close commit is cheaper than a
second fold-in bundle.

---

## HIGH findings

### HIGH 1 — Plan file and PROJECT_STATE disagree on what Slice 40 IS (HIGH 5 retargeting invisible at the governance surface)

**Evidence.**
- `specs/plans/phase-2-foundation-foldins.md:327-365` still describes
  Slice 40 as "HIGH 5 fold-in: extract `validateWorkflowKindPolicy`
  helper" with detailed deliverable list (new helper at
  `src/runtime/workflow-policy.ts`, Check 24 refactor, dogfood.ts
  runtime extension), acceptance criteria, and authority block citing
  the composition review §HIGH 5.
- The same plan file at lines 367-378 names the arc close as "Not a
  slice in the fold-in count; a cadence checkpoint per Slice 35's
  discipline upgrade" — i.e., the plan treats the composition review
  as ceremony, not a slice.
- `PROJECT_STATE.md` Slice 39 block (line 7) says: "Arc has one slice
  remaining (**Slice 40 arc-close composition review — Check 26
  gate**) before P2.4 reopens." The plain-English operator summary
  in the same block continues "Next: Slice 40 arc-close composition
  review."
- The context for this review (operator brief) confirms the
  retargeting: "HIGH 5 (validateWorkflowKindPolicy helper) was
  retargeted to P2.5 per operator interim decision."
- `scripts/audit.mjs:3206` names `PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE = 40`.
  Check 26 fires when `current_slice >= 40` and requires an arc-close
  composition review file to exist. This binding assumes Slice 40 IS
  the arc-close review, not HIGH 5.

**Impact.** Three authority surfaces disagree:
1. Plan file: "Slice 40 = HIGH 5 (helper extraction); arc close is a
   separate ceremony event, not a slice."
2. PROJECT_STATE.md + Check 26 binding: "Slice 40 = arc-close
   composition review ceremony."
3. The live context (operator brief): HIGH 5 moved to P2.5.

The retargeting decision is presumed real (operator decision), but it
is nowhere in the plan file and nowhere in the invariants ledger
(EXPLORE-I1's `binding_refs` at `specs/invariants.json:815` still
points only at `tests/contracts/spine-coverage.test.ts`, which per
the original HIGH 5 was the audit-vs-runtime gap HIGH 5 was supposed
to close). A fresh reader hitting this repo in isolation — from the
plan file — would conclude Slice 40 lands a new helper; hitting it
from PROJECT_STATE.md would conclude Slice 40 IS the arc-close
review. The cross-model challenger at arc close would read
authoritative sources saying two different things about the slice
whose closing-verdict gate it is supposed to evaluate.

This is exactly the governance-vs-runtime drift class the prior
composition review flagged at §HIGH 2 (ADR prose named event kinds
the schema didn't define). The same shape recurs: plan prose names a
slice the actual plan-of-record no longer intends to land.

**Fix hint.** Pre-P2.4, amend the plan file to: (a) record the HIGH 5
retargeting decision explicitly — operator continuity citation, date,
what moved to P2.5, what stayed; (b) rewrite §Slice 40 as "Slice 40
— arc-close composition review ceremony + any HIGH 5 fold-ins that
can land in the same commit" (or delete the §Slice 40 body and move
its content to a new P2.5 anchor in `specs/plans/phase-2-implementation.md`);
(c) resolve the "arc close — not a slice" language at plan lines
367-378 so Slice 40 is unambiguously named as the ceremony. Fold-in
vehicle: the same commit that lands this review + the Codex
challenger sibling.

---

### HIGH 2 — Check 26 trigger has a chicken-and-egg on its own closing slice

**Evidence.**
- `scripts/audit.mjs:3244-3249`:
  ```
  if (sliceNum < PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE) {
    return { level: 'green', detail: `...still in progress...` };
  }
  ```
  Check 26 is green-until `current_slice >= 40`.
- `scripts/audit.mjs:3266-3270`: once `current_slice >= 40`, if no
  arc-close review file matching the pattern exists, Check 26 returns
  **red**.
- The arc-close review is LANDED by the Slice 40 ceremony commit
  itself (per PROJECT_STATE.md Slice 39 block + this review's own
  existence).
- Per `CLAUDE.md §Verification commands (Tier 0)`, "the first four
  gates must all pass before any commit in a Ratchet-Advance or
  Equivalence Refactor lane" — and `npm run audit` exits non-zero on
  any red finding.
- `PROJECT_STATE.md` `current_slice` is updated *as part of the slice
  commit* per `CLAUDE.md §Session hygiene` ("update [PROJECT_STATE.md]
  when phase state changes").

**Impact.** The sequence is:
1. Slice 40 commit is prepared: review files are staged at
   `specs/reviews/arc-slices-35-to-40-*.md` AND
   `PROJECT_STATE.md` is updated to `current_slice: 40`.
2. `npm run audit` runs as part of the verify gate before commit.
3. If the review files are NOT yet staged → Check 26 red → audit
   exits non-zero → cannot commit.
4. If `PROJECT_STATE.md` is NOT yet updated → current_slice stays at
   39 → Check 26 informational-green → audit passes → but then the
   commit lands without the current_slice advance, and the next
   commit hits the same problem.

This is escapable (stage review files AND the state bump in the same
commit before running audit), but the check's own documented
semantics don't name the escape. A fresh operator following the
Tier-0 verify gate would hit a deadlock on the first attempt to
advance current_slice without staging the review in the same
preparation.

Relatedly, Check 26 accepts the naming pattern `(arc.*35.*40|phase-2-foundation-foldins-arc-close|foldins-arc-close)`
(`scripts/audit.mjs:3262-3264`). This file's name matches
(`arc-slices-35-to-40-*`). But the check does not distinguish the
Claude prong from the Codex prong: either one alone satisfies the
gate. If a future operator runs only Claude and skips Codex, Check
26 stays green. This is weaker than the cadence rule CLAUDE.md §Cross-
slice composition review cadence promises ("Same two-prong protocol:
fresh-read Claude composition-adversary pass + Codex cross-model
challenger via /codex.").

**Fix hint.** Pre-P2.4, either:
- **(a)** Amend Check 26 to fire on `current_slice >= 40` AND the
  review file does not exist, but *inform* rather than red (yellow
  with a note "prepare arc-close review before advancing
  current_slice"); red is reserved for "review file present but
  lacks ACCEPT verdict." This preserves the gate without creating a
  chicken-and-egg at the ceremony commit itself.
- **(b)** Tighten Check 26 to require BOTH a Claude prong file AND a
  Codex prong file matching the naming pattern, with both carrying
  ACCEPT* closing verdicts. This closes the "run only one prong"
  gap. Compose with (a) or handle separately.
- **(c)** Document the sequencing explicitly in the Check 26
  docstring + in CLAUDE.md §Cross-slice composition review cadence:
  "the arc-close review files are staged in the SAME commit as the
  current_slice advance to the arc-close slice number." This is the
  cheapest fix (docs only) and addresses the chicken-and-egg by
  operator discipline rather than by check mechanism.

Fold-in vehicle: the Slice 40 arc-close commit can land (c) as part
of the commit message / plan amendment. (a) and (b) are larger
mechanism changes; either defer to a post-arc slice or land (a)
specifically as a one-line audit.mjs edit.

---

## MED findings

### MED 1 — `ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS` is now vacuously structurally-invariant; the shape invariant no longer fires on live data

**Evidence.**
- `scripts/audit.mjs:2979` (Slice 39): `export const ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS = Object.freeze([]);`
  — the allowlist is empty.
- `tests/contracts/artifact-backing-path-integrity.test.ts:416-429`
  (Slice 39 fold-in):
  ```
  it('ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS entries each carry closing_slice + reason (when any are present)', () => {
    // Post-Slice-39: live allowlist is empty. The shape invariant below is
    // vacuously satisfied on an empty array...
    for (const entry of ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS) { ... }
  });
  ```
  The loop has zero iterations against the live constant.
- The synthetic-entry test at lines 248-286 exercises the shape via
  `opts.knownCollisions` injection. But that test only asserts on the
  CHECK's reaction to tracked/stale entries — it does not assert on
  the *shape invariant* (entry carries closing_slice + reason etc.)
  against the injected synthetic entry.

**Impact.** Slice 35 Codex HIGH 2 fold-in was "stale allowlist entries
must go red." Slice 39 resolved the only live entry and deleted it.
Now the shape invariant test iterates zero entries against live data;
if a future slice adds a new entry with a malformed shape (e.g. missing
`reason`, or `artifact_ids` length < 2), the live invariant fires
nothing. The check's runtime logic at `scripts/audit.mjs:3128` uses
`entry.artifact_ids` via `knownCollisions.find((entry) => { ... })` —
if `entry.artifact_ids` is absent, `entry.artifact_ids` is `undefined`
and `.sort()` on undefined throws at runtime (not a graceful red;
unhandled exception). The vacuous-on-empty test loop masks this
brittleness.

The per-slice Codex pass at Slice 39 did not fire because it was
declared "challenger not required." The Slice 35 Codex pass that
authored the fold-in could not see the Slice 39 vacuous-on-empty
state because Slice 35 landed two slices before Slice 39. This is
exactly the cross-slice seam the arc-close review is supposed to
catch.

**Fix hint.** Add a unit-style regression test against a synthetic
VALID entry shape to confirm the shape invariant logic works as
intended:

```ts
it('shape invariant loop catches a malformed entry when one is present', () => {
  const malformed = [{ normalized: 'x', /* missing artifact_ids etc */ }];
  for (const entry of malformed) {
    expect(() => {
      expect(Array.isArray(entry.artifact_ids)).toBe(true); // fails
    }).toThrow();
  }
});
```

Or simpler: change the live test at line 416 to assert the array IS
empty (terminal state) and add a separate synthetic-shape test that
DOES iterate. Either way, the shape-invariant loop must not be the
ONLY guardian of entries, because an empty array iterates zero times
and hides malformed-entry bugs.

### MED 2 — Slice 39 had no Codex challenger pass despite touching a ratchet surface

**Evidence.**
- `specs/plans/phase-2-foundation-foldins.md:321-323`: "Codex
  challenger pass: not required (no ADR amendment, no ratchet
  *weakening*; registry ratchet *advances* either direction)."
- But Slice 39 DID:
  - Advance `specs/ratchet-floor.json:3-8`: 828 → 830,
    `last_advanced_in_slice: '39'`.
  - Bump `specs/contracts/explore.md` v0.2 → v0.3 (new §Path-split
    rationale section + new Reopen condition #10).
  - Add a new opts parameter (`opts.knownCollisions`) to a check
    function (`scripts/audit.mjs:3015` — `checkArtifactBackingPathIntegrity`)
    — this is a ratchet-surface API change.
  - Delete the only live `ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS`
    entry — this is an allowlist-lifecycle action the Slice 35 fold-in
    specifically said must happen when a closing slice resolves a
    tracked collision.
- `CLAUDE.md §Hard invariants #6`: "Cross-model challenger required
  for any ratchet change."
- The prior composition review itself (§HIGH 4) named the split as
  the target resolution. That doesn't exempt it from challenger — the
  challenger is objection-list, not approval.

**Impact.** The single slice that crosses the registry seam does so
without a challenger pass. Slice 39's post-facto vacuous-on-empty
state (MED 1 above) is the concrete smell — a challenger pass would
likely have flagged it. Additionally, contract.md version bumps v0.2
→ v0.3 should carry per-version Codex review by precedent of v0.1
and v0.2 (which both did — see `specs/reviews/explore-md-v0.1-codex.md`
and the v0.2 entry at ADR-0008 challenger pass). Missing the v0.3
Codex leaves a forward-link gap in the contract's `codex_adversarial_review_*`
frontmatter chain (`specs/contracts/explore.md:8-9`: only v0.1 and
v0.2 Codex reviews are cited; v0.3 has no Codex sibling).

**Fix hint.** Either (a) dispatch a retroactive Codex challenger pass
on Slice 39 before the arc-close commit lands — focused on the path-
split decision, the `opts.knownCollisions` API shape, and the
vacuous-on-empty regression smell; (b) or, at minimum, document the
rationale for skipping Codex in the plan file + add a
`codex_adversarial_review_v0_3` frontmatter key to explore.md citing
"skipped — challenger not required per plan §Slice 39" with explicit
plan amendment authorizing the skip. Option (a) is safer; (b) is a
governance-surface patch that preserves the audit trail.

### MED 3 — ADR-0008 §6 "non-precedent enforcement" is prose-level without the promised audit check

**Evidence.**
- `specs/adrs/ADR-0008-dispatch-granularity-modeling.md:523-531`
  (§6 Enforcement): "This clause is authoritative prose at v0.2. A
  future slice MAY add an audit check over new ADRs for forbidden
  citation phrases... Until that audit lands, the clause is enforced
  at challenger-pass review time..."
- The Codex Slice 38 MED 3 fold-in that produced the allowed-vs-
  forbidden split: "If the clause is meant to be machine-load-bearing,
  add a small audit guard over new ADRs for forbidden phrases like
  'ADR-0008 pattern applies' / 'extending ADR-0008' without an
  explicit fresh-analysis subsection." The fold-in adopted the split
  but not the audit guard.
- No reopen-trigger in ADR-0008 §5 (six triggers) names "forbidden
  citation detected in a future ADR" — so even if a future slice
  violates §6.forbidden, there is no mechanism to open the reopen
  path.

**Impact.** The §6 split is prose at v0.2. Its enforcement is
challenger-pass discipline, which works if every future workflow-
kind ADR dispatches a Codex challenger — and if that Codex actually
catches the forbidden-citation class. The Codex Slice 38 pass itself
explicitly flagged this as "semantically fuzzy and not load-bearing."
The prose clause may drift into habit-of-citation over the next few
workflow-kind ADRs. This is a governance-surface deferred-enforcement
smell that the arc's composition view highlighted and the slice
internalized but did not close.

**Fix hint.** Add a reopen trigger to ADR-0008 §5: "a future ADR
cites ADR-0008 using forbidden-citation form per §6 (without a fresh
four-ground analysis subsection)." Even without a machine audit,
this adds a named reopen path so the clause has teeth. The audit-
guard itself can remain deferred.

### MED 4 — Plan §Slice 39 option (b) language ("close-step writes both files") does not match the landed close-step behavior

**Evidence.**
- `specs/plans/phase-2-foundation-foldins.md:299-300`: option (b)
  reads "move the workflow-specific artifact to `<run-root>/artifacts/
  explore-result.json` **and have the close-step write both files**."
- `.claude-plugin/skills/explore/circuit.json:167-191` (close-step
  post-Slice-39): only writes `artifacts/explore-result.json`. The
  engine-authored `run.result` at `artifacts/result.json` is written
  by `src/runtime/result-writer.ts`, not by the close-step — per
  `specs/contracts/explore.md:119-124`'s §Path-split rationale:
  "`run.result` is engine-authored with a universal strict Zod shape
  (`RunResult` at `src/schemas/result.ts`); `src/runtime/result-
  writer.ts` RESULT-I1 declares the engine as the single writer to
  `result.json`."
- The contract-level resolution in explore.md v0.3 is semantically
  correct (single-writer invariant preserved; close-step writes the
  workflow-specific sibling only). But the plan wording is
  superseded without an amendment note.

**Impact.** Low-severity drift: the landed resolution is the right
one per RESULT-I1, and the contract v0.3 documents it correctly.
But the plan file now contains stale option-(b) prose that a fresh
reader could follow and author an incorrect fixture ("close-step
writes both files"). Slice 39 could have amended the plan to mark
the (b) phrasing as superseded.

**Fix hint.** Add a one-paragraph amendment to plan §Slice 39 noting
the landed resolution: close-step writes `explore-result.json` only;
`run.result` remains engine-authored at `result.json` per
RESULT-I1; the "both files" wording in the original option (b) was
imprecise. Cheap fold-in; land in the Slice 40 arc-close commit.

---

## LOW findings

### LOW 1 — `specs/artifacts.md` companion doc is further-stale after Slice 39

**Evidence.** The prior composition review's LOW 2 noted
`specs/artifacts.md:110` says the graph has 17 artifacts, but the
JSON has 22. Slice 39 added no new artifacts but *moved* one
(`explore.result`'s backing path). The artifacts.md companion is not
cited anywhere in the Slice 37/38/39 commits (based on the plan
prose) and presumably remains at the pre-arc staleness, now
compounded by one more drift point.

**Impact.** Not a runtime blocker. Continued companion-doc rot.

**Fix hint.** Fold a one-line update into the Slice 40 arc-close
commit, or defer to a general docs-drift sweep.

### LOW 2 — Slice 37 review is filed with `reviewer_model: gpt-5.4`; Slice 38 uses `gpt-5-codex`; naming inconsistency

**Evidence.**
- `specs/reviews/arc-slice-37-high-2-widen-event-schema-codex.md:6`:
  `reviewer_model: gpt-5.4`.
- `specs/reviews/arc-slice-38-dispatch-granularity-adr-0008-codex.md:5`:
  `reviewer_model: gpt-5-codex`.
- `specs/reviews/arc-slice-35-methodology-upgrade-codex.md:6`:
  `reviewer_model: gpt-5.4`.

**Impact.** The codebase has no canonical Codex model id; both are
valid names for the same underlying thing, but a downstream audit
that pivots on `reviewer_model` equality (e.g., "show me all Codex
reviews") would need to know both. Low-severity governance
consistency.

**Fix hint.** Pick one canonical spelling and normalize in the arc-
close commit, or document both as acceptable in the cross-model-
challenger test harness.

### LOW 3 — `tests/contracts/artifact-backing-path-integrity.test.ts` doesn't assert that live `ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS` is length `=== 0` as terminal state

**Evidence.**
- `tests/contracts/artifact-backing-path-integrity.test.ts:321`:
  `expect(ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS.length).toBe(0);` —
  this IS asserted. But the surrounding narrative treats it as an
  "is currently empty" state, not a "must remain empty" terminal
  state. A future slice could add an entry, fix the test to
  `toBe(1)`, and the ratchet would regress silently.

**Impact.** The ratchet is asserted, but any future slice adding an
allowlist entry would naturally touch the test and update the number.
The semantics of "must stay empty unless a new tracked collision is
formally declared" aren't captured by the assertion.

**Fix hint.** Rename the assertion / add a comment explicitly stating
the post-Slice-39 terminal-state rule: "a future slice adding an
entry MUST also author a challenger pass, update the ratchet floor,
and cite the closing slice; this test's assertion must not be
auto-updated to `toBe(1)` without that evidence." Doc-only; tiny.

---

## META observations

### META 1 — The arc is structurally honest; the seams that remain are plan/governance surface, not implementation

All four slice Codex reviews (including the absent Slice 39 one) land
with ACCEPT-WITH-FOLD-INS. The HIGH and MED findings folded in during
each slice's own review are real architectural improvements (the
distinct-adapter weaker-evidence disclosure, the dispatch materialization
rule, the non-precedent split, the stale-allowlist check). The
implementation work is solid.

The seams this review found are all at the *plan vs state* or
*check-semantics vs ceremony* surface — not at the code/contract
surface. That is itself a signal that the arc did its job on the
implementation side. The remaining drift is in the thinking-about-
the-arc surface, which the arc-close commit can absorb.

### META 2 — Check 26 is a prototype for a general mechanism; its narrowness is a feature and a risk

The `scripts/audit.mjs:3198-3205` comment acknowledges Check 26 is
narrow to this one arc: "Narrow on purpose: this is the audit
binding for ONE named arc, not a general 'composition review for
every arc' gate. A broader gate would require a tracked-arcs ledger
that does not yet exist."

This is correct scoping discipline. But every future arc after this
one will need its own Check 26 variant or a generalized ledger. The
CLAUDE.md §Cross-slice composition review cadence rule names no
tracking mechanism for "did the last ≥3-slice arc commission a
composition review." A future arc that doesn't land its own Check
variant is out of compliance but audit-green. The prior composition
review §META 1 commented on "no close criterion is missing its
binding" — META 2 here is the inverse: the *discipline rule* itself
lacks a generalized audit binding, relying on operator-remembers-to-
extend-Check-26 or author-a-new-ledger.

Not a fold-in for this arc. Named here as a forward-looking risk so
the next arc doesn't silently drift.

---

## Closing — what the operator should do

Pre-P2.4 (before the arc-close commit lands):

1. **HIGH 1 fold-in (plan vs state drift).** Amend
   `specs/plans/phase-2-foundation-foldins.md §Slice 40` to name
   Slice 40 as the arc-close composition review ceremony, record
   the HIGH 5 → P2.5 retargeting decision inline with operator
   continuity citation, and update `specs/plans/phase-2-
   implementation.md` if HIGH 5 has a new P2.5 anchor. Land in the
   Slice 40 arc-close commit.

2. **HIGH 2 fold-in (Check 26 chicken-and-egg + prong gap).** Either
   amend Check 26 to fire yellow (not red) when `current_slice >= 40`
   and review file absent (escape path (a)), OR document the
   same-commit-staging discipline in the check docstring + CLAUDE.md
   §Cross-slice composition review cadence (escape path (c)). Option
   (c) is cheapest; (a) is more durable. Operator's call.

3. **MED 2 fold-in (missing Slice 39 Codex).** Dispatch a retroactive
   Codex challenger pass on Slice 39's path-split + opts.knownCollisions
   API + vacuous-on-empty smell, land as
   `specs/reviews/arc-slice-39-high-4-explore-result-path-split-codex.md`.
   Could land in the Slice 40 arc-close commit; the Codex prong of
   THIS composition review may cover the same surface and subsume
   the retroactive pass.

4. **MED 1, MED 3, MED 4, all LOWs.** Incorporable inline in the
   Slice 40 arc-close commit as doc-prose edits; no code changes
   beyond MED 1's test shape improvement.

Closing verdict ACCEPT-WITH-FOLD-INS stands on the theory that the
arc produced the right implementation work and the seams above are
all incorporable into the Slice 40 arc-close commit. If the
operator prefers to land fold-ins as a second bundle (Slice 41 pre-
P2.4), the verdict downgrade to REJECT-PENDING-FOLD-INS is
defensible.

## Fold-in discipline

- HIGH #1 — Fold-in: inline in Slice 40 arc-close commit (plan file
  amendment + retargeting record).
- HIGH #2 — Fold-in: inline in Slice 40 arc-close commit (Check 26
  semantics amendment OR docstring clarification).
- MED #1 — Fold-in: inline in Slice 40 arc-close commit (test shape
  improvement).
- MED #2 — Fold-in or retroactive: dispatch Slice 39 Codex pass
  before or alongside Slice 40 arc-close commit; this review's
  Codex sibling may subsume.
- MED #3 — Fold-in: inline in Slice 40 arc-close commit (ADR-0008
  §5 reopen trigger addition).
- MED #4 — Fold-in: inline in Slice 40 arc-close commit (plan §Slice
  39 amendment marking option-(b) "both files" prose superseded).
- LOW #1 — Deferred to a docs-drift sweep (low urgency).
- LOW #2 — Fold-in: trivial normalization in Slice 40 arc-close commit.
- LOW #3 — Fold-in: doc comment in Slice 40 arc-close commit.
- META #1 and #2 — Observational; no fold-in required.

## Post-fold-in addendum (Slice 40 arc-close commit)

Closing verdict transitions from opening REJECT-PENDING-FOLD-INS → closing
ACCEPT-WITH-FOLD-INS on the following dispositions:

- **HIGH #1 (plan vs state drift).** Incorporated. `specs/plans/phase-2-
  foundation-foldins.md §Slice 40` rewritten as arc-close ceremony slice;
  HIGH 5 → P2.5 retargeting recorded inline + preserved as §Retargeted
  scope subsection for audit trail. `specs/plans/phase-2-implementation.md
  §P2.5` gained "HIGH 5 retargeting" deliverable naming
  `validateWorkflowKindPolicy` helper as P2.5 scope. `specs/contracts/
  explore.md §Invariant (single — EXPLORE-I1)` gained a "Runtime
  rejection delivery window (v0.3 amendment)" subsection reconciling
  "MUST reject" prose with the two-layer delivery.
- **HIGH #2 (Check 26 chicken-and-egg + prong gap).** Incorporated.
  `scripts/audit.mjs` Check 26 tightened to require BOTH Claude + Codex
  prong files matching the naming pattern with ACCEPT* closing verdicts.
  CLAUDE.md §Cross-slice composition review cadence amended with
  "Same-commit staging discipline" paragraph closing the chicken-and-egg.
  Five new tests exercise the two-prong gate.
- **MED #1 (vacuous-on-empty allowlist shape).** Incorporated.
  `tests/contracts/artifact-backing-path-integrity.test.ts` gained
  synthetic-entry shape-rejection + shape-acceptance tests.
- **MED #2 (missing Slice 39 Codex / v0.3 review link).** Incorporated.
  `specs/contracts/explore.md` frontmatter gained
  `codex_adversarial_review_v0_3` pointing to this review's Codex
  prong; the arc-close Codex prong subsumes the retroactive Slice 39
  pass (explicitly covers path-split + opts.knownCollisions + vacuous-
  on-empty).
- **MED #3 (ADR-0008 §6 non-precedent enforcement prose-only).**
  Incorporated. ADR-0008 §5 gained reopen trigger #7 for forbidden-
  citation detected in a future ADR.
- **MED #4 (plan §Slice 39 "both files" superseded).** Incorporated.
  Plan §Slice 39 gained a "Slice 40 arc-close fold-in (MED 4 — plan
  text amendment)" paragraph marking the "both files" wording as
  superseded by the landed resolution.
- **LOW #1 (specs/artifacts.md stale).** Deferred to docs-drift sweep.
- **LOW #2 (reviewer_model naming inconsistency).** Deferred as trivial
  normalization — both `gpt-5.4` and `gpt-5-codex` are accepted aliases
  for the same underlying model; future normalization can fold into the
  cross-model-challenger.test.ts schema as a reviewer_model allowlist.
- **LOW #3 (terminal-state comment).** Incorporated as a doc-comment on
  the live empty-allowlist assertion in the test file.
- **META #1 + #2.** Retained as non-objections.

Both convergent HIGH findings are closed in the Slice 40 arc-close
commit. Check 26 now fires red if either prong is missing or if either
prong's closing verdict is not ACCEPT*. P2.4 reopens at a future slice
carrying the HIGH 3 capability-boundary constraint per
`specs/plans/phase-2-implementation.md §P2.4` amendment.
