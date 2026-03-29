"""Generate candidates by fanning out to OpenRouter models."""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime

from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.db import CandidateDoc, ProjectDoc, VersionDoc
from app.models.domain import FileEntry, GenerateRequest
from app.services.openrouter.client import (
    generate_candidates,
    get_project_title,
    stream_one_candidate,
)
from app.services.openrouter.models import AVAILABLE_MODELS, get_model_by_id
from app.services.openrouter.prompt import build_system_prompt, build_user_message

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

    # On first generation, generate a proper project title
    is_first_generation = not body.parent_version_id
    if is_first_generation:
        title = await get_project_title(body.prompt)
        await project.set({ProjectDoc.name: title})
        project = await ProjectDoc.get(project.id)

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

    # Set root version on the first generation
    if not project.root_version_id:
        project.root_version_id = str(version.id)
        await project.save()

    return {
        "version_id": str(version.id),
        "project_name": project.name,
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


@router.post("/stream")
async def generate_stream(body: GenerateRequest):
    """SSE endpoint — emits events as each model streams its response."""
    project = await ProjectDoc.get(PydanticObjectId(body.project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    models = [m for mid in body.model_ids if (m := get_model_by_id(mid))]
    if not models:
        raise HTTPException(status_code=400, detail="No valid model IDs provided")

    current_files = None
    parent_depth = 0
    if body.parent_version_id:
        parent = await VersionDoc.get(PydanticObjectId(body.parent_version_id))
        if parent:
            current_files = _file_map_from_doc(parent.files)
            parent_depth = parent.depth

    version = VersionDoc(
        project_id=body.project_id,
        parent_id=body.parent_version_id,
        prompt=body.prompt,
        depth=parent_depth + 1 if body.parent_version_id else 0,
    )
    await version.insert()

    if not project.root_version_id:
        project.root_version_id = str(version.id)
        await project.save()

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    system_prompt = build_system_prompt()
    user_message = build_user_message(body.prompt, current_files)
    is_first = not body.parent_version_id

    queue: asyncio.Queue = asyncio.Queue()

    async def producer() -> None:
        # Title generation runs independently — emits project_name event as soon
        # as it has a result, which may be before models finish streaming.
        async def title_task() -> None:
            try:
                title = await get_project_title(body.prompt)
                if title and isinstance(title, str):
                    await project.set({ProjectDoc.name: title})
                    await queue.put({"type": "project_name", "name": title})
            except Exception:
                pass

        title_future = asyncio.create_task(title_task()) if is_first else None

        async def stream_and_save(model) -> None:
            stream_id = str(uuid.uuid4())
            result = await stream_one_candidate(
                api_key=api_key,
                model=model,
                stream_id=stream_id,
                system_prompt=system_prompt,
                user_message=user_message,
                queue=queue,
            )
            doc = CandidateDoc(
                version_id=str(version.id),
                model_id=result.model_id,
                model_label=result.model_label,
                files=result.files,
                raw_response=result.raw_response,
                error=result.error,
            )
            await doc.insert()
            await queue.put({
                "type": "candidate_done",
                "stream_id": stream_id,
                "id": str(doc.id),
                "version_id": str(version.id),
                "model_id": result.model_id,
                "model_label": result.model_label,
                "files": result.files,
                "raw_response": result.raw_response,
                "error": result.error,
                "execution": None,
                "evaluation": None,
                "selected": False,
                "created_at": doc.created_at.isoformat(),
            })

        # Stream all models in parallel
        await asyncio.gather(*[stream_and_save(m) for m in models], return_exceptions=True)

        # Ensure title_task completes before closing the stream so its event
        # is guaranteed to arrive before `done` if it hasn't fired yet.
        if title_future is not None:
            try:
                await asyncio.wait_for(title_future, timeout=15.0)
            except Exception:
                pass

        await queue.put({"type": "done", "version_id": str(version.id)})

    asyncio.create_task(producer())

    async def event_stream():
        yield f"data: {json.dumps({'type': 'version_created', 'version_id': str(version.id)})}\n\n"
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") == "done":
                break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
