"""Attributes router — config, definitions CRUD, and per-product attribute management."""

import json
import csv
import io
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel as PydanticBaseModel

from state import state
from models.attribute import (
    AttributeDefinition,
    AttributeDefinitionCreate,
    AttributeDefinitionUpdate,
    AttributeUpdate,
    BulkAttributeUpdate,
)
from services.database import log_activity, log_product_history, log_product_history_batch

router = APIRouter(prefix="/api/attributes", tags=["attributes"])


class ReorderRequest(PydanticBaseModel):
    ordered_keys: list[str]


class AttributeResetRequest(PydanticBaseModel):
    confirm: bool = False


class AttributeImportWarning(PydanticBaseModel):
    row: int
    field: str
    message: str


REQUIRED_IMPORT_COLUMNS = {"key", "id", "category", "name"}
IMPORT_COLUMN_ALIASES = {
    "key": {"key", "attribute_key", "attribut_key"},
    "id": {"id", "metafield_id", "funktionsattribut_id"},
    "category": {"category", "kategorie"},
    "name": {"name", "anzeigename", "attributname"},
    "description": {"description", "beschreibung"},
    "required": {"required", "pflicht", "pflichtfeld"},
    "required_for_types": {"required_for_types", "pflicht_fuer_typen", "pflichttypen"},
    "default_value": {"default_value", "standardwert"},
    "suggested_values": {"suggested_values", "vorgeschlagene_werte", "werte"},
    "smart_defaults": {"smart_defaults", "intelligente_standardwerte", "titelregeln"},
}


def _normalize_import_header(header: str) -> str:
    normalized = header.strip().lower().replace(" ", "_").replace("-", "_")
    for canonical, aliases in IMPORT_COLUMN_ALIASES.items():
        if normalized in aliases:
            return canonical
    return normalized


def _parse_required(value: str, row_idx: int, warnings: list[AttributeImportWarning]) -> bool:
    normalized = value.strip().lower()
    if normalized in {"", "0", "false", "nein", "no", "n"}:
        return False
    if normalized in {"1", "true", "ja", "yes", "y", "x", "pflicht"}:
        return True
    warnings.append(AttributeImportWarning(
        row=row_idx,
        field="required",
        message=f"Ungültiger Pflichtfeld-Wert '{value}' wurde als false importiert.",
    ))
    return False


def _parse_suggested_values(value: str) -> list[str]:
    if not value.strip():
        return []
    return [item.strip() for item in value.replace("\n", "|").split("|") if item.strip()]


def _parse_smart_defaults(
    value: str,
    row_idx: int,
    warnings: list[AttributeImportWarning],
) -> list[dict[str, str]]:
    """Parse smart defaults from JSON or readable ``Titel=>Wert|...`` syntax."""
    raw = value.strip()
    if not raw:
        return []

    if raw.startswith("["):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list) and all(
            isinstance(item, dict)
            and str(item.get("title_contains", "")).strip()
            and str(item.get("value", "")).strip()
            for item in parsed
        ):
            return [
                {
                    "title_contains": str(item["title_contains"]).strip(),
                    "value": str(item["value"]).strip(),
                }
                for item in parsed
            ]
        warnings.append(AttributeImportWarning(
            row=row_idx,
            field="smart_defaults",
            message="Smart Defaults konnten nicht als JSON-Liste gelesen werden.",
        ))
        return []

    result: list[dict[str, str]] = []
    for item in raw.replace("\n", "|").split("|"):
        item = item.strip()
        if not item:
            continue
        if "=>" not in item:
            warnings.append(AttributeImportWarning(
                row=row_idx,
                field="smart_defaults",
                message=f"Titelregel '{item}' wurde uebersprungen. Erwartet wird Titel=>Wert.",
            ))
            continue
        title_contains, default_value = (part.strip() for part in item.split("=>", 1))
        if not title_contains or not default_value:
            warnings.append(AttributeImportWarning(
                row=row_idx,
                field="smart_defaults",
                message=f"Unvollstaendige Titelregel '{item}' wurde uebersprungen.",
            ))
            continue
        result.append({"title_contains": title_contains, "value": default_value})
    return result


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


