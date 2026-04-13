"""Products router — CSV import and product CRUD."""

from typing import List

from fastapi import APIRouter, UploadFile, HTTPException
from pydantic import BaseModel

from state import state
from models.product import Product
from services.csv_handler import parse_csv
from services.database import log_activity


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
        products = parse_csv(content)
    except ValueError as e:
        raise HTTPException(400, str(e))

    for p in products:
        existing = state.get_product(p.artikelnummer)
        if existing:
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
        else:
            state.add_product(p)

    imported_count = len(products)
    log_activity("import", f"{imported_count} Produkte importiert", imported_count)
    return {"imported": imported_count, "total": len(state.products)}


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


@router.patch("/{artikelnummer}/stammdaten")
def update_stammdaten(artikelnummer: str, body: StammdatenUpdate):
    """Update Stammdaten fields of an existing product."""
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, "Produkt nicht gefunden")
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(product, field, value)
    state.save_product_changes(product)
    return product


@router.post("/{artikelnummer}/unarchive")
def unarchive_product(artikelnummer: str):
    product = state.get_product(artikelnummer)
    if product is None:
        raise HTTPException(404, "Produkt nicht gefunden")
    state.unarchive_product(artikelnummer)
    return product
