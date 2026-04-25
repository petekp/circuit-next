---
name: arc-slice-141-codex
description: Per-slice Codex challenger record for Slice 141 primitive-backed recipe architecture canonicalization.
type: review
reviewer_model: gpt-5.5 via codex exec
reviewer_model_id: gpt-5.5
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-25
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.5 via codex exec + operator fold-in
review_target: slice-141-primitive-backed-recipe-architecture
target_kind: arc
target: slice-141
target_version: "Base HEAD=5a6a5f651582e925df2e3ec655aa9d074def317a; working tree reviewed before Slice 141 commit"
arc_target: primitive-backed-workflow-recipes
arc_version: "Workflow architecture canonicalization slice"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  critical: 0
  high: 2
  med: 2
  low: 0
  meta: 0
commands_run:
  - "/Applications/Codex.app/Contents/Resources/codex exec -C /Users/petepetrash/Code/circuit-next -s read-only -o /tmp/circuit-next-adr0013-codex.md"
  - "git diff --check"
  - "npm run plan:lint -- --context=committed specs/plans/repair-workflow-parity.md"
  - "npm run test -- tests/contracts/workflow-kind-policy.test.ts"
opened_scope:
  - AGENTS.md
  - PROJECT_STATE.md
  - README.md
  - TIER.md
  - scripts/policy/workflow-kind-policy.mjs
  - specs/adrs/ADR-0013-primitive-backed-workflow-recipes.md
  - specs/parity-map.md
  - specs/plans/repair-workflow-parity.md
  - specs/workflow-direction.md
  - specs/workflow-primitives.md
  - specs/workflow-recipe-composition.md
  - tests/contracts/workflow-kind-policy.test.ts
skipped_scope:
  - Runtime execution, command wiring, router behavior, adapter code, and live workflow execution were out of scope for this architecture-record slice.
fold_in_disposition: |
  Codex returned REJECT-PENDING-FOLD-INS with two HIGH findings and two MED
  findings. All four findings were folded in before commit: the old Repair plan
  is now mechanically closed by supersession, PROJECT_STATE.md no longer names
  Repair artifact schemas as next work, stale Repair-next evidence wording is
  marked historical, and subordinate workflow docs now match ADR-0013's rule
  that Repair-only work requires a later ADR reopening Repair as a first-class
  product recipe.
---

# Slice 141 - Primitive-Backed Recipe Architecture - Codex Challenger Record

Codex returned **REJECT-PENDING-FOLD-INS** on the first pass. The objection list
was useful: the new architecture direction existed in prose, but the old signed
Repair plan still looked mechanically open enough for a future agent to resume.

## Findings And Disposition

1. **HIGH - The superseded Repair plan was still mechanically active.**
   Folded in by changing `specs/plans/repair-workflow-parity.md` from
   `status: operator-signoff` to `status: closed`, adding `closed_at`,
   `closed_in_slice`, and a close reason that says the plan closed by
   supersession, not implementation.

2. **HIGH - PROJECT_STATE.md still said Repair artifact schemas were next.**
   Folded in by rewriting the live state so the old Repair path is explicitly
   historical and the only current bug-fix direction is Fix over reusable
   primitives.

3. **MED - The retained Repair plan contained stale Repair-next evidence.**
   Folded in by changing E1 to historical/superseded evidence and pointing it
   at ADR-0013 plus the current parity map.

4. **MED - Subordinate workflow docs weakened ADR-0013's Repair reopening rule.**
   Folded in by aligning `specs/workflow-direction.md`,
   `specs/workflow-recipe-composition.md`, and ADR-0013 consequence wording:
   Repair-only artifacts, `/circuit:repair`, and Repair-only runtime code stay
   out of scope unless a later ADR explicitly reopens Repair as a first-class
   product recipe.

## Closing Verdict

**ACCEPT-WITH-FOLD-INS.** The fold-ins make the architecture pivot canonical in
the files future agents actually read and in the plan lifecycle state that would
otherwise keep the old Repair plan open.
