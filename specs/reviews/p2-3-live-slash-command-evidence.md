---
review_kind: invoke-evidence
review_target: ADR-0007 CC#P2-3 live Claude Code slash-command proof
authored_at: 2026-04-24
authored_against_commit: bdf51a93792cb57636ddd9a314e9149b16280fe6
authored_against_worktree: uncommitted Slice 100 working tree; this evidence is committed with the plugin-layout changes it proves
close_criterion: ADR-0007 §Decision.1 CC#P2-3 (plugin command registration)
cc_state_transition: active — red → active — satisfied
claude_code_version: 2.1.119
plugin_source: circuit@inline
live_command: /circuit:review
---

# P2-3 Live Slash-Command Evidence

This records the live Claude Code proof that the circuit-next plugin command
surface is loadable and invokable through Claude Code itself, not only through
the project CLI surrogate.

**Provenance note:** The proof was run before the Slice 100 commit existed,
against base commit `bdf51a93792cb57636ddd9a314e9149b16280fe6` plus the
uncommitted Slice 100 working tree. The command files, manifest retarget, and
this evidence file land together in the Slice 100 commit.

## Validator

Command:

```bash
claude plugin validate .
```

Result:

```text
Validating plugin manifest: /Users/petepetrash/Code/circuit-next/.claude-plugin/plugin.json

✔ Validation passed
```

## Live Claude Code Invocation

Command:

```bash
claude -p --plugin-dir . --no-session-persistence --setting-sources project,local --output-format stream-json --permission-mode auto "/circuit:review live slash command proof for circuit-next plugin command wiring after review prompt fix"
```

The `--setting-sources project,local` flag keeps user-installed marketplace
plugins out of this proof. The stream `init` event showed only this inline
plugin:

```json
{
  "plugins": [
    {
      "name": "circuit",
      "path": "/Users/petepetrash/Code/circuit-next",
      "source": "circuit@inline"
    }
  ],
  "slash_commands": [
    "circuit:explore",
    "circuit:run",
    "circuit:review"
  ],
  "claude_code_version": "2.1.119"
}
```

The slash command expanded to the plugin command body and Claude Code invoked:

```bash
npm run circuit:run -- review --goal 'live slash command proof for circuit-next plugin command wiring after review prompt fix'
```

CLI stdout:

```json
{
  "run_id": "242bca49-f5e0-44ee-9588-eb3f7df0a619",
  "workflow_id": "review",
  "selected_workflow": "review",
  "routed_by": "explicit",
  "router_reason": "explicit workflow positional argument",
  "run_root": "/Users/petepetrash/Code/circuit-next/.circuit-next/runs/242bca49-f5e0-44ee-9588-eb3f7df0a619",
  "outcome": "complete",
  "events_observed": 18,
  "result_path": "/Users/petepetrash/Code/circuit-next/.circuit-next/runs/242bca49-f5e0-44ee-9588-eb3f7df0a619/artifacts/result.json"
}
```

Review result:

```json
{
  "scope": "live slash command proof for circuit-next plugin command wiring after review prompt fix",
  "findings": [],
  "verdict": "CLEAN"
}
```

## Scope

This proves:

- Claude Code 2.1.119 validates the plugin manifest.
- Claude Code derives `/circuit:run`, `/circuit:explore`, and
  `/circuit:review` from the inline `circuit` plugin.
- A real `/circuit:review` slash command invocation reaches the project CLI,
  creates a run root, executes the review workflow, and writes the typed
  `review-result.json` artifact.

This does not claim Phase 2 is closed. The Phase 2 close review and operator
product check remain separate CC#P2-8 artifacts.
