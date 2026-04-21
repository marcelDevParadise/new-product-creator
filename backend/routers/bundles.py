"""Bundles router — Product bundles and sets management."""

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from state import state
from services.database import get_conn, log_activity

router = APIRouter(prefix="/api/bundles", tags=["bundles"])


class BundleCreate(BaseModel):
    name: str
    description: str = ""
    items: list[dict]  # [{artikelnummer, quantity}]


class BundleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    items: list[dict] | None = None


@router.get("")
def list_bundles():
    """Return all bundles with resolved product info."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, description, items, created_at, updated_at "
            "FROM bundles ORDER BY id DESC"
        )
        rows = cur.fetchall()
    bundles = []
    for r in rows:
        items = json.loads(r[3])
        enriched = []
        total_ek = 0.0
        total_vk = 0.0
        for item in items:
            p = state.get_product(item["artikelnummer"])
            enriched.append({
                "artikelnummer": item["artikelnummer"],
                "quantity": item.get("quantity", 1),
                "artikelname": p.artikelname if p else "Unbekannt",
                "ek": p.ek if p else None,
                "preis": p.preis if p else None,
            })
            if p and p.ek:
                total_ek += p.ek * item.get("quantity", 1)
            if p and p.preis:
                total_vk += p.preis * item.get("quantity", 1)
        bundles.append({
            "id": r[0],
            "name": r[1],
            "description": r[2],
            "items": enriched,
            "total_ek": round(total_ek, 2),
            "total_vk": round(total_vk, 2),
            "created_at": r[4],
            "updated_at": r[5],
        })
    return bundles


@router.post("")
def create_bundle(data: BundleCreate):
    """Create a new bundle."""
    for item in data.items:
        if not state.get_product(item["artikelnummer"]):
            raise HTTPException(404, f"Produkt {item['artikelnummer']} nicht gefunden")
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO bundles (name, description, items) VALUES (%s, %s, %s) RETURNING id",
            (data.name, data.description, json.dumps(data.items)),
        )
        bundle_id = cur.fetchone()[0]
    log_activity("bundle_created", f"Bundle '{data.name}' erstellt", len(data.items))
    return {"id": bundle_id, "name": data.name}


@router.get("/{bundle_id}")
def get_bundle(bundle_id: int):
    """Get a single bundle."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, description, items, created_at, updated_at "
            "FROM bundles WHERE id = %s",
            (bundle_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Bundle nicht gefunden")
    items = json.loads(row[3])
    enriched = []
    for item in items:
        p = state.get_product(item["artikelnummer"])
        enriched.append({
            "artikelnummer": item["artikelnummer"],
            "quantity": item.get("quantity", 1),
            "artikelname": p.artikelname if p else "Unbekannt",
            "ek": p.ek if p else None,
            "preis": p.preis if p else None,
        })
    return {"id": row[0], "name": row[1], "description": row[2], "items": enriched, "created_at": row[4], "updated_at": row[5]}


@router.put("/{bundle_id}")
def update_bundle(bundle_id: int, data: BundleUpdate):
    """Update a bundle."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM bundles WHERE id = %s", (bundle_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Bundle nicht gefunden")
        if data.items is not None:
            for item in data.items:
                if not state.get_product(item["artikelnummer"]):
                    raise HTTPException(404, f"Produkt {item['artikelnummer']} nicht gefunden")
        updates = []
        vals: list = []
        if data.name is not None:
            updates.append("name = %s")
            vals.append(data.name)
        if data.description is not None:
            updates.append("description = %s")
            vals.append(data.description)
        if data.items is not None:
            updates.append("items = %s")
            vals.append(json.dumps(data.items))
        if updates:
            updates.append("updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')")
            vals.append(bundle_id)
            cur.execute(f"UPDATE bundles SET {', '.join(updates)} WHERE id = %s", vals)
    return {"updated": True}


@router.delete("/{bundle_id}")
def delete_bundle(bundle_id: int):
    """Delete a bundle."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT name FROM bundles WHERE id = %s", (bundle_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Bundle nicht gefunden")
        cur.execute("DELETE FROM bundles WHERE id = %s", (bundle_id,))
    log_activity("bundle_deleted", f"Bundle '{row[0]}' gelöscht")
    return {"deleted": True}
