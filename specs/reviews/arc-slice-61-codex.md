---
name: arc-slice-61-codex
description: Cross-model challenger pass over Slice 61 (planning-readiness-meta-arc discipline layer — CLAUDE.md plan-authoring summary plus user-memory index activation).
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-23
verdict: REJECT-PENDING-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-61-discipline-layer
target_kind: arc
target: slice-61
target_version: "HEAD=07044659424eccf95acbb1b6fa04630ccf5ff2a7 (slice-61 discipline layer)"
arc_target: planning-readiness-meta-arc
arc_version: "revision 08 / Slice 61 discipline layer / ADR-0010 accepted"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: "ACCEPT-WITH-FOLD-INS (all 4 findings folded in slice-61a)"
severity_counts:
  critical: 0
  high: 2
  med: 2
  low: 0
commands_run:
  - git status --short && git rev-parse HEAD && git show --stat
  - git show --no-ext-diff --unified=80 HEAD -- CLAUDE.md
  - nl -ba CLAUDE.md | sed -n '230,290p'
  - read specs/adrs/ADR-0010 Slice 61 references
  - read specs/plans/planning-readiness-meta-arc.md Slice 61 scope
  - read ~/.claude/.../memory/MEMORY.md
  - read feedback_plans_must_be_challenger_cleared_before_signoff.md
  - rg "Slice 61|pending Slice 61|CLAUDE.md|Plan-authoring|memory"
  - wc -l CLAUDE.md = 279
  - npm run audit (32 green / 2 yellow / 1 red; red is Check 35 awaiting this file)
opened_scope:
  - HEAD commit 0704465 and its repo diff
  - CLAUDE.md new Plan-authoring discipline subsection
  - ADR-0010 authoritative policy
  - specs/plans/planning-readiness-meta-arc.md Slice 61 scope
  - out-of-repo user-memory index and memory body
  - PROJECT_STATE/README/TIER marker updates
  - Slice 61 session-note update
skipped_scope:
  - no src/runtime review (prose discipline only)
  - no plan-lint re-review beyond ADR and audit consistency
  - unrelated untracked worktree file skipped
fold_in_status:
  HIGH-1: "resolved-in-slice-61a (CLAUDE.md subsection adds successor-to-live/contract-shaped-payload trigger)"
  HIGH-2: "resolved-in-slice-61a (memory checklist rewritten — all reviewer-designated fold-ins, freshness-binding cite)"
  MED-1: "resolved-in-slice-61a (ADR-0010 frontmatter + §5 cross-reference to CLAUDE.md section)"
  MED-2: "resolved-in-slice-61a (commit-body + session-note language: 'installed/verified in out-of-repo user memory' vs 'committed')"
findings:
  - id: HIGH-1
    severity: high
    title: CLAUDE.md summary omits ADR-0010's successor-to-live applicability trigger
  - id: HIGH-2
    severity: high
    title: Activated memory checklist weakens challenger-cleared semantics to HIGH-only fold-ins
  - id: MED-1
    severity: med
    title: ADR-0010 still says CLAUDE.md amendment is pending Slice 61
  - id: MED-2
    severity: med
    title: Slice evidence says user-memory change was committed, but the memory directory is out-of-repo and not versioned by HEAD
---

# Slice 61 — Codex Challenger Pass

## Verdict

**REJECT-PENDING-FOLD-INS.** Slice is directionally right; the Ratchet-Advance framing is acceptable; the discipline layer is not yet safe enough to be treated as landed. The new CLAUDE.md summary drops one of ADR-0010's applicability triggers, and the now-live memory checklist teaches a weaker rule than ADR-0010's challenger-cleared state.

## Findings

### HIGH-1 — CLAUDE.md omits ADR-0010's successor-to-live trigger

CLAUDE.md:253-254 says "Multi-slice or ratchet-advancing plans pass through a five-state lifecycle before slices open". ADR-0010 §7 applies the gate to three classes:

1. Multi-slice plans.
2. Ratchet-advancing plans.
3. Plans involving `successor-to-live` surface payload.

The third trigger is the bridge from ADR-0003's invention-before-extraction concern into plan authoring.

**Minimum fold-in:** Include the third class in the CLAUDE.md sentence.

### HIGH-2 — Live memory checklist says only HIGH fold-ins must be applied

Memory item 6 says "All HIGH-severity fold-ins from the review have been applied." ADR-0010's lifecycle table requires all accept-class reviewer-designated fold-ins (not HIGH only).

**Minimum fold-in:** Replace with "all reviewer-designated fold-ins required by the ACCEPT-class verdict" + name the `reviewed_plan:` freshness binding.

### MED-1 — ADR-0010 still carries stale Slice 61 amendment language

ADR-0010:13 still says `CLAUDE.md §Core-methodology (pending Slice 61 ...)`. Slice 61 landed; the actual section is `§Plan-authoring discipline (ADR-0010)`.

**Minimum fold-in:** Update ADR-0010 frontmatter + add cross-reference in §5 / Consequences pointing at the CLAUDE.md section.

### MED-2 — User-memory evidence is operationally real but not reproducible from HEAD

Memory file + MEMORY.md index live under `~/.claude/.../memory/` — outside the git repo. Commit body framed both as "committed," which is not strictly accurate.

**Minimum fold-in:** Phrase as "installed/verified in out-of-repo user memory" in subsequent slice notes.

## Sign-off

Do not close Slice 61 as ACCEPT yet. Fold HIGH-1 and HIGH-2 before operator-facing sign-off. MED-1 and MED-2 should land in the same fold-in.
