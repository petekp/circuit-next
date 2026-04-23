---
name: arc-planning-readiness-meta-arc-composition-review-claude
description: Fresh-read Claude composition-adversary pass over the Planning-Readiness Meta-Arc (slices 57-61a as a unit). Arc-close ceremony per CLAUDE.md §Cross-slice composition review cadence.
type: review
reviewer_model: claude-opus-4-7
authorship_role: fresh-read-composition-adversary
review_kind: arc-close-composition-review
review_date: 2026-04-23
verdict: ACCEPT-WITH-FOLD-INS
authored_by: claude-opus-4-7
review_target: planning-readiness-meta-arc
target_kind: arc
target: planning-readiness-meta-arc
target_version: "HEAD=81ffe8c (slice-61a — CLAUDE.md successor-to-live trigger + memory checklist strengthening + ADR-0010 Layer 3 paragraph)"
arc_target: planning-readiness-meta-arc
arc_version: "revision 08 / operator-signoff / slices 57-61a landed"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: "ACCEPT-WITH-FOLD-INS (all 3 findings folded in this same ceremony commit)"
severity_counts:
  critical: 0
  high: 1
  med: 1
  low: 1
commands_run:
  - read all 11 slice commit messages (57, 57a-i, 58, 58a, 59, 59a, 60, 60a, 61, 61a)
  - read all 5 per-slice Codex reviews (arc-slice-57-codex.md through arc-slice-61-codex.md)
  - read specs/plans/planning-readiness-meta-arc.md revision 08 end-to-end
  - read specs/adrs/ADR-0010-arc-planning-readiness-gate.md end-to-end
  - read specs/reviews/p2-9-plan-draft-content-challenger.md (13-finding denominator)
  - read specs/reviews/p2-9-plan-lint-retroactive-run.md (Slice 60 proof)
  - read scripts/plan-lint.mjs (22 rules + loadInvariantLayerVocab + parsePlan)
  - read scripts/audit.mjs Check 36 (checkPlanLintCommittedPlans)
  - read specs/invariants.json (6-key vocab + blocked definition)
  - read CLAUDE.md §Plan-authoring discipline (279 lines)
  - read out-of-repo memory file + MEMORY.md index
  - npm run verify + npm run audit (both green 33/2/0)
  - cross-compare slice-text scope claims vs reality (e.g., rule count evolution across 58/58a)
opened_scope:
  - full arc slices 57 → 61a as composition unit
  - authority-surface consistency: plan vs ADR vs CLAUDE.md vs memory
  - rule-count evolution across slices
  - plan-lifecycle state machine coherence across plan-lint + audit Check 36
  - rule #4 evolution (3 strengthening steps across Slice 60 + 60a)
  - vocab authority split (hardcoded fallback → JSON authoritative)
  - cross-slice citation handling (untracked P2.9 + committed fixture)
  - discipline-layer cross-reference completeness
