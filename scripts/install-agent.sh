#!/usr/bin/env bash
# Claude Log Central — Always-on agent installer (macOS LaunchAgent)
#
# DESCRIPTION
#   Installs clc-agent.sh as a per-user LaunchAgent so it starts at login,
#   restarts if it crashes, and polls Central every 15s for pending operator
#   instructions. When an instruction arrives, it runs `claude -p <text>`
#   in the background — your interactive Claude session is unaffected.
#
# WHAT IT DOES
#   1. Drops ~/.claude/clc-agent.sh
#   2. Generates ~/Library/LaunchAgents/com.clc.agent.plist with your env
#   3. (Re)loads the agent via launchctl
#
# WHAT IT DOES NOT DO
#   - Touch your shell rc files
#   - Modify your Claude Code settings.json
#   - Install any non-Apple binary (just bash + launchd)
#
# USAGE
#   curl -fsSL https://raw.githubusercontent.com/elefant-coder/claude-log-central/main/scripts/install-agent.sh \
#     | CLIENT_ID=acme-yamada-mac \
#       CLC_ADMIN_KEY=clc_admin_xxx \
#       bash
#
# UNINSTALL
#   launchctl unload ~/Library/LaunchAgents/com.clc.agent.plist
#   rm ~/Library/LaunchAgents/com.clc.agent.plist ~/.claude/clc-agent.sh
#
# REQUIREMENTS: macOS (LaunchAgent), bash, curl, jq, claude CLI

set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "❌ This installer targets macOS (uses launchd LaunchAgent)." >&2
  echo "   For Linux, run clc-agent.sh under systemd --user — see docs." >&2
  exit 1
fi

DEFAULT_BASE_URL="https://backend-production-22667.up.railway.app"
BASE_URL="${CLC_BASE_URL:-$DEFAULT_BASE_URL}"
CLIENT_ID="${CLIENT_ID:-${CLC_CLIENT_ID:-}}"
ADMIN_KEY="${CLC_ADMIN_KEY:-}"
INTERVAL="${CLC_POLL_INTERVAL:-15}"
GITHUB_RAW="https://raw.githubusercontent.com/elefant-coder/claude-log-central/main/scripts/clc-agent.sh"

# --- validate inputs ---
if [ -z "$CLIENT_ID" ]; then
  echo "❌ CLIENT_ID (or CLC_CLIENT_ID) is required." >&2
  exit 2
fi
if [ -z "$ADMIN_KEY" ]; then
  echo "❌ CLC_ADMIN_KEY is required (the operator's admin API key)." >&2
  exit 2
fi
if ! [[ "$CLIENT_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "❌ CLIENT_ID may only contain letters, digits, dot, hyphen, underscore." >&2
  exit 2
fi

# --- check dependencies ---
for cmd in jq curl claude; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ Missing dependency: $cmd" >&2
    if [ "$cmd" = "jq" ]; then echo "   Install with: brew install jq" >&2; fi
    if [ "$cmd" = "claude" ]; then echo "   Install Claude Code first: https://claude.com/code" >&2; fi
    exit 3
  fi
done

CLAUDE_PATH=$(command -v claude)

CLAUDE_DIR="$HOME/.claude"
AGENT_SCRIPT="$CLAUDE_DIR/clc-agent.sh"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/com.clc.agent.plist"
LABEL="com.clc.agent"
LOG_FILE="$CLAUDE_DIR/clc-agent.log"
OUT_FILE="$CLAUDE_DIR/clc-agent.out"
ERR_FILE="$CLAUDE_DIR/clc-agent.err"

mkdir -p "$CLAUDE_DIR" "$PLIST_DIR"

# --- step 1: fetch agent script ---
echo "==> Fetching agent script..."
if ! curl -fsSL "$GITHUB_RAW" -o "$AGENT_SCRIPT"; then
  echo "❌ Failed to download $GITHUB_RAW" >&2
  exit 4
fi
chmod +x "$AGENT_SCRIPT"
echo "    ✓ $AGENT_SCRIPT"

# --- step 2: write plist ---
echo "==> Writing LaunchAgent plist..."
# Escape XML-special chars in admin key (rare but possible)
xml_escape() {
  printf '%s' "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g'
}
ESC_BASE=$(xml_escape "$BASE_URL")
ESC_KEY=$(xml_escape "$ADMIN_KEY")
ESC_CID=$(xml_escape "$CLIENT_ID")

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$AGENT_SCRIPT</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CLC_BASE_URL</key>
    <string>$ESC_BASE</string>
    <key>CLC_ADMIN_KEY</key>
    <string>$ESC_KEY</string>
    <key>CLC_CLIENT_ID</key>
    <string>$ESC_CID</string>
    <key>CLC_POLL_INTERVAL</key>
    <string>$INTERVAL</string>
    <key>CLC_CLAUDE_BIN</key>
    <string>$CLAUDE_PATH</string>
    <key>CLC_LOG_FILE</key>
    <string>$LOG_FILE</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$OUT_FILE</string>
  <key>StandardErrorPath</key>
  <string>$ERR_FILE</string>
</dict>
</plist>
PLIST
echo "    ✓ $PLIST_PATH"

# --- step 3: (re)load via launchctl ---
echo "==> (Re)loading LaunchAgent..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"
echo "    ✓ loaded"

# --- step 4: verify it's running ---
sleep 2
if launchctl list | grep -q "$LABEL"; then
  echo
  echo "✅ clc-agent installed and running."
  echo
  echo "    client_id : $CLIENT_ID"
  echo "    base url  : $BASE_URL"
  echo "    interval  : ${INTERVAL}s"
  echo "    log       : $LOG_FILE"
  echo
  echo "Inspect activity:"
  echo "    tail -f $LOG_FILE"
  echo
  echo "Stop / uninstall:"
  echo "    launchctl unload $PLIST_PATH"
  echo "    rm $PLIST_PATH $AGENT_SCRIPT"
else
  echo "⚠️  Plist loaded but agent not found in launchctl list. Check $ERR_FILE for details." >&2
  exit 5
fi
