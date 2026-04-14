"""Products router — CSV import and product CRUD."""

from typing import List

from fastapi import APIRouter, UploadFile, HTTPException
from pydantic import BaseModel

from state import state
from models.product import Product
from services.csv_handler import parse_csv
from services.database import log_activity, log_product_history, log_product_history_batch, get_product_history


class DeleteRequest(BaseModel):
    artikelnummern: List[str]

router = APIRouter(prefix="/api/products", tags=["products"])

import re

@router.get("/next-sku")
def next_sku():
    """Return the next available CYL-XXXXX article number."""
    pattern = re.compile(r'^CYL-(\d+)$', re.IGNORECASE)
    max_num = 0
    for sku in state.products:
        m = pattern.match(sku)
        if m:
            num = int(m.group(1))
            if num > max_num:
                max_num = num
    next_num = max_num + 1
    return {"sku": f"CYL-{next_num:05d}"}


@router.post("")
def create_product(body: Product):
    """Add a single product manually."""
    if not body.artikelnummer.strip():
        raise HTTPException(400, "Artikelnummer darf nicht leer sein.")
    existing = state.get_product(body.artikelnummer)
    if existing:
        raise HTTPException(409, "Artikelnummer existiert bereits.")
    state.add_product(body)
    log_activity("product_created", body.artikelname, 1)
    log_product_history(body.artikelnummer, "created", detail=body.artikelname)
    return body


@router.get("")
def list_products(archived: bool = False):
    if archived:
        return state.get_archived_products()
    return state.get_active_products()


@router.get("/{artikelnummer}")
def get_product(artikelnummer: str):
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, "Produkt nicht gefunden")
    return product


@router.post("/import")
async def import_csv(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Nur CSV-Dateien sind erlaubt.")

    content = await file.read()
    try:
        result = parse_csv(content)
    except ValueError as e:
        raise HTTPException(400, str(e))

    products = result.products
    merged = 0
    created = 0

    for p in products:
        existing = state.get_product(p.artikelnummer)
        if existing:
            # Track field changes for history
            history_entries = []
            for field in ("artikelname", "ek", "preis", "gewicht", "hersteller", "ean"):
                new_val = getattr(p, field)
                if new_val is not None:
                    old_val = getattr(existing, field)
                    if str(old_val) != str(new_val):
                        history_entries.append((p.artikelnummer, "import_update", field, str(old_val) if old_val is not None else None, str(new_val), None))
            existing.artikelname = p.artikelname
            if p.ek is not None:
                existing.ek = p.ek
            if p.preis is not None:
                existing.preis = p.preis
            if p.gewicht is not None:
                existing.gewicht = p.gewicht
            if p.hersteller is not None:
                existing.hersteller = p.hersteller
            if p.ean is not None:
                existing.ean = p.ean
            state.save_product_changes(existing)
            if history_entries:
                log_product_history_batch(history_entries)
            merged += 1
        else:
            state.add_product(p)
            log_product_history(p.artikelnummer, "created", detail=f"Import: {p.artikelname}")
            created += 1

    imported_count = len(products)
    log_activity("import", f"{imported_count} Produkte importiert", imported_count)
    return {
        "imported": imported_count,
        "total": len(state.products),
        "created": created,
        "merged": merged,
        "skipped": result.skipped_rows,
        "warnings": [w.to_dict() for w in result.warnings],
    }


@router.delete("")
def clear_products():
    state.clear_products()
    return {"cleared": True}


@router.post("/delete")
def delete_products(body: DeleteRequest):
    """Delete specific products by their Artikelnummern."""
    deleted = 0
    for sku in body.artikelnummern:
        if state.delete_product(sku):
            log_product_history(sku, "deleted")
            deleted += 1
    if deleted:
        log_activity("product_deleted", f"{deleted} Produkte gelöscht", deleted)
    return {"deleted": deleted}


@router.post("/archive")
def archive_products(body: DeleteRequest):
    """Archive specific products by their Artikelnummern."""
    archived = 0
    for sku in body.artikelnummern:
        p = state.get_product(sku)
        if p:
            state.archive_product(sku)
            log_product_history(sku, "archived")
            archived += 1
    return {"archived": archived}


class StammdatenUpdate(BaseModel):
    artikelname: str | None = None
    ek: float | None = None
    preis: float | None = None
    gewicht: float | None = None
    hersteller: str | None = None
    ean: str | None = None
    stammdaten_complete: bool | None = None
    # Maße
    laenge: float | None = None
    breite: float | None = None
    hoehe: float | None = None
    # Grundpreis
    verkaufseinheit: float | None = None
    inhalt_menge: float | None = None
    inhalt_einheit: str | None = None
    grundpreis_ausweisen: bool | None = None
    bezugsmenge: float | None = None
    bezugsmenge_einheit: str | None = None
    # Lieferant
    lieferant_name: str | None = None
    lieferant_artikelnummer: str | None = None
    lieferant_artikelname: str | None = None
    lieferant_netto_ek: float | None = None
    # Bilder
    bild_1: str | None = None
    bild_2: str | None = None
    bild_3: str | None = None
    bild_4: str | None = None
    bild_5: str | None = None
    bild_6: str | None = None
    bild_7: str | None = None
    bild_8: str | None = None
    bild_9: str | None = None
    # Kategorien
    kategorie_1: str | None = None
    kategorie_2: str | None = None
    kategorie_3: str | None = None
    kategorie_4: str | None = None
    kategorie_5: str | None = None
    kategorie_6: str | None = None
    # SEO & Content
    kurzbeschreibung: str | None = None
    beschreibung: str | None = None
    url_pfad: str | None = None
    title_tag: str | None = None
    meta_description: str | None = None


@router.patch("/{artikelnummer}/stammdaten")
def update_stammdaten(artikelnummer: str, body: StammdatenUpdate):
    """Update Stammdaten fields of an existing product."""
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, "Produkt nicht gefunden")
    data = body.model_dump(exclude_unset=True)
    history_entries = []
    for field, value in data.items():
        if field == "stammdaten_complete":
            continue
        old_value = getattr(product, field)
        if str(old_value) != str(value):
            history_entries.append((artikelnummer, "stammdaten_update", field,
                                    str(old_value) if old_value is not None else None,
                                    str(value) if value is not None else None, None))
        setattr(product, field, value)
    state.save_product_changes(product)
    if history_entries:
        log_product_history_batch(history_entries)
    return product


