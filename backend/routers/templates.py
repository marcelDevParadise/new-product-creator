"""Templates router — reusable attribute presets."""

from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from state import state

router = APIRouter(prefix="/api/templates", tags=["templates"])


class TemplateBody(BaseModel):
    name: str
    attributes: dict[str, str | int | bool]


class ApplyBody(BaseModel):
    artikelnummern: List[str]


@router.get("")
def list_templates():
    """Return all saved templates."""
    return {name: {"name": name, "attributes": attrs} for name, attrs in state.get_templates().items()}


@router.post("")
def create_template(body: TemplateBody):
    """Create or update a template."""
    if not body.name.strip():
        raise HTTPException(400, "Template-Name darf nicht leer sein.")
    state.set_template(body.name.strip(), body.attributes)
    return {"name": body.name.strip(), "attributes": body.attributes}


@router.put("/{name}")
def update_template(name: str, body: TemplateBody):
    """Update an existing template's attributes."""
    existing = state.get_template(name)
    if existing is None:
        raise HTTPException(404, "Template nicht gefunden")
    state.set_template(name, body.attributes)
    return {"name": name, "attributes": body.attributes}


@router.delete("/{name}")
def delete_template(name: str):
    if not state.remove_template(name):
        raise HTTPException(404, "Template nicht gefunden")
    return {"deleted": True}


@router.post("/{name}/apply")
def apply_template(name: str, body: ApplyBody):
    """Apply a template's attributes to the given products."""
    template = state.get_template(name)
    if template is None:
        raise HTTPException(404, "Template nicht gefunden")

    # Filter out empty string values — only apply filled attributes
    filled = {k: v for k, v in template.items() if v != ""}
    if not filled:
        raise HTTPException(400, "Template enthält keine ausgefüllten Attribute.")

    updated = 0
    for sku in body.artikelnummern:
        product = state.get_product(sku)
        if product is None:
            continue
        for key, value in filled.items():
            if key in state.attribute_config:
                product.attributes[key] = value
        state.save_product_changes(product)
        updated += 1

    return {"updated": updated, "attributes_applied": len(filled)}
