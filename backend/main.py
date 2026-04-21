"""Attribut Generator — FastAPI Backend."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import products, attributes, export, templates, settings, stats, validation, categories, variants, bundles, warnings, ingredients
from state import state


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: reload state from DB so hot-reloads pick up latest data
    state.reload_from_db()
    yield


app = FastAPI(title="Attribut Generator", version="1.0.0", lifespan=lifespan)

# CORS_ORIGINS: kommaseparierte Liste von Origins, oder "*" für alle.
# Default deckt lokale Entwicklung ab; auf dem Pi via .env überschreiben.
_cors_env = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").strip()
if _cors_env == "*":
    cors_origins = ["*"]
else:
    cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(attributes.router)
app.include_router(export.router)
app.include_router(templates.router)
app.include_router(settings.router)
app.include_router(stats.router)
app.include_router(validation.router)
app.include_router(categories.router)
app.include_router(variants.router)
app.include_router(bundles.router)
app.include_router(warnings.router)
app.include_router(ingredients.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/reload")
def reload_state():
    """Re-read all data from the SQLite database into memory."""
    state.reload_from_db()
    return {
        "reloaded": True,
        "products": len(state.products),
        "attributes": len(state.attribute_config),
        "templates": len(state.templates),
    }
