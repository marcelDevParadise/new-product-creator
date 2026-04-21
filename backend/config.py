"""Configuration loaded from environment / .env file."""

import os
from pathlib import Path

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
