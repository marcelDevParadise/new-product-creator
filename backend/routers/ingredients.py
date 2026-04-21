"""Ingredients router — Ingredient declarations (Inhaltsstoffe) management."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.database import get_conn, log_activity

router = APIRouter(prefix="/api/ingredients", tags=["ingredients"])


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
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, inci_name, cas_number, category, created_at "
            "FROM ingredients ORDER BY category, name"
        )
        rows = cur.fetchall()
        cur.execute(
            "SELECT ingredient_id, COUNT(*) FROM product_ingredients GROUP BY ingredient_id"
        )
        usage = {r[0]: r[1] for r in cur.fetchall()}
    return [
        {"id": r[0], "name": r[1], "inci_name": r[2], "cas_number": r[3],
         "category": r[4], "created_at": r[5], "usage_count": usage.get(r[0], 0)}
        for r in rows
    ]


@router.post("")
def create_ingredient(data: IngredientCreate):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO ingredients (name, inci_name, cas_number, category) "
            "VALUES (%s, %s, %s, %s) RETURNING id",
            (data.name, data.inci_name, data.cas_number, data.category),
        )
        iid = cur.fetchone()[0]
    log_activity("ingredient_created", f"Inhaltsstoff '{data.name}' erstellt")
    return {"id": iid, "name": data.name}


@router.put("/{ingredient_id}")
def update_ingredient(ingredient_id: int, data: IngredientUpdate):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM ingredients WHERE id = %s", (ingredient_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Inhaltsstoff nicht gefunden")
        updates: list[str] = []
        vals: list = []
        for field in ("name", "inci_name", "cas_number", "category"):
            v = getattr(data, field)
            if v is not None:
                updates.append(f"{field} = %s")
                vals.append(v)
        if updates:
            vals.append(ingredient_id)
            cur.execute(
                f"UPDATE ingredients SET {', '.join(updates)} WHERE id = %s",
                vals,
            )
    return {"updated": True}


@router.delete("/{ingredient_id}")
def delete_ingredient(ingredient_id: int):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT name FROM ingredients WHERE id = %s", (ingredient_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Inhaltsstoff nicht gefunden")
        cur.execute("DELETE FROM product_ingredients WHERE ingredient_id = %s", (ingredient_id,))
        cur.execute("DELETE FROM ingredients WHERE id = %s", (ingredient_id,))
    log_activity("ingredient_deleted", f"Inhaltsstoff '{row[0]}' gelöscht")
    return {"deleted": True}


# --- Product-Ingredient assignments ---

@router.get("/product/{artikelnummer}")
def get_product_ingredients(artikelnummer: str):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT i.id, i.name, i.inci_name, i.cas_number, i.category,
                   pi.percentage, pi.position
            FROM product_ingredients pi
            JOIN ingredients i ON pi.ingredient_id = i.id
            WHERE pi.artikelnummer = %s
            ORDER BY pi.position, i.name
            """,
            (artikelnummer,),
        )
        rows = cur.fetchall()
    return [
        {"id": r[0], "name": r[1], "inci_name": r[2], "cas_number": r[3],
         "category": r[4], "percentage": r[5], "position": r[6]}
        for r in rows
    ]


@router.post("/product/{artikelnummer}")
def assign_ingredient(artikelnummer: str, data: dict):
    ingredient_id = data.get("ingredient_id")
    percentage = data.get("percentage", "")
    if not ingredient_id:
        raise HTTPException(400, "ingredient_id erforderlich")
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT COALESCE(MAX(position), -1) FROM product_ingredients "
            "WHERE artikelnummer = %s",
            (artikelnummer,),
        )
        max_pos = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO product_ingredients (artikelnummer, ingredient_id, percentage, position) "
            "VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (artikelnummer, ingredient_id) DO UPDATE SET "
            "percentage = excluded.percentage, position = excluded.position",
            (artikelnummer, ingredient_id, percentage, max_pos + 1),
        )
    return {"assigned": True}


@router.delete("/product/{artikelnummer}/{ingredient_id}")
def unassign_ingredient(artikelnummer: str, ingredient_id: int):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "DELETE FROM product_ingredients "
            "WHERE artikelnummer = %s AND ingredient_id = %s",
            (artikelnummer, ingredient_id),
        )
    return {"removed": True}


@router.put("/product/{artikelnummer}/order")
def reorder_ingredients(artikelnummer: str, data: dict):
    """Update ingredient order. Expects {"ingredient_ids": [id1, id2, ...]}."""
    ids = data.get("ingredient_ids", [])
    with get_conn() as conn, conn.cursor() as cur:
        for pos, iid in enumerate(ids):
            cur.execute(
                "UPDATE product_ingredients SET position = %s "
                "WHERE artikelnummer = %s AND ingredient_id = %s",
                (pos, artikelnummer, iid),
            )
    return {"reordered": True}
