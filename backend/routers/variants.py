"""Variants router — parent/child product grouping and auto-suggest."""

import re
from collections import defaultdict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from state import state
from models.product import Product
from services.database import log_activity
from routers.settings import get_varianten_settings

router = APIRouter(prefix="/api/variants", tags=["variants"])


# --- Request models ---

class CreateGroupRequest(BaseModel):
    parent_sku: str
    child_skus: list[str]
    variant_attributes: dict[str, dict[str, str]] = {}


class AddChildRequest(BaseModel):
    sku: str
    variant_attributes: dict[str, str] = {}


class UpdateChildRequest(BaseModel):
    variant_attributes: dict[str, str]


# --- Helpers ---

def _validate_not_child(sku: str, label: str = "Produkt") -> None:
    """Raise 409 if the product is already a child in another group."""
    product = state.get_product(sku)
    if product and product.parent_sku:
        raise HTTPException(
            status_code=409,
            detail=f"{label} '{sku}' ist bereits Variante von '{product.parent_sku}'",
        )


# --- Group CRUD ---

@router.post("/groups", status_code=201)
def create_group(body: CreateGroupRequest):
    parent = state.get_product(body.parent_sku)
    if not parent:
        raise HTTPException(404, f"Parent-Produkt '{body.parent_sku}' nicht gefunden")

    # Parent must not be a child itself
    if parent.parent_sku:
        raise HTTPException(
            409,
            f"'{body.parent_sku}' ist bereits Variante von '{parent.parent_sku}' und kann nicht Parent sein",
        )

    # Validate children
    children = []
    for sku in body.child_skus:
        if sku == body.parent_sku:
            continue  # skip if parent is in child list
        child = state.get_product(sku)
        if not child:
            raise HTTPException(404, f"Kind-Produkt '{sku}' nicht gefunden")
        if child.parent_sku and child.parent_sku != body.parent_sku:
            raise HTTPException(
                409,
                f"'{sku}' ist bereits Variante von '{child.parent_sku}'",
            )
        if child.is_parent:
            raise HTTPException(
                409,
                f"'{sku}' ist selbst ein Parent-Produkt und kann nicht Kind sein",
            )
        children.append(child)

    # Set parent flag
    parent.is_parent = True
    state.save_product_changes(parent)

    # Set children
    for child in children:
        child.parent_sku = body.parent_sku
        child.variant_attributes = body.variant_attributes.get(child.artikelnummer, {})
        state.save_product_changes(child)

    log_activity(
        "variant_group_created",
        f"Gruppe '{body.parent_sku}' mit {len(children)} Varianten erstellt",
        len(children),
    )

    return {
        "parent_sku": body.parent_sku,
        "children": len(children),
    }


@router.get("/groups")
def list_groups():
    """Return all variant groups."""
    parents = [p for p in state.products.values() if p.is_parent]
    settings = get_varianten_settings()
    groups = []
    for parent in parents:
        children = state.get_variants(parent.artikelnummer)
        # Collect which axes are used across children
        axes: set[str] = set()
        for c in children:
            axes.update(c.variant_attributes.keys())
        groups.append({
            "parent": parent.model_dump(),
            "children": [c.model_dump() for c in children],
            "variant_axes": sorted(axes),
        })
    return groups


@router.get("/groups/{parent_sku}")
def get_group(parent_sku: str):
    parent = state.get_product(parent_sku)
    if not parent or not parent.is_parent:
        raise HTTPException(404, f"Varianten-Gruppe '{parent_sku}' nicht gefunden")
    children = state.get_variants(parent_sku)
    axes: set[str] = set()
    for c in children:
        axes.update(c.variant_attributes.keys())
    return {
        "parent": parent.model_dump(),
        "children": [c.model_dump() for c in children],
        "variant_axes": sorted(axes),
    }


