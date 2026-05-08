const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";

interface FetchOptions {
  method?: string;
  body?: unknown;
  apiKey?: string;
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const apiKey =
    opts.apiKey ||
    (typeof window !== "undefined" ? localStorage.getItem("clc_api_key") : null);
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// Types
export interface LogEntry {
  id: string;
  client_id: string;
  session_id: string | null;
  request_id: string;
  timestamp: string;
  model: string | null;
  prompt: unknown;
  system_prompt: string | null;
  response: unknown;
  stop_reason: string | null;
  tool_calls: unknown[];
  tool_results: unknown[];
  computer_use: unknown[];
  git_operations: unknown[];
  latency_ms: number | null;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  status_code: number;
  error: unknown;
  metadata: Record<string, unknown>;
}

export interface LogListResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface SessionEntry {
  id: string;
  client_id: string;
  session_id: string;
  started_at: string;
  last_activity_at: string;
  total_requests: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost_usd: number;
}

export interface ClientStats {
  client_id: string;
  total_sessions: number;
  total_requests: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost_usd: number;
  error_count: number;
  last_activity: string | null;
}

export interface DashboardStats {
  clients: ClientStats[];
  total_requests: number;
  total_cost_usd: number;
  total_errors: number;
}

// API functions
export async function getDashboard(): Promise<DashboardStats> {
  return apiFetch("/api/dashboard");
}

export async function getLogs(params: {
  client_id?: string;
  session_id?: string;
  page?: number;
  page_size?: number;
  status_code?: number;
  model?: string;
}): Promise<LogListResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      searchParams.set(k, String(v));
    }
  });
  return apiFetch(`/api/logs?${searchParams}`);
}

export async function getSessions(params: {
  client_id?: string;
  page?: number;
  page_size?: number;
}): Promise<{ sessions: SessionEntry[]; total: number }> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      searchParams.set(k, String(v));
    }
  });
  return apiFetch(`/api/sessions?${searchParams}`);
}

export async function searchLogs(params: {
  query: string;
  client_id?: string;
  page?: number;
  page_size?: number;
}): Promise<LogListResponse> {
  return apiFetch("/api/search", { method: "POST", body: params });
}

export interface ClientProfile {
  client_id: string;
  company: string | null;
  person_name: string | null;
  device: string | null;
  description: string | null;
  color: string | null;
  telegram_chat_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientProfileListResponse {
  profiles: ClientProfile[];
  total: number;
}

export async function listClientProfiles(): Promise<ClientProfileListResponse> {
  return apiFetch("/api/client-profiles");
}

export async function upsertClientProfile(
  client_id: string,
  payload: {
    company?: string | null;
    person_name?: string | null;
    device?: string | null;
    description?: string | null;
    color?: string | null;
    telegram_chat_id?: string | null;
  },
): Promise<ClientProfile> {
  return apiFetch(`/api/client-profiles/${encodeURIComponent(client_id)}`, {
    method: "PUT",
    body: payload,
  });
}

export async function getTelegramStatus(): Promise<{
  configured: boolean;
  bot_username: string | null;
}> {
  return apiFetch("/api/telegram/status");
}

export async function sendTelegramTest(
  chat_id: string,
  text: string,
): Promise<{ ok: boolean; message: string | null; message_id: number | null }> {
  return apiFetch("/api/telegram/test", {
    method: "POST",
    body: { chat_id, text },
  });
}

export interface ClientRenameResponse {
  old_client_id: string;
  new_client_id: string;
  logs_renamed: number;
  sessions_renamed: number;
  instructions_renamed: number;
  profile_renamed: boolean;
}

export async function renameClientId(
  old_client_id: string,
  new_client_id: string,
): Promise<ClientRenameResponse> {
  return apiFetch(
    `/api/clients/${encodeURIComponent(old_client_id)}/rename`,
    { method: "POST", body: { new_client_id } },
  );
}

export interface InstructionEntry {
  id: string;
  client_id: string;
  session_id: string | null;
  instruction: string;
  status: "pending" | "delivered" | "cancelled";
  priority: number;
  created_at: string;
  delivered_at: string | null;
  delivered_request_id: string | null;
  created_by: string | null;
  note: string | null;
}

export interface InstructionListResponse {
  instructions: InstructionEntry[];
  total: number;
}

export async function listInstructions(params: {
  client_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<InstructionListResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      searchParams.set(k, String(v));
    }
  });
  return apiFetch(`/api/instructions?${searchParams}`);
}

export async function createInstruction(payload: {
  client_id: string;
  instruction: string;
  session_id?: string;
  priority?: number;
  note?: string;
}): Promise<InstructionEntry> {
  return apiFetch("/api/instructions", { method: "POST", body: payload });
}

export async function cancelInstruction(id: string): Promise<void> {
  const apiKey =
    typeof window !== "undefined" ? localStorage.getItem("clc_api_key") : null;
  const res = await fetch(`${API_URL}/api/instructions/${id}`, {
    method: "DELETE",
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to cancel: ${res.status}`);
  }
}

export async function analyzeLogs(params: {
  client_id: string;
  query: string;
  limit?: number;
}): Promise<{
  client_id: string;
  query: string;
  matching_logs: LogEntry[];
  summary: string;
  suggested_fix: string | null;
}> {
  return apiFetch("/api/analyze", { method: "POST", body: params });
}
