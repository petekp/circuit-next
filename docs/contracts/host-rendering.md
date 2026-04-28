---
contract: host-rendering
status: draft-v0.1
version: 0.1
last_updated: 2026-04-28
depends_on: [host-adapter, run]
---

# Host Rendering Contract

Circuit owns the text that hosts show while a run is active and when a run
finishes. Hosts render that text; they do not rewrite it.

## Progress Rendering

When invoking `run` or `resume`, hosts SHOULD pass `--progress jsonl`.
Circuit writes one progress event per stderr line and keeps the final JSON on
stdout.

For each progress event:

- Render `display.text` exactly when `display.importance === "major"`.
- Always render `display.text` exactly when `display.tone` is `warning`,
  `error`, or `checkpoint`.
- Suppress `display.importance === "detail"` by default unless the operator
  asks for debug output.
- Do not render raw JSON, raw step ids, or trace internals by default.

The existing machine fields remain available for tooling and debug views:
`type`, `label`, `step_id`, `connector_name`, `report_path`, and related
fields.

## Final Rendering

After stdout JSON is parsed, hosts MUST read
`operator_summary_markdown_path` when present and render that Markdown
verbatim as the final user-facing answer.

Hosts MUST NOT invent a separate final summary when
`operator_summary_markdown_path` is present. If that file is missing or cannot
be read, hosts MAY fall back to `operator_summary_path`, then `result_path`,
then the selected flow's final report.

## Summary Files

Circuit writes these files for top-level CLI `run` and `resume` invocations:

- `reports/operator-summary.json` — typed data for host tooling.
- `reports/operator-summary.md` — exact Markdown for the host's final answer.

The final stdout JSON includes:

- `operator_summary_path`
- `operator_summary_markdown_path`

Checkpoint results include these paths even when `result_path` is absent.

## Host Boundary

Hosts must preserve the distinction between:

- host/orchestrator: Codex, Claude Code, or generic shell
- worker connector: `claude-code`, `codex`, or a custom connector

Progress display text may mention the worker connector. Hosts should not
replace that with the host/orchestrator name.
