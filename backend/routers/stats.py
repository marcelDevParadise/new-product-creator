"""Stats router — Dashboard statistics and global search."""

from fastapi import APIRouter

from state import state
from models.stats import DashboardStats, IncompleteProduct, ActivityLog
from services.database import get_recent_activities

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/search")
def global_search(q: str = "", limit: int = 20):
    """Search across products, attributes, and templates."""
    if not q or len(q) < 2:
        return {"products": [], "attributes": [], "templates": []}

    query = q.lower()

    # Search products
    product_results = []
    for p in state.get_active_products() + state.get_archived_products():
        if query in p.artikelnummer.lower() or query in p.artikelname.lower() or (p.ean and query in p.ean.lower()) or (p.hersteller and query in p.hersteller.lower()):
            product_results.append({
                "artikelnummer": p.artikelnummer,
                "artikelname": p.artikelname,
                "archived": p.exported,
            })
            if len(product_results) >= limit:
                break

    # Search attribute definitions
    attr_results = []
    for key, defn in state.attribute_config.items():
        if query in key.lower() or query in defn.name.lower() or query in defn.description.lower():
            attr_results.append({
                "key": key,
                "name": defn.name,
                "category": defn.category,
            })
            if len(attr_results) >= limit:
                break

    # Search templates
    template_results = []
    for name, tmpl in state.templates.items():
        if query in name.lower():
            template_results.append({
                "name": name,
                "attribute_count": len(tmpl.attributes),
            })
            if len(template_results) >= limit:
                break

    return {
        "products": product_results,
        "attributes": attr_results,
        "templates": template_results,
    }


@router.get("/activities")
def get_activities(limit: int = 50):
    """Return recent activities with configurable limit."""
    raw = get_recent_activities(limit)
    return [ActivityLog(**a) for a in raw]


@router.get("", response_model=DashboardStats)
def get_stats():
    active = state.get_active_products()
    archived = state.get_archived_products()

    products_total = len(active) + len(archived)
    products_active = len(active)
    products_archived = len(archived)

    stammdaten_complete = sum(1 for p in active if p.stammdaten_complete)
    stammdaten_incomplete = products_active - stammdaten_complete
    stammdaten_percent = round(stammdaten_complete / products_active * 100, 1) if products_active else 0.0

    attributes_with = sum(1 for p in active if len(p.attributes) > 0)
    attributes_without = products_active - attributes_with
    attributes_percent = round(attributes_with / products_active * 100, 1) if products_active else 0.0

    export_ready = sum(1 for p in active if p.stammdaten_complete and len(p.attributes) > 0)
    export_not_ready = products_active - export_ready
    export_ready_percent = round(export_ready / products_active * 100, 1) if products_active else 0.0

    # Extended KPIs
    bild_fields = ["bild_1", "bild_2", "bild_3", "bild_4", "bild_5", "bild_6", "bild_7", "bild_8", "bild_9"]
    products_without_images = sum(1 for p in active if not any(getattr(p, f, None) for f in bild_fields))
    products_without_ean = sum(1 for p in active if not p.ean)
    products_with_errors = sum(1 for p in active if not p.stammdaten_complete or len(p.attributes) == 0)
    seo_complete = sum(1 for p in active if p.title_tag and p.meta_description)
    seo_percent = round(seo_complete / products_active * 100, 1) if products_active else 0.0
    total_attrs = sum(len(p.attributes) for p in active)
    avg_attributes_per_product = round(total_attrs / products_active, 1) if products_active else 0.0

    # Build incomplete products list (missing stammdaten or attributes)
    incomplete: list[IncompleteProduct] = []
    for p in active:
        if p.stammdaten_complete and len(p.attributes) > 0:
            continue
        missing_parts = []
        if not p.stammdaten_complete:
            missing_parts.append("Stammdaten")
        if len(p.attributes) == 0:
            missing_parts.append("Attribute")
        incomplete.append(IncompleteProduct(
            artikelnummer=p.artikelnummer,
            artikelname=p.artikelname,
            stammdaten_complete=p.stammdaten_complete,
            attribute_count=len(p.attributes),
            missing=", ".join(missing_parts),
        ))

    # Sort: products missing both come first
    incomplete.sort(key=lambda x: x.attribute_count + int(x.stammdaten_complete))

    # Recently updated (last 5 modified products by name, for the dashboard)
    recently_updated = [
        IncompleteProduct(
            artikelnummer=p.artikelnummer,
            artikelname=p.artikelname,
            stammdaten_complete=p.stammdaten_complete,
            attribute_count=len(p.attributes),
            missing="",
        )
        for p in active[:10]
    ]

    # Recent activities from DB
    raw_activities = get_recent_activities(8)
    recent_activities = [ActivityLog(**a) for a in raw_activities]

    return DashboardStats(
        products_total=products_total,
        products_active=products_active,
        products_archived=products_archived,
        stammdaten_complete=stammdaten_complete,
        stammdaten_incomplete=stammdaten_incomplete,
        stammdaten_percent=stammdaten_percent,
        attributes_with=attributes_with,
        attributes_without=attributes_without,
        attributes_percent=attributes_percent,
        export_ready=export_ready,
        export_not_ready=export_not_ready,
        export_ready_percent=export_ready_percent,
        products_without_images=products_without_images,
        products_without_ean=products_without_ean,
        products_with_errors=products_with_errors,
        seo_complete=seo_complete,
        seo_percent=seo_percent,
        avg_attributes_per_product=avg_attributes_per_product,
        recently_updated=recently_updated,
        incomplete_products=incomplete,
        recent_activities=recent_activities,
    )
