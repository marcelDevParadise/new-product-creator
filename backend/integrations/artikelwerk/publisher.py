from __future__ import annotations

import base64
import asyncio
import hashlib
import json
import os
import re
import uuid
from pathlib import Path
from typing import Any, Awaitable, Callable

from config import get_artikelwerk_config
from integrations.artikelwerk.client import ArtikelwerkClient, ArtikelwerkError
from integrations.artikelwerk.schemas import PublicationPreview, PublicationStep
from services.database import (
    get_articlewerk_operation,
    get_articlewerk_publication,
    save_articlewerk_operation,
    update_articlewerk_job,
    upsert_articlewerk_publication,
)


# The production target is a Raspberry Pi. Serial publication keeps Base64
# image memory and Artikelwerk's per-token rate limit predictable. Jobs remain
# queued in the database while another publication is active.
_publication_lock = asyncio.Lock()


def _payload_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _new_idempotency_key(operation: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9_.:-]", "-", operation)[:45]
    return f"attrgen:{clean}:{uuid.uuid4().hex}"[:100]


def _manufacturer_id(response: dict[str, Any]) -> str | None:
    manufacturer = response.get("manufacturer")
    if isinstance(manufacturer, dict):
        value = manufacturer.get("id") or manufacturer.get("manufacturerId")
        if value is not None:
            return str(value)
    value = response.get("id") or response.get("manufacturerId")
    return str(value) if value is not None else None


async def _create_or_find_manufacturer(
    client: ArtikelwerkClient, payload: dict[str, Any], key: str,
) -> dict[str, Any]:
    try:
        return await client.create_manufacturer(payload, key)
    except ArtikelwerkError as exc:
        if exc.status_code != 409:
            raise
        result = await client.search_manufacturers(str(payload["name"]), page_size=100)
        items = result.get("items", []) if isinstance(result, dict) else result
        matches = [
            item for item in items if isinstance(item, dict)
            and str(item.get("name", "")).strip().casefold() == str(payload["name"]).strip().casefold()
        ] if isinstance(items, list) else []
        if len(matches) != 1:
            raise
        return {"manufacturer": matches[0], "idempotentConflictResolved": True}


def _image_path(source: str) -> Path:
    root = Path(os.environ.get("IMAGE_LIBRARY_ROOT", "/srv/images")).resolve()
    value = source.split("?", 1)[0]
    if value.startswith("/images/"):
        candidate = root / value[len("/images/"):]
    elif value.startswith("images/"):
        candidate = root / value[len("images/"):]
    else:
        raw = Path(value)
        candidate = raw if raw.is_absolute() else root / raw
    resolved = candidate.resolve()
    if resolved != root and root not in resolved.parents:
        raise ArtikelwerkError("Bildpfad liegt außerhalb der Bildbibliothek.", status_code=400, code="INVALID_IMAGE_PATH")
    if not resolved.is_file():
        raise ArtikelwerkError(f"Bilddatei wurde nicht gefunden: {source}", status_code=400, code="IMAGE_NOT_FOUND")
    return resolved


def prepare_image_payload(payload: dict[str, Any]) -> dict[str, Any]:
    path = _image_path(str(payload["source"]))
    size = path.stat().st_size
    if size > 10 * 1024 * 1024:
        raise ArtikelwerkError("Bild ist größer als 10 MiB.", status_code=413, code="PAYLOAD_TOO_LARGE")
    suffix = path.suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise ArtikelwerkError("Artikelwerk akzeptiert nur JPEG, PNG und WebP.", status_code=400, code="INVALID_IMAGE")
    filename = str(payload.get("filename") or path.name)
    if Path(filename).suffix.lower() != suffix:
        filename = Path(filename).stem + suffix
    return {
        "filename": filename,
        "imageBase64": base64.b64encode(path.read_bytes()).decode("ascii"),
        "tenantIds": payload["tenantIds"],
        "order": payload["order"],
    }


async def _execute_operation(
    *,
    client: ArtikelwerkClient,
    job_id: str,
    sku: str,
    step: PublicationStep,
    payload: dict[str, Any],
    idempotent: bool,
    invoke: Callable[[str | None], Awaitable[dict[str, Any]]],
) -> dict[str, Any]:
    digest = _payload_hash(payload)
    existing = get_articlewerk_operation(sku, step.operation, step.resource_key, digest)
    if existing and existing["status"] == "succeeded" and existing.get("response") is not None:
        return existing["response"]

    operation_id = existing["operation_id"] if existing else str(uuid.uuid4())
    key = existing.get("idempotency_key") if existing else None
    if idempotent and not key:
        key = _new_idempotency_key(step.resource_key)
    save_articlewerk_operation(
        operation_id, job_id, sku, step.operation, step.resource_key, digest,
        status="pending", idempotency_key=key,
    )
    try:
        response = await invoke(key)
    except ArtikelwerkError as exc:
        save_articlewerk_operation(
            operation_id, job_id, sku, step.operation, step.resource_key, digest,
            status="failed", idempotency_key=key, error_code=exc.code, request_id=exc.request_id,
        )
        raise
    save_articlewerk_operation(
        operation_id, job_id, sku, step.operation, step.resource_key, digest,
        status="succeeded", idempotency_key=key, response=response,
        remote_operation_id=str(response.get("operationId")) if response.get("operationId") else None,
    )
    return response


async def run_publication(job_id: str, preview: PublicationPreview) -> None:
    """Serialize Pi publication jobs and execute a persisted preview."""
    async with _publication_lock:
        await _run_publication(job_id, preview)


