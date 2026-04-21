---
name: arc-slices-35-to-40-composition-review-codex
description: Cross-model challenger pass over the pre-P2.4 foundation fold-in arc, focused on boundary seams across Slices 35/37/38/39.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: composition-review
review_date: 2026-04-21
verdict: REJECT-PENDING-FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 (objections) + claude-opus-4-7 (fold-in synthesis + closing annotations at Slice 40 arc-close commit)
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
  LOW: 2
  META: 2
commands_run:
  - sed -n '1,220p' /Users/petepetrash/Code/claude-code-setup/skills/exhaustive-systems-analysis/SKILL.md
  - pwd
  - git status --short
  - git log e62a5c5..848f51a --oneline
  - rg --files specs CLAUDE.md PROJECT_STATE.md src scripts tests .claude-plugin | sort
  - wc -l <requested scope files>
  - shasum <requested scope files>
  - rg -n <composition-review search patterns> <requested scope files>
  - nl -ba <requested scope files> | sed -n <targeted line ranges>
  - rg -n '^\\s*(it|test)\\(' tests --glob '*.test.*' | wc -l
opened_scope:
  - specs/plans/phase-2-foundation-foldins.md
  - specs/reviews/p2-foundation-composition-review.md
  - specs/reviews/arc-slice-35-methodology-upgrade-codex.md
  - specs/reviews/arc-slice-37-high-2-widen-event-schema-codex.md
  - specs/reviews/arc-slice-38-dispatch-granularity-adr-0008-codex.md
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - specs/adrs/ADR-0008-dispatch-granularity-modeling.md
  - specs/contracts/explore.md
  - specs/contracts/run.md
  - src/schemas/event.ts
  - .claude-plugin/skills/explore/circuit.json
  - specs/artifacts.json
  - scripts/audit.mjs
  - tests/contracts/artifact-backing-path-integrity.test.ts
  - tests/contracts/adapter-binding-coverage.test.ts
  - CLAUDE.md
  - PROJECT_STATE.md
  - specs/ratchet-floor.json
skipped_scope:
  - specs/reviews/p2-foundation-composition-review-codex-transcript.md - archival transcript sibling; not needed once the main composition review and slice review records were read as authority.
  - tests/contracts/spine-coverage.test.ts - searched for HIGH 5 validation context, but not opened end-to-end because it was not in the requested read list.
  - src/runtime/runner.ts - opened targeted lines only to verify current dry-run dispatch behavior, not treated as part of opened_scope.
authority:
  - specs/plans/phase-2-foundation-foldins.md
  - specs/reviews/p2-foundation-composition-review.md
  - CLAUDE.md §Cross-slice composition review cadence
fold_in_disposition: HIGH #1 and HIGH #2 should fold in before P2.4 reopens; they are not safe to defer. MED #1/#2 can fold into the same governance bundle or a tight follow-up before P2.4. MED #3 must fold into P2.4 framing before that slice starts. MED #4 can fold into the next workflow-kind registration rule. LOWs are documentation/test-ratchet hardening and do not independently block.
---

# Arc Slices 35-40 Composition Review - Codex Challenger Pass

## Scope

This is an arc-close challenger pass over the pre-P2.4 foundation fold-in arc at `HEAD=848f51a`, covering Slices 35, 37, 38, and 39 plus the Slice 40 arc-close gate as currently represented in the plan and state files.

The target failure class is the same one found in `specs/reviews/p2-foundation-composition-review.md`: boundary seams where individual slices pass but the aggregate loses a load-bearing guarantee. I did not run `npm run verify`, `npm run audit`, or any mutating command.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** The arc closed three original HIGHs well enough to keep moving - event variants, dispatch-step visibility, and the result-path collision - but the current aggregate still has two blocker seams before P2.4: HIGH 5 was effectively retargeted out of the arc without updating the plan authority, and Check 26 is not currently an operative gate while the repository says the arc-close review is the next slice.

## Closing Verdict

**REJECT-PENDING-FOLD-INS.** The objections below should be handled as a second small fold-in bundle before P2.4. The highest priority is to make the HIGH 5 disposition explicit and machine-bound, then make the arc-close gate fire on the actual pre-P2.4 transition rather than on a slice marker that currently remains at 39.

