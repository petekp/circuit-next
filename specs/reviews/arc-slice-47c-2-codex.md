---
name: arc-slice-47c-2-codex
description: Cross-model challenger pass over Slice 47c continuation (commit 66f1934, descriptive sub-name "47c-2") — operator decision ratifies Option A literal cross-model challenger policy. Per-slice review per CLAUDE.md §Hard invariants #6 (literal rule, now binding under operator's Option A pick) — slice modifies behavioral-spec invariant + ratifies methodology decision; both qualify as governance-surface movement. Returns OBJECTION LIST per CHALLENGER-I1.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-22
verdict: REJECT-PENDING-FOLD-INS -> incorporated -> ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-47c-continuation
target_kind: arc
target: slice-47c-continuation
target_version: "HEAD=66f1934 (slice-47c continuation / 47c-2)"
arc_target: slice-47c-continuation-single-slice
arc_version: "HEAD=66f1934 (slice-47c continuation / 47c-2)"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 2
  med: 2
  low: 1
  meta: 1
commands_run:
  - git log --oneline -10
  - git show 66f1934
  - git diff d1dd56e..66f1934
  - cat CLAUDE.md
  - cat specs/behavioral/cross-model-challenger.md
  - cat PROJECT_STATE.md
  - cat specs/plans/slice-47-hardening-foldins.md
  - cat specs/reviews/phase-2-to-date-comprehensive-codex.md
  - cat specs/reviews/arc-slice-47a-codex.md
  - cat scripts/audit.mjs
  - npm run verify
  - npm run audit
