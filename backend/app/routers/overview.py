"""Overview endpoints — cached comparison overview for selected candidate + cross-candidate compare."""
from __future__ import annotations

import logging

from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from app.db import CandidateDoc
from app.services.openrouter.client import get_comparative_overview

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("/candidate/{candidate_id}")
async def candidate_overview(candidate_id: str):
    """Return the cached comparison overview for a candidate, or its generation status."""
    candidate = await CandidateDoc.get(PydanticObjectId(candidate_id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.comparison_overview is not None:
        return {"overview": candidate.comparison_overview, "status": "ready"}

    if candidate.overview_generating:
        return {"overview": None, "status": "generating"}

    return {"overview": None, "status": "not_started"}


class CompareRequest(BaseModel):
    version_id: str


class CandidateRanking(BaseModel):
    candidate_id: str
    model_label: str
    total_score: float
    scores: dict[str, float]
    rank: int
    reasoning: str


@router.post("/compare")
async def compare_candidates(body: CompareRequest):
    """Generate a comparative AI analysis across all candidates in a version."""
    candidates = await CandidateDoc.find(
        CandidateDoc.version_id == body.version_id
    ).limit(50).to_list()

    if not candidates:
        raise HTTPException(status_code=404, detail="No candidates found")

    evaluated = [c for c in candidates if c.evaluation]
    if not evaluated:
        raise HTTPException(status_code=400, detail="No evaluated candidates to compare")

    candidates_data = []
    for c in evaluated:
        ev = c.evaluation
        exec_data = c.execution or {}

        if exec_data.get("timed_out"):
            exec_summary = "Timed out"
        elif exec_data.get("exit_code", -1) == 0:
            exec_summary = f"Passed (exit 0, {exec_data.get('duration_ms', 0)}ms)"
        elif exec_data:
            exec_summary = f"Failed (exit {exec_data.get('exit_code', '?')})"
        else:
            exec_summary = "Not executed"

        candidates_data.append({
            "candidate_id": str(c.id),
            "model_label": c.model_label,
            "total_score": ev.get("total_score", 0),
            "scores": ev.get("scores", {}),
            "reasoning": ev.get("reasoning", ""),
            "file_count": len(c.files),
            "execution_summary": exec_summary,
        })

    candidates_data.sort(key=lambda x: x["total_score"], reverse=True)

    from app.db import VersionDoc
    version = await VersionDoc.get(PydanticObjectId(body.version_id))
    prompt = version.prompt if version else "Unknown prompt"

    try:
        comparison_text = await get_comparative_overview(candidates_data, prompt)
    except ValueError as exc:
        logger.error("Comparative overview failed: %s", exc)
        comparison_text = "Comparison unavailable — evaluation scores are shown above."

    rankings = [
        CandidateRanking(
            candidate_id=c["candidate_id"],
            model_label=c["model_label"],
            total_score=c["total_score"],
            scores=c["scores"],
            rank=i + 1,
            reasoning=c["reasoning"],
        )
        for i, c in enumerate(candidates_data)
    ]

    return {
        "comparison": comparison_text,
        "rankings": [r.model_dump() for r in rankings],
    }