@router.delete("/groups/{parent_sku}")
def delete_group(parent_sku: str):
    """Dissolve a variant group — reset parent/child flags."""
    parent = state.get_product(parent_sku)
    if not parent or not parent.is_parent:
        raise HTTPException(404, f"Varianten-Gruppe '{parent_sku}' nicht gefunden")
    children = state.get_variants(parent_sku)
    for child in children:
        child.parent_sku = None
        child.variant_attributes = {}
        state.save_product_changes(child)
    parent.is_parent = False
    state.save_product_changes(parent)
    log_activity(
        "variant_group_deleted",
        f"Gruppe '{parent_sku}' aufgelöst ({len(children)} Varianten)",
        len(children),
    )
    return {"dissolved": True, "children_released": len(children)}


@router.post("/groups/{parent_sku}/children")
def add_child(parent_sku: str, body: AddChildRequest):
    parent = state.get_product(parent_sku)
    if not parent or not parent.is_parent:
        raise HTTPException(404, f"Varianten-Gruppe '{parent_sku}' nicht gefunden")

    child = state.get_product(body.sku)
    if not child:
        raise HTTPException(404, f"Produkt '{body.sku}' nicht gefunden")
    if child.parent_sku and child.parent_sku != parent_sku:
        raise HTTPException(409, f"'{body.sku}' ist bereits Variante von '{child.parent_sku}'")
    if child.is_parent:
        raise HTTPException(409, f"'{body.sku}' ist selbst ein Parent-Produkt")

    child.parent_sku = parent_sku
    child.variant_attributes = body.variant_attributes
    state.save_product_changes(child)
    return {"added": True, "sku": body.sku}


@router.delete("/groups/{parent_sku}/children/{child_sku}")
def remove_child(parent_sku: str, child_sku: str):
    child = state.get_product(child_sku)
    if not child or child.parent_sku != parent_sku:
        raise HTTPException(404, f"'{child_sku}' ist keine Variante von '{parent_sku}'")
    child.parent_sku = None
    child.variant_attributes = {}
    state.save_product_changes(child)

    # If no children left, also clear parent flag
    remaining = state.get_variants(parent_sku)
    if not remaining:
        parent = state.get_product(parent_sku)
        if parent:
            parent.is_parent = False
            state.save_product_changes(parent)

    return {"removed": True, "sku": child_sku}


@router.patch("/groups/{parent_sku}/children/{child_sku}")
def update_child(parent_sku: str, child_sku: str, body: UpdateChildRequest):
    child = state.get_product(child_sku)
    if not child or child.parent_sku != parent_sku:
        raise HTTPException(404, f"'{child_sku}' ist keine Variante von '{parent_sku}'")
    child.variant_attributes = body.variant_attributes
    state.save_product_changes(child)
    return {"updated": True, "sku": child_sku}


# --- Resolved product (inheritance) ---

@router.get("/resolved/{sku}")
def get_resolved_product(sku: str):
    """Return product with inherited parent fields filled in + which fields were inherited."""
    product = state.get_product(sku)
    if not product:
        raise HTTPException(404, f"Produkt '{sku}' nicht gefunden")
    if not product.parent_sku:
        return {"product": product.model_dump(), "inherited_fields": []}

    settings = get_varianten_settings()
    inherit_fields = settings.get("inherit_fields", [])
    resolved = state.resolve_product(product, inherit_fields)

    # Determine which fields were actually inherited (own was empty, parent had value)
    inherited: list[str] = []
    original = product.model_dump()
    resolved_data = resolved.model_dump()
    for field in inherit_fields:
        own_val = original.get(field)
        resolved_val = resolved_data.get(field)
        if (own_val is None or own_val == "") and resolved_val is not None and resolved_val != "":
            inherited.append(field)

    return {"product": resolved_data, "inherited_fields": inherited}


# --- Diff (parent vs children) ---

@router.get("/groups/{parent_sku}/diff")
def get_group_diff(parent_sku: str):
    """Return field differences between parent and each child for inherit_fields."""
    parent = state.get_product(parent_sku)
    if not parent or not parent.is_parent:
        raise HTTPException(404, f"Varianten-Gruppe '{parent_sku}' nicht gefunden")

    settings = get_varianten_settings()
    inherit_fields = settings.get("inherit_fields", [])
    children = state.get_variants(parent_sku)
    parent_data = parent.model_dump()

    diff: dict[str, dict[str, dict[str, str | None]]] = {}
    for child in children:
        child_data = child.model_dump()
        child_diff: dict[str, dict[str, str | None]] = {}
        for field in inherit_fields:
            parent_val = parent_data.get(field)
            child_val = child_data.get(field)
            # Only report when child has its own non-empty value that differs from parent
            if child_val is not None and child_val != "":
                p_str = str(parent_val) if parent_val is not None else ""
                c_str = str(child_val)
                if p_str != c_str:
                    child_diff[field] = {
                        "parent_value": parent_val,
                        "child_value": child_val,
                    }
        if child_diff:
            diff[child.artikelnummer] = child_diff

    return diff