## HIGH Findings

### HIGH 1 - HIGH 5 was retargeted out of the arc, but the authority chain still requires it before P2.4

**Evidence.**

- The arc plan still names Slice 40 as "HIGH 5 fold-in: extract `validateWorkflowKindPolicy` helper" and specifies that the helper runs `Workflow.safeParse` before kind policy, Check 24 calls that helper, and runtime fixture loading calls it too (`specs/plans/phase-2-foundation-foldins.md:327`, `specs/plans/phase-2-foundation-foldins.md:333`, `specs/plans/phase-2-foundation-foldins.md:338`, `specs/plans/phase-2-foundation-foldins.md:340`).
- The same plan says arc close requires all five HIGH findings to be closed (`specs/plans/phase-2-foundation-foldins.md:431`).
- Current project state says only one arc slice remains, "the arc-close composition review", before P2.4 reopens (`PROJECT_STATE.md:12`), so the named HIGH 5 implementation slice has disappeared from the live trajectory.
- `explore.md` now says full `Workflow.safeParse` validation for EXPLORE-I1 is deferred to P2.5 (`specs/contracts/explore.md:328`, `specs/contracts/explore.md:334`, `specs/contracts/explore.md:335`), while the headline invariant still says "The runtime MUST reject" violating `explore`-kinded workflows (`specs/contracts/explore.md:298`).
- Check 24 still parses raw JSON and hand-extracts `fixture.phases` rather than parsing through `Workflow.safeParse` (`scripts/audit.mjs:2761`, `scripts/audit.mjs:2763`, `scripts/audit.mjs:2786`, `scripts/audit.mjs:2788`).

**Impact.** This re-opens the exact original composition-review HIGH 5. P2.4 can still start with a foundation where the contract says runtime rejection, the arc plan says pre-P2.4 helper extraction, but the implemented audit/runtime path still only hand-checks phase canonicals. The retarget may be a valid product decision, but it is not currently reflected in the arc authority that P2.4 implementers will read.

**Required fold-in.** Pick one and make it authoritative: either land the `validateWorkflowKindPolicy` helper before P2.4 as the plan still says, or amend `specs/plans/phase-2-foundation-foldins.md` and `specs/contracts/explore.md` so HIGH 5 is explicitly deferred with a named P2.5 blocker and no "runtime MUST reject" overclaim. Disposition: folded in before P2.4; not safe as an implicit deferral.

### HIGH 2 - Check 26 does not currently enforce the arc-close review before P2.4 can be framed

**Evidence.**

- CLAUDE.md's cadence rule requires a composition review before the next privileged runtime slice opens (`CLAUDE.md:190`, `CLAUDE.md:191`, `CLAUDE.md:197`, `CLAUDE.md:199`).
- The first-instance binding says Check 26 fires once `PROJECT_STATE.md` `current_slice` advances to 40 or beyond (`CLAUDE.md:202`, `CLAUDE.md:206`, `CLAUDE.md:207`).
- The live state marker is still `<!-- current_slice: 39 -->` (`PROJECT_STATE.md:1`), even though project state says the next work is the final arc-close review and then P2.4 (`PROJECT_STATE.md:12`).
- The implementation returns green when `sliceNum < 40` (`scripts/audit.mjs:3244`, `scripts/audit.mjs:3247`) and the live test explicitly accepts today's state because "arc still in progress" (`tests/contracts/artifact-backing-path-integrity.test.ts:536`, `tests/contracts/artifact-backing-path-integrity.test.ts:537`, `tests/contracts/artifact-backing-path-integrity.test.ts:538`).

**Impact.** The gate is keyed to an epoch update, not to the P2.4 transition it is supposed to guard. If this review file is written but the slice marker stays at 39, Check 26 remains informational-green. If P2.4 is framed next without first moving `current_slice` to 40, the promised audit block is not active. That is a governance-boundary failure: the state file claims "the audit will block P2.4", but the audit only blocks after a marker update that the review file itself does not perform.

