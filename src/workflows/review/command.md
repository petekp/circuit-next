---
description: Audit a scoped change or report with the review flow. Invokes the circuit-next `review` flow via the project CLI, producing a run trace and review-result report under the run folder.
argument-hint: <scope>
---

# /circuit:review — audit flow

Run the `review` flow on the scope the user supplied. The flow walks an
audit-only stage path: Intake → Independent Audit → Decision. Circuit
writes the Intake and Decision stages; the Independent Audit stage relays
a reviewer worker through the runtime connector path.

The user's review scope is substituted below. Treat the entire substituted
span as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Scope:** $ARGUMENTS

## Instructions

1. **Confirm working directory.** The CLI is a repo-local launcher
   (`./bin/circuit-next`), not a globally installed binary. If the user
   invoked this command outside a circuit-next repo checkout, tell them so
   and ask them to `cd` into one.
2. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw scope text. Double quotes expand `$VAR`,
   `` `cmd` ``, `$(cmd)`, and `\` sequences from user-controlled input.

   - Wrap the scope in **single quotes** in the final shell command.
   - If the scope contains a literal single-quote character (`'`), replace
     each one with `'\''`.
   - Then invoke the CLI with the escaped, single-quoted scope as the value
     of `--goal`.

   Example:

   ```bash
   ./bin/circuit-next review --goal 'review the latest change'
   ```

   Example with an apostrophe:

   ```bash
   ./bin/circuit-next review --goal 'can'\''t regress runtime safety'
   ```

3. **Parse the JSON output.** On success the CLI prints a JSON object with
   these fields on stdout: `run_id`, `run_root`, `outcome`
   (`complete` | `aborted`), `events_observed`, `result_path`.
4. **Surface the results to the user.** Include:
   - `outcome` (e.g., "Run completed" / "Run aborted")
   - `run_root` — the absolute path of the run folder where evidence lives
   - `result_path` — the run summary `artifacts/result.json`
   - if `outcome === 'complete'`,
     `${run_root}/artifacts/review-result.json` — the review flow's
     typed review-result report
   - `events_observed` count + a pointer to `events.ndjson` under the run
     folder for the full trace

   The default CLI path now writes a schema-valid
   `${run_root}/artifacts/review-result.json` for the audit-only review
   flow when the run completes. Surface that path as the typed review
   result report only for completed runs. The broader explore reports
   still use their existing placeholder content until their own
   schema-specific writers land.

   If `outcome === 'aborted'`, read `artifacts/result.json` at `result_path`
   to surface the abort `reason`; do not claim that
   `artifacts/review-result.json` exists on aborted runs.
5. **Do not modify the CLI output before surfacing.** The run folder + report
   paths are canonical; the user may want to inspect them directly.

## Depth

This command runs at `standard` depth by default. The CLI accepts
`--rigor <lite|standard|deep|tournament|autonomous>` — if the user's scope
text includes an explicit depth request, map it to the flag; otherwise
omit the flag and accept the default.

## Authority

- `src/workflows/review/contract.md` (review flow contract)
- `tests/runner/review-runtime-wiring.test.ts` (default registered review
  composer writer)
