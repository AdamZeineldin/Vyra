"""Overview endpoint — generates a plain-English AI summary of a candidate's code."""
from __future__ import annotations

from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException

from app.db import CandidateDoc
from app.services.openrouter.client import get_code_overview

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("/candidate/{candidate_id}")
async def candidate_overview(candidate_id: str):
    candidate = await CandidateDoc.get(PydanticObjectId(candidate_id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not candidate.files:
        raise HTTPException(status_code=400, detail="Candidate has no files to review")

    try:
        overview = await get_code_overview(candidate.files)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"overview": overview}
