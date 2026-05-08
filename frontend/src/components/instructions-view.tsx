"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelInstruction,
  createInstruction,
  getDashboard,
  listClientProfiles,
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
import {
  CheckCircle2,
  Clock,
  Send,
  XCircle,
  Ban,
  Info,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { buildProfileMap, profileLines } from "@/lib/profile";

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
      <Badge variant="secondary" className="gap-1 whitespace-nowrap">
        <Clock className="h-3 w-3" /> 待機中
      </Badge>
    );
  }
  if (status === "delivered") {
    return (
      <Badge className="gap-1 bg-green-600 hover:bg-green-600/90 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3" /> 配信済み
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground whitespace-nowrap">
      <XCircle className="h-3 w-3" /> キャンセル
    </Badge>
  );
}

function HowItWorks() {
  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4" /> 使い方
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ol className="list-decimal pl-5 space-y-1">
          <li>送信先の<strong>クライアント</strong>を選びます（ダッシュボードで会社名・担当者を登録できます）</li>
          <li>下のフォームに伝えたい内容を書いて<strong>「キューに追加」</strong>を押します</li>
          <li>対象クライアントが次にClaude Codeを使った瞬間、指示が自動で届きます</li>
          <li>下の表で配信状況が確認できます。届くまでは<Badge variant="secondary" className="gap-1 mx-1"><Clock className="h-3 w-3" />待機中</Badge>、届いたら<Badge className="gap-1 bg-green-600 hover:bg-green-600/90 mx-1"><CheckCircle2 className="h-3 w-3" />配信済み</Badge>に変わります</li>
        </ol>

        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
          <span className="rounded-md border px-2 py-1">① あなたが投稿</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span className="rounded-md border px-2 py-1">② キューで待機</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span className="rounded-md border px-2 py-1">③ クライアントがClaude Codeを使う</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span className="rounded-md border px-2 py-1 bg-green-600/10 border-green-600/30">④ 自動で届く（配信済み）</span>
        </div>

        <p className="text-xs text-muted-foreground pt-1">
          ※ 指示は <code className="bg-muted px-1 rounded">{"<system-reminder>"}</code> という形式でClaude Codeに渡され、ユーザーが直接書いた指示と同じ優先度で処理されます。
        </p>
      </CardContent>
    </Card>
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
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    staleTime: 30_000,
  });

  const { data: profilesData } = useQuery({
    queryKey: ["client-profiles"],
    queryFn: listClientProfiles,
  });
  const profileMap = buildProfileMap(profilesData?.profiles);

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
      setConfirmCancelId(null);
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
  const deliveredCount = instructions.filter((i) => i.status === "delivered").length;

  const selectedProfile = profileMap[clientId];
  const selectedDisplay = selectedProfile
    ? profileLines(clientId, selectedProfile)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">指示出し</h2>
        <p className="text-muted-foreground">
          リモートのClaude Codeに「次の指示」を遠隔で送り込めます。次回そのクライアントがClaude Codeを使った瞬間、自動で届きます。
        </p>
      </div>

      <HowItWorks />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> 新しい指示を送る
          </CardTitle>
          <CardDescription>
            送信先のクライアントを選んで、伝えたい内容を書くだけ。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium">送信先 *</label>
                {knownClients.length > 0 ? (
                  <Select
                    value={clientId}
                    onValueChange={(v) => setClientId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="既存クライアントから選ぶ（推奨）" />
                    </SelectTrigger>
                    <SelectContent>
                      {knownClients.map((c) => {
                        const lines = profileLines(c, profileMap[c]);
                        return (
                          <SelectItem key={c} value={c}>
                            {lines.title}
                            {lines.subtitle ? (
                              <span className="ml-2 text-xs text-muted-foreground font-mono">
                                {lines.subtitle}
                              </span>
                            ) : null}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  placeholder="または直接クライアントID入力 (例: acme-corp)"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                />
                {selectedDisplay && selectedDisplay.subtitle ? (
                  <p className="text-xs text-muted-foreground">
                    送信先: <strong>{selectedDisplay.title}</strong>
                    <span className="ml-2 font-mono">
                      ({selectedDisplay.subtitle})
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">優先度</label>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  数字が大きいほど先に届きます。普通は0でOK。
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">
                セッションID（上級者向け・通常は空欄）
              </label>
              <Input
                placeholder="空欄でOK。特定セッションだけに送りたい時のみ指定"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">指示内容 *</label>
              <textarea
                className="flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={`例:\nlogin画面のバリデーション処理にバグがあります。\nemail入力で空欄でも通過してしまうので、必須チェックを追加してテストも書いてください。`}
                value={instructionText}
                onChange={(e) => setInstructionText(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Claudeへの普段の指示と同じ書き方でOK。日本語でそのまま書いて大丈夫です。
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs">
                {createMut.isError ? (
                  <span className="text-destructive">
                    エラー: {(createMut.error as Error).message}
                  </span>
                ) : createMut.isSuccess ? (
                  <span className="text-green-600">
                    ✓ キューに追加しました。次回クライアントがClaude Codeを使った瞬間に届きます。
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    送信前に内容を確認してください。
                  </span>
                )}
              </p>
              <Button
                type="submit"
                disabled={createMut.isPending || !clientId.trim() || !instructionText.trim()}
              >
                {createMut.isPending ? "送信中..." : "キューに追加"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>キュー & 履歴</CardTitle>
            <CardDescription className="flex items-center gap-3 flex-wrap mt-1">
              <span>
                <Badge variant="secondary" className="gap-1 mr-1">
                  <Clock className="h-3 w-3" />
                </Badge>
                待機中 <strong>{pendingCount}</strong> 件
              </span>
              <span>
                <Badge className="gap-1 bg-green-600 hover:bg-green-600/90 mr-1">
                  <CheckCircle2 className="h-3 w-3" />
                </Badge>
                配信済み <strong>{deliveredCount}</strong> 件
              </span>
              <span className="text-xs text-muted-foreground">
                （5秒ごとに自動更新）
              </span>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select
              value={filterClient}
              onValueChange={(v) => setFilterClient(v ?? "__all__")}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">すべてのクライアント</SelectItem>
                {knownClients.map((c) => {
                  const lines = profileLines(c, profileMap[c]);
                  return (
                    <SelectItem key={c} value={c}>
                      {lines.title}
                    </SelectItem>
                  );
                })}
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
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Inbox className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">
                指示はまだありません。
              </p>
              <p className="text-muted-foreground/70 text-xs">
                上のフォームから1件目を送ってみましょう。
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">状態</TableHead>
                  <TableHead className="w-[200px]">送信先</TableHead>
                  <TableHead>指示内容</TableHead>
                  <TableHead className="w-[140px]">作成日時</TableHead>
                  <TableHead className="w-[140px]">配信日時</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instructions.map((inst) => {
                  const profile = profileMap[inst.client_id];
                  const lines = profileLines(inst.client_id, profile);
                  return (
                    <TableRow key={inst.id}>
                      <TableCell>
                        <StatusBadge status={inst.status} />
                        {inst.status === "pending" ? (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            次回通信時に届きます
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          {profile?.color ? (
                            <span
                              className="inline-block w-1.5 h-6 rounded-full shrink-0"
                              style={{ backgroundColor: profile.color }}
                            />
                          ) : null}
                          <div className="min-w-0">
                            <div className="truncate">{lines.title}</div>
                            {lines.subtitle ? (
                              <div className="text-[10px] text-muted-foreground font-mono truncate">
                                {lines.subtitle}
                              </div>
                            ) : null}
                            {inst.session_id ? (
                              <div className="text-[10px] text-muted-foreground mt-1 truncate">
                                セッション: {inst.session_id.slice(0, 16)}…
                              </div>
                            ) : null}
                          </div>
                        </div>
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
                          : inst.status === "pending"
                            ? "待機中"
                            : "-"}
                      </TableCell>
                      <TableCell>
                        {inst.status === "pending" ? (
                          confirmCancelId === inst.id ? (
                            <div className="flex gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => cancelMut.mutate(inst.id)}
                                disabled={cancelMut.isPending}
                              >
                                取消
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setConfirmCancelId(null)}
                              >
                                戻る
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmCancelId(inst.id)}
                              title="この指示をキャンセル"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