**Required fold-in.** Make the gate fire on the real transition. Options: update the arc-close review ceremony to bump `current_slice` to 40 in the same non-code slice, or add a P2.4 preflight check that refuses protected-path P2.4 commits unless an accepted arc-close review already exists regardless of the current marker. Disposition: folded in before P2.4; current Check 26 is not sufficient as the only guard.

## MED Findings

### MED 1 - Check 27's materialization rule does not bind fixture artifact paths back to the artifact registry

**Evidence.**

- `explore.md` says `specs/artifacts.json` writers/readers and the fixture `reads` arrays "MUST match this table exactly" and that divergence is a ratchet violation (`specs/contracts/explore.md:424`, `specs/contracts/explore.md:425`, `specs/contracts/explore.md:426`).
- Check 27 Rule 3 only verifies that every dispatch step has a `writes.artifact` object (`scripts/audit.mjs:3423`, `scripts/audit.mjs:3425`, `scripts/audit.mjs:3430`, `scripts/audit.mjs:3437`).
- The live fixture's Slice 39 path split is on the non-dispatch Close step: `writes.artifact.path = "artifacts/explore-result.json"` (`.claude-plugin/skills/explore/circuit.json:175`, `.claude-plugin/skills/explore/circuit.json:177`, `.claude-plugin/skills/explore/circuit.json:179`), matching the registry row at `<run-root>/artifacts/explore-result.json` (`specs/artifacts.json:693`, `specs/artifacts.json:704`).
- The live Check 27 regression only asserts dispatch-step artifact presence and that `writes.result` differs from `writes.artifact.path`; it explicitly scopes runtime materialization to P2.4 (`tests/contracts/adapter-binding-coverage.test.ts:432`, `tests/contracts/adapter-binding-coverage.test.ts:436`, `tests/contracts/adapter-binding-coverage.test.ts:448`).

**Impact.** The current live data is aligned, but the ratchet does not enforce the exact cross-file table claim. A future edit can move `close-step.writes.artifact.path`, or change a dispatch artifact path/schema to an unregistered artifact, while Check 25 remains green (no duplicate path) and Check 27 remains green (some object exists). This is a path-binding seam between Slice 38's dispatch materialization rule and Slice 39's artifact-path split.

**Required fold-in.** Add a cross-layer fixture-to-artifact-registry check: every `writes.artifact.schema` in the explore fixture must resolve to the expected artifact id, and the relative path must normalize to that artifact row's `backing_paths`. Include Close / `explore.result`, not only dispatch steps. Disposition: folded in or scoped to the next artifact-registry ratchet before more workflow kinds land.

### MED 2 - `explore.md` is version 0.3 but the executable review linkage is still version-blind

**Evidence.**

- `specs/contracts/explore.md` declares `version: 0.3` (`specs/contracts/explore.md:4`).
- Its canonical `codex_adversarial_review` still points to `explore-md-v0.1-codex.md`, and the v0.2 review is carried only in a custom `codex_adversarial_review_v0_2` key; there is no v0.3 review key (`specs/contracts/explore.md:8`, `specs/contracts/explore.md:9`, `specs/contracts/explore.md:12`).
- The linked canonical review is explicitly `contract_version: 0.1` (`specs/reviews/explore-md-v0.1-codex.md:5`, `specs/reviews/explore-md-v0.1-codex.md:6`).
- The cross-model challenger linkage test verifies that a contract's `codex_adversarial_review` target matches the contract stem, but it does not compare the contract's current `version` to the review's `contract_version` (`tests/contracts/cross-model-challenger.test.ts:918`, `tests/contracts/cross-model-challenger.test.ts:925`, `tests/contracts/cross-model-challenger.test.ts:931`).

**Impact.** The contract-review ratchet can pass while the current contract version has no version-bound review. That matters here because v0.2 changed dispatch semantics and v0.3 changed artifact ownership. The arc reviews cover those changes narratively, but the executable CHALLENGER-I3 contract-to-review link still points at v0.1.

**Required fold-in.** Either add a canonical v0.3 review link/file, or update the review-linkage schema so amended contract versions can declare a list of version-specific reviews and the test checks that the latest contract version has a matching review or accepted arc-review substitute. Disposition: folded in as review-record hardening; not a P2.4 runtime blocker by itself.

