---
contract: host-adapter
status: draft-v0.1
version: 0.1
last_updated: 2026-04-28
depends_on: [compiled-flow, run, connector]
---

# Host Adapter Contract

A host adapter is the surface that lets an orchestrator drive Circuit from a
normal project checkout. The host is not the worker connector. The host starts
Circuit, reads its JSON summary and reports, and presents the outcome to the
operator.

## Required Behavior

Every host adapter MUST support:

- Routed runs: `circuit-next run --goal "<task>"`.
- Explicit runs: `circuit-next run <flow> --goal "<task>"`.
- Checkpoint resume: `circuit-next resume --run-folder <path> --checkpoint-choice <choice>`.
- Stable final JSON parsing from stdout.
- Progress JSONL parsing from stderr when invoked with `--progress jsonl`.
- Report reading from the returned `run_folder` and `result_path`.
- Clear failures when the CLI, packaged flows, or installed host files are missing.

## Packaged Flow Lookup

Hosts that are installed outside this repository MUST NOT load flows from the
operator's current project by default. They MUST pass an explicit packaged flow
root when invoking `run`.

For the Codex plugin, the wrapper command is:

```bash
node '<plugin root>/scripts/circuit-next.mjs' run --goal '<task>'
```

The wrapper injects:

```bash
--flow-root '<plugin root>/flows'
```

Resume commands do not inject a flow root because checkpoint resume loads the
saved run manifest.

## Progress Stream

Hosts SHOULD pass `--progress jsonl` for `run` and `resume`. Circuit writes one
progress event per stderr line and keeps the final result JSON on stdout.

Hosts should render short, user-facing updates for:

- selected flow and router reason
- current major stage
- evidence warnings
- relay role and connector
- checkpoint choices
- completion or abort

Hosts MUST NOT treat progress events as the canonical outcome. The final stdout
JSON and report files remain authoritative.

## Generated Output

Canonical compiled flows live under `generated/flows/**`. Host-specific flow
output mirrors those files:

- Claude Code host output: `.claude-plugin/skills/**`.
- Codex host output: `plugins/circuit/flows/**`.

Host command files may be transformed for host-specific invocation paths, but
they MUST be generated or drift-checked from their source commands.

## Codex Doctor

The Codex plugin wrapper MUST support:

```bash
node '<plugin root>/scripts/circuit-next.mjs' doctor
```

The doctor returns JSON on stdout and checks:

- plugin manifest exists and parses
- skill names resolve locally, for example `Circuit:run`
- wrapper and packaged flow root exist
- core packaged flow files exist
- command files invoke the installed plugin wrapper, not `./bin/circuit-next`
- command files request `--progress jsonl`
- a `circuit-next` binary is available
- a temp-repo routed Review smoke run succeeds with a read-only custom reviewer
- the temp-repo smoke run emits parseable progress events

## Result Handling

Hosts MUST preserve the distinction between:

- host/orchestrator, such as Codex or Claude Code
- worker connector, such as `claude-code`, `codex`, or a custom connector

Host summaries should surface `selected_flow`, `routed_by`, `router_reason`,
`outcome`, `run_folder`, `trace_entries_observed`, and `result_path` when
present. Checkpoint results should surface the allowed choices and exact resume
shape.
