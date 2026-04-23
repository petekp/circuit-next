---
name: arc-slice-59-codex
description: Cross-model challenger pass over Slice 59 (Planning-Readiness Meta-Arc blocked enforcement-layer vocabulary addition). Ratchet-advance slice per CLAUDE.md §Hard invariants #6.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-23
verdict: REJECT-PENDING-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-59-blocked-vocabulary
target_kind: arc
target: slice-59
target_version: "HEAD=22506c0 (Slice 59 — specs/invariants.json blocked vocabulary addition)"
arc_target: planning-readiness-meta-arc
arc_version: "revision 08 / Slice 59 vocab closeout; rules #7/#8/#22 already landed at Slices 57a/58/58a"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: "ACCEPT-WITH-FOLD-INS (both findings folded at slice-59a)"
severity_counts:
  critical: 0
  high: 1
  med: 1
  low: 0
commands_run:
  - git rev-parse --short HEAD confirmed 22506c0
  - git status --short showed unrelated untracked specs/plans/p2-9-second-workflow.md; ignored
  - git show --stat --oneline --decorate HEAD
  - git show --unified=80 -- specs/invariants.json
  - read specs/reviews/arc-slice-57-codex.md for frontmatter precedent
  - read specs/invariants.json header and blocked definition
  - read scripts/plan-lint.mjs vocabulary loader plus rules 7/8/22
  - read specs/adrs/ADR-0010-arc-planning-readiness-gate.md Decision / Vocabulary
  - read specs/plans/planning-readiness-meta-arc.md §3.D / §3.E / §4 Slice 59
  - read tests/scripts/plan-lint.test.ts and rule 7/8/22 fixtures
  - node -e parse specs/invariants.json confirm six keys
  - ran plan-lint against good fixture and rule-07 rule-08 rule-22 bad fixtures
opened_scope:
  - specs/invariants.json Slice 59 diff
  - scripts/plan-lint.mjs vocabulary source-of-truth behavior
  - specs/adrs/ADR-0010 blocked vs phase2-property semantics
  - specs/plans/planning-readiness-meta-arc.md Slice 59 authority
  - tests/scripts/plan-lint.test.ts and rule 7/8/22 fixtures
skipped_scope:
  - full npm run verify rerun (operator supplied green)
  - full npm run audit rerun (operator supplied expected Check 35 red pending this file)
fold_in_status:
  HIGH-1: "resolved-in-slice-59a (layer !== 'blocked' escape removed; loadInvariantLayerVocab now throws on missing/malformed JSON; regression test added)"
  MED-1: "resolved-in-slice-59a (ADR-0010 frontmatter landed status + plan §3 E5 annotation)"
findings:
  - id: HIGH-1
    severity: high
    title: plan-lint still accepts `blocked` outside JSON authority
  - id: MED-1
    severity: med
    title: authority prose still contains stale five-key vocabulary / pending-Slice-59 statements
---

# Slice 59 — Codex Challenger Pass

## Verdict

**REJECT-PENDING-FOLD-INS.**

The `blocked` JSON definition itself is good: it is precise enough on full escrow, distinguishes substrate-widening escrow from `phase2-property`, and matches ADR-0010's intended semantics. But the slice's core claim is stronger than "JSON now contains `blocked`": it claims the hardcoded-fallback-vs-JSON-truth split is closed. It is not closed at HEAD.

## Findings

### HIGH-1 — plan-lint still accepts `blocked` outside JSON authority

`specs/invariants.json` now includes `blocked`, but `scripts/plan-lint.mjs` still contains two independent allowances:

- `loadInvariantLayerVocab()` falls back to a hardcoded five-key set if JSON is missing, malformed, or empty.
- Rule #7 then permits `blocked` even when `blocked` is not in that loaded vocabulary via `if (!vocab.has(layer) && layer !== 'blocked')`.

That means `enforcement_layer: blocked` remains valid even if `specs/invariants.json::enforcement_state_semantics` does not contain `blocked`. This directly contradicts the Slice 59 acceptance story that JSON is now authoritative and that the fallback split has been eliminated.

This is not theoretical drift. The failure mode Slice 59 says it closes is: one source says valid, another source says invalid. HEAD still has exactly that path. If JSON loses `blocked`, is malformed, or is intentionally narrowed, plan-lint continues admitting `blocked`.

**Required fold-in:** Remove the `layer !== 'blocked'` extension from rule #7 and make `loadInvariantLayerVocab()` fail closed when `specs/invariants.json` cannot be read as a non-empty authoritative vocabulary. Minimum acceptable proof: a regression test showing that deleting/omitting `blocked` from the loaded vocabulary makes `enforcement_layer: blocked` fail rule #7.

### MED-1 — authority prose still contains stale five-key vocabulary / pending-Slice-59 statements

Several authority surfaces still describe pre-Slice-59 state as current or pending:

- `specs/plans/planning-readiness-meta-arc.md` §3 says the authoritative set is `{test-enforced, audit-only, static-anchor, prose-only, phase2-property}` before describing the `blocked` extension.
- The evidence census row E5 still records the five-key set. That row is historical at base commit, so it can stay if labeled as such, but it currently reads like active evidence.
- `specs/adrs/ADR-0010-arc-planning-readiness-gate.md` frontmatter still says `specs/invariants.json::enforcement_state_semantics` is "pending Slice 59".
- ADR-0010's extension procedure still says Slice 59 "implements" the extension in future-tense / pre-implementation language.

**Required fold-in:** Update the stale authority prose so active-current statements show the six-key vocabulary, while historical evidence rows are explicitly labeled as base-commit observations.

## Asked Objections

### 1. Full escrow precision

No objection to the JSON definition text. "REQUIRES full escrow:" followed by all five required field names is sufficiently binding. The only caveat is implementation-authority: because rule #7 still has the `blocked` hardcoded escape, the vocabulary source-of-truth claim is not mechanically true. That is HIGH-1, not a wording problem in the definition.

### 2. `blocked` vs `phase2-property`

No blocking objection. The distinction is clear enough: `phase2-property` = scheduled Phase 2 harness landing, non-escrow; `blocked` = substrate widening required + explicit escrow.

### 3. Hardcoded fallback scope creep

Yes, this is the blocker. Removing or fail-closing the fallback is not scope creep if the slice's stated ratchet is "JSON is now source of truth." Leaving the fallback plus the `blocked` special-case means Slice 59 only adds documentation.

### 4. Slice boundary honesty

The shrinkage is mostly honest. Rules #7/#8/#22 and fixtures were pulled forward by Slice 58a. The one unlanded discipline-binding item is the source-of-truth cleanup in HIGH-1.

## Sign-off

Do not advance to Slice 60 yet. Land a Slice 59a fold-in that makes `specs/invariants.json::enforcement_state_semantics` the actual plan-lint vocabulary authority and cleans up stale authority prose.