### MED 3 - The HIGH 3 capability-boundary constraint is not copied into the P2.4 implementation plan

**Evidence.**

- The fold-in plan scopes HIGH 3 as a P2.4 constraint: "P2.4 v0 ships with no repo-write tool capability" and the P2.4 commit body must cite that capability boundary (`specs/plans/phase-2-foundation-foldins.md:381`, `specs/plans/phase-2-foundation-foldins.md:384`, `specs/plans/phase-2-foundation-foldins.md:385`).
- ADR-0007 trigger #6 reopens isolation when an adapter, hook, workflow step, plugin command, or subprocess can write protected repo surfaces, with P2.4's `agent` adapter named as the example (`specs/adrs/ADR-0007-phase-2-close-criteria.md:424`, `specs/adrs/ADR-0007-phase-2-close-criteria.md:428`).
- The parent P2.4 plan deliverable and acceptance evidence still describe implementing the `agent` adapter and green audit/test evidence, but do not mention "no repo-write tool capability" or the required capability-boundary citation (`specs/plans/phase-2-implementation.md:251`, `specs/plans/phase-2-implementation.md:258`, `specs/plans/phase-2-implementation.md:263`, `specs/plans/phase-2-implementation.md:265`).

**Impact.** A P2.4 implementer reading the parent implementation plan can miss the only concrete mitigation for original HIGH 3. The fold-in plan says it does not supersede P2.4, but the constraint has not been pushed into the P2.4 slice text where implementation will happen.

**Required fold-in.** Amend `specs/plans/phase-2-implementation.md §P2.4` to include the no-repo-write capability constraint in deliverable and acceptance evidence, and require the P2.4 challenger prompt to inspect that capability boundary explicitly. Disposition: folded in before P2.4 framing.

### MED 4 - Check 27's second-workflow behavior is yellow, not a blocking recurrence guard

**Evidence.**

- Check 24 still treats workflow ids not in `WORKFLOW_KIND_CANONICAL_SETS` as pass-through (`scripts/audit.mjs:2725`, `scripts/audit.mjs:2728`, `scripts/audit.mjs:2780`, `scripts/audit.mjs:2782`).
- Check 27 improves unknown workflow kinds from green to yellow, but still does not red them; it pushes a warning and continues (`scripts/audit.mjs:3368`, `scripts/audit.mjs:3374`, `scripts/audit.mjs:3377`, `scripts/audit.mjs:3452`, `scripts/audit.mjs:3455`).
- ADR-0008 says a future `build`, `repair`, `migrate`, or `sweep` fixture may force a reopen if it chooses option (b), and separately if Check 27 misfires on a legitimate zero-dispatch fixture (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:461`, `specs/adrs/ADR-0008-dispatch-granularity-modeling.md:469`, `specs/adrs/ADR-0008-dispatch-granularity-modeling.md:473`).

**Impact.** This is better than the pre-Slice-38 silent green pass, but it is not a hard recurrence guard. If a second workflow kind lands as an unregistered fixture, the audit reports yellow rather than blocking. The current project often treats red-free audit as acceptable during fold-ins, so "yellow means humans notice" is weaker than the ADR's "prevents recurrence" posture.

**Required fold-in.** For new workflow fixture landings, unknown ids should be red unless the fixture id is in a tracked exempt list with a rationale. Yellow is fine for legacy unknowns, but new workflow-kind introduction should be a gate. Disposition: scoped to the next workflow-kind slice, but the rule should be designed now.

## LOW Findings

### LOW 1 - ADR-0008 cites the Slice 37 transcript schema indirectly and with stale line granularity

**Evidence.**

- ADR-0007's Slice 37 amendment is the authoritative binding for the five-event sequence and line-binds the new event variants (`specs/adrs/ADR-0007-phase-2-close-criteria.md:156`, `specs/adrs/ADR-0007-phase-2-close-criteria.md:177`, `specs/adrs/ADR-0007-phase-2-close-criteria.md:195`).
- ADR-0008 repeatedly says "Slice 37" or "ADR-0007 CC#P2-2" rather than citing the amendment block directly (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:197`, `specs/adrs/ADR-0008-dispatch-granularity-modeling.md:200`, `specs/adrs/ADR-0008-dispatch-granularity-modeling.md:767`).
- Its provenance cites `src/schemas/event.ts:78-173`, but the `DispatchResultEvent` body now runs through line 179 (`src/schemas/event.ts:170`, `src/schemas/event.ts:179`; `specs/adrs/ADR-0008-dispatch-granularity-modeling.md:789`, `specs/adrs/ADR-0008-dispatch-granularity-modeling.md:792`).

