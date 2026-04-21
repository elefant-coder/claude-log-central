import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import proxy, admin

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ]
)

app = FastAPI(
    title="Claude Log Central",
    description="Central logging proxy for Claude Code instances across multiple clients",
    version="1.0.0",
)

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
