from datetime import datetime
from pydantic import BaseModel, Field


class ClientProfileEntry(BaseModel):
    client_id: str
    company: str | None = None
    person_name: str | None = None
    device: str | None = None
    description: str | None = None
    color: str | None = None
    created_at: datetime
    updated_at: datetime


class ClientProfileUpsert(BaseModel):
    company: str | None = Field(default=None, max_length=128)
    person_name: str | None = Field(default=None, max_length=128)
    device: str | None = Field(default=None, max_length=128)
    description: str | None = Field(default=None, max_length=2000)
    color: str | None = Field(default=None, max_length=16)


class ClientProfileListResponse(BaseModel):
    profiles: list[ClientProfileEntry]
    total: int


class ClientRenameRequest(BaseModel):
    new_client_id: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_\-\.]+$")


class ClientRenameResponse(BaseModel):
    old_client_id: str
    new_client_id: str
    logs_renamed: int
    sessions_renamed: int
    instructions_renamed: int
    profile_renamed: bool
