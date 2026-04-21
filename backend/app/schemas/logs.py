from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class LogEntry(BaseModel):
    id: str
    client_id: str
    session_id: str | None = None
    request_id: str
    timestamp: datetime
    model: str | None = None
    prompt: Any = None
    system_prompt: str | None = None
    response: Any = None
    stop_reason: str | None = None
    tool_calls: list[Any] = []
    tool_results: list[Any] = []
    computer_use: list[Any] = []
    git_operations: list[Any] = []
    latency_ms: int | None = None
    tokens_input: int = 0
    tokens_output: int = 0
    cost_usd: float = 0
    status_code: int = 200
    error: Any = None
    metadata: dict = {}


class LogListResponse(BaseModel):
    logs: list[LogEntry]
    total: int
    page: int
    page_size: int


class SessionEntry(BaseModel):
    id: str
    client_id: str
    session_id: str
    started_at: datetime
    last_activity_at: datetime
    total_requests: int = 0
    total_tokens_input: int = 0
    total_tokens_output: int = 0
    total_cost_usd: float = 0
    metadata: dict = {}


class SessionListResponse(BaseModel):
    sessions: list[SessionEntry]
    total: int


class ClientStats(BaseModel):
    client_id: str
    total_sessions: int = 0
    total_requests: int = 0
    total_tokens_input: int = 0
    total_tokens_output: int = 0
    total_cost_usd: float = 0
    error_count: int = 0
    last_activity: datetime | None = None


class DashboardStats(BaseModel):
    clients: list[ClientStats]
    total_requests: int = 0
    total_cost_usd: float = 0
    total_errors: int = 0


class AnalyzeRequest(BaseModel):
    client_id: str
    query: str
    time_from: datetime | None = None
    time_to: datetime | None = None
    limit: int = Field(default=50, le=500)


class AnalyzeResponse(BaseModel):
    client_id: str
    query: str
    matching_logs: list[LogEntry]
    summary: str
    suggested_fix: str | None = None


class SearchRequest(BaseModel):
    query: str
    client_id: str | None = None
    time_from: datetime | None = None
    time_to: datetime | None = None
    status_code: int | None = None
    model: str | None = None
    page: int = 1
    page_size: int = Field(default=50, le=200)
