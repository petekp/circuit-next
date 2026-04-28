---
name: run
description: Run a Circuit flow from Codex. Use when the user asks Codex to route a task through Circuit, run a specific Circuit flow, read Circuit reports, or resume a Circuit checkpoint.
---

# Circuit Runner

Use Circuit as a local flow engine from Codex.

## Run a Routed Task

When the user wants Circuit to choose the flow, run:

```bash
node '<plugin root>/scripts/circuit-next.mjs' run --goal '<task>' --progress jsonl
```

Replace `<plugin root>` with the absolute path to this installed Circuit
plugin directory, the directory that contains `.codex-plugin/plugin.json`.
Do not use a path relative to the user's current project.

Single-quote the task. If the task contains a single quote, escape it as
`'\''`.

Parse progress JSONL from stderr while the run is active. Surface the selected
flow and router reason, major stage changes, evidence warnings, relay role and
connector, checkpoint choices, and completion. Do not show raw step IDs unless
the user asks for debug detail.

Parse the final JSON output from stdout. Surface `selected_flow`, `routed_by`,
`router_reason`, `outcome`, `run_folder`, `trace_entries_observed`, and
`result_path` when present.

## Run an Explicit Flow

When the user names a flow, run:

```bash
node '<plugin root>/scripts/circuit-next.mjs' run <flow> --goal '<task>' --progress jsonl
```

Valid explicit flows are `explore`, `review`, `fix`, and `build`.

## Resume a Checkpoint

When a previous run is waiting at a checkpoint, run:

```bash
node '<plugin root>/scripts/circuit-next.mjs' resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
```

## Read Reports

When the run completes, read the report paths from the run folder instead of
guessing. For aborted runs, read `reports/result.json` and surface the abort
reason.

For completed runs, include a compact final summary with the selected flow,
outcome, verdict or result headline, finding count when present, evidence
warnings, run folder, and final report path.

## Boundaries

Circuit running under Codex is a host/orchestrator path. It is separate from
using Codex as a worker connector inside Circuit relay config. Codex worker
connectors are read-only in V1 and must not be used for implementer relays.
