---
description: Runs the Build flow directly through the project CLI, with optional Lite, Deep, or Autonomous entry behavior.
argument-hint: <task>
---

# /circuit:build — direct Build flow

Runs a task through the Build flow without asking the router to choose a
flow first. Use this when the operator is asking Circuit to make a focused
change.

Circuit runs the Build flow: it confirms the brief, makes a plan, relays the
implementation to a worker, runs checks, asks for review when required, and
closes with a report and evidence.

The user's task text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Task:** $ARGUMENTS

## Instructions

1. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw task text. Use the same safe construction rule as
   `/circuit:run`, `/circuit:explore`, and `/circuit:review`:

   - Wrap the task text in **single quotes** in the final shell command.
     Single quotes disable all expansion.
   - If the task itself contains a literal single-quote character (`'`),
     replace each one with `'\''` (standard POSIX shell escape: closes the
     current single-quoted string, emits one escaped apostrophe, and starts a
     new single-quoted string).
   - Then invoke the CLI with the explicit `build` flow name, passing the
     escaped, single-quoted task as the value of `--goal`.

   Default Build:

   ```bash
   ./bin/circuit-next run build --goal 'add a focused feature'
   ```

   Lite Build:

   ```bash
   ./bin/circuit-next run build --goal 'make a small change' --entry-mode lite
   ```

   Deep Build with explicit standard depth in the same invocation:

   ```bash
   ./bin/circuit-next run build --goal 'make the focused change' --entry-mode deep --depth standard
   ```

   Autonomous Build:

   ```bash
   ./bin/circuit-next run build --goal 'ship the requested fix' --entry-mode autonomous
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   ./bin/circuit-next run build --goal 'can'\''t ship'
   ```

   Use the Bash tool to execute the constructed command. `./bin/circuit-next`
   is the repo-local launcher for the compiled Circuit runtime; when the
   compiled CLI is absent in a fresh checkout, it builds `dist/` with the
   local TypeScript compiler before invoking `dist/cli/circuit.js`.
2. **Only add `--entry-mode` when the operator explicitly asks for a Build
   mode.** Map Lite Build to `--entry-mode lite`, Deep Build to
   `--entry-mode deep`, and Autonomous Build to `--entry-mode autonomous`.
   Omit `--entry-mode` for normal Build.
3. **Keep `--depth` separate from `--entry-mode`.** If the operator asks for
   an explicit depth level, pass it with `--depth`. A single command may carry
   both flags, as shown above.
4. **Parse the CLI's JSON output.** Always surface `flow_id`, `outcome`,
   `run_folder`, and `trace_entries_observed`.
5. **If `outcome === "checkpoint_waiting"`, do not read or claim
   `result_path`.** Instead surface the waiting checkpoint details:
   `checkpoint.step_id`, `checkpoint.request_path`,
   `checkpoint.allowed_choices`, and the exact resume command:

   ```bash
   ./bin/circuit-next resume --run-folder '<run_folder>' --checkpoint-choice '<choice>'
   ```

6. **If `outcome === "complete"`, read the Build final report.** Surface
   `result_path`, then read the run-folder-relative
   `reports/build-result.json` report. Surface its review result fields;
   to summarize changed files and evidence, follow its `evidence_links`
   entry (in prose: evidence links) for `build.implementation` and read that
   report.
7. **If `outcome === "aborted"`, read `reports/result.json` at
   `result_path` and surface the abort reason.**

## Authority

- `docs/contracts/flow.md` (compiled flow shape and runtime result)
- `src/cli/circuit.ts` (current CLI flags)
- `src/runtime/router.ts` (router bypass behavior for explicit flow names)
