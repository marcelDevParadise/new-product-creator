"""Templates router — reusable attribute presets with category & description."""

from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from state import state
from services.database import log_activity, log_product_history_batch

router = APIRouter(prefix="/api/templates", tags=["templates"])


class TemplateBody(BaseModel):
    name: str
    attributes: dict[str, str | int | bool]
    category: str = ""
    description: str = ""


class TemplateUpdateBody(BaseModel):
    attributes: dict[str, str | int | bool]
    category: str = ""
    description: str = ""


class TemplateMetaBody(BaseModel):
    """Update only metadata (category/description) without touching attributes."""
    category: str | None = None
    description: str | None = None


class RenameBody(BaseModel):
    new_name: str


class CloneBody(BaseModel):
    new_name: str


class ApplyBody(BaseModel):
    artikelnummern: List[str]


def _serialize(name: str, tpl: dict) -> dict:
    return {
        "name": name,
        "attributes": tpl.get("attributes", {}),
        "category": tpl.get("category", ""),
        "description": tpl.get("description", ""),
    }


@router.get("")
def list_templates():
    """Return all saved templates (with category & description)."""
    return {name: _serialize(name, tpl) for name, tpl in state.get_templates().items()}


@router.get("/categories")
def list_categories():
    """Return sorted list of distinct non-empty template categories."""
    return state.get_template_categories()


@router.post("")
def create_template(body: TemplateBody):
    """Create or update a template."""
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Template-Name darf nicht leer sein.")
    is_new = name not in state.templates
    state.set_template(name, body.attributes, body.category.strip(), body.description.strip())
    if is_new:
        log_activity("template_created", name, 1)
    return _serialize(name, state.templates[name])


@router.put("/{name}")
def update_template(name: str, body: TemplateUpdateBody):
    """Update an existing template's attributes and metadata."""
    if name not in state.templates:
        raise HTTPException(404, "Template nicht gefunden")
    state.set_template(name, body.attributes, body.category.strip(), body.description.strip())
    return _serialize(name, state.templates[name])


@router.patch("/{name}")
def update_template_meta(name: str, body: TemplateMetaBody):
    """Update only category/description of a template without touching attributes."""
    existing = state.get_template(name)
    if existing is None:
        raise HTTPException(404, "Template nicht gefunden")
    category = body.category.strip() if body.category is not None else existing.get("category", "")
    description = body.description.strip() if body.description is not None else existing.get("description", "")
    state.set_template(name, existing.get("attributes", {}), category, description)
    return _serialize(name, state.templates[name])


@router.delete("/{name}")
def delete_template(name: str):
    if not state.remove_template(name):
        raise HTTPException(404, "Template nicht gefunden")
    log_activity("template_deleted", name, 1)
    return {"deleted": True}


@router.post("/{name}/rename")
def rename_template(name: str, body: RenameBody):
    """Rename a template."""
    if name not in state.templates:
        raise HTTPException(404, "Template nicht gefunden")
    new_name = body.new_name.strip()
    if not new_name:
        raise HTTPException(400, "Neuer Name darf nicht leer sein.")
    if new_name == name:
        return _serialize(name, state.templates[name])
    if new_name in state.templates:
        raise HTTPException(409, f'Template "{new_name}" existiert bereits.')
    if not state.rename_template(name, new_name):
        raise HTTPException(400, "Umbenennen fehlgeschlagen.")
    log_activity("template_renamed", f"{name} → {new_name}", 1)
    return _serialize(new_name, state.templates[new_name])


@router.post("/{name}/clone")
def clone_template(name: str, body: CloneBody):
    """Clone an existing template under a new name."""
    if name not in state.templates:
        raise HTTPException(404, "Template nicht gefunden")
    new_name = body.new_name.strip()
    if not new_name:
        raise HTTPException(400, "Neuer Name darf nicht leer sein.")
    if new_name in state.templates:
        raise HTTPException(409, f'Template "{new_name}" existiert bereits.')
    if not state.clone_template(name, new_name):
        raise HTTPException(400, "Klonen fehlgeschlagen.")
    log_activity("template_cloned", f"{name} → {new_name}", 1)
    return _serialize(new_name, state.templates[new_name])


@router.post("/{name}/apply")
def apply_template(name: str, body: ApplyBody):
    """Apply a template's attributes to the given products."""
    template = state.get_template(name)
    if template is None:
        raise HTTPException(404, "Template nicht gefunden")

    attributes = template.get("attributes", {})
    # Filter out empty string values — only apply filled attributes
    filled = {k: v for k, v in attributes.items() if v != ""}
    if not filled:
        raise HTTPException(400, "Template enthält keine ausgefüllten Attribute.")

    updated = 0
    all_history: list[tuple] = []
    for sku in body.artikelnummern:
        product = state.get_product(sku)
        if product is None:
            continue
        for key, value in filled.items():
            if key in state.attribute_config:
                old = product.attributes.get(key)
                if str(old) != str(value):
                    all_history.append((sku, "template_applied", key, str(old) if old is not None else None, str(value), name))
                product.attributes[key] = value
        state.save_product_changes(product)
        updated += 1

    if all_history:
        log_product_history_batch(all_history)

    return {"updated": updated, "attributes_applied": len(filled)}
