"""Project CRUD endpoints."""
from datetime import datetime

from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException, Query

from app.db import ProjectDoc
from app.models.domain import CreateProjectRequest, ModelConfig
from app.services.openrouter.models import DEFAULT_MODELS

router = APIRouter(prefix="/projects", tags=["projects"])


def _doc_to_dict(doc: ProjectDoc) -> dict:
    return {
        "id": str(doc.id),
        "name": doc.name,
        "description": doc.description,
        "runtime": doc.runtime,
        "models": doc.models,
        "root_version_id": doc.root_version_id,
        "current_version_id": doc.current_version_id,
        "created_at": doc.created_at.isoformat(),
        "updated_at": doc.updated_at.isoformat(),
    }


@router.get("/")
async def list_projects(user_id: str = Query(...)):
    docs = await ProjectDoc.find(ProjectDoc.user_id == user_id).to_list()
    return [_doc_to_dict(d) for d in docs]


@router.post("/", status_code=201)
async def create_project(body: CreateProjectRequest):
    doc = ProjectDoc(
        user_id=body.user_id,
        name=body.name,
        description=body.description,
        runtime=body.runtime,
        models=[m.model_dump() for m in DEFAULT_MODELS],
    )
    await doc.insert()
    return _doc_to_dict(doc)


@router.get("/{project_id}")
async def get_project(project_id: str, user_id: str = Query(...)):
    doc = await ProjectDoc.get(PydanticObjectId(project_id))
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return _doc_to_dict(doc)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, user_id: str = Query(...)):
    doc = await ProjectDoc.get(PydanticObjectId(project_id))
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    await doc.delete()
