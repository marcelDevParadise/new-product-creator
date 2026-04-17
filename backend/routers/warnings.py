"""Warnings router — Product warning notices (Warnhinweise) management."""

import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.database import _get_connection, log_activity

router = APIRouter(prefix="/api/warnings", tags=["warnings"])

# --- DB setup ---

def _ensure_table():
    conn = _get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS warnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            text TEXT NOT NULL DEFAULT '',
            category TEXT NOT NULL DEFAULT 'Allgemein',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS product_warnings (
            artikelnummer TEXT NOT NULL,
            warning_id INTEGER NOT NULL,
            PRIMARY KEY (artikelnummer, warning_id),
            FOREIGN KEY (warning_id) REFERENCES warnings(id) ON DELETE CASCADE
        )
    """)
    conn.commit()

    # Seed from JSON if table is empty
    count = conn.execute("SELECT COUNT(*) FROM warnings").fetchone()[0]
    if count == 0:
        seed_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "warnings_seed.json")
        if os.path.exists(seed_path):
            with open(seed_path, "r", encoding="utf-8") as f:
                seeds = json.load(f)
            for s in seeds:
                try:
                    conn.execute(
                        "INSERT INTO warnings (code, title, text, category) VALUES (?, ?, ?, ?)",
                        (s["code"], s["title"], s.get("text", ""), s.get("category", "Allgemein")),
                    )
                except Exception:
                    pass
            conn.commit()
    conn.close()

_ensure_table()


# --- Models ---

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


# --- Endpoints ---

@router.get("")
def list_warnings():
    conn = _get_connection()
    rows = conn.execute("SELECT id, code, title, text, category, created_at FROM warnings ORDER BY category, code").fetchall()
    # Count usage per warning
    usage = {}
    for r in conn.execute("SELECT warning_id, COUNT(*) FROM product_warnings GROUP BY warning_id").fetchall():
        usage[r[0]] = r[1]
    conn.close()
    return [
        {"id": r[0], "code": r[1], "title": r[2], "text": r[3], "category": r[4], "created_at": r[5], "usage_count": usage.get(r[0], 0)}
        for r in rows
    ]


@router.post("")
def create_warning(data: WarningCreate):
    conn = _get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO warnings (code, title, text, category) VALUES (?, ?, ?, ?)",
            (data.code, data.title, data.text, data.category),
        )
        conn.commit()
        wid = cur.lastrowid
    except Exception:
        conn.close()
        raise HTTPException(409, f"Code '{data.code}' existiert bereits")
    conn.close()
    log_activity("warning_created", f"Warnhinweis '{data.code}' erstellt")
    return {"id": wid, "code": data.code}


@router.put("/{warning_id}")
def update_warning(warning_id: int, data: WarningUpdate):
    conn = _get_connection()
    row = conn.execute("SELECT id FROM warnings WHERE id = ?", (warning_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Warnhinweis nicht gefunden")
    updates, vals = [], []
    for field in ("code", "title", "text", "category"):
        v = getattr(data, field)
        if v is not None:
            updates.append(f"{field} = ?")
            vals.append(v)
    if updates:
        vals.append(warning_id)
        conn.execute(f"UPDATE warnings SET {', '.join(updates)} WHERE id = ?", vals)
        conn.commit()
    conn.close()
    return {"updated": True}


@router.delete("/{warning_id}")
def delete_warning(warning_id: int):
    conn = _get_connection()
    row = conn.execute("SELECT code FROM warnings WHERE id = ?", (warning_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Warnhinweis nicht gefunden")
    conn.execute("DELETE FROM product_warnings WHERE warning_id = ?", (warning_id,))
    conn.execute("DELETE FROM warnings WHERE id = ?", (warning_id,))
    conn.commit()
    conn.close()
    log_activity("warning_deleted", f"Warnhinweis '{row[0]}' gelöscht")
    return {"deleted": True}


# --- Product-Warning assignments ---

@router.get("/product/{artikelnummer}")
def get_product_warnings(artikelnummer: str):
    conn = _get_connection()
    rows = conn.execute("""
        SELECT w.id, w.code, w.title, w.text, w.category
        FROM product_warnings pw JOIN warnings w ON pw.warning_id = w.id
        WHERE pw.artikelnummer = ?
        ORDER BY w.category, w.code
    """, (artikelnummer,)).fetchall()
    conn.close()
    return [{"id": r[0], "code": r[1], "title": r[2], "text": r[3], "category": r[4]} for r in rows]


@router.post("/product/{artikelnummer}")
def assign_warning(artikelnummer: str, data: dict):
    warning_id = data.get("warning_id")
    if not warning_id:
        raise HTTPException(400, "warning_id erforderlich")
    conn = _get_connection()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO product_warnings (artikelnummer, warning_id) VALUES (?, ?)",
            (artikelnummer, warning_id),
        )
        conn.commit()
    finally:
        conn.close()
    return {"assigned": True}


@router.delete("/product/{artikelnummer}/{warning_id}")
def unassign_warning(artikelnummer: str, warning_id: int):
    conn = _get_connection()
    conn.execute(
        "DELETE FROM product_warnings WHERE artikelnummer = ? AND warning_id = ?",
        (artikelnummer, warning_id),
    )
    conn.commit()
    conn.close()
    return {"removed": True}
