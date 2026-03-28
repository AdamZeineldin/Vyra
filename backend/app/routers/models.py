"""Available models endpoint."""
from fastapi import APIRouter
from app.services.openrouter.models import AVAILABLE_MODELS, DEFAULT_MODELS

router = APIRouter(prefix="/models", tags=["models"])


@router.get("/")
async def list_models():
    return [m.model_dump() for m in AVAILABLE_MODELS]


@router.get("/defaults")
async def get_default_models():
    return [m.model_dump() for m in DEFAULT_MODELS]
