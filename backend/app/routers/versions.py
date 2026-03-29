"""Version tree endpoints — selection and history."""
from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.db import CandidateDoc, ProjectDoc, VersionDoc
from app.models.domain import SelectCandidateRequest
from app.services.openrouter.client import get_comparison_overview

router = APIRouter(prefix="/versions", tags=["versions"])


async def _generate_comparison_overview_bg(candidate_id: str, version_id: str) -> None:
    """Background task: generate and cache the comparison overview for a selected candidate."""
    candidate = await CandidateDoc.get(PydanticObjectId(candidate_id))
    if not candidate or candidate.comparison_overview is not None:
        return

    candidate.overview_generating = True
    await candidate.save()

    try:
        siblings = await CandidateDoc.find(
            CandidateDoc.version_id == version_id,
        ).to_list()
        sibling_data = [
            {"model_label": s.model_label, "files": s.files}
            for s in siblings
            if str(s.id) != candidate_id
        ]

        version = await VersionDoc.get(PydanticObjectId(version_id))
        prompt = version.prompt if version else ""

        parent_files: dict | None = None
        if version and version.parent_id:
            parent_version = await VersionDoc.get(PydanticObjectId(version.parent_id))
            if parent_version and parent_version.files:
                parent_files = parent_version.files

        overview = await get_comparison_overview(
            prompt=prompt,
            candidate_files=candidate.files,
            candidate_model_label=candidate.model_label,
            sibling_candidates=sibling_data,
            parent_files=parent_files,
        )
        candidate.comparison_overview = overview
    except Exception:
        pass
    finally:
        candidate.overview_generating = False
        await candidate.save()


@router.post("/select")
async def select_candidate(body: SelectCandidateRequest, background_tasks: BackgroundTasks):
    """Mark a candidate as selected and advance project state."""
    project = await ProjectDoc.get(PydanticObjectId(body.project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    candidate = await CandidateDoc.get(PydanticObjectId(body.candidate_id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    version = await VersionDoc.get(PydanticObjectId(body.version_id))
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Mark candidate as selected, unmark siblings
    await CandidateDoc.find(CandidateDoc.version_id == body.version_id).update(
        {"$set": {"selected": False}}
    )
    candidate.selected = True
    await candidate.save()

    # Advance version state
    version.selected_candidate_id = body.candidate_id
    version.files = candidate.files
    await version.save()

    # Advance project current version
    project.current_version_id = body.version_id
    await project.save()

    # Kick off comparison overview generation if not already cached
    if candidate.comparison_overview is None and not candidate.overview_generating:
        background_tasks.add_task(
            _generate_comparison_overview_bg, body.candidate_id, body.version_id
        )

    return {"ok": True, "version_id": body.version_id}


@router.get("/{project_id}/tree")
async def get_version_tree(project_id: str):
    """Return all versions for a project (client builds the tree)."""
    versions = await VersionDoc.find(VersionDoc.project_id == project_id).to_list()
    return [
        {
            "id": str(v.id),
            "project_id": v.project_id,
            "parent_id": v.parent_id,
            "prompt": v.prompt,
            "selected_candidate_id": v.selected_candidate_id,
            "mode": v.mode,
            "depth": v.depth,
            "created_at": v.created_at.isoformat(),
        }
        for v in versions
    ]


@router.get("/{version_id}/candidates")
async def get_candidates(version_id: str):
    """Return all candidates for a version."""
    candidates = await CandidateDoc.find(
        CandidateDoc.version_id == version_id
    ).to_list()
    return [
        {
            "id": str(c.id),
            "version_id": c.version_id,
            "model_id": c.model_id,
            "model_label": c.model_label,
            "files": c.files,
            "raw_response": c.raw_response,
            "execution": c.execution,
            "evaluation": c.evaluation,
            "selected": c.selected,
            "error": c.error,
            "created_at": c.created_at.isoformat(),
        }
        for c in candidates
    ]
