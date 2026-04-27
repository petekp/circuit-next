---
description: Audit a scoped change or artifact with the review workflow. Invokes the circuit-next `review` workflow via the project CLI, producing a canonical event log and review result artifact under the run root.
argument-hint: <scope>
---

# /circuit:review — audit workflow

Run the `review` workflow on the scope the user supplied. The workflow is
an audit-only spine: Intake → Independent Audit → Verdict. Intake and
Verdict are orchestrator-synthesis phases; Independent Audit dispatches a
reviewer worker through the runtime adapter path.

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
   - `run_root` — the absolute path where the run artifacts live
   - `result_path` — the canonical `artifacts/result.json` RunResult summary
   - if `outcome === 'complete'`,
     `${run_root}/artifacts/review-result.json` — the review workflow's
     typed verdict artifact
   - `events_observed` count + a pointer to `events.ndjson` under the run
     root for full event-level audit

   The default CLI path now writes a schema-valid
   `${run_root}/artifacts/review-result.json` for the audit-only review
   workflow when the run completes. Surface that path as the typed review
   verdict artifact only for completed runs. The broader explore synthesis
   artifacts still use their existing placeholder epoch until their own
   schema-specific writers land.

   If `outcome === 'aborted'`, read `artifacts/result.json` at `result_path`
   to surface the abort `reason`; do not claim that
   `artifacts/review-result.json` exists on aborted runs.
5. **Do not modify the CLI output before surfacing.** The run root + artifact
   paths are canonical; the user may want to inspect them directly.

## Rigor

This command runs at `standard` rigor by default. The CLI accepts
`--rigor <lite|standard|deep|tournament|autonomous>` — if the user's scope
text includes an explicit rigor request, map it to the flag; otherwise
omit the flag and accept the default.

## Authority

- `specs/contracts/review.md` (review workflow contract)
- `tests/runner/review-runtime-wiring.test.ts` (default registered review
  synthesis writer)
