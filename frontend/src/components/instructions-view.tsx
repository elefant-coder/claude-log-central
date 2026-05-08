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

function StatusBadge({ status }: { status: InstructionEntry["status"] }) {
  if (status === "pending") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" /> pending
      </Badge>
    );
  }
  if (status === "delivered") {
    return (
      <Badge className="gap-1 bg-green-600 hover:bg-green-600/90">
        <CheckCircle2 className="h-3 w-3" /> delivered
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <XCircle className="h-3 w-3" /> cancelled
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
        <h2 className="text-2xl font-bold tracking-tight">Instructions</h2>
        <p className="text-muted-foreground">
          Send operator-level guidance to a remote Claude Code client. The
          instruction is delivered as a system reminder on the client&apos;s next
          request through this proxy.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> New Instruction
          </CardTitle>
          <CardDescription>
            Target a specific client by ID. Leave session ID blank to broadcast
            to any session of that client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Client ID *</label>
                {knownClients.length > 0 ? (
                  <Select
                    value={clientId}
                    onValueChange={(v) => setClientId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select or type a client" />
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
                  placeholder="client-id (e.g. acme-corp)"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Session ID (optional)
                </label>
                <Input
                  placeholder="leave blank for any session"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Priority</label>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Instruction *</label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder='ここを直してほしい: app/foo.tsx の handleSubmit が...'
                value={instructionText}
                onChange={(e) => setInstructionText(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The text below will be wrapped in a {"<system-reminder>"} block
                and prepended/appended to the next user message.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {createMut.isError
                  ? `Error: ${(createMut.error as Error).message}`
                  : createMut.isSuccess
                    ? "Queued."
                    : ""}
              </p>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? "Sending..." : "Queue Instruction"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Queue & History</CardTitle>
            <CardDescription>
              {pendingCount} pending · {instructions.length} shown
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
                <SelectItem value="__all__">All clients</SelectItem>
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
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm py-8 text-center">
              Loading...
            </div>
          ) : instructions.length === 0 ? (
            <div className="text-muted-foreground text-sm py-8 text-center">
              No instructions yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[140px]">Client</TableHead>
                  <TableHead>Instruction</TableHead>
                  <TableHead className="w-[160px]">Created</TableHead>
                  <TableHead className="w-[160px]">Delivered</TableHead>
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
                          title="Cancel"
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
