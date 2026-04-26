---
description: Classifies free-form tasks into the current router-supported workflows (`explore`, `review`, or `build`) and runs the selected workflow through the project CLI.
argument-hint: <task>
---

# /circuit:run — workflow router

Classifies a free-form task into the current router-supported workflows and runs
the selected workflow through the project CLI. The first classifier is
deterministic and intentionally small: review/audit-style tasks route to
`review`, build-like tasks route to `build`, and everything else routes to
`explore`. Explicit router-free workflow commands remain available as
`/circuit:explore`, `/circuit:review`, and `/circuit:build`.

The user's task text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Task:** $ARGUMENTS

## Instructions

1. **Do not classify the task yourself.** Let the project CLI choose the
   workflow. It prints `selected_workflow`, `routed_by`, and
   `router_reason` in the JSON output.
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
   - Then invoke the CLI without an explicit workflow name, passing the
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
4. **Surface the selected workflow's close artifact when available.**
   For `selected_workflow === "explore"`, read the run-root-relative
   `artifacts/explore-result.json` close-step artifact (placeholder-parity
   per ADR-0007 CC#P2-1 — include the caveat). For
   `selected_workflow === "review"` and `outcome === "complete"`, read
   `artifacts/review-result.json` and surface its typed verdict. For
   `selected_workflow === "build"` and `outcome === "complete"`, read
   `artifacts/build-result.json` and surface its typed verdict fields; to
   summarize changed files and evidence, follow its `artifact_pointers` entry
   for `build.implementation` and read that artifact.
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

## Direct Workflow Bypass

Use `/circuit:explore`, `/circuit:review`, or `/circuit:build` when the
operator already knows which workflow they want. Those commands call the same
CLI with an explicit workflow name and skip this classifier layer.

## Authority

- `src/runtime/router.ts` (current deterministic classifier)
- `tests/contracts/workflow-router.test.ts` (classifier behavior)
