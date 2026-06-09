"""SQLite-Backend als Drop-in-Alternative zu PostgreSQL.

Stellt eine Connection/Cursor-API bereit, die der von psycopg ähnelt, sodass
``services/database.py`` die gleichen SQL-Strings (mit ``%s``-Platzhaltern und
Postgres-spezifischen Funktionen) verwenden kann. Dadurch entfällt Code-Duplikation
in den Routern.

Aktivierung: ``DATABASE_URL=sqlite:///./backend/products.db`` (relativ) oder
``sqlite:////absoluter/pfad.db`` (absolut).
"""

from __future__ import annotations

import re
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import urlparse


# Translator-Patterns. Reihenfolge ist wichtig (length-sortiert).
_NOW_FUNC = "(strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))"

_SQL_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    # Postgres-Zeitstempel-Funktion → SQLite strftime
    (re.compile(r"to_char\s*\(\s*NOW\s*\(\s*\)\s*,\s*'YYYY-MM-DD HH24:MI:SS'\s*\)", re.IGNORECASE), _NOW_FUNC),
    # Postgres-Größenfunktion existiert in SQLite nicht → 0 als Platzhalter
    (re.compile(r"pg_database_size\s*\(\s*current_database\s*\(\s*\)\s*\)", re.IGNORECASE), "0"),
    # Typen
    (re.compile(r"\bBIGSERIAL\b", re.IGNORECASE), "INTEGER"),
    (re.compile(r"\bBIGINT\b", re.IGNORECASE), "INTEGER"),
    (re.compile(r"\bDOUBLE\s+PRECISION\b", re.IGNORECASE), "REAL"),
]

# IF NOT EXISTS für ALTER TABLE ADD COLUMN gibt es in SQLite nicht – das wird gesondert behandelt.
_ALTER_ADD_IF_NOT_EXISTS = re.compile(
    r"^\s*ALTER\s+TABLE\s+(\S+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(.+)$",
    re.IGNORECASE | re.DOTALL,
)


def _translate(sql: str) -> str:
    """Übersetze ein Postgres-SQL-Statement nach SQLite."""
    for pattern, replacement in _SQL_REPLACEMENTS:
        sql = pattern.sub(replacement, sql)
    # Platzhalter zuletzt, damit %s in einem ersetzten Wert (z.B. Format-String von strftime) intakt bleibt.
    # strftime nutzt '%Y' etc.; daher ersetzen wir %s nur, wenn nicht von einem Buchstaben gefolgt.
    sql = re.sub(r"%s(?![a-zA-Z])", "?", sql)
    return sql


class SqliteCursorWrapper:
    """Minimaler Cursor-Wrapper mit Context-Manager-Support und SQL-Übersetzung."""

    def __init__(self, raw: sqlite3.Cursor) -> None:
        self._raw = raw

    def __enter__(self) -> "SqliteCursorWrapper":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            self._raw.close()
        except sqlite3.Error:
            pass

    def execute(self, sql: str, params: Any = ()) -> "SqliteCursorWrapper":
        # Spezialfall: ALTER TABLE ... ADD COLUMN IF NOT EXISTS — try/except (duplicate column wird geschluckt)
        m = _ALTER_ADD_IF_NOT_EXISTS.match(sql)
        if m:
            table, rest = m.group(1), m.group(2).rstrip("; \n")
            translated = _translate(f"ALTER TABLE {table} ADD COLUMN {rest}")
            try:
                self._raw.execute(translated, params or ())
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    return self
                raise
            return self
        self._raw.execute(_translate(sql), params or ())
        return self

    def executemany(self, sql: str, seq_of_params: Any) -> "SqliteCursorWrapper":
        self._raw.executemany(_translate(sql), seq_of_params)
        return self

    def fetchone(self) -> Any:
        return self._raw.fetchone()

    def fetchall(self) -> list[Any]:
        return self._raw.fetchall()

    def fetchmany(self, size: int | None = None) -> list[Any]:
        if size is None:
            return self._raw.fetchmany()
        return self._raw.fetchmany(size)

    @property
    def lastrowid(self) -> int | None:
        return self._raw.lastrowid

    @property
    def rowcount(self) -> int:
        return self._raw.rowcount

    @property
    def description(self) -> Any:
        return self._raw.description

    def close(self) -> None:
        self._raw.close()


class SqliteConnectionWrapper:
    """Connection-Wrapper, der ``cursor()`` als Context-Manager bereitstellt."""

    def __init__(self, raw: sqlite3.Connection) -> None:
        self._raw = raw

    def cursor(self) -> SqliteCursorWrapper:
        return SqliteCursorWrapper(self._raw.cursor())

    def commit(self) -> None:
        self._raw.commit()

    def rollback(self) -> None:
        self._raw.rollback()

    def close(self) -> None:
        self._raw.close()

    def execute(self, sql: str, params: Any = ()) -> SqliteCursorWrapper:
        cur = self.cursor()
        cur.execute(sql, params)
        return cur


def _resolve_sqlite_path(url: str) -> Path:
    """Extrahiere den Dateipfad aus einer ``sqlite://...``-URL."""
    parsed = urlparse(url)
    # Format: sqlite:///relativer/pfad oder sqlite:////absoluter/pfad
    # urlparse() lässt für sqlite:/// path = "/relativer/pfad" (führender Slash)
    raw = parsed.path
    if raw.startswith("/") and len(raw) > 1 and raw[1] != "/":
        # Relativer Pfad: entfernt den führenden Slash
        path_str = raw.lstrip("/")
    elif raw.startswith("//"):
        # Absoluter Pfad
        path_str = raw[1:]
    else:
        path_str = raw
    return Path(path_str).resolve()


class SqlitePool:
    """Pool-ähnliche Klasse: in SQLite einfach 1 Connection pro Thread (check_same_thread=False)."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(
            str(self._db_path),
            check_same_thread=False,
            isolation_level=None,  # Autocommit
            timeout=30.0,
        )
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.execute("PRAGMA busy_timeout=5000")
        self._wrapper = SqliteConnectionWrapper(self._conn)

    @contextmanager
    def connection(self) -> Iterator[SqliteConnectionWrapper]:
        # SQLite ist im autocommit-Modus; Locking via busy_timeout / WAL
        with self._lock:
            yield self._wrapper

    def close(self) -> None:
        try:
            self._conn.close()
        except sqlite3.Error:
            pass


def is_sqlite_url(url: str) -> bool:
    return url.lower().startswith("sqlite:")


def make_pool(url: str) -> SqlitePool:
    """Fabrik-Funktion für einen SQLite-Pool aus einer DATABASE_URL."""
    return SqlitePool(_resolve_sqlite_path(url))