**Impact.** Not a blocker because the event schema is real and `explore.md` does cite "ADR-0007 CC#P2-2 + ADR-0007 §Amendment" elsewhere. But ADR-0008 is a modeling ADR that consumes the Slice 37 amendment, so its authority chain should point at the amendment, not only at the parent ADR and stale source line ranges.

**Required fold-in.** Update ADR-0008 related/provenance/references to cite `ADR-0007 §Amendment (Slice 37)` explicitly and refresh the event.ts line range or remove fragile line numbers. Disposition: folded in as doc cleanup.

### LOW 2 - The known-collision allowlist shape tests are now intentionally vacuous

**Evidence.**

- Slice 39 asserts the live allowlist is empty (`tests/contracts/artifact-backing-path-integrity.test.ts:315`, `tests/contracts/artifact-backing-path-integrity.test.ts:321`).
- The entry-shape test explicitly says it is vacuously satisfied when the array is empty (`tests/contracts/artifact-backing-path-integrity.test.ts:416`, `tests/contracts/artifact-backing-path-integrity.test.ts:417`, `tests/contracts/artifact-backing-path-integrity.test.ts:418`).
- The freeze test similarly loops over zero entries after asserting the array itself is frozen (`tests/contracts/artifact-backing-path-integrity.test.ts:431`, `tests/contracts/artifact-backing-path-integrity.test.ts:432`, `tests/contracts/artifact-backing-path-integrity.test.ts:433`).

**Impact.** This is not a recurrence hole for the original collision; Check 25 is green and future entries will be inspected when present. The risk is narrower: entry-level shape/freeze coverage no longer has a live positive exemplar. A future refactor can accidentally weaken entry construction and the live test will not notice until a new exception is added.

**Required fold-in.** Add a synthetic known-collision shape/freeze fixture alongside the existing synthetic stale-collision tests so the entry-level invariant is exercised even when the live allowlist is empty. Disposition: deferred test hardening; not a P2.4 blocker.

## META Observations

### META 1 - The Slice 39 test floor is arithmetically consistent

The pinned floor is `830` and `last_advanced_in_slice` is `"39"` (`specs/ratchet-floor.json:4`, `specs/ratchet-floor.json:7`). A read-only static declaration count with the same pattern reported `830`. This does not prove the two Slice 39 tests are high-value invariants, but it does mean the floor number itself matches the repository state.

Disposition: Incorporated as a non-objection.

### META 2 - Slice 39 did close the original backing-path collision

The registry now separates `run.result` at `<circuit-next-run-root>/artifacts/result.json` (`specs/artifacts.json:202`, `specs/artifacts.json:216`) from `explore.result` at `<run-root>/artifacts/explore-result.json` (`specs/artifacts.json:693`, `specs/artifacts.json:704`). The remaining objection is not "the collision still exists"; it is that the next layer of path binding is not yet machine-checked.

Disposition: Incorporated as a non-objection.

## Closing

Do not reopen P2.4 yet. The minimum fold-in bundle is small: make the HIGH 5 disposition explicit and binding, make the arc-close review gate active before P2.4 can be framed, and copy the HIGH 3 capability constraint into the P2.4 implementation plan. After that, the remaining MED/LOW items can be folded into the next ratchet-touching slice without blocking the adapter.

## Post-fold-in addendum (Slice 40 arc-close commit)

This addendum was authored during the Slice 40 arc-close ceremony
commit after all inline fold-ins landed. Closing verdict transitions
from REJECT-PENDING-FOLD-INS → ACCEPT-WITH-FOLD-INS on the following
dispositions:

