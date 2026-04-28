---
name: run
description: Run a Circuit flow from Codex. Use when the user asks Codex to route a task through Circuit, run a specific Circuit flow, read Circuit reports, or resume a Circuit checkpoint.
---

# Circuit Runner

Use Circuit as a local flow engine from Codex.

## Run a Routed Task

When the user wants Circuit to choose the flow, run:

```bash
node '<plugin root>/scripts/circuit-next.mjs' run --goal '<task>'
```

Replace `<plugin root>` with the absolute path to this installed Circuit
plugin directory, the directory that contains `.codex-plugin/plugin.json`.
Do not use a path relative to the user's current project.

Single-quote the task. If the task contains a single quote, escape it as
`'\''`.

Parse the JSON output. Surface `selected_flow`, `routed_by`,
`router_reason`, `outcome`, `run_folder`, `trace_entries_observed`, and
`result_path` when present.

## Run an Explicit Flow

When the user names a flow, run:

```bash
node '<plugin root>/scripts/circuit-next.mjs' run <flow> --goal '<task>'
```

Valid explicit flows are `explore`, `review`, `fix`, and `build`.

## Resume a Checkpoint

When a previous run is waiting at a checkpoint, run:

```bash
node '<plugin root>/scripts/circuit-next.mjs' resume --run-folder '<run_folder>' --checkpoint-choice '<choice>'
```

## Read Reports

When the run completes, read the report paths from the run folder instead of
guessing. For aborted runs, read `reports/result.json` and surface the abort
reason.

## Boundaries

Circuit running under Codex is a host/orchestrator path. It is separate from
using Codex as a worker connector inside Circuit relay config. Codex worker
connectors are read-only in V1 and must not be used for implementer relays.
