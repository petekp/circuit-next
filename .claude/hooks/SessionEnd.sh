#!/usr/bin/env bash
# SessionEnd hook — circuit-next continuity tombstone.
#
# Installed via .claude/settings.json. Fires when a Claude Code session ends
# (any reason: /clear, /compact, exit, process termination). Emits a one-line
# diagnostic summary of continuity status to stderr so an operator reviewing
# session logs can see at a glance whether work was persisted.
#
# Authority: ADR-0007 §Decision.1 CC#P2-4 enforcement binding names this script
# explicitly. Pairs with .claude/hooks/SessionStart.sh and the existing
# Stop-hook auto-handoff guard (.claude/hooks/auto-handoff-guard.sh) to form
# the project's session-boundary continuity surface.
#
# Why this script does NOT auto-save a continuity record:
#   `circuit-engine continuity save` requires Claude-authored narrative fields
#   (--goal, --next, --state-markdown, --debt-markdown). A hook running at
#   session-end has no live Claude to generate those fields; auto-saving with
#   mechanical content would write a low-fidelity record over a high-fidelity
#   one. Authoring is the Stop hook's job (auto-handoff-guard.sh blocks the
#   turn and asks Claude to invoke /circuit:handoff save when work is
#   unsaved). SessionEnd's job is to mark the boundary and surface drift, not
#   to author content.
#
# Behavior:
#   - Drains stdin (Claude Code may pipe a payload).
#   - Resolves project root via $CLAUDE_PROJECT_DIR with BASH_SOURCE fallback.
#   - Bails silently if .circuit/bin/circuit-engine is not present.
#   - Calls `circuit-engine continuity status` and emits one summary line to
#     stderr describing whether a pending record exists and whether HEAD has
#     drifted past the saved base_commit.
#   - Never fails closed.

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
RECORD_ID="$(printf '%s' "$STATUS_JSON" | jq -r '.record.record_id // ""' 2>/dev/null)"
SAVED_HEAD="$(printf '%s' "$STATUS_JSON" | jq -r '.record.git.base_commit // ""' 2>/dev/null)"
CURRENT_HEAD="$(git rev-parse HEAD 2>/dev/null || true)"

case "$SELECTION" in
  pending_record)
    SHORT_RECORD="${RECORD_ID:0:24}"
    SHORT_SAVED="${SAVED_HEAD:0:8}"
    SHORT_HEAD="${CURRENT_HEAD:0:8}"
    if [ -n "$CURRENT_HEAD" ] && [ -n "$SAVED_HEAD" ] && [ "$CURRENT_HEAD" != "$SAVED_HEAD" ]; then
      printf 'circuit-next session ended: pending continuity %s; HEAD %s drifted past saved base_commit %s — operator should review before next resume\n' \
        "$SHORT_RECORD" "$SHORT_HEAD" "$SHORT_SAVED" >&2
    else
      printf 'circuit-next session ended: pending continuity %s synced to HEAD %s\n' \
        "$SHORT_RECORD" "$SHORT_HEAD" >&2
    fi
    ;;

  current_run)
    printf 'circuit-next session ended: current_run attached without pending continuity record\n' >&2
    ;;

  *)
    if [ -n "$CURRENT_HEAD" ]; then
      printf 'circuit-next session ended: no continuity record (HEAD %s)\n' "${CURRENT_HEAD:0:8}" >&2
    else
      printf 'circuit-next session ended: no continuity record\n' >&2
    fi
    ;;
esac

exit 0
