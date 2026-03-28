"""Generate candidates by fanning out to OpenRouter models."""
from __future__ import annotations

import os
from datetime import datetime

from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException

from app.db import CandidateDoc, ProjectDoc, VersionDoc
from app.models.domain import FileEntry, GenerateRequest
from app.services.openrouter.client import generate_candidates
from app.services.openrouter.models import AVAILABLE_MODELS, get_model_by_id

router = APIRouter(prefix="/generate", tags=["generate"])


def _file_map_from_doc(files_raw: dict) -> dict[str, FileEntry] | None:
    if not files_raw:
        return None
    return {
        path: FileEntry(**entry) for path, entry in files_raw.items()
    }


@router.post("/")
async def generate(body: GenerateRequest):
    # Validate project exists
    project = await ProjectDoc.get(PydanticObjectId(body.project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Resolve models
    models = [m for mid in body.model_ids if (m := get_model_by_id(mid))]
    if not models:
        raise HTTPException(status_code=400, detail="No valid model IDs provided")

    # Resolve parent version files
    current_files = None
    parent_depth = 0
    if body.parent_version_id:
        parent = await VersionDoc.get(PydanticObjectId(body.parent_version_id))
        if parent:
            current_files = _file_map_from_doc(parent.files)
            parent_depth = parent.depth

    # Create a pending version
    version = VersionDoc(
        project_id=body.project_id,
        parent_id=body.parent_version_id,
        prompt=body.prompt,
        depth=parent_depth + 1 if body.parent_version_id else 0,
    )
    await version.insert()

    # Fan out to models
    results = await generate_candidates(models, body.prompt, current_files)

    # Store candidates
    candidate_docs = []
    for result in results:
        doc = CandidateDoc(
            version_id=str(version.id),
            model_id=result.model_id,
            model_label=result.model_label,
            files=result.files,
            raw_response=result.raw_response,
            error=result.error,
        )
        await doc.insert()
        candidate_docs.append(doc)

    # Set root version if first iteration
    if not project.root_version_id:
        project.root_version_id = str(version.id)
        await project.save()

    return {
        "version_id": str(version.id),
        "candidates": [
            {
                "id": str(c.id),
                "version_id": str(version.id),
                "model_id": c.model_id,
                "model_label": c.model_label,
                "files": c.files,
                "raw_response": c.raw_response,
                "error": c.error,
                "execution": c.execution,
                "evaluation": c.evaluation,
                "selected": c.selected,
                "created_at": c.created_at.isoformat(),
            }
            for c in candidate_docs
        ],
    }
