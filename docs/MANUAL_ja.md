# Claude Log Central — 操作マニュアル

最後の更新: 2026-05-09

複数クライアントのClaude Codeを中央から監視・操作するための運用ガイド。

---

## 1. このシステムは何ができるか

| 機能 | 説明 |
|---|---|
| 📊 ログ監視 | 全クライアントのClaude Codeリクエスト・レスポンス・ツール呼び出しを記録 |
| 🎯 遠隔指示 | 任意のクライアントに対して、次のClaude Code発言にバンドルする `<system-reminder>` 形式の指示を投入 |
| 📨 Telegram通知 | 指示が投稿された瞬間にTelegramへ自動通知（オフライン端末向け） |
| 🪪 ID管理 | client_id にcompany / person_name / device / メモ / 識別カラーを紐づけ |
| 🧠 ケイパビリティ可視化 | 各クライアントが持つツール / MCPサーバー / スキル / モデル使用履歴を表示 |
| ⚡ ID変更 | 既存IDを別のIDに一括リネーム（4テーブル横断更新） |
| 🪝 SessionStart hook | クライアント起動時にCentralをポーリングして指示を即受信 |

---

## 2. 各役割の人がやること

### 2-A. **オペレーター**（たかあきさん）

#### a. ダッシュボードへのログイン

1. <https://claude-log-central.vercel.app/> を開く
2. 管理者APIキーを入力（`clc_admin_elefant_2026_Qp7xWm`）
3. ダッシュボードに全クライアントが並ぶ

#### b. 新しいクライアントを追加

1. ダッシュボード右上「**＋ クライアントを追加**」
2. クライアントID（例: `acme-mac-tanaka`）を入力
3. 表示されたコマンドをコピー → クライアントに渡す
4. クライアントが1度Claude Codeを動かすとダッシュボードに自動で行が出現

#### c. 各クライアントの情報を整える

- 鉛筆🖉アイコン → 「クライアント情報の編集」
- 会社名・担当者名・デバイス・メモ・識別カラー・Telegram chat_id を保存
- 「クライアントIDを変更」も同じダイアログから

#### d. 指示を送る

- 左サイドバー「**指示出し**」
- 送信先 / 指示内容 / 優先度 を入力 → 「キューに追加」
- 配信状況を「キュー & 履歴」で確認（5秒ごと自動更新）

#### e. クライアントの能力を確認

- ダッシュボード行の Cpu🧠アイコン → ケイパビリティ表示
- 使用可能ツール、MCPサーバー、スキル、利用頻度ランキングが見える
- 「相手が持ってないツールを指示しても無理」を事前に防げる

### 2-B. **クライアント**（指示を受ける側）

#### a. 接続

オペレーターから渡されたコマンドを実行するだけ。要点だけ抜粋：

```bash
mkdir -p ~/.claude
cat > ~/.claude/settings.json <<'JSON'
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://backend-production-22667.up.railway.app",
    "ANTHROPIC_EXTRA_HEADERS": "{\"x-client-id\": \"acme-mac-tanaka\"}"
  }
}
JSON
claude  # 通常通り起動
```

これ以降、Claude Code のリクエストが Central を経由する。動作はそのまま、追加の操作不要。

#### b. （任意・推奨）SessionStart hook 設置

オフライン中に投稿された指示を、起動時に確実に受け取れるようにする。`docs/CLIENT_SETUP_ja.md` 参照。

---

## 3. 配信経路の仕組み（3系統）

```
[オペレーター]
   │ 指示投稿
   ▼
[Central API]
   ├─① 即Telegram通知（chat_id設定済みなら）
   ├─② 次回プロキシ通過時に <system-reminder> 注入
   └─③ SessionStart hook が起動時にポーリング → additionalContext
                  ▼
            [クライアントのClaude Code]
```

3つは独立に走る。どれか1つでも届けば指示は到達する。

### 重要な振る舞い

- **Haikuには注入しない**: Claude Codeの内部分類タスクで指示を浪費しないため
- **2xx応答時のみ delivered**: 4xx/5xxなら pending のまま再注入候補
- **同じ指示は1回だけ届く**: 注入後は status=delivered

---

## 4. ありがちな質問・困りごと

### Q. 指示出したのにTelegramに来ない
A. 対象クライアントのプロフィールに `telegram_chat_id` が設定されているか確認。設定済みでも来ないなら、Railwayの `TELEGRAM_BOT_TOKEN` 環境変数が正しく設定されているか確認。

### Q. 「配信済み」になったのにクライアントが反応しない
A. 大体これは「対象のClaudeに指示を実行するtoolが無い」問題。ケイパビリティ画面で必要toolが入っているか確認。たとえば「Slack送って」と指示するなら Slack MCP か curl で叩ける Webhookが必要。

### Q. クライアントがずっと401エラーで応答しない
A. クライアント側のAnthropic認証（API key or OAuth token）が無効。クライアントに `claude /login` か API key 再設定をしてもらう。Centralはここに介入しない。

### Q. unknown のままダッシュボードに出る
A. `ANTHROPIC_EXTRA_HEADERS` に `x-client-id` が無い。設定ファイルを再確認。修正後は「ID変更」機能で過去ログをまとめてリネーム可。

### Q. クライアント側で余計に何かインストールが要る？
A. 必須なものはゼロ。`~/.claude/settings.json` 編集だけ。SessionStart hookを使う場合は `bash`, `curl`, `jq` が必要（macOSは `brew install jq`）。

---

## 5. 安全運用の心得

- **顧客の同意必須**: クライアント側のClaude Code会話ログ（プロンプト・コード断片含む）が全部Centralに集まる。**書面同意なしの導入は絶対NG**。
- **管理者APIキーの保管**: ダッシュボード認証兼API認証。漏れると全クライアントの操作・閲覧が可能になるので扱い厳重。
- **SessionStart hookは社内デバイスのみ**: hookは管理者APIキーをクライアント機に置く必要があるため、信頼できる端末以外には設置しない。

---

## 6. URL一覧

- ダッシュボード: <https://claude-log-central.vercel.app/>
- バックエンドAPI: <https://backend-production-22667.up.railway.app/>
- API Docs: <https://backend-production-22667.up.railway.app/docs>
- GitHub: <https://github.com/elefant-coder/claude-log-central>
- Railway: <https://railway.com/project/f8f7d206-ce16-4233-8a1a-5228894a1e2e>
- Vercel: claude-log-central プロジェクト

---

## 7. APIエンドポイント早見表

すべて `Authorization: Bearer <ADMIN_API_KEY>` が必要。

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/dashboard` | クライアント別サマリー |
| GET | `/api/logs` | ログ一覧（client_id, time_from等で絞り込み） |
| POST | `/api/search` | プロンプト・レスポンス・ツール内全文検索 |
| POST | `/api/analyze` | 簡易分析サマリー |
| GET | `/api/sessions` | セッション一覧 |
| GET | `/api/client-profiles` | プロフィール一覧 |
| PUT | `/api/client-profiles/{id}` | プロフィール作成/更新 |
| GET | `/api/clients/{id}/capabilities` | ケイパビリティスナップショット |
| POST | `/api/clients/{id}/rename` | client_id 変更 |
| GET | `/api/instructions` | 指示一覧 |
| POST | `/api/instructions` | 指示作成（chat_idあれば自動Telegram通知） |
| DELETE | `/api/instructions/{id}` | pending指示のキャンセル |
| POST | `/api/instructions/poll` | hook用：pending取得 + delivered化 |
| GET | `/api/telegram/status` | Bot設定状況 |
| POST | `/api/telegram/test` | テスト送信 |
