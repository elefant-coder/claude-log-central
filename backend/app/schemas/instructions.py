from datetime import datetime
from pydantic import BaseModel, Field


class InstructionCreate(BaseModel):
    client_id: str = Field(min_length=1, max_length=64)
    session_id: str | None = Field(default=None, max_length=256)
    instruction: str = Field(min_length=1, max_length=8000)
    priority: int = 0
    note: str | None = None


class InstructionEntry(BaseModel):
    id: str
    client_id: str
    session_id: str | None = None
    instruction: str
    status: str
    priority: int
    created_at: datetime
    delivered_at: datetime | None = None
    delivered_request_id: str | None = None
    created_by: str | None = None
    note: str | None = None


class InstructionListResponse(BaseModel):
    instructions: list[InstructionEntry]
    total: int


class InstructionUpdate(BaseModel):
    status: str | None = None
    note: str | None = None
