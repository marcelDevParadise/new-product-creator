"""Supplier master-data CRUD."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.database import log_activity
from state import state

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


class SupplierPayload(BaseModel):
    name: str


def _clean_name(name: str) -> str:
    cleaned = " ".join(name.split())
    if not cleaned:
        raise HTTPException(400, "Bitte einen Lieferantennamen eingeben")
    if len(cleaned) > 200:
        raise HTTPException(400, "Der Lieferantenname darf höchstens 200 Zeichen lang sein")
    return cleaned


def _ensure_unique(name: str, supplier_id: int | None = None) -> None:
    duplicate = next(
        (supplier for supplier in state.get_suppliers()
         if supplier["name"].lower() == name.lower() and supplier["id"] != supplier_id),
        None,
    )
    if duplicate:
        raise HTTPException(409, "Dieser Lieferant ist bereits vorhanden")


@router.get("")
def list_suppliers():
    return state.get_suppliers()


@router.post("", status_code=201)
def create_supplier(data: SupplierPayload):
    name = _clean_name(data.name)
    _ensure_unique(name)
    supplier = state.create_supplier(name)
    log_activity("supplier_created", f"Lieferant '{name}' erstellt")
    return supplier


@router.put("/{supplier_id}")
def update_supplier(supplier_id: int, data: SupplierPayload):
    name = _clean_name(data.name)
    _ensure_unique(name, supplier_id)
    supplier, old_name = state.rename_supplier(supplier_id, name)
    if not supplier:
        raise HTTPException(404, "Lieferant nicht gefunden")
    if old_name != name:
        log_activity("supplier_updated", f"Lieferant '{old_name}' in '{name}' umbenannt")
    return supplier


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int):
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
