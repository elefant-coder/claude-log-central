"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSessions } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
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
import { ChevronLeft, ChevronRight } from "lucide-react";

export function SessionsView() {
  const [clientFilter, setClientFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["sessions", clientFilter, page],
    queryFn: () =>
      getSessions({
        client_id: clientFilter || undefined,
        page,
        page_size: 50,
      }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sessions</h2>
        <p className="text-muted-foreground">
          Claude Code sessions grouped by client
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
          ) : !data || data.sessions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No sessions found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Session ID</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Tokens (In/Out)</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Badge variant="outline">{session.client_id}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {session.session_id.slice(0, 12)}...
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(session.started_at).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(session.last_activity_at).toLocaleString(
                        "ja-JP"
                      )}
                    </TableCell>
                    <TableCell>{session.total_requests}</TableCell>
                    <TableCell className="text-xs">
                      {(session.total_tokens_input / 1000).toFixed(1)}K /{" "}
                      {(session.total_tokens_output / 1000).toFixed(1)}K
                    </TableCell>
                    <TableCell className="text-xs">
                      ${session.total_cost_usd.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {data && data.total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              Page {page} ({data.total} total)
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
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
