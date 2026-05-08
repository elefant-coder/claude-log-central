"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getDashboard,
  listClientProfiles,
  type ClientStats,
  type ClientProfile,
} from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  DollarSign,
  AlertTriangle,
  Users,
  Pencil,
} from "lucide-react";
import { buildProfileMap, profileLines } from "@/lib/profile";
import { ClientProfileDialog } from "@/components/client-profile-dialog";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const [editing, setEditing] = useState<{
    clientId: string;
    profile: ClientProfile | null;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  const { data: profilesData } = useQuery({
    queryKey: ["client-profiles"],
    queryFn: listClientProfiles,
  });
  const profileMap = buildProfileMap(profilesData?.profiles);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        ダッシュボードの読み込みに失敗しました。APIキーを確認してください。
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
        <p className="text-muted-foreground">
          全Claude Codeクライアントの活動サマリー
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="クライアント数"
          value={String(data.clients.length)}
          icon={Users}
        />
        <StatCard
          title="リクエスト総数"
          value={data.total_requests.toLocaleString()}
          icon={Activity}
        />
        <StatCard
          title="累計コスト"
          value={`$${data.total_cost_usd.toFixed(2)}`}
          icon={DollarSign}
        />
        <StatCard
          title="エラー数"
          value={String(data.total_errors)}
          description={
            data.total_requests > 0
              ? `エラー率 ${((data.total_errors / data.total_requests) * 100).toFixed(1)}%`
              : undefined
          }
          icon={AlertTriangle}
        />
      </div>

      {/* Client table */}
      <Card>
        <CardHeader>
          <CardTitle>クライアント一覧</CardTitle>
          <CardDescription>
            クライアント別の利用状況。各行の右端にある編集ボタンから「会社名」「担当者名」「メモ」を設定できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              まだクライアントデータがありません。Claude Code を接続するとログが流れ始めます。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">クライアント</TableHead>
                  <TableHead>セッション数</TableHead>
                  <TableHead>リクエスト数</TableHead>
                  <TableHead>トークン（入力/出力）</TableHead>
                  <TableHead>コスト</TableHead>
                  <TableHead>エラー</TableHead>
                  <TableHead>最終アクティビティ</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clients.map((client: ClientStats) => {
                  const profile = profileMap[client.client_id];
                  const lines = profileLines(client.client_id, profile);
                  return (
                    <TableRow key={client.client_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {profile?.color ? (
                            <span
                              className="inline-block w-2 h-10 rounded-full shrink-0"
                              style={{ backgroundColor: profile.color }}
                            />
                          ) : null}
                          <div className="min-w-0">
                            <div className="truncate">{lines.title}</div>
                            {lines.device ? (
                              <div className="text-xs text-muted-foreground truncate">
                                💻 {lines.device}
                              </div>
                            ) : null}
                            <div className="text-xs text-muted-foreground/70 font-mono truncate">
                              {lines.subtitle || "未設定"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{client.total_sessions}</TableCell>
                      <TableCell>
                        {client.total_requests.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {(client.total_tokens_input / 1000).toFixed(1)}K /{" "}
                        {(client.total_tokens_output / 1000).toFixed(1)}K
                      </TableCell>
                      <TableCell>${client.total_cost_usd.toFixed(2)}</TableCell>
                      <TableCell>
                        {client.error_count > 0 ? (
                          <Badge variant="destructive">
                            {client.error_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {client.last_activity
                          ? new Date(client.last_activity).toLocaleString(
                              "ja-JP",
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditing({
                              clientId: client.client_id,
                              profile: profile ?? null,
                            })
                          }
                          title="このクライアントの情報を編集"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ClientProfileDialog
        open={!!editing}
        clientId={editing?.clientId ?? ""}
        profile={editing?.profile ?? null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
