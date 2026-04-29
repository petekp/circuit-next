---
contract: native-host-adapters
status: draft-v0.1
version: 0.1
last_updated: 2026-04-28
depends_on: [host-adapter, host-capabilities, host-rendering]
---

# Native Host Adapters

Circuit emits one host-neutral run stream. Native adapters map that stream to
host affordances without changing flow behavior.

## Shared Events

- `task_list.updated` carries the current flow checklist.
- `user_input.requested` carries checkpoint questions and resume metadata.
- `operator_summary_markdown_path` carries the final response text.

Adapters may choose richer presentation, but they must preserve Circuit's
wording and keep host/orchestrator separate from worker connector.

## Claude Agent SDK Track

The future Claude Agent SDK adapter should:

- map `task_list.updated` to TodoWrite/todo tracking;
- map `user_input.requested` to AskUserQuestion through `canUseTool`;
- include `AskUserQuestion` whenever tools are restricted;
- fall back to in-thread checkpoint prompts when native input is unavailable;
- avoid expecting AskUserQuestion inside Agent-tool subagents.

## Codex App Server Track

The future Codex App Server adapter should:

- map `task_list.updated` to plan updates where supported;
- map `user_input.requested` to `tool/requestUserInput` where supported;
- treat App Server dynamic tool and user-input APIs as experimental until
  separately dogfooded;
- continue using `operator_summary_markdown_path` as the final answer source.

## Non-Goals For This Slice

This contract does not implement either native bridge. The current slice only
adds the host-neutral events and teaches existing Codex and Claude surfaces to
render or fall back from them.
