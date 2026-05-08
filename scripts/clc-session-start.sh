#!/usr/bin/env bash
# Claude Log Central — SessionStart hook for Claude Code
#
# Pulls any pending operator instructions for this client from Central
# and surfaces them as additionalContext at the start of every Claude Code
# session. Works even if the device just powered on — the operator can
# queue an instruction in the Central UI any time, and it lands in the
# next session this hook runs.
#
# INSTALLATION (on the receiving Mac):
#   1. Copy this script to ~/.claude/clc-session-start.sh
#   2. chmod +x ~/.claude/clc-session-start.sh
#   3. Set env vars (e.g. in ~/.zshenv or a wrapper):
#        export CLC_BASE_URL="https://backend-production-22667.up.railway.app"
#        export CLC_ADMIN_KEY="clc_admin_..."
#        export CLC_CLIENT_ID="elefant-mac-mini"   # must match X-Client-ID
#   4. Wire it into ~/.claude/settings.json under SessionStart:
#        {
#          "hooks": {
#            "SessionStart": [
#              { "hooks": [ { "type": "command", "command": "$HOME/.claude/clc-session-start.sh" } ] }
#            ]
#          }
#        }
#
# DEPENDENCIES: bash, curl, jq

set -uo pipefail

# Read & ignore the hook input JSON (we don't need anything from it)
cat >/dev/null

: "${CLC_BASE_URL:=}"
: "${CLC_ADMIN_KEY:=}"
: "${CLC_CLIENT_ID:=}"
TIMEOUT="${CLC_HTTP_TIMEOUT:-5}"

# Bail quietly if not configured — never break a Claude Code session
if [ -z "$CLC_BASE_URL" ] || [ -z "$CLC_ADMIN_KEY" ] || [ -z "$CLC_CLIENT_ID" ]; then
  exit 0
fi
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

URL="${CLC_BASE_URL%/}/api/instructions/poll?client_id=${CLC_CLIENT_ID}&mark_delivered=true"

RESP=$(curl -sS --max-time "$TIMEOUT" \
  -H "Authorization: Bearer $CLC_ADMIN_KEY" \
  -X POST "$URL" 2>/dev/null) || exit 0

# No instructions? exit silent.
COUNT=$(echo "$RESP" | jq -r '.total // 0' 2>/dev/null)
if [ -z "$COUNT" ] || [ "$COUNT" = "0" ] || [ "$COUNT" = "null" ]; then
  exit 0
fi

# Build a system-reminder-style block listing the operator instructions.
# Claude Code injects `additionalContext` into the next model turn.
CONTEXT=$(echo "$RESP" | jq -r '
  "[Operator broadcast from Claude Log Central]\n" +
  "The human operator running Claude Log Central has queued the following " +
  "instruction(s) for this Claude Code session. Treat them as if the user " +
  "had just typed them — they take priority over any prior plan, and you " +
  "should acknowledge them in your next response.\n\n" +
  ([.instructions[] | "--- Instruction (id=\(.id), priority=\(.priority))" + (if .session_id then " session=\(.session_id)" else "" end) + " ---\n\(.instruction)\n"] | join("\n")) +
  "\n— End of Claude Log Central broadcast —"
')

# Emit the JSON Claude Code expects from a SessionStart hook
jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  },
  systemMessage: "📨 Claude Log Central から指示を受信しました"
}'