skipped_scope:
  - p2-11 plugin wiring (explicitly out of scope per arc authority)
  - P2.8 router (explicitly deferred)
  - reference-Circuit parity for review workflow (that's the downstream P2.9 arc)
fold_in_status:
  HIGH-1: "resolved-in-this-ceremony-commit (plan §4 Slice 58 updated to reflect Slice 58a scope promotion from 19 → 22 rules)"
  MED-1: "resolved-in-this-ceremony-commit (plan-lint.mjs isGitTracked tempfile behavior documented via comment; deferred full refactor to follow-up ADR if needed)"
  LOW-1: "resolved-in-this-ceremony-commit (META_ARC_FIRST_COMMIT cross-reference comments linking the plan-lint + audit duplicates)"
findings:
  - id: HIGH-1
    severity: high
    title: Plan authority text for Slice 58 says "19 rules baseline" after Slice 58a promoted scope to all 22
  - id: MED-1
    severity: med
    title: Rule #16 temp-file test depends on accidental correctness of isGitTracked for outside-repo paths
  - id: LOW-1
    severity: low
    title: META_ARC_FIRST_COMMIT constant duplicated in plan-lint.mjs + audit.mjs without cross-reference
---

# Planning-Readiness Meta-Arc — Arc-Close Composition Review (Claude)

## Method

Fresh-read composition-adversary pass over the full arc (slices 57-61a)
as a unit. Per-slice Codex passes already verified each slice against
its own acceptance evidence. This review looks for cross-slice seams,
authority-surface drift, and boundary issues that only surface in
aggregate.

Approach: read every slice commit message end-to-end, every per-slice
Codex review, plan revision 08, ADR-0010 end-to-end, CLAUDE.md
§Plan-authoring discipline, out-of-repo memory file, plan-lint.mjs,
audit Check 36. Then cross-check each authority claim against implementation
reality at HEAD.

## Overall assessment

The arc lands its stated goal: install a machine-enforced pre-operator-
signoff discipline for multi-slice / ratchet-advancing / successor-to-
live plans. The three-layer enforcement (plan-lint as Layer 1, audit
Check 36 as Layer 2, CLAUDE.md + memory as discipline Layer 3) is
coherent. The state machine is tight. The retroactive proof at Slice 60
demonstrates empirical adequacy (6/6 HIGH, 10/13 combined).

Per-slice Codex challenger passes caught real issues — notably Slice 58a
CRITICAL-1 (Check 36 predecessor chain was surface only), Slice 59a
HIGH-1 (JSON vocab was prose-only, hardcoded fallback still admitted
`blocked`), Slice 60a MED-1 (TypeScript type/interface/enum missed by
rule #4 definition patterns), Slice 61a HIGH-1 (CLAUDE.md omitted
successor-to-live applicability trigger). All five per-slice passes
converged to ACCEPT-WITH-FOLD-INS or ACCEPT. Same-session fold-ins
applied in continuation commits.

The arc is close to fully coherent. Three residual composition seams
remain — one HIGH worth folding in, one MED worth documenting, one LOW
worth annotating. None invalidate the arc's deliverables.

## Findings

### HIGH-1 — Plan §4 Slice 58 still says "19 rules baseline" after Slice 58a scope promotion

**Location:** `specs/plans/planning-readiness-meta-arc.md` §4 Slice 58
(approximately lines 604-679).

**Evidence:** The slice section is titled "Tooling layer: plan-lint
baseline (19 rules) + state machine + audit Check 36 + section-aware
scoping + fixtures" and the deliverable text reads "Implements 19
rules (structural/shape #1-#6, #9-#14 + state-machine #15-#17 + HIGH-
coverage #18-#21)." Acceptance evidence says "plan-lint rule count
(0 → 19)."

At Slice 58a, Codex HIGH-1 exposed that rules #7/#8/#22 were already
live in plan-lint's runAllRules array at Slice 58 commit time. The fold-
in chose Option B (scope promotion to all 22) rather than Option A
(gate #7/#8/#22 off). Fixtures for rules #7/#8/#22 landed in slice-58a
to match reality. So post-slice-58a, the ACTUAL rule-exercised count at
the end of Slice 58 territory is 22, not 19.

The plan body was not retroactively updated. A future reader consulting
the plan sees "Slice 58 = 19 rules, Slice 59 = +3 rules." That narrative
is incorrect: Slice 58 landed all 22 rules active (per Slice 58a
continuation), and Slice 59's deliverable was scoped down to JSON vocab
only (rules were already landed).

**Impact:** Low operational risk (the code is correct). Medium
documentation-drift risk — the plan is meant to be the authoritative
record of arc progression, and future slices citing the plan's Slice 58
text would carry forward the incorrect rule-count story.

**Fold-in:** Update specs/plans/planning-readiness-meta-arc.md §4
Slice 58 to reflect Slice 58a scope promotion. Either (a) rewrite Slice
58 section to say "Implements all 22 rules; Slice 59 extends JSON
vocab", OR (b) add a post-slice-58a note in §4 Slice 58 acknowledging
the scope promotion.

### MED-1 — Rule #16 temp-file test depends on accidental correctness of isGitTracked for outside-repo paths

**Location:** `scripts/plan-lint.mjs` lines 243-255 (isGitTracked) +
`tests/scripts/plan-lint.test.ts` rule #16 block (lines ~232-285).

**Evidence:** The rule #16 test writes to `tmpdir()/plan-lint-rule-16-
<hash>/rule-16-untracked-post-draft.md` and runs plan-lint against it.
Rule #16 uses `isGitTracked(planPath)` to classify. `isGitTracked`:

```javascript
const relPath = isAbsolute(path) ? path.slice(REPO_ROOT.length + 1) : path;
execSync(`git ls-files --error-unmatch ${JSON.stringify(relPath)}`, ...)
```

For a tempfile at `/private/var/folders/.../rule-16-untracked-post-
draft.md`, slicing `REPO_ROOT.length + 1` off gives a garbage path (e.g.,
`private/var/folders/...`). `git ls-files` on that garbage path fails.
The catch block returns false → classified as untracked → rule #16
fires. The test passes.

But this is accidental correctness. The slicing assumption only holds
for absolute paths UNDER REPO_ROOT. A future refactor (e.g., reject
outside-repo absolute paths cleanly) could break the test without
obvious symptom, because the test's passing doesn't validate that
isGitTracked saw the file as untracked for the RIGHT reason.

Codex Slice 58a LOW-1 flagged this as part of its "fixture isolation"
finding. My fold-in claim was "partial-resolved-in-slice-58a
(execFileSync switch; uniqueness allowlist deferred)" — that captured
only the subprocess-path safety part, not this specific isGitTracked
path-handling quirk.

**Impact:** Low-to-medium composition risk. The test currently proves
rule #16 fires on untracked plans but doesn't robustly specify why.
A future code change could break this without test signal.

**Fold-in:** Add an inline comment in `isGitTracked` noting the outside-
repo-path edge case, and an inline comment in the rule #16 test
acknowledging the dependency. Deferring a full refactor to a follow-up
slice is acceptable; the documentation prevents silent breakage.

### LOW-1 — META_ARC_FIRST_COMMIT constant duplicated in plan-lint.mjs + audit.mjs without cross-reference

**Location:** `scripts/plan-lint.mjs` line 97 (META_ARC_FIRST_COMMIT) +
`scripts/audit.mjs` (META_ARC_FIRST_COMMIT_FOR_AUDIT near line 4178).

**Evidence:** Both constants hardcode the same SHA
(`c91469053a95519645280fd80394a4966ac7948e`). They're used for the
same semantic purpose (legacy-plan determination via commit ancestry).
Neither references the other.

A future change to the boundary (e.g., retirement of the meta-arc with
superseder SHA) would require updating both sites. If one is missed,
plan-lint and audit Check 36 would disagree on what counts as legacy —
a plan-lint-green plan could fail audit's legacy check or vice versa.

**Impact:** Low. The boundary SHA is stable (it's the meta-arc's first
commit — immutable history). A realistic trigger for update is narrow
(meta-arc supersession), which would itself warrant a new ADR
authorizing the change. The human author changing one would be doing
so in a slice with a clear purpose and could grep for the constant name.

**Fold-in:** Add a cross-reference comment in each location pointing
at the other, flagging the duplication so an editor is aware. Full
extraction to a shared module is out of scope — scripts/audit.mjs is
ESM and scripts/plan-lint.mjs is ESM, so a shared `.mjs` helper is
feasible but adds one more module for one constant; the comment
cross-reference is the minimal-invasive fix.

## Non-findings (checked; compositionally clean)

I looked for these seams and did not find issues:

- **Rule count coherence across authority surfaces:** ADR-0010 §6 says
  "22 total in revision 04"; plan §3 lists 22 rules (#1-22 with #7/#8/#22
  spread across §3.D); plan-lint.mjs runAllRules calls 22 rule functions;
  test file asserts per-rule fixtures for all 22 (19 + 3 added slice-58a).
  Consistent.
- **State machine coverage:** evidence-draft → challenger-pending →
  challenger-cleared → operator-signoff → closed. Rule #15 enforces
  vocab. Rule #16 enforces untracked→evidence-draft-only. Rule #17
  enforces challenger-cleared→committed-challenger-with-freshness-
  binding. Check 36 enforces operator-signoff + closed →
  operator_signoff_predecessor ancestor + status-at-ancestor =
  challenger-cleared. All four transitions covered.
- **Vocab authority split resolved:** specs/invariants.json with 6 keys
  is mechanically authoritative (Slice 59a removed fallback + special
  case). Rule #7 rejects any non-vocab layer. Regression test verifies
  removing `blocked` from vocab makes rule #7 reject.
- **Rule #4 evolution coherent:** Slice 60 added symbol-defined-here
  check + JSON key support. Slice 60a extended definition patterns for
  TS type/interface/enum + default-export forms. ADR-0010 + plan §3
  text updated at Slice 60a to match. Retroactive proof's 10/13 ratio
  doesn't depend on the 60a patterns (P2.9 cites no TS types).
- **Untracked P2.9 handling:** The file stays intentionally untracked
  per plan authority. Committed byte-identical fixture at
  tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md provides clean-
  checkout reproducibility. Tests use the committed fixture. Plan-lint
  still accepts the untracked file directly (since rule #16 fires on
  status beyond evidence-draft, and untracked P2.9 is status: draft
  which also fails rule #15).
- **Discipline layer cross-reference completeness:** ADR-0010 §5 Layer
  3 (slice-61a) explicitly points at CLAUDE.md + memory. CLAUDE.md
  §Plan-authoring discipline points at ADR-0010 as authority. Memory
  file references ADR-0010 + plan-lint + audit Check 36. Triangle
  consistent.
- **Three applicability triggers (multi-slice / ratchet-advancing /
  successor-to-live-contract-shaped-payload):** consistent across
  ADR-0010 §7, CLAUDE.md §Plan-authoring discipline opening, and
  memory "Applies to" section (slice-61a fold-in).
- **Codex challenger workflow:** Every ratchet-advance slice in the
  arc (57, 58, 58a, 59, 59a, 60, 60a, 61, 61a) got a Codex pass.
  Fold-in commits cite arc-subsumption to the original per-slice
  review. Check 35 green at HEAD.

## Verdict

**ACCEPT-WITH-FOLD-INS.** Three findings: HIGH-1 (plan §4 Slice 58
prose drift), MED-1 (rule #16 temp-file test documentation), LOW-1
(duplicated META_ARC_FIRST_COMMIT constant). All three land as fold-ins
in this same arc-close ceremony commit per CLAUDE.md
§Cross-slice composition review cadence.

No findings invalidate the arc's deliverables. The gate is installed,
the enforcement is consistent, and the empirical proof held.
