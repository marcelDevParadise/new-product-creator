"""Attributes router — config, definitions CRUD, and per-product attribute management."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel as PydanticBaseModel

from state import state
from models.attribute import (
    AttributeDefinition,
    AttributeDefinitionCreate,
    AttributeDefinitionUpdate,
    AttributeUpdate,
    BulkAttributeUpdate,
)

router = APIRouter(prefix="/api/attributes", tags=["attributes"])


class ReorderRequest(PydanticBaseModel):
    ordered_keys: list[str]


# --- Attribute definitions CRUD ---

@router.get("/config")
def get_attribute_config():
    """Return the full attribute configuration."""
    config = {}
    for key, attr_def in state.attribute_config.items():
        config[key] = attr_def.model_dump()
    return config


@router.get("/categories")
def get_categories():
    """Return a list of unique attribute categories."""
    categories: list[str] = []
    seen: set[str] = set()
    for attr_def in state.attribute_config.values():
        if attr_def.category not in seen:
            seen.add(attr_def.category)
            categories.append(attr_def.category)
    return categories


@router.post("/definitions")
def create_attribute_definition(body: AttributeDefinitionCreate):
    """Create a new attribute definition."""
    if body.key in state.attribute_config:
        raise HTTPException(409, f"Attribut '{body.key}' existiert bereits")

    attr = AttributeDefinition(
        id=body.id,
        category=body.category,
        name=body.name,
        description=body.description,
        required=body.required,
        required_for_types=body.required_for_types,
        default_value=body.default_value,
        suggested_values=body.suggested_values,
        smart_defaults=body.smart_defaults,
    )
    state.add_attribute_definition(body.key, attr)
    return {"key": body.key, **attr.model_dump()}


@router.put("/definitions/{key}")
def update_attribute_definition(key: str, body: AttributeDefinitionUpdate):
    """Update an existing attribute definition."""
    existing = state.attribute_config.get(key)
    if existing is None:
        raise HTTPException(404, f"Attribut '{key}' nicht gefunden")

    data = existing.model_dump()
    for field, value in body.model_dump(exclude_none=True).items():
        data[field] = value if not isinstance(value, list) else value

    updated = AttributeDefinition(**data)
    state.update_attribute_definition(key, updated)
    return {"key": key, **updated.model_dump()}


@router.delete("/definitions/{key}")
def delete_attribute_definition(key: str):
    """Delete an attribute definition."""
    if not state.remove_attribute_definition(key):
        raise HTTPException(404, f"Attribut '{key}' nicht gefunden")
    return {"deleted": True}


@router.put("/definitions/reorder")
def reorder_attribute_definitions(body: ReorderRequest):
    """Reorder attribute definitions by providing ordered keys."""
    from services.database import save_attribute_definition as db_save
    for idx, key in enumerate(body.ordered_keys):
        attr = state.attribute_config.get(key)
        if attr:
            db_save(key, attr, sort_order=idx)
    # Reload config with new order
    from services.database import load_all_attribute_definitions
    state.attribute_config = load_all_attribute_definitions()
    return {"reordered": len(body.ordered_keys)}


# --- Per-product attribute management ---

@router.put("/products/bulk")
def bulk_update_attributes(body: BulkAttributeUpdate):
    """Apply the same attributes to multiple products at once."""
    updated = []
    for sku in body.artikelnummern:
        product = state.get_product(sku)
        if product is None:
            continue
        for key, value in body.attributes.items():
            product.attributes[key] = value
        state.save_product_changes(product)
        updated.append(product)
    return {"updated": len(updated)}


@router.post("/products/{artikelnummer}/smart-defaults")
def apply_smart_defaults(artikelnummer: str):
    """Auto-fill attributes based on smart_defaults matching the product title."""
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, "Produkt nicht gefunden")

    title_lower = product.artikelname.lower()
    applied = 0
    for key, attr_def in state.attribute_config.items():
        if key in product.attributes:
            continue  # don't overwrite existing
        for sd in attr_def.smart_defaults:
            if sd.title_contains.lower() in title_lower:
                product.attributes[key] = sd.value
                applied += 1
                break
        else:
            # If no smart default matched, apply default_value if present and not already set
            if attr_def.default_value and key not in product.attributes:
                product.attributes[key] = attr_def.default_value
                applied += 1

    if applied:
        state.save_product_changes(product)
    return {"applied": applied, "product": product}


@router.put("/products/{artikelnummer}")
def update_attributes(artikelnummer: str, body: AttributeUpdate):
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, "Produkt nicht gefunden")

    product.attributes = dict(body.attributes)

    state.save_product_changes(product)
    return product


@router.delete("/products/{artikelnummer}/{attr_key}")
def delete_attribute(artikelnummer: str, attr_key: str):
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, "Produkt nicht gefunden")

    if attr_key in product.attributes:
        del product.attributes[attr_key]

    state.save_product_changes(product)
    return product
