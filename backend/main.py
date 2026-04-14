"""Attribut Generator — FastAPI Backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import products, attributes, export, templates, settings, stats, validation, categories

app = FastAPI(title="Attribut Generator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


@app.get("/api/health")
def health():
    return {"status": "ok"}
