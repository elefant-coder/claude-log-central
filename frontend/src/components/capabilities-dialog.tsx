"use client";

import { useQuery } from "@tanstack/react-query";
import { getClientCapabilities } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wrench,
  Boxes,
  Sparkles,
  Cpu,
  Activity,
  AlertTriangle,
} from "lucide-react";

const CATEGORY_LABEL_JA: Record<string, string> = {
  filesystem: "ファイル操作",
  shell: "シェル/Bash",
  search: "検索",
  web: "Web",
  agent: "エージェント/Task",
  notebook: "ノートブック",
  skill: "スキル",
  schedule: "スケジューラ",
  monitor: "モニター",
  mcp: "MCP",
  other: "その他",
  unknown: "不明",
};

export function CapabilitiesDialog({
  open,
  clientId,
  onClose,
}: {
  open: boolean;
  clientId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-capabilities", clientId, open],
    queryFn: () => getClientCapabilities(clientId, 100),
    enabled: open && !!clientId,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4" /> ケイパビリティ — {clientId}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-muted-foreground text-sm py-8 text-center">
            読み込み中...
          </div>
        ) : error ? (
          <div className="text-destructive text-sm py-8 text-center">
            読み込みに失敗しました
          </div>
        ) : !data ? null : data.sample_size === 0 ? (
          <div className="text-muted-foreground text-sm py-8 text-center flex flex-col items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <p>このクライアントの実リクエストデータがまだありません。</p>
            <p className="text-xs">
              Claude Codeを一度起動してプロキシ経由のリクエストが流れると、ケイパビリティが自動検出されます。
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground">
                    使用可能ツール
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-bold">
                  {data.available_tools.length}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground">
                    MCPサーバー
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-bold">
                  {Object.keys(data.mcp_servers).length}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground">
                    スキル
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-bold">
                  {data.skills.length}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground">
                    調査リクエスト
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-bold">
                  {data.sample_size}
                </CardContent>
              </Card>
            </div>

            {data.models_used.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cpu className="h-4 w-4" /> 使用モデル
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {data.models_used.map((m) => (
                    <Badge key={m.model} variant="outline">
                      {m.model.replace("claude-", "")}
                      <span className="ml-1.5 text-muted-foreground">
                        × {m.count}
                      </span>
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {Object.keys(data.available_tools_by_category).length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wrench className="h-4 w-4" /> 使用可能ツール
                  </CardTitle>
                  <CardDescription>
                    最新リクエストで宣言されていたtools配列より
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(data.available_tools_by_category)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([cat, names]) => (
                      <div key={cat}>
                        <div className="text-xs font-medium mb-1">
                          {CATEGORY_LABEL_JA[cat] ?? cat} ({names.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {names.map((n) => (
                            <Badge
                              key={n}
                              variant="secondary"
                              className="font-mono text-[10px]"
                            >
                              {n}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            ) : null}

            {Object.keys(data.mcp_servers).length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Boxes className="h-4 w-4" /> MCPサーバー
                  </CardTitle>
                  <CardDescription>
                    Claude Codeが接続している外部MCPサーバーとそのツール
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(data.mcp_servers)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([server, tools]) => (
                      <div key={server}>
                        <div className="text-xs font-medium mb-1 font-mono">
                          {server}{" "}
                          <span className="text-muted-foreground">
                            ({tools.length} tools)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {tools.slice(0, 30).map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              className="font-mono text-[10px]"
                            >
                              {t}
                            </Badge>
                          ))}
                          {tools.length > 30 ? (
                            <span className="text-[10px] text-muted-foreground">
                              +{tools.length - 30} more
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            ) : null}

            {data.skills.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> 使用可能スキル
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {data.skills.map((s) => (
                    <div key={s.name} className="text-xs">
                      <span className="font-mono font-medium">{s.name}</span>
                      <span className="text-muted-foreground ml-2">
                        — {s.description}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {data.tool_usage.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4" /> 直近の利用頻度
                  </CardTitle>
                  <CardDescription>
                    過去 {data.sample_size} リクエストで実際に呼ばれたツール
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {data.tool_usage.slice(0, 15).map((t) => {
                      const max = data.tool_usage[0]?.count || 1;
                      const w = Math.max(4, (t.count / max) * 100);
                      return (
                        <div key={t.name} className="text-xs">
                          <div className="flex justify-between mb-0.5">
                            <span className="font-mono">{t.name}</span>
                            <span className="text-muted-foreground">
                              {t.count}回
                            </span>
                          </div>
                          <div className="bg-muted rounded-full h-1 overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${w}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
