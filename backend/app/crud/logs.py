from datetime import datetime
from sqlalchemy import select, func, text, and_, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.logs import ClaudeLog, ClaudeSession


async def save_log(db: AsyncSession, log_data: dict) -> None:
    log = ClaudeLog(**log_data)
    db.add(log)
    await db.commit()


async def upsert_session(db: AsyncSession, client_id: str, session_id: str, tokens_in: int, tokens_out: int, cost: float) -> None:
    result = await db.execute(
        select(ClaudeSession).where(
            ClaudeSession.client_id == client_id,
            ClaudeSession.session_id == session_id,
        )
    )
    session = result.scalar_one_or_none()

    if session:
        session.last_activity_at = datetime.utcnow()
        session.total_requests += 1
        session.total_tokens_input += tokens_in
        session.total_tokens_output += tokens_out
        session.total_cost_usd += cost
    else:
        session = ClaudeSession(
            client_id=client_id,
            session_id=session_id,
            total_requests=1,
            total_tokens_input=tokens_in,
            total_tokens_output=tokens_out,
            total_cost_usd=cost,
        )
        db.add(session)

    await db.commit()


async def get_logs(
    db: AsyncSession,
    client_id: str | None = None,
    session_id: str | None = None,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
    status_code: int | None = None,
    model: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[ClaudeLog], int]:
    conditions = []
    if client_id:
        conditions.append(ClaudeLog.client_id == client_id)
    if session_id:
        conditions.append(ClaudeLog.session_id == session_id)
    if time_from:
        conditions.append(ClaudeLog.timestamp >= time_from)
    if time_to:
        conditions.append(ClaudeLog.timestamp <= time_to)
    if status_code:
        conditions.append(ClaudeLog.status_code == status_code)
    if model:
        conditions.append(ClaudeLog.model == model)

    where = and_(*conditions) if conditions else True

    count_q = select(func.count()).select_from(ClaudeLog).where(where)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(ClaudeLog)
        .where(where)
        .order_by(ClaudeLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    logs = list(result.scalars().all())

    return logs, total


async def search_logs(
    db: AsyncSession,
    query: str,
    client_id: str | None = None,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[ClaudeLog], int]:
    conditions = []
    if client_id:
        conditions.append(ClaudeLog.client_id == client_id)
    if time_from:
        conditions.append(ClaudeLog.timestamp >= time_from)
    if time_to:
        conditions.append(ClaudeLog.timestamp <= time_to)

    # Search in prompt and response JSONB
    search_condition = or_(
        cast(ClaudeLog.prompt, String).ilike(f"%{query}%"),
        cast(ClaudeLog.response, String).ilike(f"%{query}%"),
        cast(ClaudeLog.tool_calls, String).ilike(f"%{query}%"),
        cast(ClaudeLog.error, String).ilike(f"%{query}%"),
    )
    conditions.append(search_condition)

    where = and_(*conditions)

    count_q = select(func.count()).select_from(ClaudeLog).where(where)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(ClaudeLog)
        .where(where)
        .order_by(ClaudeLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    logs = list(result.scalars().all())

    return logs, total


async def get_sessions(
    db: AsyncSession,
    client_id: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[ClaudeSession], int]:
    conditions = []
    if client_id:
        conditions.append(ClaudeSession.client_id == client_id)

    where = and_(*conditions) if conditions else True

    count_q = select(func.count()).select_from(ClaudeSession).where(where)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(ClaudeSession)
        .where(where)
        .order_by(ClaudeSession.last_activity_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    sessions = list(result.scalars().all())

    return sessions, total


async def get_dashboard_stats(db: AsyncSession) -> list[dict]:
    q = text("""
        SELECT
            client_id,
            COUNT(DISTINCT session_id) as total_sessions,
            COUNT(*) as total_requests,
            COALESCE(SUM(tokens_input), 0) as total_tokens_input,
            COALESCE(SUM(tokens_output), 0) as total_tokens_output,
            COALESCE(SUM(cost_usd), 0) as total_cost_usd,
            COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
            MAX(timestamp) as last_activity
        FROM claude_logs
        GROUP BY client_id
        ORDER BY last_activity DESC
    """)
    result = await db.execute(q)
    rows = result.mappings().all()
    return [dict(r) for r in rows]
