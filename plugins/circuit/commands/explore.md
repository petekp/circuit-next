---
description: Investigate, understand, choose among options, or shape an execution plan. Invokes the circuit-next `explore` flow end-to-end via the project CLI, producing a run trace + final report under the run folder.
argument-hint: <goal>
---

# /circuit:explore — investigation flow

Run the `explore` flow on the goal the user supplied. The flow walks a full
stage path: Frame → Analyze → Compose → Review → Close. The Compose and
Review stages relay to specialist agents; Frame, Analyze, and Close are
Circuit-written stages.

The user's goal text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Goal:** $ARGUMENTS

## Instructions

1. **Resolve plugin root.** Use the absolute path to the installed
   Circuit plugin directory, the directory that contains
   `.codex-plugin/plugin.json`. Do not use a path relative to the
   user's project.
2. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw goal (double quotes expand `$VAR`, `` `cmd` ``,
   `$(cmd)`, and `\` sequences — a malicious or accidental goal could inject
   commands). The safe construction rule:

   - Wrap the goal in **single quotes** in the final shell command. Single
     quotes disable all expansion.
   - If the goal itself contains a literal single-quote character (`'`),
     replace each one with `'\''` — that ends the current single-quoted
     string, emits one escaped apostrophe, and starts a new single-quoted
     string. This is the standard POSIX shell escape.
   - Then invoke the CLI with the escaped, single-quoted goal as the value
     of `--goal`.

   Worked example. If the goal is the literal 7-character string
   `can't go` (contains one apostrophe), the safely-escaped argv token is:

   ```text
   'can'\''t go'
   ```

   and the full Bash command becomes:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run explore --goal 'can'\''t go' --progress jsonl
   ```

   For a goal with no special characters (e.g., `find deprecated APIs`),
   the straightforward single-quoted form is sufficient:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' run explore --goal 'find deprecated APIs' --progress jsonl
   ```

   Use the Bash tool to execute the constructed command. The wrapper
   lives in the installed Circuit plugin directory and injects the plugin's
   packaged flow root before it invokes `circuit-next`.
3. **Render progress while the run is active.** `--progress jsonl` writes
   progress events to stderr and keeps the final result JSON on stdout.
   Surface the selected flow, major stage changes, relay role and connector,
   checkpoint choices, and completion. Do not show raw step IDs unless the
   user asks for debug detail.
4. **Parse the final JSON output.** On success the CLI prints a JSON object
   with these fields on stdout: `run_id`, `run_folder`, `outcome`
   (`complete` | `aborted`), `trace_entries_observed`, `result_path`.
5. **Surface the results to the user.** Include:
   - `outcome` (e.g., "Run completed" / "Run aborted")
   - `run_folder` — the absolute path of the run folder where evidence lives
   - `result_path` — the run summary `reports/result.json` (not the
     close-step report)
   - `${run_folder}/reports/explore-result.json` — the close-step report
     (the actual flow product). Note: in the current build this report
     carries baseline placeholder content. Surface the path so the user
     can inspect, with a one-line caveat that the report is a placeholder.
   - `trace_entries_observed` count + a pointer to `trace.ndjson` under the run
     folder for the full trace.

   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
   to surface the abort `reason` — the runtime mirrors that reason
   byte-for-byte from the check-evaluation layer per
   `src/flows/explore/contract.md §Relay check-evaluation semantics` and
   the `RunResult.reason` schema field.

6. **Do not modify the CLI output before surfacing.** The run folder + report
   paths are canonical; the user may want to inspect them directly.

## Depth

This command runs at `standard` depth by default. The CLI accepts
`--depth <lite|standard|deep|tournament|autonomous>` — if the user's goal
text includes an explicit depth request (e.g., "deep dive", "quick look"),
map it to the flag; otherwise omit the flag and accept the default.

## Authority

- `src/flows/explore/contract.md` (flow contract + relay semantics)
- `src/runtime/` (current runner)
