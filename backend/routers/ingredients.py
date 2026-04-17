"""Ingredients router — Ingredient declarations (Inhaltsstoffe) management."""

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.database import _get_connection, log_activity

router = APIRouter(prefix="/api/ingredients", tags=["ingredients"])


def _ensure_table():
    conn = _get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            inci_name TEXT DEFAULT '',
            cas_number TEXT DEFAULT '',
            category TEXT NOT NULL DEFAULT 'Allgemein',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS product_ingredients (
            artikelnummer TEXT NOT NULL,
            ingredient_id INTEGER NOT NULL,
            percentage TEXT DEFAULT '',
            position INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (artikelnummer, ingredient_id),
            FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
        )
    """)
    conn.commit()
    conn.close()

_ensure_table()


class IngredientCreate(BaseModel):
    name: str
    inci_name: str = ""
    cas_number: str = ""
    category: str = "Allgemein"

class IngredientUpdate(BaseModel):
    name: str | None = None
    inci_name: str | None = None
    cas_number: str | None = None
    category: str | None = None


@router.get("")
def list_ingredients():
    conn = _get_connection()
    rows = conn.execute("SELECT id, name, inci_name, cas_number, category, created_at FROM ingredients ORDER BY category, name").fetchall()
    usage = {}
    for r in conn.execute("SELECT ingredient_id, COUNT(*) FROM product_ingredients GROUP BY ingredient_id").fetchall():
        usage[r[0]] = r[1]
    conn.close()
    return [
        {"id": r[0], "name": r[1], "inci_name": r[2], "cas_number": r[3], "category": r[4], "created_at": r[5], "usage_count": usage.get(r[0], 0)}
        for r in rows
    ]


@router.post("")
def create_ingredient(data: IngredientCreate):
    conn = _get_connection()
    cur = conn.execute(
        "INSERT INTO ingredients (name, inci_name, cas_number, category) VALUES (?, ?, ?, ?)",
        (data.name, data.inci_name, data.cas_number, data.category),
    )
    conn.commit()
    iid = cur.lastrowid
    conn.close()
    log_activity("ingredient_created", f"Inhaltsstoff '{data.name}' erstellt")
    return {"id": iid, "name": data.name}


@router.put("/{ingredient_id}")
def update_ingredient(ingredient_id: int, data: IngredientUpdate):
    conn = _get_connection()
    row = conn.execute("SELECT id FROM ingredients WHERE id = ?", (ingredient_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Inhaltsstoff nicht gefunden")
    updates, vals = [], []
    for field in ("name", "inci_name", "cas_number", "category"):
        v = getattr(data, field)
        if v is not None:
            updates.append(f"{field} = ?")
            vals.append(v)
    if updates:
        vals.append(ingredient_id)
        conn.execute(f"UPDATE ingredients SET {', '.join(updates)} WHERE id = ?", vals)
        conn.commit()
    conn.close()
    return {"updated": True}


@router.delete("/{ingredient_id}")
def delete_ingredient(ingredient_id: int):
    conn = _get_connection()
    row = conn.execute("SELECT name FROM ingredients WHERE id = ?", (ingredient_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Inhaltsstoff nicht gefunden")
    conn.execute("DELETE FROM product_ingredients WHERE ingredient_id = ?", (ingredient_id,))
    conn.execute("DELETE FROM ingredients WHERE id = ?", (ingredient_id,))
    conn.commit()
    conn.close()
    log_activity("ingredient_deleted", f"Inhaltsstoff '{row[0]}' gelöscht")
    return {"deleted": True}


# --- Product-Ingredient assignments ---

@router.get("/product/{artikelnummer}")
def get_product_ingredients(artikelnummer: str):
    conn = _get_connection()
    rows = conn.execute("""
        SELECT i.id, i.name, i.inci_name, i.cas_number, i.category, pi.percentage, pi.position
        FROM product_ingredients pi JOIN ingredients i ON pi.ingredient_id = i.id
        WHERE pi.artikelnummer = ?
        ORDER BY pi.position, i.name
    """, (artikelnummer,)).fetchall()
    conn.close()
    return [
        {"id": r[0], "name": r[1], "inci_name": r[2], "cas_number": r[3], "category": r[4], "percentage": r[5], "position": r[6]}
        for r in rows
    ]


@router.post("/product/{artikelnummer}")
def assign_ingredient(artikelnummer: str, data: dict):
    ingredient_id = data.get("ingredient_id")
    percentage = data.get("percentage", "")
    if not ingredient_id:
        raise HTTPException(400, "ingredient_id erforderlich")
    conn = _get_connection()
    # Get next position
    max_pos = conn.execute(
        "SELECT COALESCE(MAX(position), -1) FROM product_ingredients WHERE artikelnummer = ?",
        (artikelnummer,),
    ).fetchone()[0]
    try:
        conn.execute(
            "INSERT OR REPLACE INTO product_ingredients (artikelnummer, ingredient_id, percentage, position) VALUES (?, ?, ?, ?)",
            (artikelnummer, ingredient_id, percentage, max_pos + 1),
        )
        conn.commit()
    finally:
        conn.close()
    return {"assigned": True}


@router.delete("/product/{artikelnummer}/{ingredient_id}")
def unassign_ingredient(artikelnummer: str, ingredient_id: int):
    conn = _get_connection()
    conn.execute(
        "DELETE FROM product_ingredients WHERE artikelnummer = ? AND ingredient_id = ?",
        (artikelnummer, ingredient_id),
    )
    conn.commit()
    conn.close()
    return {"removed": True}


@router.put("/product/{artikelnummer}/order")
def reorder_ingredients(artikelnummer: str, data: dict):
    """Update ingredient order. Expects {"ingredient_ids": [id1, id2, ...]}."""
    ids = data.get("ingredient_ids", [])
    conn = _get_connection()
    for pos, iid in enumerate(ids):
        conn.execute(
            "UPDATE product_ingredients SET position = ? WHERE artikelnummer = ? AND ingredient_id = ?",
            (pos, artikelnummer, iid),
        )
    conn.commit()
    conn.close()
    return {"reordered": True}
