#!/usr/bin/env bash
# SessionStart hook — circuit-next continuity-resume banner.
#
# Installed via .claude/settings.json with matcher "startup|resume|clear|compact".
# Fires when a Claude Code session starts (any of the four entrypoints) and, if
# circuit-engine continuity has a pending record or attached current_run, emits
# a Markdown banner to stdout. Claude Code captures stdout from SessionStart
# hooks as additionalContext so the banner becomes the first context the new
# session sees.
#
# Authority: ADR-0007 §Decision.1 CC#P2-4 enforcement binding names this script
# explicitly. Mirrors the prior-gen circuit `session-start.ts` banner shape
# (~/Code/circuit/scripts/runtime/engine/src/cli/session-start.ts) so an
# operator who has used either generation sees a consistent resume surface.
#
# Behavior:
#   - Drains stdin (Claude Code may pipe a payload).
#   - Resolves project root via $CLAUDE_PROJECT_DIR, falling back to the
#     script's BASH_SOURCE-derived parent directory.
#   - Bails silently if .circuit/bin/circuit-engine is not present (e.g. when
#     this hook ships in a tree that doesn't carry the control-plane shim).
#   - Calls `circuit-engine continuity status --json`, parses with jq, and
#     emits one of three banners: pending-record, current-run-attached, or
#     nothing (no continuity, no banner).
#   - Never fails closed — any error path exits 0 silently so a hook bug can
#     never block session startup.

set -uo pipefail

# Drain stdin so Claude Code's hook payload doesn't leave a broken pipe behind.
cat >/dev/null 2>&1 || true

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$PROJECT_ROOT" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
fi

cd "$PROJECT_ROOT" 2>/dev/null || exit 0

ENGINE_BIN=".circuit/bin/circuit-engine"
if [ ! -x "$ENGINE_BIN" ]; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

STATUS_JSON="$("$ENGINE_BIN" continuity status --json 2>/dev/null || true)"
if [ -z "$STATUS_JSON" ]; then
  exit 0
fi

SELECTION="$(printf '%s' "$STATUS_JSON" | jq -r '.selection // "none"' 2>/dev/null || echo "none")"

case "$SELECTION" in
  pending_record)
    GOAL="$(printf '%s' "$STATUS_JSON" | jq -r '.record.narrative.goal // ""' 2>/dev/null)"
    NEXT="$(printf '%s' "$STATUS_JSON" | jq -r '.record.narrative.next // ""' 2>/dev/null)"
    WARNINGS="$(printf '%s' "$STATUS_JSON" | jq -r '.warnings[]? // empty' 2>/dev/null)"

    printf '> **Circuit continuity pending.**\n'
    if [ -n "$GOAL" ]; then
      printf '> Goal: %s\n' "$GOAL"
    fi
    if [ -n "$NEXT" ]; then
      printf '> Next: %s\n' "$NEXT"
    fi
    printf '>\n'
    printf '> **To pick back up:**\n'
    printf '> - Run `.circuit/bin/circuit-engine continuity resume` to inspect the saved record.\n'
    printf '> - Or invoke a Circuit workflow with a continuation arg (for example `/circuit:run continue`) -- Circuit auto-resumes from pending continuity.\n'
    printf '> - Or name a concrete new task via `/circuit:run <task>` -- Circuit treats that as override and starts fresh.\n'
    printf '> - Or run `.circuit/bin/circuit-engine continuity clear` to clear pending continuity.\n'
    printf '> - If the engine says the plugin root is not initialized, invoke any `/circuit:*` command once in this project, then retry the engine command.\n'
    printf '> Available: pending continuity\n'
    if [ -n "$WARNINGS" ]; then
      while IFS= read -r warning; do
        [ -n "$warning" ] && printf '> Warning: %s\n' "$warning"
      done <<< "$WARNINGS"
    fi
    printf '\n'
    ;;

  current_run)
    printf '> **Circuit active run attached.**\n'
    printf '> No pending continuity record -- the indexed current_run is a fallback attachment, not saved handoff authority.\n'
    printf '> Name your next task to continue, or inspect the attachment with `.circuit/bin/circuit-engine continuity status`.\n'
    printf '> Available: active run\n\n'
    ;;

  *)
    # No pending record and no attached current_run — emit nothing.
    ;;
esac

exit 0
