---
name: arc-slice-80-codex
description: Cross-model challenger pass over Slice 80 (P2.9 review plugin command and CLI surface). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance. Returns objection list per CHALLENGER-I1 and satisfies scripts/audit.mjs Check 35 for the Slice 80 commit.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 via codex exec
review_target: slice-80-p2-9-review-command-and-cli-surface
target_kind: arc
target: slice-80
target_version: "Base HEAD=b4c4130 (Slice 79 P2.9 review runtime wiring seam); landed by the Slice 80 commit carrying this file"
arc_target: p2-9-second-workflow
arc_version: "Planned P2.9 Slice 67; actual repository Slice 80"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 0
  med: 2
  low: 0
  meta: 0
commands_run:
  - ran codex exec --sandbox read-only -m gpt-5.4 over the Slice 80 command-surface working tree
  - parent session folded in both MED findings
  - parent session ran npx vitest run tests/runner/plugin-command-invocation.test.ts tests/contracts/plugin-surface.test.ts tests/scripts/audit-check-36.test.ts
  - parent session ran npm run verify
opened_scope:
  - AGENTS.md
  - specs/plans/p2-9-second-workflow.md §9 Slice 67
  - .claude-plugin/plugin.json
  - .claude-plugin/commands/circuit-run.md
  - .claude-plugin/commands/circuit-review.md
  - tests/runner/plugin-command-invocation.test.ts
  - tests/contracts/plugin-surface.test.ts
  - tests/runner/review-runtime-wiring.test.ts default-placeholder regression
  - PROJECT_STATE.md
skipped_scope:
  - plugin command manual live adapter smoke (default adapter auth is environment-dependent; existing CLI smoke remains env-gated)
  - generic per-workflow synthesis-writer registration (declared post-P2.9 substrate work)
  - final P2.9 generalization proof (planned next slice)
authority:
  - AGENTS.md §Hard invariants #6
  - AGENTS.md §Cross-model challenger protocol
  - specs/plans/p2-9-second-workflow.md §9 Slice 67
  - specs/contracts/review.md
  - scripts/audit.mjs Check 35
---

# Slice 80 - P2.9 Review Command and CLI Surface - Codex Challenger Pass

This records the Codex cross-model challenger pass for the P2.9 slice
that adds `/circuit:review` as an explicit plugin command and registers
it in `.claude-plugin/plugin.json`.

## Wrapper Note

The repo-preferred `/codex` wrapper remains unavailable in this
environment because it selects a model unavailable to this account. The
challenger was therefore run directly with
`codex exec --sandbox read-only -m gpt-5.4`, matching the fallback used
for the preceding P2.9 slices.

## Opening Verdict

**ACCEPT-WITH-FOLD-INS.** Codex found the command direction sound: the
manifest adds `circuit:review`, `/circuit:run` no longer says explore is
the only wired workflow, and `/circuit:review` explicitly carries the
current synthesis-writer caveat instead of claiming typed review verdicts
from the default CLI path.

Codex raised two MED findings before commit.

## Objection List and Dispositions

### MED 1 - Slice 67 plan acceptance still overclaimed the default CLI path

The signed P2.9 plan still said the `/circuit:review` manual smoke should
run to a "valid verdict artifact" and showed the stale command shape
without the npm `--` separator. That contradicted the actual bounded
surface: the new command honestly says the default CLI path still uses
placeholder close synthesis, and the Slice 79 test proves that
non-injected review output is not a schema-valid `ReviewResult`.

Disposition: **folded in**. `specs/plans/p2-9-second-workflow.md` Slice
67 now names `npm run circuit:run -- review --goal "<scope>"` and scopes
acceptance to command closure plus the placeholder caveat. It explicitly
keeps schema-valid `review.result` proof on the Slice 66 injected-writer
test seam until post-P2.9 per-workflow synthesis registration lands.

### MED 2 - Command invocation test did not pin the workflow positional token

The first test helper accepted the workflow name anywhere later on the
same bash line. That meant a block invoking `explore` with a goal like
`review the latest change` could satisfy the review-command ratchet.

Disposition: **folded in**. `hasExecutableWorkflowInvocation()` now
requires the workflow name as the positional token after
`npm run circuit:run --` or `node dist/cli/dogfood.js`. A regression test
proves that `review` appearing only inside goal text does not satisfy the
review command check.

## Closing Verdict

**ACCEPT-WITH-FOLD-INS.** Both MED findings were folded in before
verification. The remaining P2.9 work is the second-workflow
generalization proof and arc close.
