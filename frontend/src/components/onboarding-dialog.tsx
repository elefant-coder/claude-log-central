"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Check, BookOpen } from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://backend-production-22667.up.railway.app";

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium">{label}</label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="h-6 text-xs gap-1"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> コピー済み
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> コピー
            </>
          )}
        </Button>
      </div>
      <pre className="bg-muted/50 rounded-md p-3 text-xs whitespace-pre-wrap break-all font-mono">
        {value}
      </pre>
    </div>
  );
}

export function OnboardingDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [clientId, setClientId] = useState("");

  const safeId = clientId.trim() || "<クライアントID>";
  const settingsJson = `{
  "env": {
    "ANTHROPIC_BASE_URL": "${BACKEND_URL}",
    "ANTHROPIC_EXTRA_HEADERS": "{\\"x-client-id\\": \\"${safeId}\\"}"
  }
}`;

  const shellSnippet = `# 1. ~/.claude/settings.json を作成（既存なら env 部分をマージ）
mkdir -p ~/.claude
cat > ~/.claude/settings.json <<'JSON'
${settingsJson}
JSON

# 2. claude を起動するだけ。これ以降のリクエストはCentralを経由してログされる
claude`;

  const hookSnippet = `# 起動時に未配信指示を取得するhook（オフラインでも届く根本対策）
curl -fsSL https://raw.githubusercontent.com/elefant-coder/claude-log-central/main/scripts/clc-session-start.sh \\
  -o ~/.claude/clc-session-start.sh
chmod +x ~/.claude/clc-session-start.sh

cat >> ~/.zshenv <<'ENV'
export CLC_BASE_URL="${BACKEND_URL}"
export CLC_ADMIN_KEY="<管理者APIキー>"
export CLC_CLIENT_ID="${safeId}"
ENV

# ~/.claude/settings.json に hooks を追加（既存とマージ）
# {
#   "hooks": {
#     "SessionStart": [
#       { "hooks": [ { "type": "command", "command": "$HOME/.claude/clc-session-start.sh" } ] }
#     ]
#   }
# }`;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> 新しいクライアントを接続
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-2">
              クライアントの Mac / Linux 機にClaude Code (CLI) があれば、以下の3ステップで接続できます。
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
              <li>クライアントIDを決める（例: <code className="bg-muted px-1 rounded">acme-mac-tanaka</code>）</li>
              <li>下のスニペットをコピー → 接続したい機で実行</li>
              <li>ダッシュボードに新しい行が出てくれば成功</li>
            </ol>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">クライアントID</label>
            <Input
              placeholder="例: acme-mac-tanaka"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              半角英数とハイフン・アンダースコアのみ。一意な文字列を推奨（会社+人+デバイスの組み合わせなど）。
            </p>
          </div>

          <CopyBox
            label="① 基本セットアップ（クライアント機で実行）"
            value={shellSnippet}
          />

          <CopyBox
            label="② settings.json の中身（手動編集する場合）"
            value={settingsJson}
          />

          <details className="rounded-md border p-3">
            <summary className="text-xs font-medium cursor-pointer">
              ③ オプション: SessionStart hook（オフライン時でも指示を確実に受け取る）
            </summary>
            <div className="mt-2">
              <CopyBox label="hookセットアップ" value={hookSnippet} />
              <p className="text-[10px] text-muted-foreground mt-2">
                ※ 管理者APIキーをクライアント機に置く必要があります。社内デバイスなどtrustedな機にのみ設定してください。
              </p>
            </div>
          </details>

          <div className="bg-muted/30 rounded-md p-3 text-xs space-y-1">
            <p className="font-medium">📋 接続後にやること</p>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li>クライアントが1回でもClaude Codeを動かせば、ダッシュボードに自動で行が増える</li>
              <li>新しい行の鉛筆アイコンから「会社名・担当者・デバイス・Telegram通知先」を設定</li>
              <li>「ケイパビリティ」ボタンで使用可能ツール/MCPを確認</li>
              <li>「指示出し」タブから遠隔で指示を送信</li>
            </ul>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
