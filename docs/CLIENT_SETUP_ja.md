# Claude Code クライアント接続ガイド

オペレーターから「Claude Log Central」に接続するよう依頼された方向けのセットアップ手順。所要1〜3分。

## 必須セットアップ（1分）

ターミナルで以下を実行（`<クライアントID>` をオペレーターから渡された値に置換）：

```bash
mkdir -p ~/.claude
cat > ~/.claude/settings.json <<'JSON'
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://backend-production-22667.up.railway.app",
    "ANTHROPIC_EXTRA_HEADERS": "{\"x-client-id\": \"<クライアントID>\"}"
  }
}
JSON
```

これだけ。普段通り `claude` を起動すればOK。

> ℹ️ 既に `~/.claude/settings.json` がある場合は、`env` セクションだけ手動でマージしてください。

## 動作確認

ターミナルで Claude Code に何か話しかけて応答が返れば成功。オペレーター側のダッシュボードに自分のクライアントIDが行として現れる。

## SessionStart hook（推奨・任意）

オフライン中にオペレーターが投稿した指示を、Claude Code 起動時に必ず受け取れるようにする。

### 必要な前提
- bash, curl, jq （macOS: `brew install jq`）

### 設置手順

```bash
# 1. スクリプト取得
curl -fsSL https://raw.githubusercontent.com/elefant-coder/claude-log-central/main/scripts/clc-session-start.sh \
  -o ~/.claude/clc-session-start.sh
chmod +x ~/.claude/clc-session-start.sh

# 2. 環境変数を ~/.zshenv に追加（bash の場合は ~/.bash_profile）
cat >> ~/.zshenv <<'ENV'
export CLC_BASE_URL="https://backend-production-22667.up.railway.app"
export CLC_ADMIN_KEY="<管理者APIキー>"   # オペレーターから受け取る
export CLC_CLIENT_ID="<クライアントID>"
ENV

# 3. ~/.claude/settings.json の hooks に追記（既存とマージ）
```

settings.json 例（既存env設定があるならhooksだけ足す）：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://backend-production-22667.up.railway.app",
    "ANTHROPIC_EXTRA_HEADERS": "{\"x-client-id\": \"<クライアントID>\"}"
  },
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

## トラブルシューティング

### Q. Claude Codeが普段通り動くのか不安
A. 動きます。ANTHROPIC_BASE_URL の差し替えは Anthropic公式互換の中継で、API応答内容は無加工。レイテンシが少し（10-20ms）増える程度。

### Q. APIキーは安全？
A. クライアント側のAPIキー（あなたのClaude Pro/MaxのOAuthトークン or sk-ant- API key）は Central のサーバを通過しますが**ログには保存されません**。HTTPSで暗号化されて即座にAnthropicへ転送されます。

### Q. 何が記録される？
A. リクエスト本文（プロンプト・メッセージ履歴・ツール呼び出し・コード断片）、レスポンス、レイテンシ、トークン使用量、コスト。**機密データを扱う場合は事前にオペレーターと範囲をすり合わせ**を推奨。

### Q. 解除したい
A. `~/.claude/settings.json` の `env` セクションから `ANTHROPIC_BASE_URL` と `ANTHROPIC_EXTRA_HEADERS` を削除すれば即解除。Claude Code を再起動。

## オペレーターに伝えておくと便利な情報

- 自分のクライアントID
- 利用デバイス（Mac mini / MacBook Pro 等）
- Telegram chat_id（通知が欲しい場合）
- 営業時間 / オフタイム（指示が即実行されない可能性のある時間帯）
