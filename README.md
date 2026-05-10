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

## Operator Instructions (送信→配信)

クライアントのClaude Codeへ遠隔で指示を送信できます。

### 配信経路（2系統 + 通知1系統）

1. **プロキシ注入**: 対象クライアントが次にプロキシ経由でAnthropic APIを叩いた瞬間、最新のuserメッセージに `<system-reminder>` として自動挿入されます。Haikuや内部呼び出しは除外。
2. **SessionStart hook**: クライアントの `~/.claude/settings.json` に `scripts/clc-session-start.sh` を仕込むと、Claude Codeが新セッションを開始した瞬間にCentral APIをポーリングして pending 指示を `additionalContext` として注入。プロキシを通らないコマンドや起動直後でも届く。
3. **Telegram通知**: クライアントプロフィールに `telegram_chat_id` を設定すると、指示作成時に自動でTelegramへ通知を送信。デバイスがオフラインでも届く。

### Telegram Bot のセットアップ

1. Telegramで `@BotFather` を開く
2. `/newbot` → ボット名・ユーザー名を決めて作成、トークン（`123456789:AAExxx...` 形式）を控える
3. 通知を受け取りたいチャット（自分宛DMでもグループでもOK）でボットに何か発言する
4. `https://api.telegram.org/bot<TOKEN>/getUpdates` をブラウザで開いて、`message.chat.id` を控える
5. **Railway**: `Variables` に `TELEGRAM_BOT_TOKEN=<TOKEN>` を追加 → 再デプロイ
6. **Central UI**: ダッシュボード → 対象クライアント行の編集 → Telegramセクションに `chat_id` を入力 → 「テスト送信」で疎通確認

### 常駐エージェント設置（PC開いてれば常時届く・最推奨）

LaunchAgentとして常駐。Claude Code 起動状態を問わず、PCがログイン済みであれば15秒以内に届く。

```bash
curl -fsSL https://raw.githubusercontent.com/elefant-coder/claude-log-central/main/scripts/install-agent.sh \
  | CLIENT_ID="elefant-mac-mini" CLC_ADMIN_KEY="<管理者APIキー>" bash
```

挙動: 15秒ごとに `/api/instructions/poll` を叩き、pending があれば `claude -p "<指示文>"` を headless で実行。  
ログ: `~/.claude/clc-agent.log`  
解除: `launchctl unload ~/Library/LaunchAgents/com.clc.agent.plist`

---

### SessionStart hook 設置（軽量版・常駐エージェントを置きたくない場合）

```bash
# 1. ホストにスクリプト配置
curl -fsSL https://raw.githubusercontent.com/elefant-coder/claude-log-central/main/scripts/clc-session-start.sh \
  -o ~/.claude/clc-session-start.sh
chmod +x ~/.claude/clc-session-start.sh

# 2. 環境変数を ~/.zshenv に追加
cat >> ~/.zshenv <<'EOF'
export CLC_BASE_URL="https://backend-production-22667.up.railway.app"
export CLC_ADMIN_KEY="clc_admin_..."
export CLC_CLIENT_ID="elefant-mac-mini"
EOF

# 3. ~/.claude/settings.json に hook 設定を追加
#    （既存hooksとマージしてください）
```

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "$HOME/.claude/clc-session-start.sh" }
        ]
      }
    ]
  }
}
```

これで:
- Mac miniでClaude Codeを起動するたびに pending 指示を自動取得
- プロキシを通らないclaude起動直後でも届く
- 取得済みは自動で `delivered` になりキューから消える

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | `claude_logs_secret_2026` | PostgreSQL password |
| `ADMIN_API_KEY` | `clc_admin_key_change_me` | Dashboard & API auth key |
| `ANTHROPIC_API_URL` | `https://api.anthropic.com` | Upstream Anthropic API |
| `TELEGRAM_BOT_TOKEN` | (空) | Telegram Bot のトークン。設定すると指示作成時に自動通知が有効化 |

## Security Notes

- Change `ADMIN_API_KEY` and `POSTGRES_PASSWORD` in production
- Use HTTPS (reverse proxy with nginx/Caddy) in production
- Client API keys are forwarded but never stored in logs
- Log retention: configurable, default 90 days
