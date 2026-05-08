import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, BigInteger, Numeric, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    client_id = Column(String(64), primary_key=True)
    company = Column(String(128), nullable=True)
    person_name = Column(String(128), nullable=True)
    device = Column(String(128), nullable=True)
    description = Column(Text, nullable=True)
    color = Column(String(16), nullable=True)
    telegram_chat_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Instruction(Base):
    __tablename__ = "instructions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(String(64), nullable=False, index=True)
    session_id = Column(String(256), nullable=True, index=True)
    instruction = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="pending", index=True)
    priority = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    delivered_request_id = Column(String(256), nullable=True)
    created_by = Column(String(64), nullable=True)
    note = Column(Text, nullable=True)


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
