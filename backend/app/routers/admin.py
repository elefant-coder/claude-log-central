"""Admin API - Dashboard data, log search, analysis endpoints."""
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.middleware.auth import verify_admin_key
from app.crud.logs import get_logs, search_logs, get_sessions, get_dashboard_stats
from app.schemas.logs import (
    LogListResponse, LogEntry, SessionListResponse, SessionEntry,
    DashboardStats, ClientStats, SearchRequest, AnalyzeRequest, AnalyzeResponse,
)

router = APIRouter(prefix="/api", dependencies=[Depends(verify_admin_key)])


def log_to_entry(log) -> LogEntry:
    return LogEntry(
        id=str(log.id),
        client_id=log.client_id,
        session_id=log.session_id,
        request_id=log.request_id,
        timestamp=log.timestamp,
        model=log.model,
        prompt=log.prompt,
        system_prompt=log.system_prompt,
        response=log.response,
        stop_reason=log.stop_reason,
        tool_calls=log.tool_calls or [],
        tool_results=log.tool_results or [],
        computer_use=log.computer_use or [],
        git_operations=log.git_operations or [],
        latency_ms=log.latency_ms,
        tokens_input=log.tokens_input or 0,
        tokens_output=log.tokens_output or 0,
        cost_usd=float(log.cost_usd or 0),
        status_code=log.status_code or 200,
        error=log.error,
        metadata=log.metadata_ or {},
    )


def session_to_entry(s) -> SessionEntry:
    return SessionEntry(
        id=str(s.id),
        client_id=s.client_id,
        session_id=s.session_id,
        started_at=s.started_at,
        last_activity_at=s.last_activity_at,
        total_requests=s.total_requests or 0,
        total_tokens_input=s.total_tokens_input or 0,
        total_tokens_output=s.total_tokens_output or 0,
        total_cost_usd=float(s.total_cost_usd or 0),
        metadata=s.metadata_ or {},
    )


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(db: AsyncSession = Depends(get_db)):
    stats = await get_dashboard_stats(db)
    clients = [
        ClientStats(
            client_id=s["client_id"],
            total_sessions=s["total_sessions"],
            total_requests=s["total_requests"],
            total_tokens_input=s["total_tokens_input"],
            total_tokens_output=s["total_tokens_output"],
            total_cost_usd=float(s["total_cost_usd"]),
            error_count=s["error_count"],
            last_activity=s["last_activity"],
        )
        for s in stats
    ]
    return DashboardStats(
        clients=clients,
        total_requests=sum(c.total_requests for c in clients),
        total_cost_usd=sum(c.total_cost_usd for c in clients),
        total_errors=sum(c.error_count for c in clients),
    )


@router.get("/logs", response_model=LogListResponse)
async def list_logs(
    client_id: str | None = None,
    session_id: str | None = None,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
    status_code: int | None = None,
    model: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    logs, total = await get_logs(
        db, client_id=client_id, session_id=session_id,
        time_from=time_from, time_to=time_to,
        status_code=status_code, model=model,
        page=page, page_size=page_size,
    )
    return LogListResponse(
        logs=[log_to_entry(l) for l in logs],
        total=total, page=page, page_size=page_size,
    )


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    client_id: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    sessions, total = await get_sessions(db, client_id=client_id, page=page, page_size=page_size)
    return SessionListResponse(
        sessions=[session_to_entry(s) for s in sessions],
        total=total,
    )


@router.post("/search", response_model=LogListResponse)
async def search(req: SearchRequest, db: AsyncSession = Depends(get_db)):
    logs, total = await search_logs(
        db, query=req.query, client_id=req.client_id,
        time_from=req.time_from, time_to=req.time_to,
        page=req.page, page_size=req.page_size,
    )
    return LogListResponse(
        logs=[log_to_entry(l) for l in logs],
        total=total, page=req.page, page_size=req.page_size,
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    """Analyze logs for a specific client - used by Taka's Claude Code."""
    logs, total = await search_logs(
        db, query=req.query, client_id=req.client_id,
        time_from=req.time_from, time_to=req.time_to,
        page=1, page_size=req.limit,
    )
    log_entries = [log_to_entry(l) for l in logs]

    # Build summary from logs
    error_logs = [l for l in log_entries if l.status_code >= 400]
    tool_names = set()
    for l in log_entries:
        for tc in l.tool_calls:
            if isinstance(tc, dict):
                tool_names.add(tc.get("name", "unknown"))

    summary_parts = [
        f"Found {total} matching logs for client '{req.client_id}'.",
        f"Errors: {len(error_logs)}.",
        f"Tools used: {', '.join(tool_names) if tool_names else 'none'}.",
    ]
    if error_logs:
        summary_parts.append(f"Latest error: status {error_logs[0].status_code} at {error_logs[0].timestamp}")
        if error_logs[0].error:
            summary_parts.append(f"Error detail: {str(error_logs[0].error)[:500]}")

    suggested_fix = None
    if error_logs:
        suggested_fix = "Check the error logs above. Common fixes: verify API key, check rate limits, review tool input parameters."

    return AnalyzeResponse(
        client_id=req.client_id,
        query=req.query,
        matching_logs=log_entries[:20],
        summary=" ".join(summary_parts),
        suggested_fix=suggested_fix,
    )