@router.get("/export")
def export_attributes_json():
    """Export all attribute definitions grouped by category as a JSON download."""
    grouped: dict[str, list[dict]] = {}
    category_order: list[str] = []
    for key, attr_def in state.attribute_config.items():
        cat = attr_def.category
        if cat not in grouped:
            grouped[cat] = []
            category_order.append(cat)
        entry = attr_def.model_dump()
        entry["key"] = key
        grouped[cat].append(entry)

    payload = {
        "exported_at": datetime.now().isoformat(timespec="seconds"),
        "total_attributes": len(state.attribute_config),
        "total_categories": len(category_order),
        "categories": [
            {
                "name": cat,
                "count": len(grouped[cat]),
                "attributes": grouped[cat],
            }
            for cat in category_order
        ],
    }

    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    filename = f"attribute-export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=content,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/definitions/import/template")
def download_attribute_import_template():
    """Download a UTF-8 CSV template for bulk importing attribute definitions."""
    columns = [
        "key", "id", "category", "name", "description", "required",
        "required_for_types", "default_value", "suggested_values", "smart_defaults",
    ]
    examples = [
        [
            "meta_material",
            "meta_material:custom:single_line_text_field",
            "Material",
            "Material",
            "Material oder Materialmix des Produkts",
            "true",
            "",
            "",
            "Baumwolle|Polyester|Silikon",
            "",
        ],
        [
            "meta_color",
            "meta_color:custom:single_line_text_field",
            "Optik",
            "Farbe",
            "Hauptfarbe des Produkts",
            "false",
            "",
            "",
            "Schwarz|Weiß|Rot|Blau",
            "XL=>Schwarz|White Edition=>Weiß",
        ],
    ]

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    writer.writerow(columns)
    writer.writerows(examples)
    content = output.getvalue().encode("utf-8-sig")

    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=attribute-import-beispiel.csv"},
    )


