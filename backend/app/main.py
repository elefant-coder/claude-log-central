import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.db import engine
from app.routers import proxy, admin

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ]
)

logger = structlog.get_logger()

app = FastAPI(
    title="Claude Log Central",
    description="Central logging proxy for Claude Code instances across multiple clients",
    version="1.0.0",
)


INSTRUCTIONS_DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS instructions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id VARCHAR(64) NOT NULL,
        session_id VARCHAR(256),
        instruction TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        delivered_at TIMESTAMPTZ,
        delivered_request_id VARCHAR(256),
        created_by VARCHAR(64),
        note TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_instructions_client_status ON instructions(client_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_instructions_session ON instructions(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_instructions_created_at ON instructions(created_at DESC)",
]

CLIENT_PROFILES_DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS client_profiles (
        client_id VARCHAR(64) PRIMARY KEY,
        company VARCHAR(128),
        person_name VARCHAR(128),
        description TEXT,
        color VARCHAR(16),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS device VARCHAR(128)",
    "ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(64)",
]


@app.on_event("startup")
async def on_startup():
    """Run idempotent schema migrations for tables not in the original init.sql."""
    try:
        async with engine.begin() as conn:
            for stmt in INSTRUCTIONS_DDL_STATEMENTS:
                await conn.execute(text(stmt))
            for stmt in CLIENT_PROFILES_DDL_STATEMENTS:
                await conn.execute(text(stmt))
        logger.info("schema ensured")
    except Exception as e:
        logger.error("startup migration failed", error=str(e))

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Proxy routes (no auth - clients authenticate with their own Anthropic keys)
app.include_router(proxy.router, tags=["proxy"])

# Admin routes (require admin API key)
app.include_router(admin.router, tags=["admin"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "claude-log-central"}
