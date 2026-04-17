"""Validation router — data quality checks."""

from fastapi import APIRouter

from state import state
from services.validation import validate_all_products, compute_quality_stats

router = APIRouter(prefix="/api/validation", tags=["validation"])


@router.get("")
def get_validation_results(severity: str | None = None):
    """Run all validation rules on active products.

    Optional query param `severity` to filter: 'error', 'warning', 'ok'.
    """
    products = state.get_active_products()
    results = validate_all_products(products, state.attribute_config)
    stats = compute_quality_stats(results)

    if severity:
        results = [r for r in results if r["severity"] == severity]

    return {"stats": stats, "products": results}


_HEATMAP_FIELDS = [
    ("artikelname", "Artikelname"),
    ("ek", "EK-Preis"),
    ("preis", "VK-Preis"),
    ("gewicht", "Gewicht"),
    ("hersteller", "Hersteller"),
    ("ean", "EAN"),
    ("bild_1", "Bild 1"),
    ("kurzbeschreibung", "Kurzbeschreibung"),
    ("beschreibung", "Beschreibung"),
    ("url_pfad", "URL-Pfad"),
    ("title_tag", "Title Tag"),
    ("meta_description", "Meta-Description"),
    ("kategorie_1", "Kategorie 1"),
    ("lieferant_name", "Lieferant"),
]


@router.get("/heatmap")
def get_heatmap():
    """Return completeness heatmap data for active products."""
    active = state.get_active_products()
    total = len(active)

    # Field stats
    field_stats = []
    for field, label in _HEATMAP_FIELDS:
        filled = 0
        for p in active:
            val = getattr(p, field, None)
            if val is not None and str(val).strip() and val != 0:
                filled += 1
        field_stats.append({
            "field": field,
            "label": label,
            "filled_count": filled,
            "total": total,
            "percent": round(filled / total * 100, 1) if total else 0,
        })

    # Per-product stats (first 100)
    products = []
    for p in active[:100]:
        fields = {}
        filled_count = 0
        for field, _ in _HEATMAP_FIELDS:
            val = getattr(p, field, None)
            ok = val is not None and str(val).strip() and val != 0
            fields[field] = ok
            if ok:
                filled_count += 1
        products.append({
            "artikelnummer": p.artikelnummer,
            "artikelname": p.artikelname,
            "filled_count": filled_count,
            "total_fields": len(_HEATMAP_FIELDS),
            "fields": fields,
        })

    products.sort(key=lambda x: x["filled_count"])

    return {
        "field_stats": field_stats,
        "products": products,
        "total_products": total,
    }


@router.get("/{artikelnummer}")
def get_product_validation(artikelnummer: str):
    """Validate a single product."""
    product = state.get_product(artikelnummer)
    if product is None:
        from fastapi import HTTPException
        raise HTTPException(404, "Produkt nicht gefunden")

    products = list(state.products.values())
    results = validate_all_products([product], state.attribute_config)
    return results[0] if results else {}