@router.post("/definitions/import")
async def import_attribute_definitions(file: UploadFile):
    """Bulk import attribute definitions from a semicolon-separated UTF-8 CSV."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Nur CSV-Dateien sind erlaubt.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, "CSV muss UTF-8 codiert sein.")

    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    if reader.fieldnames is None:
        raise HTTPException(400, "CSV enthält keine Header-Zeile.")

    normalized_fieldnames = [_normalize_import_header(field) for field in reader.fieldnames]
    missing = REQUIRED_IMPORT_COLUMNS - set(normalized_fieldnames)
    if missing:
        raise HTTPException(400, f"Fehlende Spalten: {', '.join(sorted(missing))}")

    warnings: list[AttributeImportWarning] = []
    created = 0
    updated = 0
    skipped = 0
    imported_keys: set[str] = set()

    for row_idx, row in enumerate(reader, start=2):
        normalized_row: dict[str, str] = {}
        for key, value in row.items():
            if key is None:
                continue
            normalized_row[_normalize_import_header(key)] = value.strip() if isinstance(value, str) else ""

        key = normalized_row.get("key", "")

        if not key:
            skipped += 1
            warnings.append(AttributeImportWarning(
                row=row_idx,
                field="key",
                message="Zeile übersprungen: key fehlt.",
            ))
            continue

        if key in imported_keys:
            skipped += 1
            warnings.append(AttributeImportWarning(
                row=row_idx,
                field="key",
                message=f"Zeile übersprungen: key '{key}' ist in dieser Datei doppelt.",
            ))
            continue

        missing_values = [column for column in REQUIRED_IMPORT_COLUMNS if not normalized_row.get(column)]
        if missing_values:
            skipped += 1
            warnings.append(AttributeImportWarning(
                row=row_idx,
                field=", ".join(missing_values),
                message=f"Zeile übersprungen: Pflichtwerte fehlen ({', '.join(missing_values)}).",
            ))
            continue

        existing = state.attribute_config.get(key)
        data = existing.model_dump() if existing else {
            "description": "",
            "required": False,
            "required_for_types": [],
            "default_value": None,
            "suggested_values": [],
            "smart_defaults": [],
        }

        data.update({
            "id": normalized_row["id"],
            "category": normalized_row["category"],
            "name": normalized_row["name"],
        })

        present_columns = set(normalized_fieldnames)
        if "description" in present_columns:
            data["description"] = normalized_row.get("description", "")
        if "required" in present_columns:
            data["required"] = _parse_required(normalized_row.get("required", ""), row_idx, warnings)
        if "required_for_types" in present_columns:
            data["required_for_types"] = _parse_suggested_values(
                normalized_row.get("required_for_types", "")
            )
        if "default_value" in present_columns:
            default_value = normalized_row.get("default_value", "")
            data["default_value"] = default_value or None
        if "suggested_values" in present_columns:
            data["suggested_values"] = _parse_suggested_values(normalized_row.get("suggested_values", ""))
        if "smart_defaults" in present_columns:
            data["smart_defaults"] = _parse_smart_defaults(
                normalized_row.get("smart_defaults", ""), row_idx, warnings
            )

        attr = AttributeDefinition(**data)
        if existing:
            state.update_attribute_definition(key, attr)
            updated += 1
        else:
            state.add_attribute_definition(key, attr)
            created += 1
        imported_keys.add(key)

    imported = created + updated
    if imported:
        log_activity("attribute_import", f"{imported} Attribute importiert", imported)

    return {
        "imported": imported,
        "total": len(state.attribute_config),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "warnings": [warning.model_dump() for warning in warnings],
    }


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


# NOTE: /definitions/reorder must be declared BEFORE /definitions/{key},
# otherwise FastAPI matches 'reorder' as a key parameter.
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


@router.post("/definitions/reset")
def reset_attribute_definitions(body: AttributeResetRequest):
    """Delete all definitions permanently while preserving assigned values."""
    if not body.confirm:
        raise HTTPException(400, "Zum Loeschen aller Attribute muss confirm=true gesetzt sein.")
    deleted = state.clear_attribute_definitions()
    if deleted:
        log_activity("attribute_definitions_reset", f"{deleted} Attributdefinitionen geloescht", deleted)
    return {
        "deleted": deleted,
        "total": len(state.attribute_config),
        "product_values_preserved": True,
        "template_values_preserved": True,
    }


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


# --- Per-product attribute management ---

@router.post("/products/bulk")
def bulk_update_attributes(body: BulkAttributeUpdate):
    """Apply the same attributes to multiple products at once."""
    updated = []
    all_history: list[tuple] = []
    for sku in body.artikelnummern:
        product = state.get_product(sku)
        if product is None:
            continue
        for key, value in body.attributes.items():
            old = product.attributes.get(key)
            if str(old) != str(value):
                all_history.append((sku, "bulk_attribute", key, str(old) if old is not None else None, str(value), None))
            product.attributes[key] = value
        state.save_product_changes(product)
        updated.append(product)
    if all_history:
        log_product_history_batch(all_history)
    return {"updated": len(updated)}


@router.post("/products/{artikelnummer}/smart-defaults")
def apply_smart_defaults(artikelnummer: str):
    """Auto-fill attributes based on smart_defaults matching the product title."""
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, f"Produkt '{artikelnummer}' nicht gefunden")

    title_lower = product.artikelname.lower()
    applied = 0
    history_entries: list[tuple] = []
    for key, attr_def in state.attribute_config.items():
        if key in product.attributes:
            continue  # don't overwrite existing
        for sd in attr_def.smart_defaults:
            if sd.title_contains.lower() in title_lower:
                product.attributes[key] = sd.value
                history_entries.append((artikelnummer, "smart_default", key, None, str(sd.value), None))
                applied += 1
                break
        else:
            # If no smart default matched, apply default_value if present and not already set
            if attr_def.default_value and key not in product.attributes:
                product.attributes[key] = attr_def.default_value
                history_entries.append((artikelnummer, "smart_default", key, None, str(attr_def.default_value), None))
                applied += 1

    if applied:
        state.save_product_changes(product)
        log_product_history_batch(history_entries)
    return {"applied": applied, "product": product}


@router.put("/products/{artikelnummer}")
def update_attributes(artikelnummer: str, body: AttributeUpdate):
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, f"Produkt '{artikelnummer}' nicht gefunden")

    old_attrs = dict(product.attributes)
    new_attrs = dict(body.attributes)
    history_entries: list[tuple] = []
    # Detect changed / added attributes
    for key, value in new_attrs.items():
        old = old_attrs.get(key)
        if str(old) != str(value):
            history_entries.append((artikelnummer, "attribute_update", key, str(old) if old is not None else None, str(value), None))
    # Detect removed attributes
    for key in old_attrs:
        if key not in new_attrs:
            history_entries.append((artikelnummer, "attribute_removed", key, str(old_attrs[key]), None, None))

    product.attributes = new_attrs
    state.save_product_changes(product)
    if history_entries:
        log_product_history_batch(history_entries)
    return product


@router.delete("/products/{artikelnummer}/{attr_key}")
def delete_attribute(artikelnummer: str, attr_key: str):
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, f"Produkt '{artikelnummer}' nicht gefunden")

    old_value = product.attributes.get(attr_key)
    if attr_key in product.attributes:
        del product.attributes[attr_key]
        log_product_history(artikelnummer, "attribute_removed", attr_key, str(old_value) if old_value is not None else None, None)

    state.save_product_changes(product)
    return product
