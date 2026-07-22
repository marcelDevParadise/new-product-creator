from __future__ import annotations

import re
from collections.abc import Iterable

from config import get_artikelwerk_config
from integrations.artikelwerk.client import ArtikelwerkClient, ArtikelwerkError
from routers.settings import get_artikelwerk_settings


_CYL_SKU = re.compile(r"^CYL-(\d+)$", re.IGNORECASE)


async def get_next_article_sku(local_skus: Iterable[str]) -> str:
    """Return the next globally safe CYL number known to Artikelwerk and locally.

    Artikelwerk owns the global sequence, while unpublished local products may
    already use numbers beyond it. The higher of both sequences therefore wins.
    The result remains a preview; POST /articles performs the actual reservation.
    """
    settings = get_artikelwerk_settings()
    config = get_artikelwerk_config()

    async with ArtikelwerkClient(config) as client:
        tenant_id = settings.tenant_ids[0] if settings.tenant_ids else None
        if tenant_id is None:
            context = await client.context()
            defaults = [int(item["id"]) for item in context.get("tenants", []) if item.get("isDefault")]
            if not defaults:
                raise ArtikelwerkError(
                    "Kein Artikelwerk-Mandant für die Artikelnummernvergabe ausgewählt.",
                    status_code=409,
                    code="NO_TENANT",
                )
            tenant_id = defaults[0]

        local_sequences = {
            int(match.group(1))
            for sku in local_skus
            if (match := _CYL_SKU.fullmatch(sku))
        }
        after_sequence: int | None = None
        for _ in range(len(local_sequences) + 1):
            result = await client.next_article_number(
                tenant_id, after_sequence=after_sequence,
            )
            remote_number = str(result.get("number", ""))
            remote_match = _CYL_SKU.fullmatch(remote_number)
            if not remote_match:
                raise ArtikelwerkError(
                    "Artikelwerk lieferte keine gültige nächste Artikelnummer.",
                    code="INVALID_RESPONSE",
                    details=result,
                )
            sequence = int(remote_match.group(1))
            if after_sequence is not None and sequence <= after_sequence:
                raise ArtikelwerkError(
                    "Artikelwerk lieferte keine fortschreitende Artikelnummer.",
                    code="INVALID_RESPONSE", details=result,
                )
            if sequence not in local_sequences:
                return remote_number
            after_sequence = sequence

    raise ArtikelwerkError(
        "Artikelwerk konnte keine freie Artikelnummer ermitteln.",
        code="ARTICLE_NUMBER_EXHAUSTED",
    )
