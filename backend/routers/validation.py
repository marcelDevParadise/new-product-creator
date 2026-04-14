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
