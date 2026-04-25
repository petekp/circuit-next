---
review: arc-slice-143-codex
name: arc-slice-143-codex
description: Non-external fallback challenger record for Slice 143 two-mode methodology hardening.
type: review
reviewer_model: gpt-5.5 in-process Codex
reviewer_model_id: gpt-5.5
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-25
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.5 in-process Codex + operator fallback authorization
review_target: slice-143-two-mode-methodology-hardening
target_kind: arc
target: slice-143
target_version: "Working tree reviewed before Slice 143 commit; base HEAD=021650a290d79ee9a4ca95cf5f2a051c4f4f5e3b"
arc_target: two-mode-methodology-hardening
arc_version: "Single-slice implementation of the signed hardened two-mode plan"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
review_channel: non-external-fallback
external_attempt: previously-blocked-for-this-methodology-arc
operator_fallback_authorization: "Operator said 'Change the plan/process to allow a non-external challenger path.' and later 'Proceed.' on 2026-04-25 after the external Codex CLI challenger path was blocked by escalation review."
limitations: "Same-session Codex adversarial review is weaker than the default external Codex CLI pass; correlated failure risk remains and is disclosed under ADR-0014."
severity_counts:
  critical: 0
  high: 0
  med: 3
  low: 1
  meta: 0
commands_run:
  - "npm run test -- tests/contracts/work-mode-discipline.test.ts tests/contracts/slice-30-doctor.test.ts"
  - "npm run test -- tests/contracts/specs-portability.test.ts"
  - "npm run plan:lint -- --context=committed specs/plans/methodology-2tier-revamp-proposal.md"
opened_scope:
  - AGENTS.md
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
  - scripts/audit.mjs
  - scripts/audit.d.mts
  - scripts/doctor.mjs
  - specs/methodology/decision.md
  - specs/methodology/task-packet-template.md
  - specs/plans/methodology-2tier-revamp-proposal.md
  - specs/reviews/arc-slice-143-codex.md
  - tests/contracts/work-mode-discipline.test.ts
  - tests/contracts/slice-30-doctor.test.ts
  - tests/contracts/specs-portability.test.ts
skipped_scope:
  - Runtime execution, adapter behavior, command routing, plugin behavior, and product workflow behavior were out of scope for this methodology hardening slice.
---

# Slice 143 Non-External Challenger Review

Reviewed the two-mode hardening implementation after the plan reached
operator signoff. This review used the ADR-0014 fallback channel because the
external Codex CLI path was already blocked for this methodology arc.

## Verdict

ACCEPT-WITH-FOLD-INS.

## Findings

### MED 1 - Doctor output would keep teaching the old three-part framing

Risk: agents use `scripts/doctor.mjs` as a quick next-slice briefing. If it
continued saying all three framing literals are always required, the method
would be loosened in docs but not in day-to-day guidance.

Fold-in: `scripts/doctor.mjs` now prints the failure-mode and
acceptance-evidence pair as required for every slice, then separately states
that `Why this not adjacent:` is required for Heavy and ambiguous Light work.
`tests/contracts/slice-30-doctor.test.ts` pins that wording.

### MED 2 - Router path needed to be pinned as a Heavy surface

Risk: the plan specifically names `src/runtime/router.ts`, but the existing
test fixture did not assert that exact path. A future audit edit could drop it
while still covering nearby runtime files.

Fold-in: `tests/contracts/work-mode-discipline.test.ts` now includes
`src/runtime/router.ts` in the Light-forbidden fixture and assertion.

### MED 3 - Methodology portability allowlist needed the new file

Risk: `specs/methodology/` is intentionally exact-listed so authority files do
not appear or disappear silently. Adding the task-packet template without
updating that list made full verification fail after the file was tracked.

Fold-in: `tests/contracts/specs-portability.test.ts` now includes
`specs/methodology/task-packet-template.md` in the exact methodology-file set.

### LOW 1 - Long AGENTS.md line reduced readability

Risk: the new Light-mode sentence wrapped poorly in the agent-facing guide,
making the policy harder to skim.

Fold-in: the sentence was wrapped without changing meaning.

## Residual Risk

This change intentionally keeps ADR-0010 plan lifecycle unchanged. The
remaining process cost in multi-slice plans is therefore still present and
should be evaluated separately if it becomes the next bottleneck.
