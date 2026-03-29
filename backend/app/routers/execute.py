"""Execute candidate code in Docker sandbox."""
from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import CandidateDoc
from app.models.domain import FileEntry
from app.services.piston.sandbox import ExecutionRequest, classify_output_type, execute_in_sandbox
from app.services.evaluator.rubric import RubricInput, compute_confidence, pick_best_candidate, score_candidate

router = APIRouter(prefix="/execute", tags=["execute"])


class ExecuteRequest(BaseModel):
    candidate_id: str
    runtime: str = "node"
    stdin: str = ""


class EvaluateAllRequest(BaseModel):
    version_id: str
    prompt: str
    runtime: str = "node"
    prior_files: dict = {}


@router.post("/candidate")
async def execute_candidate(body: ExecuteRequest):
    """Execute a single candidate's code in Docker."""
    candidate = await CandidateDoc.get(PydanticObjectId(body.candidate_id))
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    files = {
        path: FileEntry(**entry) for path, entry in candidate.files.items()
    }

    req = ExecutionRequest(
        candidate_id=body.candidate_id,
        files=files,
        runtime=body.runtime,
        stdin=body.stdin,
    )
    result = await execute_in_sandbox(req)

    # Determine preview type
    output_type = classify_output_type(result.stdout, files)

    # Store result on candidate
    candidate.execution = result.model_dump()
    await candidate.save()

    return {
        "candidate_id": body.candidate_id,
        "execution": result.model_dump(),
        "output_type": output_type,
    }


@router.post("/evaluate-all")
async def evaluate_all(body: EvaluateAllRequest):
    """Run rubric evaluation across all candidates for a version."""
    from app.db import VersionDoc
    candidates = await CandidateDoc.find(
        CandidateDoc.version_id == body.version_id
    ).to_list()

    if not candidates:
        raise HTTPException(status_code=404, detail="No candidates found for version")

    prior_files = {
        path: FileEntry(**entry) for path, entry in body.prior_files.items()
    } if body.prior_files else {}

    evaluations = {}
    results = []

    for candidate in candidates:
        files = {path: FileEntry(**entry) for path, entry in candidate.files.items()}
        exec_result = candidate.execution or {}

        inp = RubricInput(
            files=files,
            prompt=body.prompt,
            prior_files=prior_files,
            execution_stdout=exec_result.get("stdout", ""),
            execution_exit_code=exec_result.get("exit_code", 0),
            execution_timed_out=exec_result.get("timed_out", False),
            execution_stderr=exec_result.get("stderr", ""),
        )
        evaluation = score_candidate(inp)
        evaluations[str(candidate.id)] = evaluation
        candidate.evaluation = evaluation.model_dump()
        await candidate.save()

    # Recompute confidence across all scores
    all_scores = [e.total_score for e in evaluations.values()]
    overall_confidence = compute_confidence(all_scores)

    # Update each candidate's confidence
    for cid, ev in evaluations.items():
        candidate_doc = await CandidateDoc.get(PydanticObjectId(cid))
        if candidate_doc and candidate_doc.evaluation:
            candidate_doc.evaluation["confidence"] = overall_confidence
            await candidate_doc.save()

    best_id = pick_best_candidate(evaluations)

    return {
        "version_id": body.version_id,
        "best_candidate_id": best_id,
        "confidence": overall_confidence,
        "evaluations": {
            cid: {
                "total_score": ev.total_score,
                "scores": ev.scores.model_dump(),
                "reasoning": ev.reasoning,
            }
            for cid, ev in evaluations.items()
        },
    }
