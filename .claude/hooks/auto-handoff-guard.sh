#!/usr/bin/env bash
# Stop hook — auto-handoff guard for circuit-next.
#
# Installed via .claude/settings.json. Fires when Claude finishes a turn and,
# if substantive new work happened that the latest continuity record does
# not cover, emits a block-decision JSON on stdout telling Claude to save
# a continuity record before stopping. Otherwise exits silently.
#
# Goal: the operator should be able to /clear and say "resume" without
# having to remember to ask for a handoff first.
#
# Authority on "what continuity state is current" is
# .circuit/control-plane/continuity-index.json (the engine's source of
# truth), not ls -t over the records/ directory. Records are deleted on
# continuity clear so ls -t alone would return empty and miss the
# "cleared-then-continuing" case. The 2026-04-21 fix reads the index
# first and only falls back to ls -t for historical context.
#
# Guard conditions (at least one must hold to block):
#   1a. No continuity record exists yet (fresh project, HEAD or dirty tree
#       present).
#   1b. Index shows pending_record=null but HEAD exists and historical
#       records were seen — continuity was cleared and work continues
#       (the "clear-then-continue" gap).
#   2.  Indexed pending_record points to a record whose base_commit differs
#       from current HEAD (HEAD advanced past the saved snapshot).
#   3.  Indexed pending_record exists, HEAD matches, but uncommitted work
#       is present AND the record file is older than 120s (stale).
#
# If none of those hold, Claude has either already saved in this turn or
# done nothing worth persisting; the hook stays silent.

set -uo pipefail

PROJECT_ROOT="/Users/petepetrash/Code/circuit-next"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

# Drain stdin so the hook doesn't leave a broken pipe behind. We don't need
# session_id / tool_response payloads for this check.
cat >/dev/null 2>&1 || true

# Don't prompt on repos that don't have the circuit-next control plane.
if [ ! -x ".circuit/bin/circuit-engine" ]; then
  exit 0
fi

CURRENT_HEAD="$(git rev-parse HEAD 2>/dev/null || true)"
DIRTY="$(git status --porcelain 2>/dev/null | head -1 || true)"

# Prefer the engine-owned continuity-index.json. Fall back to ls -t only
# if the index is unreadable or its pending pointer doesn't resolve to
# an existing file on disk.
INDEX_FILE=".circuit/control-plane/continuity-index.json"
PENDING_INDEXED="no"
LATEST_RECORD=""
if [ -f "$INDEX_FILE" ]; then
  PENDING_PATH="$(jq -r '.pending_record.payload_rel // ""' "$INDEX_FILE" 2>/dev/null || echo "")"
  if [ -n "$PENDING_PATH" ] && [ -f "$PENDING_PATH" ]; then
    LATEST_RECORD="$PENDING_PATH"
    PENDING_INDEXED="yes"
  fi
fi

NEEDS_HANDOFF=false
REASON_DETAIL=""

if [ "$PENDING_INDEXED" = "no" ]; then
  # Index says no pending record. Either (a) continuity was cleared after
  # work landed, or (b) this project has never saved a record.
  if [ -n "$CURRENT_HEAD" ] || [ -n "$DIRTY" ]; then
    NEEDS_HANDOFF=true
    # Distinguish the two cases for a more actionable reason.
    ANY_RECORD="$(ls -t .circuit/control-plane/continuity-records/continuity-*.json 2>/dev/null | head -1 || true)"
    if [ -n "${ANY_RECORD:-}" ]; then
      REASON_DETAIL="continuity-index pending_record is null (cleared) but HEAD or working tree has changes — save a fresh record before stopping"
    else
      REASON_DETAIL="no continuity record exists yet for this project"
    fi
  fi
else
  LAST_SAVED_HEAD="$(jq -r '.git.base_commit // ""' "$LATEST_RECORD" 2>/dev/null || true)"

  if stat -f %m "$LATEST_RECORD" >/dev/null 2>&1; then
    RECORD_MTIME="$(stat -f %m "$LATEST_RECORD")"
  else
    RECORD_MTIME="$(stat -c %Y "$LATEST_RECORD" 2>/dev/null || echo 0)"
  fi
  NOW="$(date +%s)"
  AGE=$((NOW - RECORD_MTIME))

  if [ -n "$CURRENT_HEAD" ] && [ -n "$LAST_SAVED_HEAD" ] && [ "$CURRENT_HEAD" != "$LAST_SAVED_HEAD" ]; then
    NEEDS_HANDOFF=true
    SHORT_HEAD="${CURRENT_HEAD:0:8}"
    SHORT_SAVED="${LAST_SAVED_HEAD:0:8}"
    REASON_DETAIL="HEAD ($SHORT_HEAD) has advanced past the latest continuity record's base_commit ($SHORT_SAVED)"
  elif [ -n "$DIRTY" ] && [ "$AGE" -gt 120 ]; then
    NEEDS_HANDOFF=true
    REASON_DETAIL="uncommitted work is present and the latest continuity record is ${AGE}s old (stale)"
  fi
fi

if [ "$NEEDS_HANDOFF" = "true" ]; then
  REASON="Auto-continuity guard: ${REASON_DETAIL}. Before this turn ends, run \`.circuit/bin/circuit-engine continuity save\` with --goal, --next, --state-markdown, and --debt-markdown to persist a continuity record capturing this chunk of work so the next thread can resume cleanly with \`.circuit/bin/circuit-engine continuity resume\`. If the engine says the plugin root is not initialized, invoke any available \`/circuit:*\` command once in this project, then retry the engine command. If there is genuinely no work worth persisting, say so in one short sentence and return control; otherwise save before stopping."
  jq -nc --arg r "$REASON" '{decision:"block", reason:$r}'
fi

exit 0
