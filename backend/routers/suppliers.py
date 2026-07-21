"""Supplier master-data CRUD and Artikelwerk synchronization."""

import hashlib
import json
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from config import get_artikelwerk_config
from integrations.artikelwerk.client import ArtikelwerkClient, ArtikelwerkError
from services.database import log_activity
from state import state

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


class SupplierPayload(BaseModel):
    name: str
    supplier_number: str | None = Field(default=None, max_length=64)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    website: str | None = Field(default=None, max_length=255)
    active: bool = True
    default_company_id: int | None = Field(default=None, ge=1)
    default_warehouse_id: int | None = Field(default=None, ge=1)


def _clean_name(name: str) -> str:
    cleaned = " ".join(name.split())
    if not cleaned:
        raise HTTPException(400, "Bitte einen Lieferantennamen eingeben")
    if len(cleaned) > 255:
        raise HTTPException(400, "Der Lieferantenname darf höchstens 255 Zeichen lang sein")
    return cleaned


def _ensure_unique(name: str, supplier_id: int | None = None) -> None:
    duplicate = next(
        (supplier for supplier in state.get_suppliers()
         if supplier["name"].lower() == name.lower() and supplier["id"] != supplier_id),
        None,
    )
    if duplicate:
        raise HTTPException(409, "Dieser Lieferant ist bereits vorhanden")


def _clean_payload(data: SupplierPayload) -> dict:
    payload = data.model_dump()
    payload["name"] = _clean_name(data.name)
    payload["supplier_number"] = (data.supplier_number or "").strip() or None
    payload["currency"] = data.currency.strip().upper()
    for field in ("email", "phone", "website"):
        payload[field] = (payload[field] or "").strip() or None
    return payload


def _ensure_supplier_number_unique(number: str | None, supplier_id: int | None = None) -> None:
    if not number:
        return
    duplicate = next(
        (supplier for supplier in state.get_suppliers()
         if (supplier.get("supplier_number") or "").lower() == number.lower()
         and supplier["id"] != supplier_id),
        None,
    )
    if duplicate:
        raise HTTPException(409, "Diese Lieferantennummer ist bereits vorhanden")


@router.get("")
def list_suppliers():
    return state.get_suppliers()


@router.get("/articlewerk")
async def search_articlewerk_suppliers(
    supplier_number: str | None = Query(default=None, max_length=64),
    name: str | None = Query(default=None, max_length=255),
    active: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    try:
        async with ArtikelwerkClient(get_artikelwerk_config()) as client:
            return await client.search_suppliers(
                supplier_number=supplier_number, name=name, active=active,
                page=page, page_size=page_size,
            )
    except ArtikelwerkError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": str(exc), "requestId": exc.request_id},
        ) from exc


@router.post("/articlewerk/import")
async def import_articlewerk_suppliers(active: bool | None = None):
    imported = 0
    created = 0
    page = 1
    try:
        async with ArtikelwerkClient(get_artikelwerk_config()) as client:
            while True:
                result = await client.search_suppliers(active=active, page=page, page_size=100)
                items = result.get("items", [])
                for remote in items:
                    _, was_created = state.upsert_articlewerk_supplier(remote)
                    imported += 1
                    created += int(was_created)
                if page >= int(result.get("totalPages", page)):
                    break
                page += 1
    except ArtikelwerkError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": str(exc), "requestId": exc.request_id},
        ) from exc
    log_activity("suppliers_imported", f"{imported} Lieferanten aus Artikelwerk übernommen", imported)
    return {"imported": imported, "created": created, "updated": imported - created}


@router.post("", status_code=201)
def create_supplier(data: SupplierPayload):
    payload = _clean_payload(data)
    _ensure_unique(payload["name"])
    _ensure_supplier_number_unique(payload["supplier_number"])
    supplier = state.create_supplier(payload)
    log_activity("supplier_created", f"Lieferant '{payload['name']}' erstellt")
    return supplier


