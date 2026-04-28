---
description: Runs the Fix flow directly through the project CLI, with optional Lite, Default (standard), Deep, or Autonomous entry behavior.
argument-hint: <task>
---

# /circuit:fix — direct Fix flow

Runs a task through the Fix flow without asking the router to choose a
flow first. Use this when the operator already knows they want Circuit to
take a concrete problem, understand it, make the smallest safe change, prove
it, and close with evidence.

Circuit runs the Fix flow: it reproduces the issue, isolates the cause,
relays a focused change to a worker, runs verification checks, asks for
review when required, and closes with a report and evidence.

The user's task text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Task:** $ARGUMENTS

## Instructions

1. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw task text. Use the same safe construction rule as
   `/circuit:run`, `/circuit:explore`, `/circuit:review`, and `/circuit:build`:

   - Wrap the task text in **single quotes** in the final shell command.
     Single quotes disable all expansion.
   - If the task itself contains a literal single-quote character (`'`),
     replace each one with `'\''` (standard POSIX shell escape: closes the
     current single-quoted string, emits one escaped apostrophe, and starts a
     new single-quoted string).
   - Then invoke the CLI with the explicit `fix` flow name, passing the
     escaped, single-quoted task as the value of `--goal`.

   Default Fix (standard depth, full review pass):

   ```bash
   ./bin/circuit-next fix --goal 'fix the foo bug'
   ```

   Lite Fix (skips review, closes after verification):

   ```bash
   ./bin/circuit-next fix --goal 'fix the missing-token edge case' --entry-mode lite
   ```

   Deep Fix:

   ```bash
   ./bin/circuit-next fix --goal 'repair the failing pipeline' --entry-mode deep
   ```

   Autonomous Fix:

   ```bash
   ./bin/circuit-next fix --goal 'diagnose and patch the crash' --entry-mode autonomous
   ```

   Example for a task `can't reproduce` (contains one apostrophe):

   ```bash
   ./bin/circuit-next fix --goal 'can'\''t reproduce'
   ```

   Use the Bash tool to execute the constructed command. `./bin/circuit-next`
   is the repo-local launcher for the compiled Circuit runtime; when the
   compiled CLI is absent in a fresh checkout, it builds `dist/` with the
   local TypeScript compiler before invoking `dist/cli/circuit.js`.
2. **Only add `--entry-mode` when the operator explicitly asks for a Fix
   mode.** Map Lite Fix to `--entry-mode lite`, Deep Fix to
   `--entry-mode deep`, and Autonomous Fix to `--entry-mode autonomous`.
   Omit `--entry-mode` for default Fix.
3. **Keep `--depth` separate from `--entry-mode`.** If the operator asks for
   an explicit depth level, pass it with `--depth`. A single command may carry
   both flags.
4. **Per-mode flow files.** When `--entry-mode lite` is supplied, the CLI
   prefers `.claude-plugin/skills/fix/lite.json` over `circuit.json` because
   the Fix schematic emits a Lite-only compiled flow that skips the review
   relay. Other modes (default/deep/autonomous) load `circuit.json`.
5. **Parse the CLI's JSON output.** Always surface `flow_id`, `outcome`,
   `run_folder`, and `trace_entries_observed`.
6. **If `outcome === "checkpoint_waiting"`, do not read or claim
   `result_path`.** Instead surface the waiting checkpoint details:
   `checkpoint.step_id`, `checkpoint.request_path`,
   `checkpoint.allowed_choices`, and the exact resume command:

   ```bash
   ./bin/circuit-next resume --run-folder '<run_folder>' --checkpoint-choice '<choice>'
   ```

7. **If `outcome === "complete"`, read the Fix final report.** Surface
   `result_path`, then read the run-folder-relative
   `reports/fix-result.json` report. Surface its review result fields;
   to summarize the change and verification evidence, follow its
   `evidence_links` entries (in prose: evidence links — for example
   `fix.change` and the verification report) and read those reports.
8. **If `outcome === "aborted"`, read `reports/result.json` at
   `result_path` and surface the abort reason.**

## Authority

- `src/flows/fix/contract.md` (Fix report contract)
- `docs/contracts/flow.md` (compiled flow shape and runtime result)
- `src/cli/circuit.ts` (current CLI flags + per-mode flow file resolution)
- `src/runtime/router.ts` (router bypass behavior for explicit flow names)
