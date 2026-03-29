"""MongoDB connection and Beanie document models."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

import certifi
import motor.motor_asyncio
from beanie import Document, init_beanie
from pydantic import Field


class ProjectDoc(Document):
    user_id: str
    name: str
    description: str = ""
    runtime: Literal["node", "python"] = "node"
    models: list[dict[str, str]] = Field(default_factory=list)
    root_version_id: str | None = None
    current_version_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "projects"


class VersionDoc(Document):
    project_id: str
    parent_id: str | None = None
    prompt: str
    selected_candidate_id: str | None = None
    files: dict[str, Any] = Field(default_factory=dict)
    mode: Literal["user", "agent"] = "user"
    depth: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "versions"


class CandidateDoc(Document):
    version_id: str
    model_id: str
    model_label: str
    files: dict[str, Any] = Field(default_factory=dict)
    raw_response: str = ""
    execution: dict[str, Any] | None = None
    evaluation: dict[str, Any] | None = None
    selected: bool = False
    error: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "candidates"


async def init_db(mongodb_uri: str, db_name: str = "yhack") -> None:
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_uri, tlsCAFile=certifi.where())
    try:
        database = client.get_default_database()
    except Exception:
        database = client[db_name]
    await init_beanie(
        database=database,
        document_models=[ProjectDoc, VersionDoc, CandidateDoc],
    )
