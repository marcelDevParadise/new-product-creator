"""Warnings router — Product warning notices (Warnhinweise) management."""

import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.database import get_conn, log_activity

router = APIRouter(prefix="/api/warnings", tags=["warnings"])


def _seed_from_json_if_empty() -> None:
    """One-shot: seed warnings table from data/warnings_seed.json on first run."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM warnings")
        if cur.fetchone()[0] > 0:
            return
        seed_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "data", "warnings_seed.json"
        )
        if not os.path.exists(seed_path):
            return
        with open(seed_path, "r", encoding="utf-8") as f:
            seeds = json.load(f)
        for s in seeds:
            try:
                cur.execute(
                    "INSERT INTO warnings (code, title, text, category) "
                    "VALUES (%s, %s, %s, %s) ON CONFLICT (code) DO NOTHING",
                    (s["code"], s["title"], s.get("text", ""), s.get("category", "Allgemein")),
                )
            except Exception:
                pass


class WarningCreate(BaseModel):
    code: str
    title: str
    text: str = ""
    category: str = "Allgemein"


class WarningUpdate(BaseModel):
    code: str | None = None
    title: str | None = None
    text: str | None = None
    category: str | None = None


@router.get("")
def list_warnings():
    _seed_from_json_if_empty()
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, code, title, text, category, created_at "
            "FROM warnings ORDER BY category, code"
        )
        rows = cur.fetchall()
        cur.execute(
            "SELECT warning_id, COUNT(*) FROM product_warnings GROUP BY warning_id"
        )
        usage = {r[0]: r[1] for r in cur.fetchall()}
    return [
        {"id": r[0], "code": r[1], "title": r[2], "text": r[3],
         "category": r[4], "created_at": r[5], "usage_count": usage.get(r[0], 0)}
        for r in rows
    ]


@router.post("")
def create_warning(data: WarningCreate):
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO warnings (code, title, text, category) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (data.code, data.title, data.text, data.category),
            )
            wid = cur.fetchone()[0]
    except Exception:
        raise HTTPException(409, f"Code '{data.code}' existiert bereits")
    log_activity("warning_created", f"Warnhinweis '{data.code}' erstellt")
    return {"id": wid, "code": data.code}


@router.put("/{warning_id}")
def update_warning(warning_id: int, data: WarningUpdate):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM warnings WHERE id = %s", (warning_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Warnhinweis nicht gefunden")
        updates: list[str] = []
        vals: list = []
        for field in ("code", "title", "text", "category"):
            v = getattr(data, field)
            if v is not None:
                updates.append(f"{field} = %s")
                vals.append(v)
        if updates:
            vals.append(warning_id)
            cur.execute(f"UPDATE warnings SET {', '.join(updates)} WHERE id = %s", vals)
    return {"updated": True}


@router.delete("/{warning_id}")
def delete_warning(warning_id: int):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT code FROM warnings WHERE id = %s", (warning_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Warnhinweis nicht gefunden")
        cur.execute("DELETE FROM product_warnings WHERE warning_id = %s", (warning_id,))
        cur.execute("DELETE FROM warnings WHERE id = %s", (warning_id,))
    log_activity("warning_deleted", f"Warnhinweis '{row[0]}' gelöscht")
    return {"deleted": True}


# --- Product-Warning assignments ---

@router.get("/product/{artikelnummer}")
def get_product_warnings(artikelnummer: str):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT w.id, w.code, w.title, w.text, w.category
            FROM product_warnings pw
            JOIN warnings w ON pw.warning_id = w.id
            WHERE pw.artikelnummer = %s
            ORDER BY w.category, w.code
            """,
            (artikelnummer,),
        )
        rows = cur.fetchall()
    return [
        {"id": r[0], "code": r[1], "title": r[2], "text": r[3], "category": r[4]}
        for r in rows
    ]


@router.post("/product/{artikelnummer}")
def assign_warning(artikelnummer: str, data: dict):
    warning_id = data.get("warning_id")
    if not warning_id:
        raise HTTPException(400, "warning_id erforderlich")
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO product_warnings (artikelnummer, warning_id) "
            "VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (artikelnummer, warning_id),
        )
    return {"assigned": True}


@router.delete("/product/{artikelnummer}/{warning_id}")
def unassign_warning(artikelnummer: str, warning_id: int):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "DELETE FROM product_warnings "
            "WHERE artikelnummer = %s AND warning_id = %s",
            (artikelnummer, warning_id),
        )
    return {"removed": True}