@router.post("/{artikelnummer}/unarchive")
def unarchive_product(artikelnummer: str):
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, "Produkt nicht gefunden")
    state.unarchive_product(artikelnummer)
    log_product_history(artikelnummer, "unarchived")
    return product


@router.get("/{artikelnummer}/history")
def product_history(artikelnummer: str, limit: int = 100):
    """Return change history for a specific product."""
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, "Produkt nicht gefunden")
    return get_product_history(artikelnummer, limit)


class BulkStammdatenUpdate(BaseModel):
    artikelnummern: List[str]
    fields: dict


@router.patch("/bulk/stammdaten")
def bulk_update_stammdaten(body: BulkStammdatenUpdate):
    """Update Stammdaten fields for multiple products at once."""
    ALLOWED_FIELDS = {
        "hersteller", "ean", "ek", "preis", "gewicht",
        "laenge", "breite", "hoehe",
        "verkaufseinheit", "inhalt_menge", "inhalt_einheit",
        "grundpreis_ausweisen", "bezugsmenge", "bezugsmenge_einheit",
        "lieferant_name", "lieferant_artikelnummer", "lieferant_artikelname", "lieferant_netto_ek",
        "bild_1", "bild_2", "bild_3", "bild_4", "bild_5", "bild_6", "bild_7", "bild_8", "bild_9",
        "kategorie_1", "kategorie_2", "kategorie_3", "kategorie_4", "kategorie_5", "kategorie_6",
        "kurzbeschreibung", "beschreibung", "url_pfad", "title_tag", "meta_description",
    }
    # Filter to only allowed fields
    fields = {k: v for k, v in body.fields.items() if k in ALLOWED_FIELDS}
    if not fields:
        raise HTTPException(400, "Keine gültigen Felder angegeben")

    updated = 0
    for sku in body.artikelnummern:
        product = state.get_product(sku)
        if not product:
            continue
        history_entries = []
        for field, value in fields.items():
            old_value = getattr(product, field)
            if str(old_value) != str(value):
                history_entries.append((sku, "bulk_stammdaten", field, str(old_value) if old_value is not None else None, str(value) if value is not None else None, None))
            setattr(product, field, value)
        state.save_product_changes(product)
        if history_entries:
            log_product_history_batch(history_entries)
        updated += 1

    if updated:
        log_activity("bulk_stammdaten", f"{updated} Produkte aktualisiert: {', '.join(fields.keys())}", updated)
    return {"updated": updated, "fields": list(fields.keys())}
