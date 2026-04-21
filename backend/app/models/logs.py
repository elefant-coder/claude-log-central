import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, BigInteger, Numeric, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class ClaudeSession(Base):
    __tablename__ = "claude_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(String(64), nullable=False, index=True)
    session_id = Column(String(256), nullable=False)
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_activity_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    total_requests = Column(Integer, default=0)
    total_tokens_input = Column(BigInteger, default=0)
    total_tokens_output = Column(BigInteger, default=0)
    total_cost_usd = Column(Numeric(10, 6), default=0)
    metadata_ = Column("metadata", JSONB, default={})


class ClaudeLog(Base):
    __tablename__ = "claude_logs"

    id = Column(UUID(as_uuid=True), default=uuid.uuid4)
    client_id = Column(String(64), nullable=False)
    session_id = Column(String(256))
    request_id = Column(String(256), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, primary_key=True)
    model = Column(String(128))

    prompt = Column(JSONB)
    system_prompt = Column(Text)

    response = Column(JSONB)
    stop_reason = Column(String(64))

    tool_calls = Column(JSONB, default=[])
    tool_results = Column(JSONB, default=[])
    computer_use = Column(JSONB, default=[])
    git_operations = Column(JSONB, default=[])

    latency_ms = Column(Integer)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    cost_usd = Column(Numeric(10, 6), default=0)

    status_code = Column(Integer, default=200)
    error = Column(JSONB)
    metadata_ = Column("metadata", JSONB, default={})

    # Composite PK defined in SQL init (id + timestamp for partitioning)
    __mapper_args__ = {"primary_key": [id, timestamp]}
