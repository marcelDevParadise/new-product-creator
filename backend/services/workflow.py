"""Shared product-workflow rules and approval fingerprints."""

from __future__ import annotations

import hashlib
import json

from models.product import Product


WORKFLOW_STATUSES = (
    "draft",
    "in_progress",
    "review",
    "approved",
    "published",
    "error",
    "archived",
)

MANUAL_WORKFLOW_STATUSES = {
    "draft",
    "in_progress",
    "review",
    "approved",
    "error",
    "archived",
}


def publication_fingerprint(product: Product, children: list[Product] | None = None) -> str:
    """Hash every product field relevant to approval, including variant children."""
    def serialize(item: Product) -> dict:
        data = item.model_dump(mode="json")
        # Local list/archive state is not part of the Artikelwerk payload.
        data.pop("exported", None)
        return data

    payload = {
        "product": serialize(product),
        "children": [
            serialize(child)
            for child in sorted(children or [], key=lambda value: value.artikelnummer.casefold())
        ],
    }
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