async def _run_publication(job_id: str, preview: PublicationPreview) -> None:
    """Execute a validated preview while persisting every remote operation."""
    update_articlewerk_job(job_id, status="publishing", phase="connect", progress=0)
    upsert_articlewerk_publication(preview.sku, status="publishing")
    completed = 0
    remote_article_id: str | None = None
    manufacturer_id: str | None = None
    variation_ids: dict[str, dict[str, str]] = {}

    try:
        publication = get_articlewerk_publication(preview.sku)
        remote_article_id = publication.get("remote_article_id") if publication else None
        async with ArtikelwerkClient(get_artikelwerk_config()) as client:
            for step in preview.steps:
                update_articlewerk_job(job_id, status="publishing", phase=step.operation, progress=completed)
                payload = dict(step.payload)

                if step.operation == "create_manufacturer":
                    response = await _execute_operation(
                        client=client, job_id=job_id, sku=preview.sku, step=step, payload=payload, idempotent=True,
                        invoke=lambda key: _create_or_find_manufacturer(client, payload, key or ""),
                    )
                    manufacturer_id = _manufacturer_id(response)
                    if not manufacturer_id:
                        raise ArtikelwerkError(
                            "Artikelwerk-Antwort enthält keine Hersteller-ID.", code="INVALID_RESPONSE",
                        )
                elif step.operation == "create_article":
                    if remote_article_id:
                        completed += 1
                        continue
                    if manufacturer_id:
                        payload["manufacturerId"] = int(manufacturer_id)
                    response = await _execute_operation(
                        client=client, job_id=job_id, sku=preview.sku, step=step, payload=payload, idempotent=True,
                        invoke=lambda key: client.create_article(payload, key or ""),
                    )
                    article = response.get("article", {})
                    remote_article_id = str(article.get("id", ""))
                    if not remote_article_id:
                        raise ArtikelwerkError("Artikelwerk-Antwort enthält keine Artikel-ID.", code="INVALID_RESPONSE")
                    upsert_articlewerk_publication(
                        preview.sku, status="publishing", remote_article_id=remote_article_id,
                        payload_hash=_payload_hash(payload),
                    )
                else:
                    if not remote_article_id:
                        raise ArtikelwerkError("Die Artikel-ID fehlt für eine Folgeoperation.", code="MISSING_ARTICLE_ID")
                    if step.operation == "set_attribute":
                        await _execute_operation(
                            client=client, job_id=job_id, sku=preview.sku, step=step, payload=payload, idempotent=False,
                            invoke=lambda _key: client.set_attribute(remote_article_id or "", payload),
                        )
                    elif step.operation == "upsert_description":
                        await _execute_operation(
                            client=client, job_id=job_id, sku=preview.sku, step=step, payload=payload, idempotent=False,
                            invoke=lambda _key: client.upsert_description(remote_article_id or "", payload),
                        )
                    elif step.operation == "update_base_price":
                        await _execute_operation(
                            client=client, job_id=job_id, sku=preview.sku, step=step, payload=payload, idempotent=False,
                            invoke=lambda _key: client.update_base_price(remote_article_id or "", payload),
                        )
                    elif step.operation == "upload_image":
                        image_payload = prepare_image_payload(payload)
                        await _execute_operation(
                            client=client, job_id=job_id, sku=preview.sku, step=step, payload=image_payload, idempotent=True,
                            invoke=lambda key: client.upload_image(remote_article_id or "", image_payload, key or ""),
                        )
                    elif step.operation == "create_variation":
                        response = await _execute_operation(
                            client=client, job_id=job_id, sku=preview.sku, step=step, payload=payload, idempotent=True,
                            invoke=lambda key: client.create_variation(remote_article_id or "", payload, key or ""),
                        )
                        axis = step.resource_key.split(":", 1)[1]
                        variation_ids[axis] = {
                            str(item["name"]): str(item["id"])
                            for item in response.get("variation", {}).get("values", [])
                        }
                    elif step.operation == "create_child":
                        labels = payload.pop("_variationValues", {})
                        try:
                            payload["valueIds"] = [variation_ids[axis][label] for axis, label in sorted(labels.items())]
                        except KeyError as exc:
                            raise ArtikelwerkError(
                                f"Artikelwerk lieferte keine Wert-ID für {exc}.", code="MISSING_VARIATION_VALUE",
                            ) from exc
                        response = await _execute_operation(
                            client=client, job_id=job_id, sku=preview.sku, step=step, payload=payload, idempotent=True,
                            invoke=lambda key: client.create_child(remote_article_id or "", payload, key or ""),
                        )
                        child = response.get("child", {})
                        if child.get("id") and child.get("sku"):
                            upsert_articlewerk_publication(
                                str(child["sku"]), status="published", remote_article_id=str(child["id"]),
                                payload_hash=_payload_hash(payload),
                            )
                completed += 1

        upsert_articlewerk_publication(preview.sku, status="published")
        update_articlewerk_job(job_id, status="published", phase="complete", progress=len(preview.steps))
    except ArtikelwerkError as exc:
        status = "partial" if remote_article_id else "failed"
        upsert_articlewerk_publication(
            preview.sku, status=status, error_code=exc.code,
            error_message=str(exc), request_id=exc.request_id,
        )
        update_articlewerk_job(
            job_id, status=status, phase="failed", progress=completed,
            last_error=f"{exc.code}: {exc}",
        )
    except Exception as exc:
        # Keep unexpected mapper/database/runtime failures visible instead of
        # leaving the job permanently in "publishing".
        status = "partial" if remote_article_id else "failed"
        message = str(exc) or exc.__class__.__name__
        upsert_articlewerk_publication(
            preview.sku, status=status, error_code="INTERNAL_ERROR", error_message=message,
        )
        update_articlewerk_job(
            job_id, status=status, phase="failed", progress=completed,
            last_error=f"INTERNAL_ERROR: {message}",
        )
