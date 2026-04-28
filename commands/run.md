---
description: Classifies free-form tasks into the current router-supported flows (`explore`, `review`, `fix`, or `build`) and runs the selected flow through the project CLI.
argument-hint: <task>
---

<!--
  This file is HAND-AUTHORED. Unlike commands/<flow>.md (which are
  generated from src/workflows/<id>/command.md by scripts/emit-workflows.mjs),
  /circuit:run is the CLI router entry, not a flow, so its source of
  truth lives directly here.
-->

# /circuit:run — flow router

Classifies a free-form task into the current router-supported flows and runs
the selected flow through the project CLI. The first classifier is
deterministic and intentionally small: review/audit-style tasks route to
`review`, fix/repair-style tasks route to `fix`, build-like tasks route to
`build`, and everything else routes to `explore`. Explicit router-free
flow commands remain available as `/circuit:explore`, `/circuit:review`,
`/circuit:fix`, and `/circuit:build`.

The user's task text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Task:** $ARGUMENTS

## Instructions

1. **Do not classify the task yourself.** Let the project CLI choose the
   flow. It prints `selected_workflow`, `routed_by`, and
   `router_reason` in the JSON output. (`selected_workflow` is the schema
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
   ./bin/circuit-next --goal 'find deprecated APIs'
   ```

   Example for a review task `review this change for safety problems`:

   ```bash
   ./bin/circuit-next --goal 'review this change for safety problems'
   ```

   Example for a Build task `develop: add a focused feature`:

   ```bash
   ./bin/circuit-next --goal 'develop: add a focused feature'
   ```

   Example for a Build task using both an entry mode and explicit rigor:

   ```bash
   ./bin/circuit-next --goal 'develop: make the focused change' --entry-mode deep --rigor standard
   ```

   Example for a Fix task `fix the foo bug`:

   ```bash
   ./bin/circuit-next --goal 'fix the foo bug'
   ```

   Example for a Fix task using Lite mode (skips the review pass):

   ```bash
   ./bin/circuit-next --goal 'fix the missing-token edge case' --entry-mode lite
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   ./bin/circuit-next --goal 'can'\''t ship'
   ```

   Use the Bash tool to execute the constructed command. `./bin/circuit-next`
   is the repo-local launcher for the compiled Circuit runtime; when the
   compiled CLI is absent in a fresh checkout, it builds `dist/` with the
   local TypeScript compiler before invoking `dist/cli/circuit.js`.
3. **Parse the CLI's JSON output and surface:** `selected_workflow`,
   `routed_by`, `router_reason`, `outcome`, `run_root`, `events_observed`,
   and `result_path` when present. If present, also surface `router_signal`.
4. **Surface the selected flow's final report when available.**
   For `selected_workflow === "explore"`, read the run-folder-relative
   `artifacts/explore-result.json` close-step report (this is a baseline
   placeholder report; surface that caveat when present). For
   `selected_workflow === "review"` and `outcome === "complete"`, read
   `artifacts/review-result.json` and surface its review result. For
   `selected_workflow === "build"` and `outcome === "complete"`, read
   `artifacts/build-result.json` and surface its review result fields; to
   summarize changed files and evidence, follow its `artifact_pointers`
   entry (the JSON field is named `artifact_pointers`; in prose call them
   evidence links) for `build.implementation` and read that report. For
   `selected_workflow === "fix"` and `outcome === "complete"`, read
   `artifacts/fix-result.json` and surface its review result fields; to
   summarize the change and verification evidence, follow its
   `artifact_pointers` entries (for example `fix.change` and the
   verification report) and read those reports.
5. **If `outcome === "checkpoint_waiting"`, do not read or claim
   `result_path`.** Surface the routed metadata (`selected_workflow`,
   `routed_by`, `router_reason`, and optional `router_signal`), then surface
   `checkpoint.step_id`, `checkpoint.request_path`,
   `checkpoint.allowed_choices`, and the exact resume command:

   ```bash
   ./bin/circuit-next resume --run-root '<run_root>' --checkpoint-choice '<choice>'
   ```

6. **If `outcome === "aborted"`, read `artifacts/result.json` at
   `result_path` to surface the abort `reason`.**

## Direct Flow Bypass

Use `/circuit:explore`, `/circuit:review`, `/circuit:fix`, or `/circuit:build`
when the operator already knows which flow they want. Those commands call
the same CLI with an explicit flow name and skip this classifier layer.

## Authority

- `src/runtime/router.ts` (current deterministic classifier)
- `tests/contracts/workflow-router.test.ts` (classifier behavior)
