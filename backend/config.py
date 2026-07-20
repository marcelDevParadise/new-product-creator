"""Configuration loaded from environment / .env file."""

import os
from pathlib import Path
from dataclasses import dataclass

from dotenv import load_dotenv

# Load .env from backend directory if present
load_dotenv(Path(__file__).parent / ".env")


def get_database_url() -> str:
    """Return DATABASE_URL or raise a helpful error."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL ist nicht gesetzt. Lege backend/.env an mit:\n"
            "  DATABASE_URL=postgresql://user:passwort@host:5432/dbname\n"
            "Vorlage: backend/.env.example"
        )
    return url


@dataclass(frozen=True)
class ArtikelwerkConfig:
    base_url: str
    api_key: str
    timeout_seconds: float
    verify_tls: bool

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.api_key)


def get_artikelwerk_config() -> ArtikelwerkConfig:
    """Return server-only Artikelwerk connection settings.

    The API key deliberately lives outside the user-editable settings JSON and
    must never be returned by an API route.
    """
    base_url = os.environ.get("ARTIKELWERK_BASE_URL", "").strip().rstrip("/")
    api_key = os.environ.get("ARTIKELWERK_API_KEY", "").strip()
    try:
        timeout = max(1.0, float(os.environ.get("ARTIKELWERK_TIMEOUT_SECONDS", "30")))
    except ValueError:
        timeout = 30.0
    verify_tls = os.environ.get("ARTIKELWERK_VERIFY_TLS", "true").strip().lower() not in {
        "0", "false", "no", "off",
    }
    return ArtikelwerkConfig(base_url, api_key, timeout, verify_tls)
