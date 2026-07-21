"""PostgreSQL database for product & attribute persistence.

Function signatures and return types mirror the previous SQLite implementation
so that the rest of the codebase (state.py, routers/*) does not need to change.
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg_pool import ConnectionPool

from config import get_database_url
from models.product import Product
from models.attribute import AttributeDefinition
from services.sqlite_backend import is_sqlite_url, make_pool as _make_sqlite_pool, SqlitePool

# Lazy connection pool — created on first use so importing this module
# does not require a reachable database.
_pool: ConnectionPool | SqlitePool | None = None


def _get_pool() -> ConnectionPool | SqlitePool:
    global _pool
    if _pool is None:
        url = get_database_url()
        if is_sqlite_url(url):
            _pool = _make_sqlite_pool(url)
        else:
            _pool = ConnectionPool(
                conninfo=url,
                min_size=1,
                max_size=10,
                kwargs={"autocommit": True},
                open=True,
            )
    return _pool


@contextmanager
def _conn() -> Iterator[psycopg.Connection]:
    """Acquire a connection from the pool for the duration of the block."""
    pool = _get_pool()
    with pool.connection() as connection:
        yield connection


# Public alias used by routers that need direct cursor access.
get_conn = _conn


# --- Schema ---

_NOW_SQL = "to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')"


def init_db() -> None:
    """Create tables if they don't exist and run column migrations."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS products (
                artikelnummer TEXT PRIMARY KEY,
                artikelname TEXT NOT NULL,
                preis DOUBLE PRECISION,
                gewicht DOUBLE PRECISION,
                hersteller TEXT,
                ean TEXT,
                attributes TEXT NOT NULL DEFAULT '{}',
                exported INTEGER NOT NULL DEFAULT 0
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS templates (
                name TEXT PRIMARY KEY,
                attributes TEXT NOT NULL DEFAULT '{}'
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS attribute_definitions (
                key TEXT PRIMARY KEY,
                id TEXT NOT NULL,
                category TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                required INTEGER NOT NULL DEFAULT 0,
                required_for_types TEXT NOT NULL DEFAULT '[]',
                default_value TEXT,
                suggested_values TEXT NOT NULL DEFAULT '[]',
                smart_defaults TEXT NOT NULL DEFAULT '[]',
                sort_order INTEGER NOT NULL DEFAULT 0
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS activity_log (
                id BIGSERIAL PRIMARY KEY,
                event_type TEXT NOT NULL,
                detail TEXT,
                count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS product_history (
                id BIGSERIAL PRIMARY KEY,
                artikelnummer TEXT NOT NULL,
                event_type TEXT NOT NULL,
                field TEXT,
                old_value TEXT,
                new_value TEXT,
                detail TEXT,
                created_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_product_history_sku
            ON product_history (artikelnummer, created_at DESC)
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS export_history (
                id BIGSERIAL PRIMARY KEY,
                export_type TEXT NOT NULL,
                filename TEXT NOT NULL,
                product_count INTEGER NOT NULL DEFAULT 0,
                row_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        # Bundles
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bundles (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                items TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
                updated_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            )
        """)
        # Warnings
        cur.execute("""
            CREATE TABLE IF NOT EXISTS warnings (
                id BIGSERIAL PRIMARY KEY,
                code TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                text TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'Allgemein',
                created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS product_warnings (
                artikelnummer TEXT NOT NULL,
                warning_id BIGINT NOT NULL,
                PRIMARY KEY (artikelnummer, warning_id),
                FOREIGN KEY (warning_id) REFERENCES warnings(id) ON DELETE CASCADE
            )
        """)
        # Ingredients
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ingredients (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                inci_name TEXT DEFAULT '',
                cas_number TEXT DEFAULT '',
                category TEXT NOT NULL DEFAULT 'Allgemein',
                created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS suppliers (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
                updated_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            )
        """)
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_name_ci
            ON suppliers (LOWER(name))
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS product_ingredients (
                artikelnummer TEXT NOT NULL,
                ingredient_id BIGINT NOT NULL,
                percentage TEXT DEFAULT '',
                position INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (artikelnummer, ingredient_id),
                FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS articlewerk_publications (
                artikelnummer TEXT PRIMARY KEY,
                remote_article_id TEXT,
                status TEXT NOT NULL DEFAULT 'not_published',
                payload_hash TEXT,
                last_error_code TEXT,
                last_error_message TEXT,
                last_request_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS articlewerk_jobs (
                job_id TEXT PRIMARY KEY,
                root_sku TEXT NOT NULL,
                status TEXT NOT NULL,
                current_phase TEXT,
                progress_current INTEGER NOT NULL DEFAULT 0,
                progress_total INTEGER NOT NULL DEFAULT 0,
                preview_json TEXT NOT NULL DEFAULT '{}',
                last_error TEXT,
                created_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS articlewerk_operations (
                operation_id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                artikelnummer TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                resource_key TEXT NOT NULL,
                idempotency_key TEXT,
                payload_hash TEXT NOT NULL,
                status TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                remote_operation_id TEXT,
                response_json TEXT,
                error_code TEXT,
                request_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE (artikelnummer, operation_type, resource_key, payload_hash)
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_articlewerk_jobs_status
            ON articlewerk_jobs (status, created_at)
        """)
        _migrate_product_columns(cur)
        _migrate_template_columns(cur)
        _migrate_articlewerk_columns(cur)
        _migrate_supplier_columns(cur)
        cur.execute(
            "INSERT INTO suppliers (name) "
            "SELECT DISTINCT TRIM(lieferant_name) FROM products "
            "WHERE lieferant_name IS NOT NULL AND TRIM(lieferant_name) <> '' "
            "ON CONFLICT DO NOTHING"
        )


# --- Suppliers ---

def load_all_suppliers() -> list[dict]:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT s.id, s.name, s.supplier_number, s.currency, s.email, s.phone, s.website, s.active, "
            "s.default_company_id, s.default_warehouse_id, s.articlewerk_supplier_id, "
            "s.articlewerk_revision, s.articlewerk_synced_at, s.articlewerk_sync_error, COUNT(p.artikelnummer), s.created_at, s.updated_at "
            "FROM suppliers s LEFT JOIN products p ON LOWER(p.lieferant_name) = LOWER(s.name) "
            "GROUP BY s.id, s.name, s.supplier_number, s.currency, s.email, s.phone, s.website, s.active, "
            "s.default_company_id, s.default_warehouse_id, s.articlewerk_supplier_id, "
            "s.articlewerk_revision, s.articlewerk_synced_at, s.articlewerk_sync_error, s.created_at, s.updated_at "
            "ORDER BY LOWER(s.name)"
        )
        rows = cur.fetchall()
    return [
        {
            "id": row[0], "name": row[1], "supplier_number": row[2], "currency": row[3],
            "email": row[4], "phone": row[5], "website": row[6], "active": bool(row[7]),
            "default_company_id": row[8], "default_warehouse_id": row[9],
            "articlewerk_supplier_id": row[10], "articlewerk_revision": row[11],
            "articlewerk_synced_at": row[12], "articlewerk_sync_error": row[13],
            "product_count": row[14], "created_at": row[15], "updated_at": row[16],
        }
        for row in rows
    ]


def create_supplier(data: dict) -> dict:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO suppliers "
            f"(name, supplier_number, currency, email, phone, website, active, default_company_id, default_warehouse_id, created_at, updated_at) "
            f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, {_NOW_SQL}, {_NOW_SQL}) RETURNING id",
            (data["name"], data.get("supplier_number"), data.get("currency", "EUR"), data.get("email"),
             data.get("phone"), data.get("website"), int(data.get("active", True)),
             data.get("default_company_id"), data.get("default_warehouse_id")),
        )
        supplier_id = cur.fetchone()[0]
    return next(item for item in load_all_suppliers() if item["id"] == supplier_id)


def update_supplier(supplier_id: int, data: dict) -> tuple[dict | None, str | None]:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT name FROM suppliers WHERE id = %s", (supplier_id,))
        row = cur.fetchone()
        if not row:
            return None, None
        old_name = row[0]
        cur.execute(
            f"UPDATE suppliers SET name=%s, supplier_number=%s, currency=%s, email=%s, phone=%s, website=%s, "
            f"active=%s, default_company_id=%s, default_warehouse_id=%s, updated_at={_NOW_SQL} WHERE id=%s",
            (data["name"], data.get("supplier_number"), data.get("currency", "EUR"), data.get("email"),
             data.get("phone"), data.get("website"), int(data.get("active", True)),
             data.get("default_company_id"), data.get("default_warehouse_id"), supplier_id),
        )
        cur.execute(
            "UPDATE products SET lieferant_name = %s WHERE LOWER(lieferant_name) = LOWER(%s)",
            (data["name"], old_name),
        )
    supplier = next((item for item in load_all_suppliers() if item["id"] == supplier_id), None)
    return supplier, old_name


def save_supplier_articlewerk_result(
    supplier_id: int, *, remote_id: str | None = None, revision: str | None = None,
    error: str | None = None,
) -> dict | None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"UPDATE suppliers SET articlewerk_supplier_id=COALESCE(%s, articlewerk_supplier_id), "
            f"articlewerk_revision=COALESCE(%s, articlewerk_revision), "
            f"articlewerk_synced_at=CASE WHEN %s IS NOT NULL THEN {_NOW_SQL} ELSE articlewerk_synced_at END, "
            f"articlewerk_sync_error=%s, updated_at={_NOW_SQL} WHERE id=%s",
            (remote_id, revision, remote_id, error, supplier_id),
        )
    return next((item for item in load_all_suppliers() if item["id"] == supplier_id), None)


def upsert_articlewerk_supplier(remote: dict) -> tuple[dict, bool]:
    remote_id = str(remote["id"])
    number = str(remote["supplierNumber"]).strip()
    name = str(remote["name"]).strip()
    suppliers = load_all_suppliers()
    match = next((item for item in suppliers if item.get("articlewerk_supplier_id") == remote_id), None)
    if match is None:
        match = next(
            (item for item in suppliers if (item.get("supplier_number") or "").casefold() == number.casefold()),
            None,
        )
    if match is None:
        match = next(
            (item for item in suppliers
             if not item.get("supplier_number") and item["name"].casefold() == name.casefold()),
            None,
        )
    with _conn() as conn, conn.cursor() as cur:
        if match:
            cur.execute(
                f"UPDATE suppliers SET name=%s, supplier_number=%s, currency=%s, email=%s, phone=%s, website=%s, "
                f"active=%s, articlewerk_supplier_id=%s, articlewerk_revision=%s, articlewerk_synced_at={_NOW_SQL}, "
                f"articlewerk_sync_error=NULL, updated_at={_NOW_SQL} WHERE id=%s",
                (name, number, remote.get("currency", "EUR"), remote.get("email"), remote.get("phone"),
                 remote.get("website"), int(remote.get("active", True)), remote_id, remote.get("revision"), match["id"]),
            )
            if match["name"] != name:
                cur.execute(
                    "UPDATE products SET lieferant_name=%s WHERE LOWER(lieferant_name)=LOWER(%s)",
                    (name, match["name"]),
                )
            supplier_id = match["id"]
            created = False
        else:
            cur.execute(
                f"INSERT INTO suppliers "
                f"(name, supplier_number, currency, email, phone, website, active, articlewerk_supplier_id, "
                f"articlewerk_revision, articlewerk_synced_at, created_at, updated_at) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,{_NOW_SQL},{_NOW_SQL},{_NOW_SQL}) RETURNING id",
                (name, number, remote.get("currency", "EUR"), remote.get("email"), remote.get("phone"),
                 remote.get("website"), int(remote.get("active", True)), remote_id, remote.get("revision")),
            )
            supplier_id = cur.fetchone()[0]
            created = True
    supplier = next(item for item in load_all_suppliers() if item["id"] == supplier_id)
    return supplier, created


def delete_supplier(supplier_id: int) -> tuple[bool, str | None, int]:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT s.name, COUNT(p.artikelnummer) FROM suppliers s "
            "LEFT JOIN products p ON LOWER(p.lieferant_name) = LOWER(s.name) "
            "WHERE s.id = %s GROUP BY s.id, s.name",
            (supplier_id,),
        )
        row = cur.fetchone()
        if not row:
            return False, None, 0
        name, product_count = row
        if product_count:
            return False, name, product_count
        cur.execute("DELETE FROM suppliers WHERE id = %s", (supplier_id,))
    return True, name, 0


def _migrate_product_columns(cur: psycopg.Cursor) -> None:
    """Add new Stammdaten columns to existing products table (idempotent)."""
    migrations = [
        ("preis", "DOUBLE PRECISION"),
        ("gewicht", "DOUBLE PRECISION"),
        ("hersteller", "TEXT"),
        ("ean", "TEXT"),
        ("ek", "DOUBLE PRECISION"),
        ("stammdaten_complete", "INTEGER DEFAULT 0"),
        # Maße
        ("laenge", "DOUBLE PRECISION"),
        ("breite", "DOUBLE PRECISION"),
        ("hoehe", "DOUBLE PRECISION"),
        # Grundpreis
        ("verkaufseinheit", "DOUBLE PRECISION"),
        ("inhalt_menge", "DOUBLE PRECISION"),
        ("inhalt_einheit", "TEXT"),
        ("grundpreis_ausweisen", "INTEGER DEFAULT 0"),
        ("bezugsmenge", "DOUBLE PRECISION"),
        ("bezugsmenge_einheit", "TEXT"),
        # Lieferant
        ("lieferant_name", "TEXT"),
        ("lieferant_artikelnummer", "TEXT"),
        ("lieferant_artikelname", "TEXT"),
        ("lieferant_netto_ek", "DOUBLE PRECISION"),
        # Bilder
        ("bild_1", "TEXT"),
        ("bild_2", "TEXT"),
        ("bild_3", "TEXT"),
        ("bild_4", "TEXT"),
        ("bild_5", "TEXT"),
        ("bild_6", "TEXT"),
        ("bild_7", "TEXT"),
        ("bild_8", "TEXT"),
        ("bild_9", "TEXT"),
        # Kategorien
        ("kategorie_1", "TEXT"),
        ("kategorie_2", "TEXT"),
        ("kategorie_3", "TEXT"),
        ("kategorie_4", "TEXT"),
        ("kategorie_5", "TEXT"),
        ("kategorie_6", "TEXT"),
        # SEO & Content
        ("kurzbeschreibung", "TEXT"),
        ("beschreibung", "TEXT"),
        ("url_pfad", "TEXT"),
        ("title_tag", "TEXT"),
        ("meta_description", "TEXT"),
        ("seo_keywords", "TEXT"),
        # Varianten
        ("parent_sku", "TEXT"),
        ("is_parent", "INTEGER DEFAULT 0"),
        ("variant_attributes", "TEXT DEFAULT '{}'"),
    ]
    for col_name, col_type in migrations:
        cur.execute(f"ALTER TABLE products ADD COLUMN IF NOT EXISTS {col_name} {col_type}")


def _migrate_template_columns(cur: psycopg.Cursor) -> None:
    """Add metadata columns (category, description) to templates table."""
    cur.execute("ALTER TABLE templates ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''")
    cur.execute("ALTER TABLE templates ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''")


def _migrate_articlewerk_columns(cur: psycopg.Cursor) -> None:
    cur.execute("ALTER TABLE articlewerk_jobs ADD COLUMN IF NOT EXISTS preview_json TEXT NOT NULL DEFAULT '{}'")


def _migrate_supplier_columns(cur: psycopg.Cursor) -> None:
    migrations = [
        ("supplier_number", "TEXT"),
        ("currency", "TEXT NOT NULL DEFAULT 'EUR'"),
        ("email", "TEXT"),
        ("phone", "TEXT"),
        ("website", "TEXT"),
        ("active", "INTEGER NOT NULL DEFAULT 1"),
        ("default_company_id", "INTEGER"),
        ("default_warehouse_id", "INTEGER"),
        ("articlewerk_supplier_id", "TEXT"),
        ("articlewerk_revision", "TEXT"),
        ("articlewerk_synced_at", "TEXT"),
        ("articlewerk_sync_error", "TEXT"),
    ]
    for col_name, col_type in migrations:
        cur.execute(f"ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_number_ci "
        "ON suppliers (LOWER(supplier_number)) WHERE supplier_number IS NOT NULL AND supplier_number <> ''"
    )


# --- Artikelwerk publication state ---

def create_articlewerk_job(job_id: str, root_sku: str, total: int, preview: dict) -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO articlewerk_jobs "
            f"(job_id, root_sku, status, current_phase, progress_current, progress_total, preview_json, created_at) "
            f"VALUES (%s, %s, 'queued', 'queued', 0, %s, %s, {_NOW_SQL})",
            (job_id, root_sku, total, json.dumps(preview, ensure_ascii=False)),
        )


def update_articlewerk_job(
    job_id: str,
    *,
    status: str,
    phase: str | None = None,
    progress: int | None = None,
    last_error: str | None = None,
) -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"UPDATE articlewerk_jobs SET status=%s, current_phase=%s, "
            f"progress_current=COALESCE(%s, progress_current), last_error=%s, "
            f"started_at=CASE WHEN %s='publishing' AND started_at IS NULL THEN {_NOW_SQL} ELSE started_at END, "
            f"finished_at=CASE WHEN %s IN ('published','failed','partial') THEN {_NOW_SQL} ELSE finished_at END "
            f"WHERE job_id=%s",
            (status, phase, progress, last_error, status, status, job_id),
        )


def get_articlewerk_job(job_id: str) -> dict | None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT job_id, root_sku, status, current_phase, progress_current, progress_total, "
            "last_error, created_at, started_at, finished_at FROM articlewerk_jobs WHERE job_id=%s",
            (job_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    keys = ("job_id", "root_sku", "status", "current_phase", "progress_current", "progress_total",
            "last_error", "created_at", "started_at", "finished_at")
    return dict(zip(keys, row))


def list_articlewerk_jobs(limit: int = 50) -> list[dict]:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT job_id, root_sku, status, current_phase, progress_current, progress_total, "
            "last_error, created_at, started_at, finished_at FROM articlewerk_jobs "
            "ORDER BY created_at DESC LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
    keys = ("job_id", "root_sku", "status", "current_phase", "progress_current", "progress_total",
            "last_error", "created_at", "started_at", "finished_at")
    return [dict(zip(keys, row)) for row in rows]


def list_articlewerk_logs(
    *, limit: int = 100, status: str | None = None, search: str | None = None,
) -> dict:
    """Return persisted publication jobs with their individual API operations."""
    conditions: list[str] = []
    params: list[object] = []
    if status:
        if status == "errors":
            conditions.append("j.status IN ('failed', 'partial')")
        else:
            conditions.append("j.status=%s")
            params.append(status)
    if search:
        pattern = f"%{search.strip()}%"
        conditions.append(
            "(LOWER(j.root_sku) LIKE LOWER(%s) OR LOWER(j.job_id) LIKE LOWER(%s) "
            "OR LOWER(COALESCE(j.last_error, '')) LIKE LOWER(%s) OR EXISTS ("
            "SELECT 1 FROM articlewerk_operations search_op WHERE search_op.job_id=j.job_id "
            "AND (LOWER(COALESCE(search_op.request_id, '')) LIKE LOWER(%s) "
            "OR LOWER(COALESCE(search_op.error_code, '')) LIKE LOWER(%s))))"
        )
        params.extend([pattern] * 5)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""

    with _conn() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM articlewerk_jobs j{where}", tuple(params))
        total = int(cur.fetchone()[0])
        cur.execute(
            "SELECT j.job_id, j.root_sku, j.status, j.current_phase, j.progress_current, "
            "j.progress_total, j.last_error, j.created_at, j.started_at, j.finished_at, "
            "o.operation_id, o.operation_type, o.resource_key, o.status, o.attempts, "
            "o.remote_operation_id, o.error_code, o.request_id, o.created_at, o.updated_at "
            "FROM (SELECT * FROM articlewerk_jobs j" + where
            + " ORDER BY j.created_at DESC LIMIT %s) j "
            "LEFT JOIN articlewerk_operations o ON o.job_id=j.job_id "
            "ORDER BY j.created_at DESC, o.created_at ASC",
            tuple([*params, limit]),
        )
        rows = cur.fetchall()

    jobs: list[dict] = []
    by_id: dict[str, dict] = {}
    for row in rows:
        job_id = row[0]
        job = by_id.get(job_id)
        if job is None:
            job = {
                "job_id": job_id, "root_sku": row[1], "status": row[2],
                "current_phase": row[3], "progress_current": row[4], "progress_total": row[5],
                "last_error": row[6], "created_at": row[7], "started_at": row[8],
                "finished_at": row[9], "operations": [],
            }
            by_id[job_id] = job
            jobs.append(job)
        if row[10] is not None:
            job["operations"].append({
                "operation_id": row[10], "operation_type": row[11], "resource_key": row[12],
                "status": row[13], "attempts": row[14], "remote_operation_id": row[15],
                "error_code": row[16], "request_id": row[17], "created_at": row[18],
                "updated_at": row[19],
            })
    return {"items": jobs, "total": total}


def list_resumable_articlewerk_jobs() -> list[dict]:
    """Return queued/interrupted jobs including their immutable preview."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT job_id, preview_json FROM articlewerk_jobs "
            "WHERE status IN ('queued', 'publishing') ORDER BY created_at"
        )
        rows = cur.fetchall()
    result = []
    for job_id, preview_json in rows:
        try:
            preview = json.loads(preview_json)
        except (TypeError, json.JSONDecodeError):
            preview = None
        if preview:
            result.append({"job_id": job_id, "preview": preview})
    return result


def upsert_articlewerk_publication(
    artikelnummer: str,
    *,
    status: str,
    remote_article_id: str | None = None,
    payload_hash: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    request_id: str | None = None,
) -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO articlewerk_publications "
            f"(artikelnummer, remote_article_id, status, payload_hash, last_error_code, "
            f"last_error_message, last_request_id, created_at, updated_at) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,{_NOW_SQL},{_NOW_SQL}) "
            f"ON CONFLICT (artikelnummer) DO UPDATE SET "
            f"remote_article_id=COALESCE(excluded.remote_article_id, articlewerk_publications.remote_article_id), "
            f"status=excluded.status, payload_hash=COALESCE(excluded.payload_hash, articlewerk_publications.payload_hash), "
            f"last_error_code=excluded.last_error_code, last_error_message=excluded.last_error_message, "
            f"last_request_id=excluded.last_request_id, updated_at={_NOW_SQL}",
            (artikelnummer, remote_article_id, status, payload_hash, error_code, error_message, request_id),
        )


def get_articlewerk_publication(artikelnummer: str) -> dict | None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT artikelnummer, remote_article_id, status, payload_hash, last_error_code, "
            "last_error_message, last_request_id, created_at, updated_at "
            "FROM articlewerk_publications WHERE artikelnummer=%s",
            (artikelnummer,),
        )
        row = cur.fetchone()
    if not row:
        return None
    keys = ("artikelnummer", "remote_article_id", "status", "payload_hash", "last_error_code",
            "last_error_message", "last_request_id", "created_at", "updated_at")
    return dict(zip(keys, row))


def get_articlewerk_operation(
    artikelnummer: str, operation_type: str, resource_key: str, payload_hash: str,
) -> dict | None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT operation_id, job_id, artikelnummer, operation_type, resource_key, idempotency_key, "
            "payload_hash, status, attempts, remote_operation_id, response_json, error_code, request_id "
            "FROM articlewerk_operations WHERE artikelnummer=%s AND operation_type=%s "
            "AND resource_key=%s AND payload_hash=%s",
            (artikelnummer, operation_type, resource_key, payload_hash),
        )
        row = cur.fetchone()
    if not row:
        return None
    keys = ("operation_id", "job_id", "artikelnummer", "operation_type", "resource_key", "idempotency_key",
            "payload_hash", "status", "attempts", "remote_operation_id", "response_json", "error_code", "request_id")
    result = dict(zip(keys, row))
    result["response"] = json.loads(result.pop("response_json")) if result.get("response_json") else None
    return result


def save_articlewerk_operation(
    operation_id: str,
    job_id: str,
    artikelnummer: str,
    operation_type: str,
    resource_key: str,
    payload_hash: str,
    *,
    status: str,
    idempotency_key: str | None = None,
    response: dict | None = None,
    remote_operation_id: str | None = None,
    error_code: str | None = None,
    request_id: str | None = None,
) -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO articlewerk_operations "
            f"(operation_id, job_id, artikelnummer, operation_type, resource_key, idempotency_key, "
            f"payload_hash, status, attempts, remote_operation_id, response_json, error_code, request_id, created_at, updated_at) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,1,%s,%s,%s,%s,{_NOW_SQL},{_NOW_SQL}) "
            f"ON CONFLICT (artikelnummer, operation_type, resource_key, payload_hash) DO UPDATE SET "
            f"job_id=excluded.job_id, status=excluded.status, "
            f"attempts=CASE WHEN excluded.status='pending' THEN articlewerk_operations.attempts+1 ELSE articlewerk_operations.attempts END, "
            f"remote_operation_id=COALESCE(excluded.remote_operation_id, articlewerk_operations.remote_operation_id), "
            f"response_json=COALESCE(excluded.response_json, articlewerk_operations.response_json), "
            f"error_code=excluded.error_code, request_id=excluded.request_id, updated_at={_NOW_SQL}",
            (operation_id, job_id, artikelnummer, operation_type, resource_key, idempotency_key,
             payload_hash, status, remote_operation_id, json.dumps(response) if response is not None else None,
             error_code, request_id),
        )


# --- Products ---

def load_all_products() -> dict[str, Product]:
    """Load all products from the database."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT artikelnummer, artikelname, ek, preis, gewicht, hersteller, ean, "
            "attributes, exported, stammdaten_complete, "
            "laenge, breite, hoehe, "
            "verkaufseinheit, inhalt_menge, inhalt_einheit, grundpreis_ausweisen, bezugsmenge, bezugsmenge_einheit, "
            "lieferant_name, lieferant_artikelnummer, lieferant_artikelname, lieferant_netto_ek, "
            "bild_1, bild_2, bild_3, bild_4, bild_5, bild_6, bild_7, bild_8, bild_9, "
            "kategorie_1, kategorie_2, kategorie_3, kategorie_4, kategorie_5, kategorie_6, "
            "kurzbeschreibung, beschreibung, url_pfad, title_tag, meta_description, seo_keywords, "
            "parent_sku, is_parent, variant_attributes "
            "FROM products"
        )
        rows = cur.fetchall()
    products: dict[str, Product] = {}
    for row in rows:
        products[row[0]] = Product(
            artikelnummer=row[0],
            artikelname=row[1],
            ek=row[2],
            preis=row[3],
            gewicht=row[4],
            hersteller=row[5],
            ean=row[6],
            attributes=json.loads(row[7]),
            exported=bool(row[8]),
            stammdaten_complete=bool(row[9]),
            laenge=row[10],
            breite=row[11],
            hoehe=row[12],
            verkaufseinheit=row[13],
            inhalt_menge=row[14],
            inhalt_einheit=row[15],
            grundpreis_ausweisen=bool(row[16]) if row[16] is not None else False,
            bezugsmenge=row[17],
            bezugsmenge_einheit=row[18],
            lieferant_name=row[19],
            lieferant_artikelnummer=row[20],
            lieferant_artikelname=row[21],
            lieferant_netto_ek=row[22],
            bild_1=row[23],
            bild_2=row[24],
            bild_3=row[25],
            bild_4=row[26],
            bild_5=row[27],
            bild_6=row[28],
            bild_7=row[29],
            bild_8=row[30],
            bild_9=row[31],
            kategorie_1=row[32],
            kategorie_2=row[33],
            kategorie_3=row[34],
            kategorie_4=row[35],
            kategorie_5=row[36],
            kategorie_6=row[37],
            kurzbeschreibung=row[38],
            beschreibung=row[39],
            url_pfad=row[40],
            title_tag=row[41],
            meta_description=row[42],
            seo_keywords=row[43],
            parent_sku=row[44],
            is_parent=bool(row[45]) if row[45] is not None else False,
            variant_attributes=json.loads(row[46]) if row[46] else {},
        )
    return products


def save_product(product: Product) -> None:
    """Insert or update a single product."""
    cols = [
        "artikelnummer", "artikelname", "ek", "preis", "gewicht", "hersteller", "ean",
        "attributes", "exported", "stammdaten_complete",
        "laenge", "breite", "hoehe",
        "verkaufseinheit", "inhalt_menge", "inhalt_einheit", "grundpreis_ausweisen", "bezugsmenge", "bezugsmenge_einheit",
        "lieferant_name", "lieferant_artikelnummer", "lieferant_artikelname", "lieferant_netto_ek",
        "bild_1", "bild_2", "bild_3", "bild_4", "bild_5", "bild_6", "bild_7", "bild_8", "bild_9",
        "kategorie_1", "kategorie_2", "kategorie_3", "kategorie_4", "kategorie_5", "kategorie_6",
        "kurzbeschreibung", "beschreibung", "url_pfad", "title_tag", "meta_description", "seo_keywords",
        "parent_sku", "is_parent", "variant_attributes",
    ]
    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(cols)
    updates = ", ".join(f"{c} = excluded.{c}" for c in cols if c != "artikelnummer")
    vals = (
        product.artikelnummer, product.artikelname, product.ek, product.preis, product.gewicht,
        product.hersteller, product.ean, json.dumps(product.attributes), int(product.exported),
        int(product.stammdaten_complete),
        product.laenge, product.breite, product.hoehe,
        product.verkaufseinheit, product.inhalt_menge, product.inhalt_einheit, int(product.grundpreis_ausweisen), product.bezugsmenge, product.bezugsmenge_einheit,
        product.lieferant_name, product.lieferant_artikelnummer, product.lieferant_artikelname, product.lieferant_netto_ek,
        product.bild_1, product.bild_2, product.bild_3, product.bild_4, product.bild_5, product.bild_6, product.bild_7, product.bild_8, product.bild_9,
        product.kategorie_1, product.kategorie_2, product.kategorie_3, product.kategorie_4, product.kategorie_5, product.kategorie_6,
        product.kurzbeschreibung, product.beschreibung, product.url_pfad, product.title_tag, product.meta_description, product.seo_keywords,
        product.parent_sku, int(product.is_parent), json.dumps(product.variant_attributes),
    )
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO products ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT (artikelnummer) DO UPDATE SET {updates}",
            vals,
        )


def delete_product(artikelnummer: str) -> None:
    """Remove a single product from the database."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM products WHERE artikelnummer = %s", (artikelnummer,))


def delete_all_products() -> None:
    """Remove all products from the database."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM products")


# --- Templates ---

def load_all_templates() -> dict[str, dict]:
    """Load all templates from the database.

    Returns a dict mapping name -> {"attributes": dict, "category": str, "description": str}.
    """
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT name, attributes, category, description FROM templates")
        rows = cur.fetchall()
    return {
        name: {
            "attributes": json.loads(attrs_json),
            "category": category or "",
            "description": description or "",
        }
        for name, attrs_json, category, description in rows
    }


def save_template(
    name: str,
    attributes: dict[str, str | int | bool],
    category: str = "",
    description: str = "",
) -> None:
    """Insert or update a template with its metadata."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """INSERT INTO templates (name, attributes, category, description) VALUES (%s, %s, %s, %s)
               ON CONFLICT (name) DO UPDATE SET
                 attributes = excluded.attributes,
                 category = excluded.category,
                 description = excluded.description""",
            (name, json.dumps(attributes), category, description),
        )


def delete_template(name: str) -> None:
    """Remove a template from the database."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM templates WHERE name = %s", (name,))


# --- Attribute Definitions ---

def load_all_attribute_definitions() -> dict[str, AttributeDefinition]:
    """Load all attribute definitions from the database."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT key, id, category, name, description, required, "
            "required_for_types, default_value, suggested_values, smart_defaults, sort_order "
            "FROM attribute_definitions ORDER BY sort_order, key"
        )
        rows = cur.fetchall()
    result: dict[str, AttributeDefinition] = {}
    for row in rows:
        key, attr_id, category, name, description, required, rft_json, default_value, sv_json, sd_json, _sort = row
        result[key] = AttributeDefinition(
            id=attr_id,
            category=category,
            name=name,
            description=description,
            required=bool(required),
            required_for_types=json.loads(rft_json),
            default_value=default_value,
            suggested_values=json.loads(sv_json),
            smart_defaults=json.loads(sd_json),
        )
    return result


def save_attribute_definition(key: str, attr: AttributeDefinition, sort_order: int = 0) -> None:
    """Insert or update an attribute definition."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """INSERT INTO attribute_definitions
               (key, id, category, name, description, required, required_for_types,
                default_value, suggested_values, smart_defaults, sort_order)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (key) DO UPDATE SET
                 id=excluded.id, category=excluded.category, name=excluded.name,
                 description=excluded.description, required=excluded.required,
                 required_for_types=excluded.required_for_types,
                 default_value=excluded.default_value,
                 suggested_values=excluded.suggested_values,
                 smart_defaults=excluded.smart_defaults,
                 sort_order=excluded.sort_order""",
            (
                key,
                attr.id,
                attr.category,
                attr.name,
                attr.description,
                int(attr.required),
                json.dumps(attr.required_for_types),
                attr.default_value,
                json.dumps(attr.suggested_values),
                json.dumps([sd.model_dump() for sd in attr.smart_defaults]),
                sort_order,
            ),
        )


def delete_attribute_definition(key: str) -> None:
    """Remove an attribute definition from the database."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM attribute_definitions WHERE key = %s", (key,))


def count_attribute_definitions() -> int:
    """Return the number of attribute definitions in the database."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM attribute_definitions")
        return cur.fetchone()[0]


# --- Activity Log ---

def log_activity(event_type: str, detail: str, count: int = 0) -> None:
    """Append an entry to the activity log."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO activity_log (event_type, detail, count, created_at) VALUES (%s, %s, %s, {_NOW_SQL})",
            (event_type, detail, count),
        )


