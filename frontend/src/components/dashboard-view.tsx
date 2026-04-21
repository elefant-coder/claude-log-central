"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboard, type ClientStats } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, DollarSign, AlertTriangle, Users } from "lucide-react";

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
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        Failed to load dashboard. Check your API key.
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of all Claude Code client activity
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Clients"
          value={String(data.clients.length)}
          icon={Users}
        />
        <StatCard
          title="Total Requests"
          value={data.total_requests.toLocaleString()}
          icon={Activity}
        />
        <StatCard
          title="Total Cost"
          value={`$${data.total_cost_usd.toFixed(2)}`}
          icon={DollarSign}
        />
        <StatCard
          title="Total Errors"
          value={String(data.total_errors)}
          description={
            data.total_requests > 0
              ? `${((data.total_errors / data.total_requests) * 100).toFixed(1)}% error rate`
              : undefined
          }
          icon={AlertTriangle}
        />
      </div>

      {/* Client table */}
      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>
            Per-client usage statistics and activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No client data yet. Connect a Claude Code instance to start
              logging.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Tokens (In/Out)</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clients.map((client: ClientStats) => (
                  <TableRow key={client.client_id}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{client.client_id}</Badge>
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
                        ? new Date(client.last_activity).toLocaleString("ja-JP")
                        : "-"}
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
