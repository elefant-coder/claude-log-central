"""CRUD for client_profiles — friendly metadata attached to a client_id."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.logs import ClientProfile


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
    description: str | None,
    color: str | None,
) -> ClientProfile:
    now = datetime.utcnow()
    stmt = pg_insert(ClientProfile).values(
        client_id=client_id,
        company=company,
        person_name=person_name,
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
