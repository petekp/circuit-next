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

Execution-language plan requests, such as `Execute this plan: <path>`, should
also use the routed form. Circuit will start the first likely workflow slice
instead of returning an analysis-only Explore run.

Replace `<plugin root>` with the absolute path to this installed Circuit
plugin directory, the directory that contains `.codex-plugin/plugin.json`.
Do not use a path relative to the user's current project.

Single-quote the task. If the task contains a single quote, escape it as
`'\''`.

Parse progress JSONL from stderr while the run is active. For every event whose
`display.importance === "major"` or whose `display.tone` is `warning`, `error`,
or `checkpoint`, render `display.text` exactly. Suppress `detail` events unless
the user asks for debug detail. Do not show raw JSON, raw step IDs, or trace
internals by default.

When `task_list.updated` arrives, update Codex's plan/task surface when
available. If that surface is unavailable, keep the thread output compact and do
not print the full checklist unless the user asks for debug detail.

When `user_input.requested` arrives, use Codex's native user-input affordance
when available. Otherwise ask the question in-thread, map the chosen option to
its `checkpoint_choice`, and resume with the provided command shape.

Parse the final JSON output from stdout. Surface `selected_flow`, `routed_by`,
`router_reason`, `outcome`, `run_folder`, `trace_entries_observed`, and
`operator_summary_markdown_path`, and `result_path` when present.

## Run an Explicit Flow

When the user names a flow, run:

```bash
node '<plugin root>/scripts/circuit-next.mjs' run <flow> --goal '<task>' --progress jsonl
```

Valid explicit flows are `explore`, `review`, `migrate`, `fix`, `build`, and
`sweep`.

## Resume a Checkpoint

When a previous run is waiting at a checkpoint, run:

```bash
node '<plugin root>/scripts/circuit-next.mjs' resume --run-folder '<run_folder>' --checkpoint-choice '<choice>' --progress jsonl
```

If the active progress stream includes `user_input.requested`, prefer its
question text, options, and `checkpoint_choice` values over guessing from the
summary JSON.

## Read Reports

When the run completes, read the report paths from the run folder instead of
guessing. For aborted runs, read `reports/result.json` and surface the abort
reason.

For completed runs, read `operator_summary_markdown_path` and render that
Markdown verbatim as the final user-facing answer. Do not invent a separate
summary. If the operator summary is missing, include a compact fallback summary
with the selected flow, outcome, verdict or result headline, finding count when
present, evidence warnings, run folder, and final report path.

## Boundaries

Circuit running under Codex is a host/orchestrator path. It is separate from
using Codex as a worker connector inside Circuit relay config. Codex worker
connectors are read-only in V1 and must not be used for implementer relays.