# --- Create new child product ---

class CreateChildRequest(BaseModel):
    variant_attributes: dict[str, str] = {}
    artikelname: str | None = None


@router.post("/groups/{parent_sku}/children/create", status_code=201)
def create_variant_child(parent_sku: str, body: CreateChildRequest):
    """Create a brand-new product as a child of the given parent, inheriting fields."""
    parent = state.get_product(parent_sku)
    if not parent or not parent.is_parent:
        raise HTTPException(404, f"Varianten-Gruppe '{parent_sku}' nicht gefunden")

    # Generate next SKU
    import re as _re
    max_num = 0
    for sku in state.products:
        m = _re.match(r'^CYL-(\d+)$', sku, _re.IGNORECASE)
        if m:
            num = int(m.group(1))
            if num > max_num:
                max_num = num
    new_sku = f"CYL-{max_num + 1:05d}"

    # Build child from parent's inheritable fields
    settings = get_varianten_settings()
    inherit_fields = settings.get("inherit_fields", [])
    parent_data = parent.model_dump()

    child_data: dict = {
        "artikelnummer": new_sku,
        "artikelname": body.artikelname or parent.artikelname,
        "parent_sku": parent_sku,
        "is_parent": False,
        "variant_attributes": body.variant_attributes,
    }
    # Copy inheritable fields from parent
    for field in inherit_fields:
        val = parent_data.get(field)
        if val is not None and val != "":
            child_data[field] = val

    new_product = Product(**child_data)
    state.add_product(new_product)

    log_activity(
        "variant_child_created",
        f"Variante '{new_sku}' unter '{parent_sku}' erstellt",
        1,
    )

    return new_product.model_dump()


# --- Auto-Suggest ---

# Common size/quantity patterns to strip from names
_SUFFIX_RE = re.compile(
    r"\s*[-–]\s*"
    r"(\d+\s*(ml|l|g|kg|cm|mm|m|oz|stk|stück|pcs|er[\s-]*(pack|set))"
    r"|small|medium|large|xl|xxl|s|m|l"
    r"|schwarz|weiß|rot|blau|grün|gelb|rosa|pink|lila|natur|transparent"
    r")\s*$",
    re.IGNORECASE,
)


@router.get("/suggest")
def suggest_groups():
    """Suggest variant groupings based on product name similarity."""
    products = state.get_active_products()
    if len(products) < 2:
        return []

    # Group candidates by a normalised base name
    buckets: dict[str, list[str]] = defaultdict(list)
    for p in products:
        if p.is_parent or p.parent_sku:
            continue  # already grouped
        base = _SUFFIX_RE.sub("", p.artikelname).strip()
        if base:
            buckets[base.lower()].append(p.artikelnummer)

    suggestions = []
    for base_name, skus in buckets.items():
        if len(skus) < 2:
            continue
        # Find full names to determine differences
        members = [state.get_product(s) for s in skus if state.get_product(s)]
        differences = []
        for m in members:
            diff = m.artikelname
            base_cleaned = _SUFFIX_RE.sub("", m.artikelname).strip()
            remainder = m.artikelname[len(base_cleaned):].strip(" -–")
            if remainder:
                differences.append(remainder)
            else:
                differences.append(m.artikelnummer)
        suggestions.append({
            "suggested_parent": skus[0],
            "members": skus,
            "common_name": _SUFFIX_RE.sub("", members[0].artikelname).strip() if members else base_name,
            "differences": differences,
        })

    # Sort by group size descending
    suggestions.sort(key=lambda s: len(s["members"]), reverse=True)
    return suggestions