- **HIGH #1 — HIGH 5 retargeting invisible at authority chain.**
  Incorporated. `specs/plans/phase-2-foundation-foldins.md §Slice 40`
  rewritten as arc-close ceremony slice with explicit HIGH 5 → P2.5
  retargeting note preserving the original scope as §Retargeted
  scope subsection for audit trail. `specs/plans/phase-2-implementation.md
  §P2.5` gained a new "HIGH 5 retargeting" deliverable subsection
  naming `validateWorkflowKindPolicy` helper extraction as P2.5
  scope. `specs/contracts/explore.md §Invariant (single — EXPLORE-I1)`
  gained a "Runtime rejection delivery window (v0.3 amendment)"
  subsection reconciling the "MUST reject" prose with the
  fixture-level/runtime-level two-layer delivery.
- **HIGH #2 — Check 26 not an operative pre-P2.4 gate.**
  Incorporated. `scripts/audit.mjs` Check 26
  (`checkArcCloseCompositionReviewPresence`) tightened to require
  BOTH a Claude prong file AND a Codex prong file matching the
  naming pattern with both carrying ACCEPT* closing verdicts
  (two-prong gate). CLAUDE.md §Cross-slice composition review
  cadence amended with a "Same-commit staging discipline" paragraph
  documenting that the arc-close ceremony slice stages both prong
  review files + advances `current_slice` in one commit, closing
  the chicken-and-egg. Five new tests exercise the two-prong gate
  (single-prong fails, mismatched-prong-verdict fails, prong-labeled
  naming required, both-prongs-accept passes).
- **MED #1 — Check 27 fixture-to-artifact-registry binding.**
  Scoped to the next workflow-kind slice per fold-in disposition.
  Design rule documented in `specs/plans/phase-2-foundation-foldins.md
  §Slice 40 Deliverable` so the rule survives P2.4.
- **MED #2 — explore.md v0.3 review linkage version-blind.**
  Incorporated. `specs/contracts/explore.md` frontmatter gained
  `codex_adversarial_review_v0_3` pointing to THIS review file
  (the arc-close Codex prong). The arc-close Codex prong
  subsumes a retroactive Slice 39 Codex pass because this review
  explicitly covers the path-split decision, opts.knownCollisions
  API shape, and vacuous-on-empty regression smell.
- **MED #3 — HIGH 3 capability constraint not in P2.4 plan.**
  Incorporated. `specs/plans/phase-2-implementation.md §P2.4`
  amended with "HIGH 3 capability-boundary constraint" subsection
  requiring P2.4 v0 to ship with no repo-write tool capability,
  requiring the commit body to cite the capability boundary, and
  requiring the P2.4 Codex challenger prompt to inspect the
  capability boundary as a named review item.
- **MED #4 — Check 27 second-workflow behavior yellow not red.**
  Scoped to the next workflow-kind slice per fold-in disposition
  (design rule: new workflow-kind introductions produce red unless
  in a tracked exempt list with rationale; existing unknown-kind
  yellow behavior retained for backward compat).
- **LOW #1 — ADR-0008 stale event.ts line range + amendment citation.**
  Deferred to a docs-drift sweep (low urgency per original
  disposition; not a P2.4 blocker).
- **LOW #2 — Vacuous-on-empty allowlist shape tests.**
  Incorporated. `tests/contracts/artifact-backing-path-integrity.test.ts`
  gained two new tests: (1) shape invariant rejection over a
  malformed synthetic entry (per-field assertions documented),
  (2) shape invariant acceptance over a synthetic valid entry
  (positive-exemplar so the contract survives even when the live
  allowlist is empty). Plus a terminal-state comment on the
  existing empty-allowlist assertion per Claude LOW 3 fold-in.
- **META #1 + #2.** Retained as non-objections.

The two convergent HIGH findings are closed in the Slice 40 arc-close
commit. Check 26 is now a genuine pre-P2.4 gate: both prong files
must be present with ACCEPT* closing verdicts for P2.4 to reopen.
P2.4 reopens at a future slice; the arc-close-cadence discipline is
now both documented in CLAUDE.md and machine-enforced in Check 26.
