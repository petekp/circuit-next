---
name: arc-slice-102-codex
description: Per-slice Codex challenger record for Slice 102 direct launcher, router phrase coverage, and continuity hook wording cleanup.
type: review
reviewer_model: gpt-5.2 via codex exec
reviewer_model_id: gpt-5.2
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.2 via codex exec
review_target: slice-102-direct-launcher-router-hook-cleanup
target_kind: arc
target: slice-102
target_version: "Base HEAD=05939ad6b4ac2adeb20f3eb4a3cdcb1d8515127b; working tree reviewed before Slice 102 commit"
arc_target: post-phase-2-parity-expansion-readiness
arc_version: "Direct launcher + router issue-finding coverage + continuity hook wording cleanup"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 0
  med: 4
  low: 3
  meta: 1
commands_run:
  - "codex exec -m gpt-5.2 --sandbox read-only --ephemeral --color never -o /tmp/circuit-next-slice-102-codex-output.txt (slice-102 challenger; operator explicitly approved external review of uncommitted diff)"
opened_scope:
  - bin/circuit-next
  - src/cli/circuit.ts
  - src/cli/dogfood.ts
  - src/runtime/router.ts
  - package.json
  - commands/run.md
  - commands/explore.md
  - commands/review.md
  - .claude-plugin/plugin.json
  - .claude/hooks/auto-handoff-guard.sh
  - .claude/hooks/SessionStart.sh
  - .claude/hooks/SessionEnd.sh
  - tests/contracts/workflow-router.test.ts
  - tests/contracts/slice-27d-dogfood-run-0.test.ts
  - tests/runner/plugin-command-invocation.test.ts
  - tests/runner/dogfood-smoke.test.ts
  - tests/runner/session-hook-behavior.test.ts
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - Full first-generation Circuit workflow parity beyond launcher/router/hook cleanup
fold_in_disposition: |
  Codex returned ACCEPT-WITH-FOLD-INS with 0 HIGH, 4 MED, 3 LOW, and 1 META. All MED and LOW findings were folded in before commit:
  - MED 1: commands/explore.md and commands/review.md no longer call the direct launcher an npm script.
  - MED 2: bin/circuit-next now emits an actionable error when the compiled CLI is missing and local TypeScript is unavailable or cannot spawn.
  - MED 3: router tests now pin `find issue #123 in the tracker` as Explore, and the issue-finding regex avoids issue-ticket phrasing while still routing `find an issue in this codebase` to Review.
  - MED 4: tests/contracts/slice-27d-dogfood-run-0.test.ts now asserts bin/circuit-next exists, has the Node shebang, references dist/cli/circuit.js, and is executable.
  - LOW 1 and LOW 2: src/cli/circuit.ts and src/cli/dogfood.ts now use safer non-Error formatting; src/cli/circuit.ts uses path.basename instead of POSIX-only split('/') for direct-invocation detection.
  - LOW 3: SessionStart and auto-handoff guard guidance now mention the plugin-root initialization failure mode.
  - META: staging was constrained to intended tracked edits plus bin/circuit-next and src/cli/circuit.ts; ignored runtime state remains unstaged.
---

# Slice 102 - Direct Launcher, Router, And Hook Cleanup - Codex Challenger Record

Codex returned **ACCEPT-WITH-FOLD-INS** for the uncommitted Slice 102 working
tree. No HIGH findings were raised.

The review focused on whether the operator-visible Claude Code path still
routes through the old `npm run circuit:run` bridge or `dist/cli/dogfood.js`,
whether issue-finding prompts route to Review, whether continuity hook guidance
still points at the unavailable `circuit:handoff` skill, and whether the new
launcher is tested enough to keep working.

## Findings

Codex raised four MED findings:

1. `commands/explore.md` and `commands/review.md` still described the CLI as
   an npm script even though the command bodies now invoke `./bin/circuit-next`.
2. `bin/circuit-next` had a weak missing-dependency path when `dist/cli/circuit.js`
   was absent and `node_modules/.bin/tsc` could not run.
3. The issue-finding router pattern needed a guard against issue-tracker
   lookups such as `find issue #123 in the tracker`.
4. Tests pinned the package strings but did not assert that `bin/circuit-next`
   exists and is executable.

Codex raised three LOW findings:

1. CLI error formatting could print `error: undefined` for non-Error throws.
2. `src/cli/circuit.ts` direct-invocation detection used POSIX-only path
   splitting.
3. Hook guidance did not mention the possible "plugin root not initialized"
   failure from `.circuit/bin/circuit-engine`.

The META finding was staging hygiene: include `bin/circuit-next` and
`src/cli/circuit.ts`, preserve the launcher's executable bit, and do not stage
ignored runtime state.

## Disposition

All MED and LOW findings were folded in before the Slice 102 commit. The META
staging warning is carried into the commit step.
