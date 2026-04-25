---
plan: methodology-2tier-revamp-proposal
status: challenger-cleared
revision: 01
opened_at: 2026-04-25
cleared_at: 2026-04-25
cleared_in_session: methodology-2tier-non-external-fallback-challenger-01
base_commit: 34b8f69
target: methodology-two-mode-hardening
trigger: |
  The repo already has ADR-0012 Light/Heavy work modes, but implementation
  prompts remain inconsistent and the Heavy boundary is worded broadly enough
  to pull low-risk preparatory work into unnecessary challenger ceremony. A
  discarded Green/Yellow/Red draft in the worktree showed the opposite risk:
  adding a middle tier creates new audit vocabulary and weakens the simpler
  two-mode boundary. This plan hardens the existing Light/Heavy system instead.
authority:
  - AGENTS.md §Work modes
  - AGENTS.md §Lane discipline
  - AGENTS.md §Plan-authoring discipline
  - specs/adrs/ADR-0012-two-mode-methodology.md
  - specs/adrs/ADR-0014-non-external-challenger-fallback.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - specs/methodology/decision.md §D11
  - scripts/audit.mjs Check 35a
  - tests/contracts/work-mode-discipline.test.ts
---

# Hardened Two-Mode Methodology Plan

Keep the existing **Light / Heavy** overlay. Add a reusable task-packet
template, sharpen the false-green rule for Heavy work, and keep plan lifecycle
unchanged.

## §1 Evidence census

| Claim | Status | Source |
|---|---|---|
| ADR-0012 already added `Work mode: Light` and `Work mode: Heavy`. | verified | `specs/adrs/ADR-0012-two-mode-methodology.md` |
| AGENTS.md requires every post-ADR-0012 slice to declare Light or Heavy. | verified | `AGENTS.md` |
| Audit Check 35a already rejects Light commits that touch obvious Heavy surfaces. | verified | `scripts/audit.mjs` |
| The abandoned 3-tier draft used `Risk tier: Green`, `Risk tier: Yellow`, and `Risk tier: Red`. | verified | discarded working-tree draft, preserved in this plan's trigger |
| The useful part of the discarded draft is the small task-packet idea, not the extra tier. | decided | operator direction and hardened proposal |
| ADR-0010 plan lifecycle remains in force. | verified | `AGENTS.md`, `specs/adrs/ADR-0010-arc-planning-readiness-gate.md` |
| External Codex challenger was policy-blocked even after operator approval; ADR-0014 now permits a recorded non-external fallback for this condition. | verified | session escalation rejection, `specs/adrs/ADR-0014-non-external-challenger-fallback.md` |

Unknown-blocking: none.

## §2 Scope

Implement these changes:

- Add `specs/methodology/task-packet-template.md`.
- Update `AGENTS.md` so Work modes open with the false-green rule and point to
  the task-packet template.
- Amend `specs/methodology/decision.md` D11 to clarify the existing two-mode
  overlay; do not supersede ADR-0012.
- Update audit Check 35a only as needed to keep real Heavy surfaces protected.
- Update framing audit so routine Light slices need failure mode and acceptance
  evidence, while Heavy slices still need `Why this not adjacent:`.
- Add focused tests for the two-mode boundary and framing rule.

Do not implement these changes:

- No Green/Yellow/Red tier.
- No single-slice plan exemption.
- No ADR-0010 plan-lifecycle change.
- No broad audit rewrite.
- No runtime, command, adapter, router, or plugin behavior change.

## §3 Work items

### Work item 1 - Formal plan lifecycle

Move this plan from `evidence-draft` to `challenger-pending`, commit it, run
the required challenger pass, fold in findings, promote to
`challenger-cleared`, and record operator signoff before implementation.
External Codex is the default challenger path. If the external path is blocked
or unavailable, ADR-0014 allows a non-external fallback review only when the
artifact records the blocked attempt, operator authorization, channel
limitations, and the usual plan freshness binding.

Acceptance evidence:

- `npm run plan:lint -- specs/plans/methodology-2tier-revamp-proposal.md`
  passes in authoring context before the challenger-pending commit.
- `npm run plan:lint -- --context=committed specs/plans/methodology-2tier-revamp-proposal.md`
  passes when the plan is staged/tracked at committed lifecycle states.
- A committed challenger review exists at
  `specs/reviews/methodology-2tier-revamp-proposal-codex-challenger-01.md`
  with ACCEPT or ACCEPT-WITH-FOLD-INS.
- If that review uses ADR-0014 fallback, its frontmatter declares
  `review_channel: non-external-fallback`, `external_attempt`, operator
  authorization, limitations, and the matching plan identity fields.
- Operator signoff transition records `operator_signoff_predecessor`.

Why this not adjacent: implementing the methodology edits immediately was
rejected because this plan changes methodology and audit gates. The plan
lifecycle is the existing safe path for this kind of change.

### Work item 2 - Task packet and written methodology

Add the task-packet template and update the operator/agent-facing methodology
text.

Acceptance evidence:

- `specs/methodology/task-packet-template.md` contains fields for task,
  context, allowed scope, forbidden scope, acceptance evidence, risk, stop
  conditions, and output shape.
- `AGENTS.md` keeps Light/Heavy, opens Work modes with "process is
  proportional to the blast radius of a false green", and links to the
  task-packet template.
- `specs/methodology/decision.md` D11 mirrors the sharpened two-mode rule.
- `AGENTS.md` remains under its 450-line cap.

Why this not adjacent: changing audit first was rejected because the task
packet is the low-risk operator benefit. Written methodology should define the
target before enforcement changes pin it.

### Work item 3 - Audit and tests

Keep Check 35a on Light/Heavy and sharpen its real Heavy-surface coverage.

Heavy-by-default surfaces include:

- `src/runtime/runner.ts`
- `src/runtime/router.ts`
- `src/runtime/adapters/**`
- `commands/**`
- `.claude-plugin/**`
- `scripts/audit.mjs`
- `scripts/plan-lint.mjs`
- `specs/adrs/**`
- `specs/methodology/**`
- `specs/plans/**`

Acceptance evidence:

- Future slice missing `Work mode:` fails.
- Light schema/test/doc-only change passes.
- Light touching runtime, router, adapter, command, plugin, audit, plan-lint,
  methodology, ADR, or plan files fails.
- Heavy without `Codex challenger: REQUIRED` fails.
- Heavy with challenger evidence passes.
- Framing audit accepts pair-only Light commits and rejects Heavy commits
  missing `Why this not adjacent:`.
- Focused tests pass for `tests/contracts/work-mode-discipline.test.ts` and
  any framing-audit test touched by the implementation.
- `npm run verify` passes.
- Post-commit `npm run audit` reports 0 red and no new unaccounted yellows.

Why this not adjacent: adding a third tier was rejected because it adds
classification friction. The useful enforcement change is to keep the simpler
Light/Heavy boundary and make its protected surfaces match the real repo.

## §4 Close criteria

The plan can close after:

- Plan lifecycle reaches operator-signoff before implementation.
- The implementation lands as Heavy methodology work with Codex challenger
  evidence.
- Focused tests, `npm run verify`, and post-commit `npm run audit` pass.
- ADR-0010 remains unchanged.
- No Green/Yellow/Red vocabulary remains in committed methodology or audit
  surfaces.
- If this methodology arc spans three or more implementation slices before the
  next privileged runtime slice, the required composition review is completed
  before that runtime slice opens.
