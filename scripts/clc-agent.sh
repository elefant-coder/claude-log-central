#!/usr/bin/env bash
# Claude Log Central — Always-on instruction agent
#
# Polls Central every $CLC_POLL_INTERVAL seconds for pending operator
# instructions targeted at this client_id. When an instruction is found,
# spawns a headless `claude -p "<instruction>"` so it runs in a fresh
# session with full access to the user's MCP servers, tools, and hooks.
#
# Designed to run as a launchd LaunchAgent, started at user login and
# auto-restarted on crash. See install-agent.sh.
#
# REQUIRED ENV
#   CLC_BASE_URL      Central backend URL
#   CLC_ADMIN_KEY     Admin API key for Central
#   CLC_CLIENT_ID     This client's identifier (must match the operator's UI)
#
# OPTIONAL ENV
#   CLC_POLL_INTERVAL Seconds between polls. Default: 15
#   CLC_LOG_FILE      Path to log file. Default: ~/.claude/clc-agent.log
#   CLC_CLAUDE_BIN    Path to claude CLI. Default: claude (relies on PATH)

set -uo pipefail

: "${CLC_BASE_URL:?CLC_BASE_URL must be set}"
: "${CLC_ADMIN_KEY:?CLC_ADMIN_KEY must be set}"
: "${CLC_CLIENT_ID:?CLC_CLIENT_ID must be set}"

INTERVAL="${CLC_POLL_INTERVAL:-15}"
LOG="${CLC_LOG_FILE:-$HOME/.claude/clc-agent.log}"
CLAUDE_BIN="${CLC_CLAUDE_BIN:-claude}"

mkdir -p "$(dirname "$LOG")"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"
}

# Sanity-check dependencies up front
for cmd in jq curl "$CLAUDE_BIN"; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "FATAL: required command not found: $cmd"
    exit 78
  fi
done

log "Started clc-agent  client_id=$CLC_CLIENT_ID  interval=${INTERVAL}s  base=$CLC_BASE_URL"

trap 'log "Stopping (SIGTERM)"; exit 0' TERM
trap 'log "Stopping (SIGINT)";  exit 0' INT

while true; do
  # Pull pending instructions for this client (atomic mark_delivered=true)
  RESP=$(curl -sS --max-time 10 \
    -H "Authorization: Bearer $CLC_ADMIN_KEY" \
    -X POST "$CLC_BASE_URL/api/instructions/poll?client_id=$CLC_CLIENT_ID&mark_delivered=true" 2>/dev/null) || {
    log "poll: network error"
    sleep "$INTERVAL"
    continue
  }

  if ! COUNT=$(echo "$RESP" | jq -r '.total // 0' 2>/dev/null); then
    log "poll: malformed response: $(echo "$RESP" | head -c 200)"
    sleep "$INTERVAL"
    continue
  fi

  if [ "$COUNT" -gt 0 ] 2>/dev/null; then
    log "poll: $COUNT pending instruction(s) — executing serially"

    # Process serially, one instruction per claude -p run.
    # Use process-substitution to avoid the subshell-loses-state pitfall of `| while`.
    while IFS= read -r inst; do
      ID=$(printf '%s' "$inst" | jq -r '.id')
      TEXT=$(printf '%s' "$inst" | jq -r '.instruction')
      PRIO=$(printf '%s' "$inst" | jq -r '.priority // 0')

      log "EXEC id=$ID prio=$PRIO text=${TEXT:0:120}"

      # Run claude headless. --print forces non-interactive output.
      # Stream stderr to log too. Cap captured output so a runaway response
      # doesn't blow up the log.
      OUT=$("$CLAUDE_BIN" --print "$TEXT" 2>&1 || echo "[claude exited non-zero: $?]")
      OUT_HEAD=$(printf '%s' "$OUT" | head -c 2000)
      log "DONE id=$ID  output_head=${OUT_HEAD:0:600}"
    done < <(echo "$RESP" | jq -c '.instructions[]')
  fi

  sleep "$INTERVAL"
done
