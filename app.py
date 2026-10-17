"""Vercel entrypoint: one origin for the React UI and FastAPI API."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from backend.app.main import app as api


@asynccontextmanager
async def lifespan(application):
    # Mounted sub-applications do not receive lifespan events automatically.
    async with api.router.lifespan_context(api):
        yield


app = FastAPI(title="IssueFlow", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", api)
app.frontend("/", directory="frontend/dist", fallback="index.html")
