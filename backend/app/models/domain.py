"""Domain models (Pydantic schemas for API + DB)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── File system ──────────────────────────────────────────────────────────────

class FileEntry(BaseModel):
    path: str
    content: str
    language: str


FileMap = dict[str, FileEntry]  # path -> FileEntry


# ── Models ────────────────────────────────────────────────────────────────────

class ModelConfig(BaseModel):
    id: str
    label: str
    provider: str


# ── Project ───────────────────────────────────────────────────────────────────

class Project(BaseModel):
    id: str
    name: str
    description: str = ""
    runtime: Literal["node", "python"] = "node"
    models: list[ModelConfig] = Field(default_factory=list)
    root_version_id: str | None = None
    current_version_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""
    runtime: Literal["node", "python"] = "node"


# ── Version ───────────────────────────────────────────────────────────────────

class Version(BaseModel):
    id: str
    project_id: str
    parent_id: str | None = None
    prompt: str
    selected_candidate_id: str | None = None
    files: FileMap = Field(default_factory=dict)
    mode: Literal["user", "agent"] = "user"
    depth: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── Execution ─────────────────────────────────────────────────────────────────

class ExecutionResult(BaseModel):
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    duration_ms: int = 0
    timed_out: bool = False


# ── Evaluation ────────────────────────────────────────────────────────────────

class RubricScores(BaseModel):
    correctness: float = 0.0      # 0-10: syntax ok, runs without error
    code_quality: float = 0.0     # 0-10: naming, nesting, line count
    completeness: float = 0.0     # 0-10: prompt intent fulfilled
    efficiency: float = 0.0       # 0-10: minimal regressions, clean diff


class Evaluation(BaseModel):
    scores: RubricScores
    total_score: float
    confidence: float             # 0-1, hidden from UI
    reasoning: str = ""


# ── Candidate ─────────────────────────────────────────────────────────────────

class Candidate(BaseModel):
    id: str
    version_id: str
    model_id: str
    model_label: str
    files: FileMap = Field(default_factory=dict)
    raw_response: str = ""
    execution: ExecutionResult | None = None
    evaluation: Evaluation | None = None
    selected: bool = False
    error: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── API request/response ──────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str
    parent_version_id: str | None = None
    model_ids: list[str]
    project_id: str


class SelectCandidateRequest(BaseModel):
    candidate_id: str
    version_id: str
    project_id: str


class GenerateResponse(BaseModel):
    version_id: str
    candidates: list[Candidate]


# ── Diff ──────────────────────────────────────────────────────────────────────

class FileDiff(BaseModel):
    path: str
    status: Literal["added", "modified", "deleted"]
    hunks: str = ""


class DiffSummary(BaseModel):
    files_added: int = 0
    files_modified: int = 0
    files_deleted: int = 0
    total_changes: int = 0
