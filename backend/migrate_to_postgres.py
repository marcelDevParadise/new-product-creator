"""One-shot migration: copy data from local SQLite into PostgreSQL.

Usage:
    cd backend
    python migrate_to_postgres.py [--source PATH_TO_SQLITE] [--clear]

The script:
  1. Initialises the PostgreSQL schema (idempotent).
  2. Copies products, templates, attribute_definitions, activity_log,
     product_history and export_history table-by-table.
  3. Resets sequence values for tables with BIGSERIAL primary keys.

By default the source is backend/services/data/products.db.
Pass --clear to wipe target tables before importing.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

# Allow running this file directly: ensure backend/ is on sys.path
sys.path.insert(0, str(Path(__file__).parent))

from services.database import _conn, init_db  # noqa: E402

DEFAULT_SOURCE = Path(__file__).parent / "services" / "data" / "products.db"

# Tables to copy: (table_name, columns, has_serial_id)
TABLES: list[tuple[str, list[str], bool]] = [
    (
        "products",
        [
            "artikelnummer", "artikelname", "ek", "preis", "gewicht", "hersteller", "ean",
            "attributes", "exported", "stammdaten_complete",
            "laenge", "breite", "hoehe",
            "verkaufseinheit", "inhalt_menge", "inhalt_einheit", "grundpreis_ausweisen",
            "bezugsmenge", "bezugsmenge_einheit",
            "lieferant_name", "lieferant_artikelnummer", "lieferant_artikelname", "lieferant_netto_ek",
            "bild_1", "bild_2", "bild_3", "bild_4", "bild_5", "bild_6", "bild_7", "bild_8", "bild_9",
            "kategorie_1", "kategorie_2", "kategorie_3", "kategorie_4", "kategorie_5", "kategorie_6",
            "kurzbeschreibung", "beschreibung", "url_pfad", "title_tag", "meta_description", "seo_keywords",
            "parent_sku", "is_parent", "variant_attributes",
        ],
        False,
    ),
    (
        "templates",
        ["name", "attributes", "category", "description"],
        False,
    ),
    (
        "attribute_definitions",
        [
            "key", "id", "category", "name", "description", "required", "required_for_types",
            "default_value", "suggested_values", "smart_defaults", "sort_order",
        ],
        False,
    ),
    (
        "activity_log",
        ["id", "event_type", "detail", "count", "created_at"],
        True,
    ),
    (
        "product_history",
        ["id", "artikelnummer", "event_type", "field", "old_value", "new_value", "detail", "created_at"],
        True,
    ),
    (
        "export_history",
        ["id", "export_type", "filename", "product_count", "row_count", "created_at"],
        True,
    ),
    (
        "bundles",
        ["id", "name", "description", "items", "created_at", "updated_at"],
        True,
    ),
    (
        "warnings",
        ["id", "code", "title", "text", "category", "created_at"],
        True,
    ),
    (
        "product_warnings",
        ["artikelnummer", "warning_id"],
        False,
    ),
    (
        "ingredients",
        ["id", "name", "inci_name", "cas_number", "category", "created_at"],
        True,
    ),
    (
        "product_ingredients",
        ["artikelnummer", "ingredient_id", "percentage", "position"],
        False,
    ),
]


def _sqlite_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def _copy_table(sqlite_conn: sqlite3.Connection, table: str, columns: list[str]) -> int:
    existing = _sqlite_columns(sqlite_conn, table)
    if not existing:
        print(f"  - {table}: not in source, skipped")
        return 0
    # Only select columns that exist in the source SQLite DB (older schemas)
    select_cols = [c for c in columns if c in existing]
    missing = [c for c in columns if c not in existing]
    rows = sqlite_conn.execute(
        f"SELECT {', '.join(select_cols)} FROM {table}"
    ).fetchall()
    if not rows:
        print(f"  - {table}: empty")
        return 0

    placeholders = ", ".join(["%s"] * len(select_cols))
    col_list = ", ".join(select_cols)
    insert_sql = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})"

    with _conn() as pg, pg.cursor() as cur:
        cur.executemany(insert_sql, rows)

    note = f" (missing in source: {', '.join(missing)})" if missing else ""
    print(f"  - {table}: {len(rows)} rows copied{note}")
    return len(rows)


def _reset_sequence(table: str) -> None:
    """Set BIGSERIAL sequence to MAX(id) so future inserts don't collide."""
    with _conn() as pg, pg.cursor() as cur:
        cur.execute(
            f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
            f"COALESCE((SELECT MAX(id) FROM {table}), 1), "
            f"(SELECT MAX(id) FROM {table}) IS NOT NULL)"
        )


def _clear_target() -> None:
    print("Clearing target tables…")
    with _conn() as pg, pg.cursor() as cur:
        # FKs exist (product_warnings -> warnings, product_ingredients -> ingredients).
        # CASCADE handles dependent rows; RESTART IDENTITY resets BIGSERIAL counters.
        cur.execute(
            "TRUNCATE products, templates, attribute_definitions, "
            "activity_log, product_history, export_history, "
            "bundles, warnings, product_warnings, ingredients, product_ingredients "
            "RESTART IDENTITY CASCADE"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"Path to the SQLite database (default: {DEFAULT_SOURCE})",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Truncate target tables before import",
    )
    args = parser.parse_args()

    if not args.source.exists():
        print(f"ERROR: source SQLite file not found: {args.source}")
        return 1

    print(f"Source SQLite : {args.source}")
    print("Target        : PostgreSQL via DATABASE_URL")
    print()

    print("Initialising target schema…")
    init_db()

    if args.clear:
        _clear_target()

    sqlite_conn = sqlite3.connect(str(args.source))
    try:
        total = 0
        print("Copying tables…")
        for table, columns, has_serial in TABLES:
            total += _copy_table(sqlite_conn, table, columns)
            if has_serial:
                _reset_sequence(table)
    finally:
        sqlite_conn.close()

    print()
    print(f"Done. {total} rows imported.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
