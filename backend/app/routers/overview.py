"""Overview endpoint — returns cached comparison overview for a selected candidate."""
from __future__ import annotations

from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException

from app.db import CandidateDoc

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("/candidate/{candidate_id}")
async def candidate_overview(candidate_id: str):
    candidate = await CandidateDoc.get(PydanticObjectId(candidate_id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.comparison_overview is not None:
        return {"overview": candidate.comparison_overview, "status": "ready"}

    if candidate.overview_generating:
        return {"overview": None, "status": "generating"}

    return {"overview": None, "status": "not_started"}
