"""FastAPI application entry point."""
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv, find_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import execute, generate, models, overview, projects, versions

load_dotenv(find_dotenv(usecwd=True))


@asynccontextmanager
async def lifespan(app: FastAPI):
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/yhack")
    await init_db(mongodb_uri)
    yield


app = FastAPI(title="YHack Iterative Coder API", version="0.1.0", lifespan=lifespan)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_extra = [o.strip() for o in _raw_origins.split(",") if o.strip()]
_origins = list({
    os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
    *_extra,
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(generate.router)
app.include_router(versions.router)
app.include_router(models.router)
app.include_router(execute.router)
app.include_router(overview.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
