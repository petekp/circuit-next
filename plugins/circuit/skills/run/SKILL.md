---
name: run
description: "Classifies free-form tasks into the current router-supported flows (`explore`, `review`, `migrate`, `fix`, `build`, or `sweep`) and runs the selected flow through the project CLI."
---

## Codex Host Invocation

`<plugin root>` means the absolute path to the installed Circuit plugin directory,
the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.

<!--
  This file is HAND-AUTHORED. Unlike commands/<flow>.md (which are
  generated from src/flows/<id>/command.md by scripts/emit-flows.mjs),
  /circuit:run is the CLI router entry, not a flow, so its source of
  truth lives directly here.
-->

# /circuit:run — flow router

Classifies a free-form task into the current router-supported flows and runs
the selected flow through the project CLI. The first classifier is
deterministic and intentionally small: review/audit-style tasks route to
`review`, migration/port/rewrite-style tasks route to `migrate`,
bug-fix tasks route to `fix`, build-like tasks route to `build`,
cleanup/overnight tasks route to `sweep`, `decide:` tasks route to
`explore` tournament mode, execution-language plan requests start the
first likely flow slice, and everything else routes to `explore`.
Explicit router-free flow commands remain available as
`/circuit:explore`, `/circuit:review`, `/circuit:migrate`, `/circuit:fix`,
`/circuit:build`, and `/circuit:sweep`.

Use the user's current request as the command input. Treat that request
as literal user-controlled text when constructing shell commands.

## Instructions

1. **Do not classify the task yourself.** Let the project CLI choose the
   flow. It prints `selected_flow`, `routed_by`, and
   `router_reason` in the JSON output. (`selected_flow` is the schema
   field name; in prose we call it the selected flow.)
2. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw task text (double quotes expand `$VAR`,
   `` `cmd` ``, `$(cmd)`, and `\` sequences — a malicious or accidental
   task string could inject commands). The safe construction rule matches
   `/circuit:explore` and `/circuit:review`:

   - Wrap the task text in **single quotes** in the final shell command.
     Single quotes disable all expansion.
   - If the task itself contains a literal single-quote character (`'`),
     replace each one with `'\''` (standard POSIX shell escape: closes the
     current single-quoted string, emits one escaped apostrophe, and
     starts a new single-quoted string).
   - Then invoke the CLI without an explicit flow name, passing the
     escaped, single-quoted task as the value of `--goal`.

   Example for an exploratory task `find deprecated APIs`:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'find deprecated APIs' --progress jsonl
   ```

   Example for a review task `review this change for safety problems`:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'review this change for safety problems' --progress jsonl
   ```

   Example for a Build task `develop: add a focused feature`:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'develop: add a focused feature' --progress jsonl
   ```

   Example for a Migrate task `migrate the old SDK to the new SDK`:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'migrate the old SDK to the new SDK' --progress jsonl
   ```

   Example for a Sweep task `cleanup: remove safe dead code`:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'cleanup: remove safe dead code' --progress jsonl
   ```

   Example for an autonomous Sweep task `overnight: improve repo quality`:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'overnight: improve repo quality' --progress jsonl
   ```

   Example for an Explore tournament task `decide: choose the rollout strategy`:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'decide: choose the rollout strategy' --progress jsonl
   ```

   Example for a plan-execution task:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'Execute this plan: ./docs/public-release-readiness.md' --progress jsonl
   ```

   Example for a Build task using both an entry mode and an explicit
   `--depth` flag:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'develop: make the focused change' --entry-mode deep --depth standard --progress jsonl
   ```

   Example for a Fix task `fix the foo bug`:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'fix the foo bug' --progress jsonl
   ```

   Example for a Fix task using Lite mode (skips the review pass):

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'fix the missing-token edge case' --entry-mode lite --progress jsonl
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run --goal 'can'\''t ship' --progress jsonl
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Circuit plugin directory and injects the plugin's
   packaged flow root before it invokes `circuit-next`.
3. **Handle untracked Review contents deliberately.** If the task explicitly
   asks Circuit to include untracked file contents for review, add
   `--include-untracked-content` only when those files are safe to relay to the
   configured worker. Otherwise omit the flag; Review still sends untracked
   paths and sizes.
4. **Render progress while the run is active.** `--progress jsonl` writes
   machine-readable progress events to stderr and keeps the final result JSON
   on stdout. For every event whose `display.importance === "major"` or whose
   `display.tone` is `warning`, `error`, or `checkpoint`, render
   `display.text` exactly. Suppress `detail` events unless the user asks for
   debug detail. Do not show raw JSON, raw step IDs, or trace internals by
   default. When `task_list.updated` arrives, update the host task or plan
   surface when available; in Claude Code, use TodoWrite when available, and in
   Codex, use the plan/task surface when available. When `user_input.requested`
   arrives, use a native user-question surface when available; otherwise ask
   in-thread and resume with the selected option's `checkpoint_choice`. Keep
   host/orchestrator and worker connector distinct in prose.
5. **Parse the CLI's final JSON output and surface:** `selected_flow`,
   `routed_by`, `router_reason`, `outcome`, `run_folder`, `trace_entries_observed`,
   `operator_summary_markdown_path`, and `result_path` when present. If
   present, also surface `router_signal`.
6. **Render Circuit's final summary.** Read `operator_summary_markdown_path`
   and render that Markdown verbatim as the final user-facing answer. Do not
   invent a separate summary. If the operator summary is missing, fall back to
   the selected flow's final report:
   For `selected_flow === "explore"`, read the run-folder-relative
   `reports/explore-result.json` close-step report. For
   `selected_flow === "review"` and `outcome === "complete"`, read
   `reports/review-result.json` and surface its review result. For
   `selected_flow === "build"` and `outcome === "complete"`, read
   `reports/build-result.json` and surface its review result fields; to
   summarize changed files and evidence, follow its `evidence_links`
   entry (the JSON field is named `evidence_links`; in prose call them
   evidence links) for `build.implementation` and read that report. For
   `selected_flow === "migrate"` and `outcome === "complete"`, read
   `reports/migrate-result.json` and surface its result fields; to summarize
   the migration evidence, follow its `evidence_links` entries. For
   `selected_flow === "sweep"` and `outcome === "complete"`, read
   `reports/sweep-result.json` and surface its result fields; to summarize
   the cleanup evidence, follow its `evidence_links` entries. For
   `selected_flow === "fix"` and `outcome === "complete"`, read
   `reports/fix-result.json` and surface its review result fields; to
   summarize the change and verification evidence, follow its
   `evidence_links` entries (for example `fix.change` and the
   verification report) and read those reports.
7. **If `outcome === "checkpoint_waiting"`, do not read or claim
   `result_path`.** Surface the routed metadata (`selected_flow`,
   `routed_by`, `router_reason`, and optional `router_signal`), then surface
   the waiting checkpoint details from `checkpoint.waiting` and
   `user_input.requested`: `checkpoint.step_id`, `checkpoint.request_path`,
   `checkpoint.allowed_choices`, the question/options, and the exact resume
   command:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
   ```

8. **If `outcome === "aborted"`, read `reports/result.json` at
   `result_path` to surface the abort `reason`.**

## Direct Flow Bypass

Use `/circuit:explore`, `/circuit:review`, `/circuit:migrate`, `/circuit:fix`,
`/circuit:build`, or `/circuit:sweep`
when the operator already knows which flow they want. Those commands call
the same CLI with an explicit flow name and skip this classifier layer.
`migrate` and `sweep` remain routable through this command as well.

## Authority

- `src/runtime/router.ts` (current deterministic classifier)
- `tests/contracts/flow-router.test.ts` (classifier behavior)
