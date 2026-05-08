"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLogs, type LogEntry } from "@/lib/api";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

function LogDetailDialog({
  log,
  open,
  onClose,
}: {
  log: LogEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            ログ詳細 - {log.request_id.slice(0, 8)}...
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">クライアント:</span> {log.client_id}
            </div>
            <div>
              <span className="font-medium">モデル:</span> {log.model || "N/A"}
            </div>
            <div>
              <span className="font-medium">ステータス:</span>{" "}
              <Badge
                variant={log.status_code >= 400 ? "destructive" : "secondary"}
              >
                {log.status_code}
              </Badge>
            </div>
            <div>
              <span className="font-medium">レイテンシ:</span>{" "}
              {log.latency_ms}ms
            </div>
            <div>
              <span className="font-medium">トークン:</span>{" "}
              入力 {log.tokens_input} / 出力 {log.tokens_output}
            </div>
            <div>
              <span className="font-medium">コスト:</span> $
              {log.cost_usd.toFixed(4)}
            </div>
          </div>

          {log.system_prompt && (
            <div>
              <h4 className="font-medium mb-1">システムプロンプト</h4>
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs max-h-40 overflow-y-auto">
                {log.system_prompt}
              </pre>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-1">プロンプト（メッセージ履歴）</h4>
            <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs max-h-60 overflow-y-auto">
              {JSON.stringify(log.prompt, null, 2)}
            </pre>
          </div>

          <div>
            <h4 className="font-medium mb-1">レスポンス</h4>
            <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs max-h-60 overflow-y-auto">
              {JSON.stringify(log.response, null, 2)}
            </pre>
          </div>

          {log.tool_calls.length > 0 && (
            <div>
              <h4 className="font-medium mb-1">
                ツール呼び出し（{log.tool_calls.length}件）
              </h4>
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs max-h-40 overflow-y-auto">
                {JSON.stringify(log.tool_calls, null, 2)}
              </pre>
            </div>
          )}

          {log.git_operations.length > 0 && (
            <div>
              <h4 className="font-medium mb-1">
                Git操作（{log.git_operations.length}件）
              </h4>
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs max-h-40 overflow-y-auto">
                {JSON.stringify(log.git_operations, null, 2)}
              </pre>
            </div>
          )}

          {log.error != null && (
            <div>
              <h4 className="font-medium mb-1 text-destructive">エラー</h4>
              <pre className="bg-destructive/10 p-3 rounded-md overflow-x-auto text-xs">
                {JSON.stringify(log.error, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LogsView() {
  const [clientFilter, setClientFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["logs", clientFilter, page],
    queryFn: () =>
      getLogs({
        client_id: clientFilter || undefined,
        page,
        page_size: 50,
      }),
  });

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ログ</h2>
        <p className="text-muted-foreground">
          全クライアントのClaude Code APIリクエスト履歴
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="クライアントIDで絞り込み..."
          value={clientFilter}
          onChange={(e) => {
            setClientFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              読み込み中...
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              ログが見つかりません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>クライアント</TableHead>
                  <TableHead>モデル</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>レイテンシ</TableHead>
                  <TableHead>トークン</TableHead>
                  <TableHead>ツール</TableHead>
                  <TableHead>コスト</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.client_id}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.model?.replace("claude-", "") || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status_code >= 400 ? "destructive" : "secondary"
                        }
                      >
                        {log.status_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.latency_ms ? `${log.latency_ms}ms` : "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.tokens_input}/{log.tokens_output}
                    </TableCell>
                    <TableCell>
                      {log.tool_calls.length > 0 && (
                        <Badge variant="outline">
                          {log.tool_calls.length} 件
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      ${log.cost_usd.toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages} ページ（全 {data?.total} 件）
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <LogDetailDialog
        log={selectedLog}
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}
