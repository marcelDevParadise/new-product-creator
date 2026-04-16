"""SQLite database for product & attribute persistence."""

import json
import sqlite3
from pathlib import Path

from models.product import Product
from models.attribute import AttributeDefinition

DB_PATH = Path(__file__).parent / "data" / "products.db"


def _get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    conn = _get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS products (
            artikelnummer TEXT PRIMARY KEY,
            artikelname TEXT NOT NULL,
            preis REAL,
            gewicht REAL,
            hersteller TEXT,
            ean TEXT,
            attributes TEXT NOT NULL DEFAULT '{}',
            exported INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS templates (
            name TEXT PRIMARY KEY,
            attributes TEXT NOT NULL DEFAULT '{}'
        )
    """)
    conn.execute("""
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            detail TEXT,
            count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS product_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            artikelnummer TEXT NOT NULL,
            event_type TEXT NOT NULL,
            field TEXT,
            old_value TEXT,
            new_value TEXT,
            detail TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_product_history_sku
        ON product_history (artikelnummer, created_at DESC)
    """)
    # Migrate existing DB: add Stammdaten columns if missing
    _migrate_product_columns(conn)
    conn.commit()
    conn.close()


def _migrate_product_columns(conn: sqlite3.Connection) -> None:
    """Add new Stammdaten columns to existing products table."""
    cursor = conn.execute("PRAGMA table_info(products)")
    existing = {row[1] for row in cursor.fetchall()}
    migrations = [
        ("preis", "REAL"),
        ("gewicht", "REAL"),
        ("hersteller", "TEXT"),
        ("ean", "TEXT"),
        ("ek", "REAL"),
        ("stammdaten_complete", "INTEGER DEFAULT 0"),
        # Maße
        ("laenge", "REAL"),
        ("breite", "REAL"),
        ("hoehe", "REAL"),
        # Grundpreis
        ("verkaufseinheit", "REAL"),
        ("inhalt_menge", "REAL"),
        ("inhalt_einheit", "TEXT"),
        ("grundpreis_ausweisen", "INTEGER DEFAULT 0"),
        ("bezugsmenge", "REAL"),
        ("bezugsmenge_einheit", "TEXT"),
        # Lieferant
        ("lieferant_name", "TEXT"),
        ("lieferant_artikelnummer", "TEXT"),
        ("lieferant_artikelname", "TEXT"),
        ("lieferant_netto_ek", "REAL"),
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
        # Varianten
        ("parent_sku", "TEXT"),
        ("is_parent", "INTEGER DEFAULT 0"),
        ("variant_attributes", "TEXT DEFAULT '{}'"),
    ]
    for col_name, col_type in migrations:
        if col_name not in existing:
            conn.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_type}")


def load_all_products() -> dict[str, Product]:
    """Load all products from the database."""
    conn = _get_connection()
    rows = conn.execute(
        "SELECT artikelnummer, artikelname, ek, preis, gewicht, hersteller, ean, "
        "attributes, exported, stammdaten_complete, "
        "laenge, breite, hoehe, "
        "verkaufseinheit, inhalt_menge, inhalt_einheit, grundpreis_ausweisen, bezugsmenge, bezugsmenge_einheit, "
        "lieferant_name, lieferant_artikelnummer, lieferant_artikelname, lieferant_netto_ek, "
        "bild_1, bild_2, bild_3, bild_4, bild_5, bild_6, bild_7, bild_8, bild_9, "
        "kategorie_1, kategorie_2, kategorie_3, kategorie_4, kategorie_5, kategorie_6, "
        "kurzbeschreibung, beschreibung, url_pfad, title_tag, meta_description, "
        "parent_sku, is_parent, variant_attributes "
        "FROM products"
    ).fetchall()
    conn.close()
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
            parent_sku=row[43],
            is_parent=bool(row[44]) if row[44] is not None else False,
            variant_attributes=json.loads(row[45]) if row[45] else {},
        )
    return products


def save_product(product: Product) -> None:
    """Insert or update a single product."""
    conn = _get_connection()
    cols = [
        "artikelnummer", "artikelname", "ek", "preis", "gewicht", "hersteller", "ean",
        "attributes", "exported", "stammdaten_complete",
        "laenge", "breite", "hoehe",
        "verkaufseinheit", "inhalt_menge", "inhalt_einheit", "grundpreis_ausweisen", "bezugsmenge", "bezugsmenge_einheit",
        "lieferant_name", "lieferant_artikelnummer", "lieferant_artikelname", "lieferant_netto_ek",
        "bild_1", "bild_2", "bild_3", "bild_4", "bild_5", "bild_6", "bild_7", "bild_8", "bild_9",
        "kategorie_1", "kategorie_2", "kategorie_3", "kategorie_4", "kategorie_5", "kategorie_6",
        "kurzbeschreibung", "beschreibung", "url_pfad", "title_tag", "meta_description",
        "parent_sku", "is_parent", "variant_attributes",
    ]
    placeholders = ", ".join(["?"] * len(cols))
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
        product.kurzbeschreibung, product.beschreibung, product.url_pfad, product.title_tag, product.meta_description,
        product.parent_sku, int(product.is_parent), json.dumps(product.variant_attributes),
    )
    conn.execute(
        f"INSERT INTO products ({col_list}) VALUES ({placeholders}) ON CONFLICT(artikelnummer) DO UPDATE SET {updates}",
        vals,
    )
    conn.commit()
    conn.close()


def delete_product(artikelnummer: str) -> None:
    """Remove a single product from the database."""
    conn = _get_connection()
    conn.execute("DELETE FROM products WHERE artikelnummer = ?", (artikelnummer,))
    conn.commit()
    conn.close()


def delete_all_products() -> None:
    """Remove all products from the database."""
    conn = _get_connection()
    conn.execute("DELETE FROM products")
    conn.commit()
    conn.close()


# --- Templates ---

def load_all_templates() -> dict[str, dict[str, str | int | bool]]:
    """Load all templates from the database."""
    conn = _get_connection()
    rows = conn.execute("SELECT name, attributes FROM templates").fetchall()
    conn.close()
    return {name: json.loads(attrs_json) for name, attrs_json in rows}


def save_template(name: str, attributes: dict[str, str | int | bool]) -> None:
    """Insert or update a template."""
    conn = _get_connection()
    conn.execute(
        """INSERT INTO templates (name, attributes) VALUES (?, ?)
           ON CONFLICT(name) DO UPDATE SET attributes = excluded.attributes""",
        (name, json.dumps(attributes)),
    )
    conn.commit()
    conn.close()


def delete_template(name: str) -> None:
    """Remove a template from the database."""
    conn = _get_connection()
    conn.execute("DELETE FROM templates WHERE name = ?", (name,))
    conn.commit()
    conn.close()


# --- Attribute Definitions ---

def load_all_attribute_definitions() -> dict[str, AttributeDefinition]:
    """Load all attribute definitions from the database."""
    conn = _get_connection()
    rows = conn.execute(
        "SELECT key, id, category, name, description, required, "
        "required_for_types, default_value, suggested_values, smart_defaults, sort_order "
        "FROM attribute_definitions ORDER BY sort_order, key"
    ).fetchall()
    conn.close()
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
    conn = _get_connection()
    conn.execute(
        """INSERT INTO attribute_definitions
           (key, id, category, name, description, required, required_for_types,
            default_value, suggested_values, smart_defaults, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
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
    conn.commit()
    conn.close()


def delete_attribute_definition(key: str) -> None:
    """Remove an attribute definition from the database."""
    conn = _get_connection()
    conn.execute("DELETE FROM attribute_definitions WHERE key = ?", (key,))
    conn.commit()
    conn.close()


def count_attribute_definitions() -> int:
    """Return the number of attribute definitions in the database."""
    conn = _get_connection()
    count = conn.execute("SELECT COUNT(*) FROM attribute_definitions").fetchone()[0]
    conn.close()
    return count


# --- Activity Log ---

def log_activity(event_type: str, detail: str, count: int = 0) -> None:
    """Append an entry to the activity log."""
    conn = _get_connection()
    conn.execute(
        "INSERT INTO activity_log (event_type, detail, count, created_at) VALUES (?, ?, ?, datetime('now'))",
        (event_type, detail, count),
    )
    conn.commit()
    conn.close()


def get_recent_activities(limit: int = 10) -> list[dict]:
    """Return the most recent activity log entries."""
    conn = _get_connection()
    rows = conn.execute(
        "SELECT event_type, detail, count, created_at FROM activity_log ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [
        {"event_type": r[0], "detail": r[1], "count": r[2], "created_at": r[3]}
        for r in rows
    ]


# --- Product History ---

def log_product_history(artikelnummer: str, event_type: str, field: str | None = None,
                        old_value: str | None = None, new_value: str | None = None,
                        detail: str | None = None) -> None:
    """Append a change entry to the product history."""
    conn = _get_connection()
    conn.execute(
        "INSERT INTO product_history (artikelnummer, event_type, field, old_value, new_value, detail, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
        (artikelnummer, event_type, field, old_value, new_value, detail),
    )
    conn.commit()
    conn.close()


def log_product_history_batch(entries: list[tuple]) -> None:
    """Batch-insert multiple history entries. Each tuple: (sku, event_type, field, old, new, detail)."""
    if not entries:
        return
    conn = _get_connection()
    conn.executemany(
        "INSERT INTO product_history (artikelnummer, event_type, field, old_value, new_value, detail, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
        entries,
    )
    conn.commit()
    conn.close()


def get_product_history(artikelnummer: str, limit: int = 100) -> list[dict]:
    """Return history entries for a specific product."""
    conn = _get_connection()
    rows = conn.execute(
        "SELECT id, artikelnummer, event_type, field, old_value, new_value, detail, created_at "
        "FROM product_history WHERE artikelnummer = ? ORDER BY id DESC LIMIT ?",
        (artikelnummer, limit),
    ).fetchall()
    conn.close()
    return [
        {"id": r[0], "artikelnummer": r[1], "event_type": r[2], "field": r[3],
         "old_value": r[4], "new_value": r[5], "detail": r[6], "created_at": r[7]}
        for r in rows
    ]
