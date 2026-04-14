"""Export router — JTL Ameise CSV and Stammdaten CSV downloads."""

from datetime import date

from fastapi import APIRouter
from fastapi.responses import Response

from state import state
from services.csv_handler import build_ameise_csv, build_stammdaten_csv, build_seo_csv
from services.database import log_activity
from routers.settings import get_export_settings

router = APIRouter(prefix="/api/export", tags=["export"])


def _make_filename(typ: str) -> str:
    """Build export filename from settings pattern."""
    es = get_export_settings()
    return es.dateiname_muster.format(typ=typ, datum=date.today().isoformat()) + ".csv"


@router.get("/validate")
def validate_export():
    """Check which products are missing required attributes before export."""
    products = [p for p in state.get_active_products() if p.attributes]
    required_attrs = {k: v for k, v in state.attribute_config.items() if v.required}
    warnings = []
    for p in products:
        missing = [v.name for k, v in required_attrs.items() if k not in p.attributes]
        if missing:
            warnings.append({
                "artikelnummer": p.artikelnummer,
                "artikelname": p.artikelname,
                "missing": missing,
            })
    return {"total_products": len(products), "warnings": warnings, "ok": len(warnings) == 0}


@router.post("/ameise")
def export_ameise():
    products = [p for p in state.get_active_products() if p.attributes]
    es = get_export_settings()
    csv_content = build_ameise_csv(
        products, state.attribute_config,
        delimiter=es.csv_trennzeichen,
        attributgruppe=es.attributgruppe,
    )

    # Archive exported products
    for p in products:
        state.archive_product(p.artikelnummer)

    log_activity("export_ameise", f"{len(products)} Produkte exportiert", len(products))

    filename = _make_filename("ameise")

    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/preview")
def export_preview():
    """Return a JSON preview of what would be exported."""
    rows = []
    active_with_attrs = [p for p in state.get_active_products() if p.attributes]
    for product in active_with_attrs:
        for attr_key, attr_value in product.attributes.items():
            config = state.attribute_config.get(attr_key)
            if config is None:
                continue
            rows.append({
                "artikelnummer": product.artikelnummer,
                "artikelname": product.artikelname,
            "attributgruppe": get_export_settings().attributgruppe,
                "funktionsattribut": config.id,
                "attributname": config.name,
                "attributwert": str(attr_value),
            })
    return {"rows": rows, "total_products": len(active_with_attrs), "total_rows": len(rows)}


# --- Stammdaten Export ---

@router.post("/stammdaten")
def export_stammdaten():
    """Download a flat CSV with Stammdaten (one row per product). Does NOT archive."""
    products = state.get_active_products()
    es = get_export_settings()
    csv_content = build_stammdaten_csv(products, delimiter=es.csv_trennzeichen, decimal_sep=es.dezimalformat)
    log_activity("export_stammdaten", f"{len(products)} Produkte exportiert", len(products))
    filename = _make_filename("stammdaten")
    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/stammdaten/preview")
def stammdaten_preview():
    """Return a JSON preview of the Stammdaten export."""
    products = state.get_active_products()
    rows = []
    for p in products:
        rows.append({
            "artikelnummer": p.artikelnummer,
            "artikelname": p.artikelname,
            "ek": p.ek,
            "preis": p.preis,
            "gewicht": p.gewicht,
            "hersteller": p.hersteller or "",
            "ean": p.ean or "",
            "laenge": p.laenge,
            "breite": p.breite,
            "hoehe": p.hoehe,
            "verkaufseinheit": p.verkaufseinheit,
            "inhalt_menge": p.inhalt_menge,
            "inhalt_einheit": p.inhalt_einheit or "",
            "grundpreis_ausweisen": p.grundpreis_ausweisen,
            "bezugsmenge": p.bezugsmenge,
            "bezugsmenge_einheit": p.bezugsmenge_einheit or "",
            "lieferant_name": p.lieferant_name or "",
            "lieferant_artikelnummer": p.lieferant_artikelnummer or "",
            "lieferant_artikelname": p.lieferant_artikelname or "",
            "lieferant_netto_ek": p.lieferant_netto_ek,
            "bild_1": p.bild_1 or "",
            "bild_2": p.bild_2 or "",
            "bild_3": p.bild_3 or "",
            "bild_4": p.bild_4 or "",
            "bild_5": p.bild_5 or "",
            "bild_6": p.bild_6 or "",
            "bild_7": p.bild_7 or "",
            "bild_8": p.bild_8 or "",
            "bild_9": p.bild_9 or "",
            "kategorie_1": p.kategorie_1 or "",
            "kategorie_2": p.kategorie_2 or "",
            "kategorie_3": p.kategorie_3 or "",
            "kategorie_4": p.kategorie_4 or "",
            "kategorie_5": p.kategorie_5 or "",
            "kategorie_6": p.kategorie_6 or "",
        })
    return {"rows": rows, "total_products": len(products)}


# --- SEO & Content Export ---

@router.post("/seo")
def export_seo():
    """Download a CSV with SEO & Content fields (one row per product). Does NOT archive."""
    products = state.get_active_products()
    es = get_export_settings()
    csv_content = build_seo_csv(products, delimiter=es.csv_trennzeichen)
    log_activity("export_seo", f"{len(products)} Produkte exportiert", len(products))
    filename = _make_filename("seo")
    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/seo/preview")
def seo_preview():
    """Return a JSON preview of the SEO & Content export."""
    products = state.get_active_products()
    rows = []
    for p in products:
        rows.append({
            "artikelnummer": p.artikelnummer,
            "artikelname": p.artikelname,
            "kurzbeschreibung": p.kurzbeschreibung or "",
            "beschreibung": p.beschreibung or "",
            "url_pfad": p.url_pfad or "",
            "title_tag": p.title_tag or "",
            "meta_description": p.meta_description or "",
        })
    return {"rows": rows, "total_products": len(products)}