opened_scope:
  - PROJECT_STATE.md (active entry post-amend)
  - specs/behavioral/cross-model-challenger.md (CHALLENGER-I2 amendment + last_updated)
  - specs/plans/slice-47-hardening-foldins.md (§Slice 47c-2 + §Slice 47d scope item 1 amendment)
  - specs/plans/phase-2-implementation.md (§Slice 45a + §Slice 46b paragraphs — supersession note targets)
  - CLAUDE.md (§Hard invariants #6 — verified unchanged)
  - scripts/audit.mjs (Lane declaration check + Phase 2 isolation citation check + SLICE_ID_PATTERN + checkStatusEpochAlignment)
  - 66f1934 commit body (challenger discipline)
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen circuit (read-only reference per CLAUDE.md)
  - the in-flight 47b + 47c (partial) batched challenger pass (separate review)
---

# Cross-model challenger review — Slice 47c continuation (commit 66f1934 / "47c-2")

**Verdict (opening):** REJECT-PENDING-FOLD-INS
**Verdict (closing):** ACCEPT-WITH-FOLD-INS *(after this slice's fold-in amend)*

## HIGH

### HIGH 1 — HEAD does not satisfy the slice's own verification/audit acceptance evidence

**Finding:** PROJECT_STATE.md:7 and specs/plans/slice-47-hardening-foldins.md:127 claim `npm run verify` and `npm run audit` are green. Fresh run on the operator-local environment produced `npm run audit` = **28 green / 3 yellow / 2 red**. The red findings are: (a) Lane declaration missing — Check 1 at scripts/audit.mjs:4449-4467 requires exact substring `Lane: ${lane}` (mixed case), the commit body uses uppercase `LANE: Equivalence Refactor`; (b) Phase 2 slice isolation citation missing — Check 23 at scripts/audit.mjs:2346-2399 requires exact `Isolation: policy-compliant (no implementer separation required)` for Phase 2 commits touching specs/, the commit body omits this exact text. The PROJECT_STATE entry's framing carries the correct text but the audit checks scan COMMIT BODIES not PROJECT_STATE entries.

**Evidence:** scripts/audit.mjs:376 (`checkLane` exact-substring match for `Lane: ${lane}`). scripts/audit.mjs:2346-2399 (`checkPhase2SliceIsolationCitation` exact-text posture check). 66f1934 commit body uses `LANE:` uppercase + omits Isolation posture line.

**Impact:** The committed state is red under the repo's own audit gate, so the slice's "acceptance evidence: npm run verify + npm run audit both green" is false post-commit. This also means the next slice would start from a known-red methodology gate, undermining the claimed closure of a methodology-discipline finding (the very HIGH 5 this slice resolves).

**Remediation:** Disposition path: operator/Claude fold in via amend. Amend 66f1934 so the commit body includes exact `Lane: Equivalence Refactor` and exact `Isolation: policy-compliant (no implementer separation required)`, then rerun `npm run verify` and `npm run audit`. New SHA replaces 66f1934 in branch history.

**Disposition:** Incorporated. Commit body amended via `git commit --amend` to include exact `Lane: Equivalence Refactor` (mixed case per scripts/audit.mjs:376 substring match) AND exact `Isolation: policy-compliant (no implementer separation required)` (per scripts/audit.mjs:2358 posture allowlist). Audit re-run confirms green post-amend.

### HIGH 2 — The active Phase 2 plan still contains the retired "ratchet without governance movement needs no Codex" rationale

**Finding:** specs/behavioral/cross-model-challenger.md §CHALLENGER-I2 (post-amendment) now says any ratchet advance requires Codex, even mechanical test-count/audit advances. But specs/plans/phase-2-implementation.md:690-693 still says Slice 45a had "no Codex challenger pass" because none of the listed triggers apply, even though specs/plans/phase-2-implementation.md:680-682 records it as a Ratchet-Advance slice with `+1` static declaration. More directly, specs/plans/phase-2-implementation.md:757-760 still says Slice 46b had "No ADR amendment, no Codex challenger pass" because it "advances ratchet without governance-surface movement." The originating review explicitly warned not to leave both interpretations live at specs/reviews/phase-2-to-date-comprehensive-codex.md:216-220.

**Evidence:** specs/behavioral/cross-model-challenger.md:56-64 (post-amendment literal-scope clause). specs/plans/phase-2-implementation.md:690-693 (Slice 45a no-Codex rationale, retired but still live). specs/plans/phase-2-implementation.md:757-760 (Slice 46b no-Codex rationale, retired but still live).

**Impact:** This commit claims to close the loophole authoritatively, but one active plan surface still preserves the exact loophole language future authors can cite. The new CHALLENGER-I2 text is stronger, but the repo would have contradictory live guidance rather than a clean supersession trail.

**Remediation:** Disposition path: operator/Claude fold in. Add explicit supersession notes to the Slice 45a and 46b paragraphs in specs/plans/phase-2-implementation.md: the historical no-Codex rationale is retired by Slice 47c-2, those slices are covered only by the one-time Slice 47d amnesty path, and future ratchet advances may not cite those paragraphs as precedent.

**Disposition:** Incorporated. Both Slice 45a and Slice 46b paragraphs in specs/plans/phase-2-implementation.md amended with explicit "Supersession note (Slice 47c-2 / Codex HIGH 2 fold-in, 2026-04-22)" subsection naming the retired interpretation, the binding Slice 47d amnesty path, and the precedent-citation prohibition for future slices.

## MED

### MED 1 — The past-slice amnesty binding is prose-only and can be satisfied by a vague 47d review

**Finding:** specs/plans/slice-47-hardening-foldins.md:150-151 says the Slice 47d composition-review prompt "MUST name" Slices 43a / 43b / 43c / 45a / 46b. But the acceptance evidence at specs/plans/slice-47-hardening-foldins.md:145-147 only requires the two prong files and ACCEPT-class verdicts. The current arc-close audit checks only file presence and closing verdicts at scripts/audit.mjs:3231-3300; it does not inspect whether those past slices are named. The review-record schema enforces commands_run, opened_scope, and skipped_scope for arc/phase records at tests/contracts/cross-model-challenger.test.ts:151-160 and tests/contracts/cross-model-challenger.test.ts:566-630, but there is no covered_slices / amnesty_scope field or exact-slice set check.

**Evidence:** specs/plans/slice-47-hardening-foldins.md:150-151 (prose-only "MUST name"). scripts/audit.mjs Check 26 checks file presence + closing verdict only. tests/contracts/cross-model-challenger.test.ts:151-160 + 566-630 (review-record schema enforces base + opened_scope/skipped_scope but no covered_slices field).

**Impact:** A future Slice 47d Codex prong could pass the existing audit while only reviewing the 47 arc and giving the five past slices a sentence-level nod. That would make the amnesty path weaker than the individual backfill passes it replaces.

**Remediation:** Disposition path: fold in or explicitly defer with a named follow-up. Minimum fold-in: require Slice 47d prong frontmatter to include a machine-readable amnesty_scope or covered_slices list containing exactly `43a, 43b, 43c, 45a, 46b`, and add a contract/audit check for the 47d review files. If deferring, name the deferral as a real follow-up before 47d, not "if drift recurs."

**Disposition:** Deferred with named follow-up. Captured at specs/plans/slice-47-hardening-foldins.md §Slice 47d scope item 1 amendment (this commit) as a hard prerequisite before 47d arc-close: BOTH prong files MUST carry an `amnesty_scope: [43a, 43b, 43c, 45a, 46b]` (or `covered_slices` — naming TBD at 47d authoring) frontmatter field; missing field treated as REJECT-PENDING-FOLD-INS at 47d Codex challenger pass. Audit-check for the field deferred to a follow-up after 47d closes (the field's existence is the binding; the check is the enforcement).

### MED 2 — Future literal-policy enforcement is deferred to the same honor-system layer that already failed

**Finding:** specs/plans/slice-47-hardening-foldins.md:128 defers a RED audit check for ratchet-without-Codex and says mechanical enforcement can land later "if drift recurs." PROJECT_STATE.md:7 repeats the same rationale. But the failure being closed is precisely a repeated practice drift across Slices 43a / 43b / 43c / 45a / 46b, and CHALLENGER-I2 only says future drift "returns through this invariant" at specs/behavioral/cross-model-challenger.md:69-72.

**Evidence:** specs/plans/slice-47-hardening-foldins.md:128 (Alternate framing (a) deferral). PROJECT_STATE.md:7 (alternate framing (a) deferral repeated). Past drift across five slices is the originating evidence pattern.

**Impact:** The policy text is now better, but there is still a regression window: the next mechanical ratchet can skip Codex, leave a plausible rationale, and remain audit-green until another human/model notices. This is a weaker closure than the adjacent ADR-0007 scalar-progress firewall, which became an actual audit check.

**Remediation:** Disposition path: fold in or defer with a bounded trigger. Either land a small enforcement slice before the next ratchet/floor advance, or add a named follow-up with a hard reopen condition. A practical first version can audit for exact `Codex challenger: REQUIRED|NOT REQUIRED` in slice commit bodies and fail when a commit advances specs/ratchet-floor.json, adds tests/**/*.test.*, or changes scripts/audit.mjs without a matching specs/reviews/arc-slice-<slice>-codex.md or explicit arc-subsumption field.

**Disposition:** Deferred with HARD bounded trigger (not "if drift recurs"). Captured in plan amendment (this commit) as: a mechanical-enforcement audit check MUST land in or before the next slice that ATTEMPTS to advance specs/ratchet-floor.json, OR the next slice that adds a tests/**/*.test.* file, OR the next slice that modifies scripts/audit.mjs — whichever fires first. The check's first-version shape (per Codex's recommendation): scan the slice's commit body for exact `Codex challenger: REQUIRED` declaration AND verify a corresponding specs/reviews/arc-slice-<slice>-codex.md OR the slice has an explicit arc-subsumption field naming the future arc-close review that will cover it. If neither, audit goes RED. The 47d arc-close composition-review prong files do NOT count for satisfying this gate (they're the amnesty path for past slices, not a forward-looking exemption mechanism).

## LOW

### LOW 1 — The behavioral spec metadata was not refreshed with the substantive 47c-2 edit

**Finding:** specs/behavioral/cross-model-challenger.md:5 still says `last_updated: 2026-04-20`, while the same file now records the 2026-04-22 Slice 47c-2 decision at specs/behavioral/cross-model-challenger.md:53-72.

**Evidence:** specs/behavioral/cross-model-challenger.md:5 (`last_updated: 2026-04-20` pre-fold-in).

**Impact:** Low operational risk, but it weakens the spec's freshness signal on exactly the governance surface this slice is trying to make authoritative.

**Remediation:** Disposition path: operator/Claude fold in. Set `last_updated: 2026-04-22` in the same fold-in that addresses the higher-priority issues.

**Disposition:** Incorporated. specs/behavioral/cross-model-challenger.md frontmatter `last_updated` updated from `2026-04-20` to `2026-04-22` in this commit's amend.

## META

No objection to keeping canonical `current_slice=47c` while using "47c-2" as a descriptive sub-name. The audit pattern at scripts/audit.mjs:1791 (SLICE_ID_PATTERN = `/^[0-9]+[a-z]?$/`) and status-doc freshness check at scripts/audit.mjs:1869-1928 make a literal `47c-2` marker invalid, and the PROJECT_STATE explanation is sufficient for future readers.

**Disposition:** No action — META acknowledged.

## Trajectory check

The slice points in the right direction conceptually: Option A is now stated plainly, CHALLENGER-I2 is much harder to narrow by implication, and the past-slice amnesty route is at least named. The opening problem was execution discipline around the policy — the committed tree was audit-red here, old active-plan prose still preserved the retired rationale, and the two future-facing bindings were mostly prose. **Post-fold-in (this commit's amend), HIGH 1 + HIGH 2 + LOW 1 are closed; MED 1 + MED 2 are deferred with HARD reopen conditions (not "if drift recurs"). The closing verdict moves to ACCEPT-WITH-FOLD-INS.** The MED-deferred items are real risks but bounded and named — MED 1 binds at Slice 47d authoring (frontmatter field becomes a 47d acceptance-evidence prerequisite); MED 2 binds at the next ratchet-advancing slice (mechanical enforcement audit check becomes a co-landing requirement, not a future hope).
