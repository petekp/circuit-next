---
description: Investigate, understand, choose among options, or shape an execution plan. Invokes the circuit-next `explore` workflow end-to-end via the project CLI, producing a canonical event log + result artifact under the run root.
argument-hint: <goal>
---

# /circuit:explore — investigation workflow

Run the `explore` workflow on the goal the user supplied. The workflow is a
full-spine investigation: Frame → Analyze → Synthesize → Review → Close. The
Synthesize and Review phases dispatch to subprocess adapters per
`specs/adrs/ADR-0009-adapter-invocation-pattern.md`; Frame, Analyze, and Close
are orchestrator-synthesis phases.

The user's goal text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Goal:** $ARGUMENTS

## Instructions

1. **Confirm working directory.** The CLI is a repo-local launcher
   (`./bin/circuit-next`), not a globally installed binary. If the user
   invoked this command outside a circuit-next repo checkout, tell them so
   and ask them to `cd` into one.
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
   ./bin/circuit-next explore --goal 'can'\''t go'
   ```

   For a goal with no special characters (e.g., `find deprecated APIs`),
   the straightforward single-quoted form is sufficient:

   ```bash
   ./bin/circuit-next explore --goal 'find deprecated APIs'
   ```

   Use the Bash tool to execute the constructed command. `./bin/circuit-next`
   is the repo-local launcher for the compiled Circuit runtime; when the
   compiled CLI is absent in a fresh checkout, it builds `dist/` with the
   local TypeScript compiler before invoking `dist/cli/circuit.js`.
3. **Parse the JSON output.** On success the CLI prints a JSON object with
   these fields on stdout: `run_id`, `run_root`, `outcome`
   (`complete` | `aborted`), `events_observed`, `result_path`.
4. **Surface the results to the user.** Include:
   - `outcome` (e.g., "Run completed" / "Run aborted")
   - `run_root` — the absolute path where the run artifacts live
   - `result_path` — the canonical `artifacts/result.json` RunResult summary
     (not the close-step output)
   - `${run_root}/artifacts/explore-result.json` — the close-step output
     artifact (the actual workflow product). Note: at this phase of
     Phase 2, this artifact carries placeholder content (the close-step
     orchestrator-synthesis produces `<close-step-placeholder-*>` strings
     per ADR-0007 CC#P2-1 placeholder-parity). Surface the path so the
     user can inspect, with a one-line caveat about placeholder-parity.
   - `events_observed` count + a pointer to `events.ndjson` under the run
     root for full event-level audit.

   If `outcome === 'aborted'`, read `artifacts/result.json` at `result_path`
   to surface the abort `reason` — the runtime mirrors that reason
   byte-for-byte from the gate-evaluation layer per
   `specs/contracts/explore.md §Dispatch gate-evaluation semantics` and
   the `RunResult.reason` schema field.
5. **Do not modify the CLI output before surfacing.** The run root + artifact
   paths are canonical; the user may want to inspect them directly.

## Rigor

This command runs at `standard` rigor by default (per ADR-0007 CC#P2-6
resolution of plan Open Question #5, captured in
`.claude-plugin/skills/explore/circuit.json:18`). The CLI accepts
`--rigor <lite|standard|deep|tournament|autonomous>` — if the user's goal
text includes an explicit rigor request (e.g., "deep dive", "quick look"),
map it to the flag; otherwise omit the flag and accept the default.

## Authority

- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-1`
  (one-workflow parity — this command's target workflow)
- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-3`
  (plugin command registration — active-satisfied at CLI-surrogate parity
  at P2.11 / Slice 56)
- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-6`
  (spine policy coverage — full-spine explore per Open Question #5)
- `specs/adrs/ADR-0009-adapter-invocation-pattern.md §1`
  (subprocess-per-adapter invocation — the adapters the runner dispatches
  to during Synthesize + Review)
- `specs/contracts/explore.md §Canonical phase set + §Dispatch gate-evaluation
  semantics` (workflow contract + dispatch semantics)
- `specs/plans/p2-11-plugin-wiring.md` (this slice's plan; superseded scope
  body at `specs/plans/project-holistic-foldins.md §Slice 52`)
- `specs/reviews/p2-11-invoke-evidence.md` (CLI-surrogate invocation evidence
  recording CC#P2-3 state transition)
- `specs/reviews/arc-slice-56-codex.md` HIGH 2 (the safe-construction rule
  above was added in response to Codex's objection; the rule prevents shell
  metacharacter injection from user-controlled goal text)