def get_recent_activities(limit: int = 10) -> list[dict]:
    """Return the most recent activity log entries."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT event_type, detail, count, created_at FROM activity_log ORDER BY id DESC LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
    return [
        {"event_type": r[0], "detail": r[1], "count": r[2], "created_at": r[3]}
        for r in rows
    ]


# --- Export History ---

def log_export(export_type: str, filename: str, product_count: int, row_count: int) -> None:
    """Append an entry to the export history."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO export_history (export_type, filename, product_count, row_count, created_at) "
            f"VALUES (%s, %s, %s, %s, {_NOW_SQL})",
            (export_type, filename, product_count, row_count),
        )


def get_export_history(limit: int = 50) -> list[dict]:
    """Return the most recent export history entries."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, export_type, filename, product_count, row_count, created_at "
            "FROM export_history ORDER BY id DESC LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
    return [
        {"id": r[0], "export_type": r[1], "filename": r[2], "product_count": r[3], "row_count": r[4], "created_at": r[5]}
        for r in rows
    ]


# --- Product History ---

def log_product_history(artikelnummer: str, event_type: str, field: str | None = None,
                        old_value: str | None = None, new_value: str | None = None,
                        detail: str | None = None) -> None:
    """Append a change entry to the product history."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO product_history (artikelnummer, event_type, field, old_value, new_value, detail, created_at) "
            f"VALUES (%s, %s, %s, %s, %s, %s, {_NOW_SQL})",
            (artikelnummer, event_type, field, old_value, new_value, detail),
        )


def log_product_history_batch(entries: list[tuple]) -> None:
    """Batch-insert multiple history entries. Each tuple: (sku, event_type, field, old, new, detail)."""
    if not entries:
        return
    with _conn() as conn, conn.cursor() as cur:
        cur.executemany(
            f"INSERT INTO product_history (artikelnummer, event_type, field, old_value, new_value, detail, created_at) "
            f"VALUES (%s, %s, %s, %s, %s, %s, {_NOW_SQL})",
            entries,
        )


def get_product_history(artikelnummer: str, limit: int = 100) -> list[dict]:
    """Return history entries for a specific product."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, artikelnummer, event_type, field, old_value, new_value, detail, created_at "
            "FROM product_history WHERE artikelnummer = %s ORDER BY id DESC LIMIT %s",
            (artikelnummer, limit),
        )
        rows = cur.fetchall()
    return [
        {"id": r[0], "artikelnummer": r[1], "event_type": r[2], "field": r[3],
         "old_value": r[4], "new_value": r[5], "detail": r[6], "created_at": r[7]}
        for r in rows
    ]
