"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertClientProfile, type ClientProfile } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const PRESET_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#eab308",
  "#ec4899",
];

function ProfileForm({
  clientId,
  profile,
  onClose,
}: {
  clientId: string;
  profile: ClientProfile | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [company, setCompany] = useState(profile?.company ?? "");
  const [personName, setPersonName] = useState(profile?.person_name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [color, setColor] = useState<string>(profile?.color ?? "");

  const mut = useMutation({
    mutationFn: () =>
      upsertClientProfile(clientId, {
        company: company.trim() || null,
        person_name: personName.trim() || null,
        description: description.trim() || null,
        color: color || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-profiles"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-muted/50 px-3 py-2 rounded-md">
        <div className="text-xs text-muted-foreground">クライアントID</div>
        <div className="font-mono text-sm break-all">{clientId}</div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">会社名</label>
        <Input
          placeholder="例: 株式会社エレファント"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">担当者名</label>
        <Input
          placeholder="例: 安元 天秋"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">メモ</label>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="例: フロントエンド開発を担当。営業時間は平日10-19時。"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">識別カラー（任意）</label>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            type="button"
            onClick={() => setColor("")}
            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs ${
              color === "" ? "border-foreground" : "border-transparent"
            }`}
            title="色なし"
          >
            ✕
          </button>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 ${
                color === c ? "border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          {mut.isError ? `エラー: ${(mut.error as Error).message}` : ""}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ClientProfileDialog({
  open,
  clientId,
  profile,
  onClose,
}: {
  open: boolean;
  clientId: string;
  profile: ClientProfile | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>クライアント情報の編集</DialogTitle>
        </DialogHeader>
        {open ? (
          <ProfileForm
            key={clientId}
            clientId={clientId}
            profile={profile}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
