# Claude Log Central

全クライアントのClaude Code行動ログを中央集約して監視・分析するシステム。

## Architecture

```
Client A (Claude Code CLI)  ──┐
Client B (Claude Code CLI)  ──┤── ANTHROPIC_BASE_URL ──> [FastAPI Proxy] ──> Anthropic API
Client C (Claude Code CLI)  ──┘         │
                                        ▼
                                   [PostgreSQL]
                                        │
                                        ▼
                              [Next.js Dashboard] ← Taka's browser
                                        │
                              [Analyze API] ← Taka's Claude Code
```

## Quick Start (Local)

```bash
# 1. Start all services
docker compose up -d

# 2. Access dashboard
open http://localhost:3100
# API Key: clc_admin_key_change_me

# 3. Backend API docs
open http://localhost:8100/docs
```

## Client Setup (1 line)

Each client just needs to set their `ANTHROPIC_BASE_URL` and add identification headers.

### Option A: Environment variable

```bash
# In client's .env or shell profile
export ANTHROPIC_BASE_URL=http://YOUR_SERVER:8100
export ANTHROPIC_EXTRA_HEADERS='{"x-client-id": "client-a", "x-session-id": "session-001"}'
```

### Option B: Claude Code settings (~/.claude/settings.json)

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://YOUR_SERVER:8100",
    "ANTHROPIC_EXTRA_HEADERS": "{\"x-client-id\": \"client-a\"}"
  }
}
```

## Taka's Claude Code Analysis Tool

Add this MCP tool or call the API directly:

```bash
# Search logs
curl -H "Authorization: Bearer clc_admin_key_change_me" \
  "http://localhost:8100/api/logs?client_id=client-a"

# Analyze issues
curl -X POST -H "Authorization: Bearer clc_admin_key_change_me" \
  -H "Content-Type: application/json" \
  "http://localhost:8100/api/analyze" \
  -d '{"client_id": "client-a", "query": "error"}'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | `claude_logs_secret_2026` | PostgreSQL password |
| `ADMIN_API_KEY` | `clc_admin_key_change_me` | Dashboard & API auth key |
| `ANTHROPIC_API_URL` | `https://api.anthropic.com` | Upstream Anthropic API |

## Security Notes

- Change `ADMIN_API_KEY` and `POSTGRES_PASSWORD` in production
- Use HTTPS (reverse proxy with nginx/Caddy) in production
- Client API keys are forwarded but never stored in logs
- Log retention: configurable, default 90 days
