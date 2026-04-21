"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchLogs, analyzeLogs, type LogEntry } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Sparkles } from "lucide-react";

export function SearchView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState("search");

  // Search
  const searchResult = useQuery({
    queryKey: ["search", searchQuery, clientId],
    queryFn: () =>
      searchLogs({ query: searchQuery, client_id: clientId || undefined }),
    enabled: submitted && activeTab === "search" && searchQuery.length > 0,
  });

  // Analyze
  const analyzeResult = useQuery({
    queryKey: ["analyze", searchQuery, clientId],
    queryFn: () =>
      analyzeLogs({ client_id: clientId, query: searchQuery }),
    enabled:
      submitted &&
      activeTab === "analyze" &&
      searchQuery.length > 0 &&
      clientId.length > 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Search & Analyze</h2>
        <p className="text-muted-foreground">
          Search logs or analyze issues across clients
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="search">
            <Search className="w-4 h-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="analyze">
            <Sparkles className="w-4 h-4 mr-2" />
            Analyze
          </TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
          <Input
            placeholder={
              activeTab === "search"
                ? "Search in prompts, responses, tools..."
                : "Describe the issue to analyze..."
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSubmitted(false);
            }}
            className="flex-1"
          />
          <Input
            placeholder="Client ID (optional for search)"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setSubmitted(false);
            }}
            className="max-w-[200px]"
          />
          <Button type="submit">
            {activeTab === "search" ? "Search" : "Analyze"}
          </Button>
        </form>

        <TabsContent value="search" className="mt-4">
          {searchResult.isLoading && (
            <div className="p-8 text-center text-muted-foreground">
              Searching...
            </div>
          )}
          {searchResult.data && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {searchResult.data.total} results found
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Tools</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResult.data.logs.map((log: LogEntry) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
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
                              log.status_code >= 400
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {log.status_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.latency_ms}ms
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.tool_calls.length > 0
                            ? `${log.tool_calls.length} calls`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analyze" className="mt-4">
          {!clientId && submitted && (
            <div className="p-8 text-center text-muted-foreground">
              Client ID is required for analysis
            </div>
          )}
          {analyzeResult.isLoading && (
            <div className="p-8 text-center text-muted-foreground">
              Analyzing logs...
            </div>
          )}
          {analyzeResult.data && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Analysis Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>{analyzeResult.data.summary}</p>
                  {analyzeResult.data.suggested_fix && (
                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-md">
                      <h4 className="font-medium text-green-500 mb-1">
                        Suggested Fix
                      </h4>
                      <p className="text-sm">
                        {analyzeResult.data.suggested_fix}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {analyzeResult.data.matching_logs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Related Logs ({analyzeResult.data.matching_logs.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analyzeResult.data.matching_logs.map((log: LogEntry) => (
                      <div
                        key={log.id}
                        className="border-b last:border-0 py-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString("ja-JP")}
                          </span>
                          <Badge
                            variant={
                              log.status_code >= 400
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {log.status_code}
                          </Badge>
                          {log.model && (
                            <span className="text-xs">{log.model}</span>
                          )}
                        </div>
                        {log.error != null && (
                          <pre className="text-xs bg-destructive/10 p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(log.error, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
