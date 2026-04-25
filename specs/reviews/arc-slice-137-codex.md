---
name: arc-slice-137-codex
description: Per-slice Codex challenger record for Slice 137 agent-legibility cleanup.
type: review
reviewer_model: gpt-5.5 via Codex.app codex exec
reviewer_model_id: gpt-5.5
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-25
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.5 via Codex.app codex exec + operator fold-in
review_target: slice-137-agent-legibility-cleanup
target_kind: arc
target: slice-137
target_version: "Base HEAD=b0849cce663c19a57803009fdb98bb53e8e1e2fe; working tree reviewed before Slice 137 commit"
arc_target: agent-legibility-cleanup
arc_version: "AGENTS.md active guide, CLAUDE.md compatibility pointer, stale cleanup and inventory refresh"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  critical: 0
  high: 3
  med: 0
  low: 0
  meta: 0
commands_run:
  - "/Applications/Codex.app/Contents/Resources/codex exec -C /Users/petepetrash/Code/circuit-next -s read-only -o /tmp/circuit-next-slice-137-codex.md \"...\""
  - "git diff --check"
  - "npm run check -- --pretty false"
  - "npm run test -- tests/contracts/session-hygiene.test.ts tests/contracts/cross-model-challenger.test.ts tests/contracts/product-surface-inventory.test.ts tests/contracts/work-mode-discipline.test.ts tests/contracts/slice-47c-forbidden-progress-firewall.test.ts tests/contracts/slice-47d-audit-extensions.test.ts --reporter=dot (blocked in read-only challenger sandbox by Vitest temp/cache EPERM; not counted as verification evidence)"
opened_scope:
  - AGENTS.md
  - CLAUDE.md
  - README.md
  - PROJECT_STATE.md
  - TIER.md
  - scripts/audit.mjs
  - scripts/audit.d.mts
  - scripts/doctor.mjs
  - scripts/inventory.mjs
  - scripts/inventory.d.mts
  - specs/behavioral/session-hygiene.md
  - specs/behavioral/cross-model-challenger.md
  - tests/contracts/session-hygiene.test.ts
  - tests/contracts/cross-model-challenger.test.ts
  - tests/contracts/product-surface-inventory.test.ts
  - tests/contracts/work-mode-discipline.test.ts
  - tests/contracts/slice-47c-forbidden-progress-firewall.test.ts
  - tests/contracts/slice-47d-audit-extensions.test.ts
  - tests/contracts/artifact-backing-path-integrity.test.ts
  - reports/product-surface.inventory.json
  - reports/product-surface.inventory.md
  - reports/prune-audit-2026-04-25.md
  - package.json
  - package-lock.json
skipped_scope:
  - No runtime behavior changes.
  - No workflow fixture or command behavior changes.
  - No raw review-transcript pruning.
fold_in_disposition: |
  The challenger returned ACCEPT-WITH-FOLD-INS with three required fold-ins:
  status docs would be stale after a Slice 137 commit; the citation audit still
  treated CLAUDE.md as an authority citation even though this slice demotes it
  to a compatibility pointer; and a ratified challenger behavioral spec plus
  active comments still named CLAUDE.md as the challenger authority surface.

  The fold-in updates README.md, PROJECT_STATE.md, and TIER.md to current_slice
  137 and records the cleanup in PROJECT_STATE §0. It removes CLAUDE.md from
  the citation pass regex and green detail while keeping CLAUDE.md scanned as
  a heavy/visible compatibility surface. It also retargets
  specs/behavioral/cross-model-challenger.md, scripts/audit.d.mts, and active
  test comments to AGENTS.md.
---

# Slice 137 - Agent-Legibility Cleanup - Codex Challenger Record

Codex returned **ACCEPT-WITH-FOLD-INS**.

## Findings And Fold-Ins

1. **HIGH:** Status docs would become stale after the Slice 137 commit.

   Folded in by updating `README.md`, `PROJECT_STATE.md`, and `TIER.md` to
   `current_slice: 137`, and by adding a Slice 137 live-state entry to
   `PROJECT_STATE.md`.

2. **HIGH:** The citation audit still accepted `CLAUDE.md` as an authority
   citation after the slice reduced `CLAUDE.md` to a compatibility pointer.

   Folded in by removing `/CLAUDE\.md/i` from the citation pass patterns and
   updating the green citation-detail message to name `AGENTS.md`, not
   `CLAUDE.md`.

3. **HIGH:** A ratified challenger behavioral spec and active comments still
   named `CLAUDE.md` as the challenger authority surface.

   Folded in by retargeting active authority references to `AGENTS.md` in
   `specs/behavioral/cross-model-challenger.md`, `scripts/audit.d.mts`, and
   `tests/contracts/artifact-backing-path-integrity.test.ts`.

## Residual Risk

Historical review records still mention `CLAUDE.md`; those references are left
as historical evidence. `CLAUDE.md` also remains visible to the forbidden
progress scan and Heavy-mode denylist because it is still a compatibility
surface users and tools may read.
