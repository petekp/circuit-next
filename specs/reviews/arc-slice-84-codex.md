---
name: arc-slice-84-codex
description: Cross-model challenger pass over Slice 84 (P2.8 deterministic /circuit:run router). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance runtime/command work. Returns objection list per CHALLENGER-I1 and satisfies scripts/audit.mjs Check 35 for the Slice 84 commit.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 via codex exec
review_target: slice-84-p2-8-router-first-pass
target_kind: arc
target: slice-84
target_version: "Base HEAD=02c0294 (Slice 83 review writer follow-on); draft working tree reviewed before Slice 84 commit"
arc_target: post-p2-9-cleanup
arc_version: "Actual repository Slice 84; closes P2.8 first deterministic /circuit:run classifier"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 1
  med: 3
  low: 2
  meta: 3
commands_run:
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (opening pass over draft Slice 84 diff)"
  - "parent session folded HIGH/MED/LOW findings into CLI route validation, classifier signals, command docs, and tests"
  - "npx vitest run tests/contracts/workflow-router.test.ts tests/runner/cli-router.test.ts tests/runner/plugin-command-invocation.test.ts tests/contracts/plugin-surface.test.ts"
  - "npm run check"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (follow-up pass; verdict ACCEPT-WITH-FOLD-INS)"
  - "parent session folded final LOW command-doc provenance wording and reran focused tests + npm run check"
opened_scope:
  - src/runtime/router.ts
  - src/cli/dogfood.ts
  - tests/contracts/workflow-router.test.ts
  - tests/runner/cli-router.test.ts
  - tests/runner/plugin-command-invocation.test.ts
  - tests/contracts/plugin-surface.test.ts
  - .claude-plugin/commands/circuit-run.md
  - .claude-plugin/plugin.json
  - specs/plans/phase-2-implementation.md
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - intelligent routing selector
  - model/effort selection
  - live slash-command execution inside Claude Code
  - full npm run verify inside the read-only Codex sandbox; parent session owns final verification
authority:
  - AGENTS.md Hard invariants #6
  - AGENTS.md Cross-model challenger protocol
  - specs/plans/phase-2-implementation.md P2.8
  - specs/adrs/ADR-0007-phase-2-close-criteria.md CC#P2-3
  - scripts/audit.mjs Check 35
---

# Slice 84 - P2.8 Router First Pass - Codex Challenger Pass

This records the Codex cross-model challenger pass for the slice that
turns `/circuit:run` from an always-explore command into a deterministic
CLI router over the current router-supported workflows, `explore` and
`review`.

## Wrapper Note

The first sandboxed Codex CLI attempt could not access its own session
files. The challenger was rerun with the Codex CLI outside the app
sandbox, using `codex exec -m gpt-5.4 --sandbox read-only --ephemeral
--color never`.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** Codex found one HIGH, three MED, one LOW,
and three META observations. The main concern was not the classifier
idea itself; it was keeping route metadata, fixture loading, command
docs, and tests aligned so the selected workflow could not lie about the
workflow actually executed.

## Objection List and Dispositions

### HIGH 1 - Fixture override could make router metadata lie

The first draft let `--fixture` override the path loaded after
classification. A classified `review` run could load an `explore`
fixture while still printing `selected_workflow: "review"`, and the
command docs told callers to branch on `selected_workflow` for the close
artifact path.

Disposition: **folded in.** `main()` now validates that the loaded
fixture's `workflow.id` matches the selected route before running. The
new CLI-router test covers a mismatch between a review-classified goal
and an explore fixture override.

### MED 1 - Review and inspect signals were too broad

The first classifier routed any task containing `review` or `inspect` to
the audit-only review workflow, including exploratory tasks like
reviewing possible approaches or inspecting project structure.

Disposition: **folded in.** Generic `review` and `inspect` patterns were
narrowed to change/diff/patch/code/artifact-style nouns. The router test
now includes negative exploratory `review` and `inspect` cases that must
stay on `explore`.

### MED 2 - Tests did not exercise CLI routing behavior

The first test layer covered the pure classifier and command markdown,
but not `main()` output for omitted workflow positionals, explicit
workflow bypass, or fixture mismatch.

Disposition: **folded in.** `main()` now accepts optional test injection
for dispatcher, clock, and run id. `tests/runner/cli-router.test.ts`
covers classifier-to-review, classifier-to-explore, explicit bypass, and
fixture mismatch rejection without invoking live CLIs.

### MED 3 - "Current registered workflows" overclaimed the router set

The first command and manifest wording said the router handled the
current registered workflows, while the code only pinned the
router-supported set in a local constant.

Disposition: **folded in.** User-facing docs and manifest text now say
`router-supported workflows` for the `explore` / `review` first pass.

### LOW 1 - Router docs test did not pin the provenance trio together

Codex asked that the command-body test require the classifier metadata
surface as a group, not as loose tokens.

Disposition: **folded in.** The command-body test now asserts the output
instruction includes `selected_workflow`, `routed_by`, and
`router_reason` together in the parse/surface step.

## Re-Check

Codex re-checked the folded diff and returned **ACCEPT-WITH-FOLD-INS**.
The follow-up pass confirmed the original HIGH and MED findings were
closed, then raised one final LOW: the explicit list of fields to surface
in `/circuit:run` still omitted `routed_by` even though the command body
mentioned that the CLI prints it.

Disposition: **folded in after re-check.** The command's explicit output
field list now includes `routed_by`, and the command-body test pins the
full provenance trio in that instruction.

## Closing Verdict

**ACCEPT-WITH-FOLD-INS.** Slice 84 is acceptable to commit once the
parent session's full verification and audit steps pass in the normal
workspace.
