"""Stats router — Dashboard statistics, content scores, price stats, system health, and global search."""

import sys
import time

from fastapi import APIRouter

from state import state
from models.stats import (
    DashboardStats, IncompleteProduct, ActivityLog,
    ContentScoreProduct, PriceStats, SystemHealth,
)
from services.database import get_recent_activities, _conn

router = APIRouter(prefix="/api/stats", tags=["stats"])

_START_TIME = time.time()

_CONTENT_FIELDS = ["artikelname", "kurzbeschreibung", "beschreibung", "title_tag", "meta_description"]
_CONTENT_LABELS = {
    "artikelname": "Artikelname",
    "kurzbeschreibung": "Kurzbeschreibung",
    "beschreibung": "Beschreibung",
    "title_tag": "Title Tag",
    "meta_description": "Meta-Description",
}


def _compute_content_score(product) -> tuple[int, list[str]]:
    """Return (score 0-5, list of missing field labels)."""
    missing = []
    for f in _CONTENT_FIELDS:
        val = getattr(product, f, None)
        if not val or not str(val).strip():
            missing.append(_CONTENT_LABELS[f])
    return len(_CONTENT_FIELDS) - len(missing), missing


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

    # Search templates (match name, category or description)
    template_results = []
    for name, tmpl in state.templates.items():
        category = tmpl.get("category", "")
        description = tmpl.get("description", "")
        if query in name.lower() or query in category.lower() or query in description.lower():
            template_results.append({
                "name": name,
                "attribute_count": len(tmpl.get("attributes", {})),
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

    # Content Score
    content_complete = 0
    content_partial = 0
    content_empty = 0
    content_total_score = 0
    for p in active:
        score, _ = _compute_content_score(p)
        content_total_score += score
        if score == 5:
            content_complete += 1
        elif score == 0:
            content_empty += 1
        else:
            content_partial += 1
    content_score_avg = round(content_total_score / products_active / 5 * 100, 1) if products_active else 0.0

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
        content_score_avg=content_score_avg,
        content_complete=content_complete,
        content_partial=content_partial,
        content_empty=content_empty,
        recently_updated=recently_updated,
        incomplete_products=incomplete,
        recent_activities=recent_activities,
    )


@router.get("/content-scores")
def get_content_scores():
    """Return per-product content scores and aggregates."""
    active = state.get_active_products()
    products = []
    for p in active:
        score, missing = _compute_content_score(p)
        products.append(ContentScoreProduct(
            artikelnummer=p.artikelnummer,
            artikelname=p.artikelname,
            score=score,
            score_percent=round(score / 5 * 100, 1),
            missing=missing,
        ))
    products.sort(key=lambda x: x.score)
    total = len(products)
    complete = sum(1 for p in products if p.score == 5)
    avg = round(sum(p.score for p in products) / total / 5 * 100, 1) if total else 0.0
    return {
        "products": products,
        "total": total,
        "complete": complete,
        "avg_percent": avg,
    }


@router.get("/prices")
def get_price_stats():
    """Return price and margin statistics for active products."""
    active = state.get_active_products()
    ek_values = [p.ek for p in active if p.ek is not None and p.ek > 0]
    vk_values = [p.preis for p in active if p.preis is not None and p.preis > 0]
    margins = []
    margin_products = []
    for p in active:
        if p.ek is not None and p.ek > 0 and p.preis is not None and p.preis > 0:
            margin = p.preis - p.ek
            margin_pct = round(margin / p.preis * 100, 1) if p.preis else 0
            margins.append(margin)
            margin_products.append({
                "artikelnummer": p.artikelnummer,
                "artikelname": p.artikelname,
                "ek": p.ek,
                "vk": p.preis,
                "margin": round(margin, 2),
                "margin_percent": margin_pct,
            })

    avg_ek = round(sum(ek_values) / len(ek_values), 2) if ek_values else 0
    avg_vk = round(sum(vk_values) / len(vk_values), 2) if vk_values else 0
    avg_margin = round(sum(margins) / len(margins), 2) if margins else 0
    avg_margin_percent = round(avg_margin / avg_vk * 100, 1) if avg_vk else 0

    negative = [mp for mp in margin_products if mp["margin"] < 0]
    # Sort by margin ascending → worst margins first
    margin_products.sort(key=lambda x: x["margin"])

    return PriceStats(
        avg_ek=avg_ek,
        avg_vk=avg_vk,
        avg_margin=avg_margin,
        avg_margin_percent=avg_margin_percent,
        products_without_ek=sum(1 for p in active if p.ek is None or p.ek <= 0),
        products_without_vk=sum(1 for p in active if p.preis is None or p.preis <= 0),
        products_negative_margin=len(negative),
        min_ek=min(ek_values) if ek_values else None,
        max_ek=max(ek_values) if ek_values else None,
        min_vk=min(vk_values) if vk_values else None,
        max_vk=max(vk_values) if vk_values else None,
        critical_margin_products=margin_products[:10],
    )


@router.get("/health")
def get_system_health():
    """Return system health information."""
    db_size = 0
    products_count = len(state.products)
    activity_count = 0
    history_count = 0
    integrity = "error"

    try:
        with _conn() as conn, conn.cursor() as cur:
            # Database size in bytes (current database)
            cur.execute("SELECT pg_database_size(current_database())")
            db_size = cur.fetchone()[0] or 0
            cur.execute("SELECT COUNT(*) FROM products")
            products_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM activity_log")
            activity_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM product_history")
            history_count = cur.fetchone()[0]
            # Postgres has no PRAGMA integrity_check; a successful query is our health signal.
            integrity = "ok"
    except Exception:
        pass

    # Format size
    if db_size < 1024:
        size_display = f"{db_size} B"
    elif db_size < 1024 * 1024:
        size_display = f"{db_size / 1024:.1f} KB"
    else:
        size_display = f"{db_size / (1024 * 1024):.1f} MB"

    uptime = time.time() - _START_TIME
    if uptime < 3600:
        uptime_display = f"{uptime / 60:.0f} Min."
    elif uptime < 86400:
        uptime_display = f"{uptime / 3600:.1f} Std."
    else:
        uptime_display = f"{uptime / 86400:.1f} Tage"

    return SystemHealth(
        db_size_bytes=db_size,
        db_size_display=size_display,
        products_count=products_count,
        activity_log_count=activity_count,
        product_history_count=history_count,
        attribute_definitions_count=len(state.attribute_config),
        templates_count=len(state.templates),
        uptime_seconds=round(uptime, 1),
        uptime_display=uptime_display,
        python_version=sys.version.split()[0],
        integrity_ok=integrity == "ok",
    )


@router.post("/vacuum")
def vacuum_db():
    """Run VACUUM and ANALYZE on the database."""
    try:
        with _conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT pg_database_size(current_database())")
            old_size = cur.fetchone()[0] or 0
            # VACUUM cannot run inside a transaction. autocommit is enabled in the pool.
            cur.execute("VACUUM")
            cur.execute("ANALYZE")
            cur.execute("SELECT pg_database_size(current_database())")
            new_size = cur.fetchone()[0] or 0
        saved = old_size - new_size
        return {"success": True, "old_size": old_size, "new_size": new_size, "saved_bytes": saved}
    except Exception as e:
        return {"success": False, "error": str(e)}
