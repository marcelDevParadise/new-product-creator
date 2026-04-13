"""Stats router — Dashboard statistics endpoint."""

from fastapi import APIRouter

from state import state
from models.stats import DashboardStats, IncompleteProduct, ActivityLog
from services.database import get_recent_activities

router = APIRouter(prefix="/api/stats", tags=["stats"])


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

    # Build incomplete products list (missing stammdaten or attributes, max 10)
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

    # Recent activities from DB
    raw_activities = get_recent_activities(5)
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
        incomplete_products=incomplete,
        recent_activities=recent_activities,
    )
