from pydantic import BaseModel
from typing import Any


class ToolEntry(BaseModel):
    name: str
    description: str = ""


class ToolUsageEntry(BaseModel):
    name: str
    count: int
    category: str


class ModelUsageEntry(BaseModel):
    model: str
    count: int


class CapabilitiesResponse(BaseModel):
    client_id: str
    sample_size: int
    system_prompt_size: int
    available_tools: list[Any] = []
    available_tools_by_category: dict[str, list[str]] = {}
    mcp_servers: dict[str, list[str]] = {}
    skills: list[dict[str, str]] = []
    tool_usage: list[ToolUsageEntry] = []
    models_used: list[ModelUsageEntry] = []
    last_seen: str | None = None
