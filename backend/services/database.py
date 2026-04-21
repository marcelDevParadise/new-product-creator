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

# Lazy connection pool — created on first use so importing this module
# does not require a reachable database.
_pool: ConnectionPool | None = None


def _get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=get_database_url(),
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
            CREATE TABLE IF NOT EXISTS product_ingredients (
                artikelnummer TEXT NOT NULL,
                ingredient_id BIGINT NOT NULL,
                percentage TEXT DEFAULT '',
                position INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (artikelnummer, ingredient_id),
                FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
            )
        """)
        _migrate_product_columns(cur)
        _migrate_template_columns(cur)


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
