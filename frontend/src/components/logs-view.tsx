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
            Log Detail - {log.request_id.slice(0, 8)}...
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">Client:</span> {log.client_id}
            </div>
            <div>
              <span className="font-medium">Model:</span> {log.model || "N/A"}
            </div>
            <div>
              <span className="font-medium">Status:</span>{" "}
              <Badge
                variant={log.status_code >= 400 ? "destructive" : "secondary"}
              >
                {log.status_code}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Latency:</span>{" "}
              {log.latency_ms}ms
            </div>
            <div>
              <span className="font-medium">Tokens:</span>{" "}
              {log.tokens_input} in / {log.tokens_output} out
            </div>
            <div>
              <span className="font-medium">Cost:</span> $
              {log.cost_usd.toFixed(4)}
            </div>
          </div>

          {log.system_prompt && (
            <div>
              <h4 className="font-medium mb-1">System Prompt</h4>
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs max-h-40 overflow-y-auto">
                {log.system_prompt}
              </pre>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-1">Prompt (Messages)</h4>
            <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs max-h-60 overflow-y-auto">
              {JSON.stringify(log.prompt, null, 2)}
            </pre>
          </div>

          <div>
            <h4 className="font-medium mb-1">Response</h4>
            <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs max-h-60 overflow-y-auto">
              {JSON.stringify(log.response, null, 2)}
            </pre>
          </div>

          {log.tool_calls.length > 0 && (
            <div>
              <h4 className="font-medium mb-1">
                Tool Calls ({log.tool_calls.length})
              </h4>
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs max-h-40 overflow-y-auto">
                {JSON.stringify(log.tool_calls, null, 2)}
              </pre>
            </div>
          )}

          {log.git_operations.length > 0 && (
            <div>
              <h4 className="font-medium mb-1">
                Git Operations ({log.git_operations.length})
              </h4>
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs max-h-40 overflow-y-auto">
                {JSON.stringify(log.git_operations, null, 2)}
              </pre>
            </div>
          )}

          {log.error != null && (
            <div>
              <h4 className="font-medium mb-1 text-destructive">Error</h4>
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
        <h2 className="text-2xl font-bold tracking-tight">Logs</h2>
        <p className="text-muted-foreground">
          All Claude Code API requests across clients
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Filter by client ID..."
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
              Loading...
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No logs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Tools</TableHead>
                  <TableHead>Cost</TableHead>
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
                          {log.tool_calls.length} tools
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
              Page {page} of {totalPages} ({data?.total} total)
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
