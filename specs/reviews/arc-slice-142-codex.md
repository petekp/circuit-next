---
review: arc-slice-142-codex
name: arc-slice-142-codex
description: Non-external fallback challenger record for Slice 142 challenger-path fallback methodology change.
type: review
reviewer_model: gpt-5.5 in-process Codex
reviewer_model_id: gpt-5.5
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-25
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.5 in-process Codex + operator fallback authorization
review_target: slice-142-non-external-challenger-fallback
target_kind: arc
target: slice-142
target_version: "Working tree reviewed before Slice 142 commit; base HEAD=5d411dc9045fa526c1030f1f02a5be04f57e7841"
arc_target: challenger-path-fallback-methodology
arc_version: "Single-slice fallback process amendment"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
review_channel: non-external-fallback
external_attempt: blocked
operator_fallback_authorization: "Operator said 'Change the plan/process to allow a non-external challenger path.' on 2026-04-25 after the external Codex CLI challenger was rejected by the escalation reviewer even with explicit disclosure approval."
limitations: "Same-session Codex adversarial review is weaker than the default external Codex CLI pass; correlated failure risk remains."
severity_counts:
  critical: 0
  high: 0
  med: 2
  low: 1
  meta: 0
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --output-last-message /tmp/methodology-2tier-plan-codex-review.txt <prompt>"
  - "npm run test -- tests/contracts/work-mode-discipline.test.ts tests/contracts/slice-47d-audit-extensions.test.ts tests/scripts/plan-lint.test.ts"
  - "npm run verify"
opened_scope:
  - AGENTS.md
  - PROJECT_STATE.md
  - README.md
  - TIER.md
  - specs/adrs/ADR-0014-non-external-challenger-fallback.md
  - specs/methodology/decision.md
  - specs/plans/methodology-2tier-revamp-proposal.md
  - specs/reviews/arc-slice-142-codex.md
skipped_scope:
  - Runtime execution, command routing, adapter code, plugin command behavior, and product workflow behavior were out of scope for this methodology fallback slice.
---

# Slice 142 Non-External Challenger Review

Reviewed the change that adds ADR-0014 and updates AGENTS.md,
`specs/methodology/decision.md`, project status, and the active
two-mode hardening plan to allow a non-external challenger fallback.

## Verdict

ACCEPT-WITH-FOLD-INS.

## Findings

### MED 1 - Fallback could become the new default

Risk: allowing a non-external path can silently undo the discipline that made
challenger review useful.

Fold-in: ADR-0014 and AGENTS.md require external Codex first. Fallback is
allowed only after a blocked/unavailable external attempt, explicit operator
authorization, and review-frontmatter disclosure of the weaker channel.

### MED 2 - Existing plan lifecycle could be bypassed by a renamed review file

Risk: the plan could clear without the normal binding fields if fallback is
treated as a separate channel.

Fold-in: ADR-0014 keeps the existing plan lifecycle and requires fallback plan
reviews to carry the same `plan_slug`, `plan_revision`, `plan_base_commit`, and
`plan_content_sha256` fields as external reviews.

### LOW 1 - The word "Codex" in filenames can overstate independence

Risk: `*-codex.md` and `*-codex-challenger-*.md` filenames may imply the
external CLI ran even when it did not.

Fold-in: ADR-0014 requires `review_channel: non-external-fallback`,
`external_attempt`, operator authorization, and limitations in the review
frontmatter so readers can distinguish fallback evidence from external evidence.
