"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelInstruction,
  createInstruction,
  getDashboard,
  listInstructions,
  type InstructionEntry,
} from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Clock, Send, XCircle, Ban } from "lucide-react";

const STATUS_FILTERS = ["all", "pending", "delivered", "cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_LABEL_JA: Record<StatusFilter, string> = {
  all: "すべて",
  pending: "待機中",
  delivered: "配信済み",
  cancelled: "キャンセル",
};

function StatusBadge({ status }: { status: InstructionEntry["status"] }) {
  if (status === "pending") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" /> 待機中
      </Badge>
    );
  }
  if (status === "delivered") {
    return (
      <Badge className="gap-1 bg-green-600 hover:bg-green-600/90">
        <CheckCircle2 className="h-3 w-3" /> 配信済み
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <XCircle className="h-3 w-3" /> キャンセル
    </Badge>
  );
}

export function InstructionsView() {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [instructionText, setInstructionText] = useState<string>("");
  const [priority, setPriority] = useState<number>(0);
  const [filterClient, setFilterClient] = useState<string>("__all__");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    staleTime: 30_000,
  });

  const knownClients = useMemo(
    () => dashboard?.clients.map((c) => c.client_id) ?? [],
    [dashboard],
  );

  const { data: instructionsData, isLoading } = useQuery({
    queryKey: ["instructions", filterClient, filterStatus],
    queryFn: () =>
      listInstructions({
        client_id: filterClient !== "__all__" ? filterClient : undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
        page_size: 100,
      }),
    refetchInterval: 5000,
  });

  const createMut = useMutation({
    mutationFn: createInstruction,
    onSuccess: () => {
      setInstructionText("");
      setSessionId("");
      qc.invalidateQueries({ queryKey: ["instructions"] });
    },
  });

  const cancelMut = useMutation({
    mutationFn: cancelInstruction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instructions"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !instructionText.trim()) return;
    createMut.mutate({
      client_id: clientId.trim(),
      instruction: instructionText.trim(),
      session_id: sessionId.trim() || undefined,
      priority,
    });
  };

  const instructions = instructionsData?.instructions ?? [];
  const pendingCount = instructions.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">指示出し</h2>
        <p className="text-muted-foreground">
          リモートのClaude Codeに指示を届けます。送信した内容は、対象クライアントが次にこのプロキシ経由でAnthropic APIを叩いた瞬間にシステムリマインダーとして自動で挿入されます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> 新しい指示を送る
          </CardTitle>
          <CardDescription>
            クライアントIDで送信先を指定します。セッションIDを空にすると、そのクライアントの全セッションに届きます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">クライアントID *</label>
                {knownClients.length > 0 ? (
                  <Select
                    value={clientId}
                    onValueChange={(v) => setClientId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="既存のクライアントから選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {knownClients.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  placeholder="例: acme-corp"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  セッションID（任意）
                </label>
                <Input
                  placeholder="空欄なら全セッション対象"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">優先度</label>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">指示内容 *</label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="例: app/foo.tsx の handleSubmit にバリデーションが抜けているので追加して、テストもお願い。"
                value={instructionText}
                onChange={(e) => setInstructionText(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                上の内容は {"<system-reminder>"} ブロックに包まれて、次回のユーザーメッセージに添付されます。
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {createMut.isError
                  ? `エラー: ${(createMut.error as Error).message}`
                  : createMut.isSuccess
                    ? "キューに追加しました。"
                    : ""}
              </p>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? "送信中..." : "キューに追加"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>キュー & 履歴</CardTitle>
            <CardDescription>
              待機中 {pendingCount} 件 ・ 表示中 {instructions.length} 件
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select
              value={filterClient}
              onValueChange={(v) => setFilterClient(v ?? "__all__")}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">すべてのクライアント</SelectItem>
                {knownClients.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterStatus}
              onValueChange={(v) =>
                setFilterStatus((v ?? "all") as StatusFilter)
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL_JA[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm py-8 text-center">
              読み込み中...
            </div>
          ) : instructions.length === 0 ? (
            <div className="text-muted-foreground text-sm py-8 text-center">
              指示はまだありません。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">状態</TableHead>
                  <TableHead className="w-[140px]">クライアント</TableHead>
                  <TableHead>指示内容</TableHead>
                  <TableHead className="w-[160px]">作成日時</TableHead>
                  <TableHead className="w-[160px]">配信日時</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instructions.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <StatusBadge status={inst.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Badge variant="outline">{inst.client_id}</Badge>
                      {inst.session_id ? (
                        <div className="text-muted-foreground mt-1 truncate max-w-[140px]">
                          {inst.session_id}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {inst.instruction}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inst.created_at).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inst.delivered_at
                        ? new Date(inst.delivered_at).toLocaleString("ja-JP")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {inst.status === "pending" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelMut.mutate(inst.id)}
                          disabled={cancelMut.isPending}
                          title="キャンセル"
                        >
                          <Ban className="h-3 w-3" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
