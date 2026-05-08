"""CRUD for client_profiles — friendly metadata attached to a client_id."""
from datetime import datetime

from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.logs import ClientProfile, ClaudeLog, ClaudeSession, Instruction


async def list_profiles(db: AsyncSession) -> list[ClientProfile]:
    result = await db.execute(select(ClientProfile).order_by(ClientProfile.client_id))
    return list(result.scalars().all())


async def get_profile(db: AsyncSession, client_id: str) -> ClientProfile | None:
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.client_id == client_id)
    )
    return result.scalar_one_or_none()


async def upsert_profile(
    db: AsyncSession,
    client_id: str,
    company: str | None,
    person_name: str | None,
    device: str | None,
    description: str | None,
    color: str | None,
) -> ClientProfile:
    now = datetime.utcnow()
    stmt = pg_insert(ClientProfile).values(
        client_id=client_id,
        company=company,
        person_name=person_name,
        device=device,
        description=description,
        color=color,
        created_at=now,
        updated_at=now,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[ClientProfile.client_id],
        set_={
            "company": company,
            "person_name": person_name,
            "device": device,
            "description": description,
            "color": color,
            "updated_at": now,
        },
    )
    await db.execute(stmt)
    await db.commit()

    result = await db.execute(
        select(ClientProfile).where(ClientProfile.client_id == client_id)
    )
    return result.scalar_one()


async def rename_client_id(
    db: AsyncSession,
    old_id: str,
    new_id: str,
) -> dict:
    """Atomically rename a client_id across logs, sessions, instructions, profile.

    Refuses if `new_id` already has any data (would conflict with sessions UNIQUE).
    """
    if old_id == new_id:
        return {
            "logs_renamed": 0,
            "sessions_renamed": 0,
            "instructions_renamed": 0,
            "profile_renamed": False,
        }

    # Check for conflicts on the new_id
    conflict_check = await db.execute(
        text(
            "SELECT "
            "(SELECT COUNT(*) FROM claude_sessions WHERE client_id = :new) AS s, "
            "(SELECT COUNT(*) FROM client_profiles WHERE client_id = :new) AS p"
        ),
        {"new": new_id},
    )
    row = conflict_check.mappings().one()
    if row["s"] > 0 or row["p"] > 0:
        raise ValueError(
            f"client_id '{new_id}' already exists. Pick a different name "
            f"or delete the existing data first."
        )

    # Run updates in a single transaction
    logs_res = await db.execute(
        update(ClaudeLog).where(ClaudeLog.client_id == old_id).values(client_id=new_id)
    )
    sessions_res = await db.execute(
        update(ClaudeSession).where(ClaudeSession.client_id == old_id).values(client_id=new_id)
    )
    instr_res = await db.execute(
        update(Instruction).where(Instruction.client_id == old_id).values(client_id=new_id)
    )
    profile_res = await db.execute(
        update(ClientProfile).where(ClientProfile.client_id == old_id).values(client_id=new_id)
    )
    await db.commit()

    return {
        "logs_renamed": logs_res.rowcount or 0,
        "sessions_renamed": sessions_res.rowcount or 0,
        "instructions_renamed": instr_res.rowcount or 0,
        "profile_renamed": (profile_res.rowcount or 0) > 0,
    }