@router.put("/{supplier_id}")
def update_supplier(supplier_id: int, data: SupplierPayload):
    existing = state.get_supplier(supplier_id)
    if existing and existing.get("articlewerk_supplier_id"):
        raise HTTPException(409, "Synchronisierte Lieferanten können ohne Artikelwerk-Update-Route nicht geändert werden")
    payload = _clean_payload(data)
    _ensure_unique(payload["name"], supplier_id)
    _ensure_supplier_number_unique(payload["supplier_number"], supplier_id)
    supplier, old_name = state.update_supplier(supplier_id, payload)
    if not supplier:
        raise HTTPException(404, "Lieferant nicht gefunden")
    if old_name != payload["name"]:
        log_activity("supplier_updated", f"Lieferant '{old_name}' in '{payload['name']}' umbenannt")
    return supplier


@router.post("/{supplier_id}/articlewerk")
async def publish_supplier_to_articlewerk(supplier_id: int):
    supplier = state.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(404, "Lieferant nicht gefunden")
    if supplier.get("articlewerk_supplier_id"):
        raise HTTPException(409, "Lieferant wurde bereits in Artikelwerk angelegt")
    missing = [label for field, label in (
        ("supplier_number", "Lieferantennummer"),
        ("default_company_id", "Standardfirma"),
        ("default_warehouse_id", "Standardlager"),
    ) if not supplier.get(field)]
    if missing:
        raise HTTPException(422, "Für Artikelwerk fehlen: " + ", ".join(missing))

    remote_payload = {
        "name": supplier["name"],
        "supplierNumber": supplier["supplier_number"],
        "currency": supplier["currency"],
        "email": supplier["email"],
        "phone": supplier["phone"],
        "website": supplier["website"],
        "active": supplier["active"],
        "defaultCompanyId": supplier["default_company_id"],
        "defaultWarehouseId": supplier["default_warehouse_id"],
    }
    digest = hashlib.sha256(
        json.dumps(remote_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:20]
    key = f"attrgen:supplier:{supplier_id}:{digest}"
    try:
        async with ArtikelwerkClient(get_artikelwerk_config()) as client:
            search_result = await client.search_suppliers(supplier_number=supplier["supplier_number"])
            existing_items = search_result.get("items", [])
            if existing_items:
                remote = existing_items[0]
                updated, _ = state.upsert_articlewerk_supplier(remote)
                log_activity("supplier_linked", f"Lieferant '{supplier['name']}' mit Artikelwerk verknüpft")
                return updated
            response = await client.create_supplier(remote_payload, key)
    except ArtikelwerkError as exc:
        state.save_supplier_articlewerk_result(supplier_id, error=f"{exc.code}: {exc}")
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": str(exc), "requestId": exc.request_id},
        ) from exc
    remote = response.get("supplier", {})
    remote_id = str(remote.get("id", ""))
    if not remote_id:
        state.save_supplier_articlewerk_result(supplier_id, error="INVALID_RESPONSE: Lieferanten-ID fehlt")
        raise HTTPException(502, "Artikelwerk-Antwort enthält keine Lieferanten-ID")
    updated = state.save_supplier_articlewerk_result(supplier_id, remote_id=remote_id)
    log_activity("supplier_published", f"Lieferant '{supplier['name']}' an Artikelwerk übertragen")
    return updated


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int):
    existing = state.get_supplier(supplier_id)
    if existing and existing.get("articlewerk_supplier_id"):
        raise HTTPException(409, "Synchronisierte Lieferanten können ohne Artikelwerk-Löschroute nicht gelöscht werden")
    deleted, name, product_count = state.delete_supplier(supplier_id)
    if not name:
        raise HTTPException(404, "Lieferant nicht gefunden")
    if not deleted:
        raise HTTPException(
            409,
            f"Lieferant kann nicht gelöscht werden, da er {product_count} Artikel(n) zugeordnet ist",
        )
    log_activity("supplier_deleted", f"Lieferant '{name}' gelöscht")
    return {"deleted": True}
