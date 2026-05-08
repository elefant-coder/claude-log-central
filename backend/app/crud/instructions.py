"""CRUD operations for operator instructions sent to remote Claude Code clients."""
from datetime import datetime
import uuid as uuid_lib

from sqlalchemy import select, func, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.logs import Instruction


async def create_instruction(
    db: AsyncSession,
    client_id: str,
    instruction_text: str,
    session_id: str | None = None,
    priority: int = 0,
    created_by: str | None = None,
    note: str | None = None,
) -> Instruction:
    inst = Instruction(
        id=uuid_lib.uuid4(),
        client_id=client_id,
        session_id=session_id,
        instruction=instruction_text,
        status="pending",
        priority=priority,
        created_by=created_by,
        note=note,
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


async def list_instructions(
    db: AsyncSession,
    client_id: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[Instruction], int]:
    conditions = []
    if client_id:
        conditions.append(Instruction.client_id == client_id)
    if status:
        conditions.append(Instruction.status == status)

    where = and_(*conditions) if conditions else True

    count_q = select(func.count()).select_from(Instruction).where(where)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(Instruction)
        .where(where)
        .order_by(Instruction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    rows = list(result.scalars().all())
    return rows, total


async def get_instruction(db: AsyncSession, instruction_id: str) -> Instruction | None:
    result = await db.execute(
        select(Instruction).where(Instruction.id == uuid_lib.UUID(instruction_id))
    )
    return result.scalar_one_or_none()


async def cancel_instruction(db: AsyncSession, instruction_id: str) -> bool:
    """Mark a pending instruction as cancelled. Returns True if cancelled, False if not found or already delivered."""
    result = await db.execute(
        update(Instruction)
        .where(
            and_(
                Instruction.id == uuid_lib.UUID(instruction_id),
                Instruction.status == "pending",
            )
        )
        .values(status="cancelled")
    )
    await db.commit()
    return result.rowcount > 0


async def fetch_pending_for_client(
    db: AsyncSession,
    client_id: str,
    session_id: str | None = None,
) -> list[Instruction]:
    """Return all pending instructions for a client (and optionally session-targeted ones).

    Selection rule:
      - status == 'pending'
      - client_id matches
      - instruction.session_id is NULL (broadcast to all sessions of this client)
        OR matches the current session_id
    Ordered by priority desc, then created_at asc.
    """
    conditions = [
        Instruction.status == "pending",
        Instruction.client_id == client_id,
    ]
    if session_id is not None:
        from sqlalchemy import or_
        conditions.append(
            or_(Instruction.session_id.is_(None), Instruction.session_id == session_id)
        )
    else:
        conditions.append(Instruction.session_id.is_(None))

    q = (
        select(Instruction)
        .where(and_(*conditions))
        .order_by(Instruction.priority.desc(), Instruction.created_at.asc())
    )
    result = await db.execute(q)
    return list(result.scalars().all())


async def mark_delivered(
    db: AsyncSession,
    instruction_ids: list[uuid_lib.UUID],
    request_id: str,
) -> None:
    if not instruction_ids:
        return
    await db.execute(
        update(Instruction)
        .where(Instruction.id.in_(instruction_ids))
        .values(
            status="delivered",
            delivered_at=datetime.utcnow(),
            delivered_request_id=request_id,
        )
    )
    await db.commit()
