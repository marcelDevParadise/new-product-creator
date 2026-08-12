from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field

from config import get_artikelwerk_config
from integrations.artikelwerk.client import ArtikelwerkClient, ArtikelwerkError
from integrations.artikelwerk.mapper import build_preview, configured_attribute_id
from integrations.artikelwerk.normalization import normalized_reference_name, searchable_reference_name
from integrations.artikelwerk.publisher import run_publication, run_publication_queue
from integrations.artikelwerk.schemas import ArtikelwerkSettings, ConnectionStatus, PublicationPreview
from routers.settings import get_artikelwerk_settings, save_artikelwerk_settings
from services.database import (
    create_articlewerk_job,
    get_articlewerk_managed_attribute_ids,
    get_articlewerk_job,
    get_articlewerk_publication,
    get_product_workflow,
    list_articlewerk_publications,
    list_articlewerk_logs,
    list_articlewerk_jobs,
    reset_deleted_articlewerk_publication,
    upsert_articlewerk_publication,
)
from services.sync_diff import (
    build_business_diff,
    explain_issues,
    planned_changes,
    preview_hash,
)
from services.workflow import publication_fingerprint
from state import state


router = APIRouter(prefix="/api/articlewerk", tags=["articlewerk"])


class BulkPublicationRequest(BaseModel):
    skus: list[str] = Field(min_length=1, max_length=50)


def _article_number_sort_key(value: str) -> tuple[tuple[int, object], ...]:
    """Natural, case-insensitive ordering (CYL-2 before CYL-10)."""
    return tuple(
        (0, int(part)) if part.isdigit() else (1, part.casefold())
        for part in re.split(r"(\d+)", value)
        if part
    )


def _items(result: object) -> list[dict]:
    if isinstance(result, list):
        return [item for item in result if isinstance(item, dict)]
    if isinstance(result, dict):
        values = result.get("items", [])
        return [item for item in values if isinstance(item, dict)] if isinstance(values, list) else []
    return []


def _exact_named(items: list[dict], name: str) -> list[dict]:
    target = normalized_reference_name(name)
    return [
        item for item in items
        if normalized_reference_name(item.get("name") or item.get("label") or "") == target
    ]


def _reference_id(item: dict, kind: str) -> object | None:
    return item.get("id") if item.get("id") is not None else item.get(f"{kind}Id")


def _category_parent_id(item: dict) -> object | None:
    return item.get("parentId") if "parentId" in item else item.get("parentCategoryId")


def _category_path(item: dict) -> tuple[str, ...]:
    path = item.get("path")
    if not isinstance(path, list):
        return ()
    return tuple(normalized_reference_name(value) for value in path)


def _unique_references(items: list[dict], kind: str) -> list[dict]:
    """Collapse duplicate catalog rows without hiding genuinely ambiguous IDs."""
    unique: dict[str, dict] = {}
    without_id: list[dict] = []
    for item in items:
        reference_id = _reference_id(item, kind)
        if reference_id is None:
            without_id.append(item)
        else:
            unique.setdefault(str(reference_id), item)
    return [*unique.values(), *without_id]


async def _resolve_create_references(
    client: ArtikelwerkClient, product, context: dict, settings: ArtikelwerkSettings,
) -> None:
    """Resolve human-readable local master data to global Artikelwerk IDs."""
    if settings.publish_manufacturer and product.hersteller:
        matches = _exact_named(
            _items(await client.search_manufacturers(searchable_reference_name(product.hersteller))),
            product.hersteller,
        )
        if len(matches) == 1 and _reference_id(matches[0], "manufacturer") is not None:
            context["resolvedManufacturerId"] = _reference_id(matches[0], "manufacturer")
        elif not matches:
            context["manufacturerNeedsCreate"] = True
        else:
            context["manufacturerMatchCount"] = len(matches)

    if settings.publish_purchase and product.lieferant_name:
        local = next(
            (item for item in state.get_suppliers()
             if str(item.get("name", "")).strip().casefold() == product.lieferant_name.strip().casefold()),
            None,
        )
        if local and local.get("articlewerk_supplier_id"):
            context["resolvedSupplier"] = {
                "id": local["articlewerk_supplier_id"], "currency": local.get("currency") or "EUR",
            }
        else:
            result = await client.search_suppliers(name=product.lieferant_name, active=True, page_size=100)
            matches = _exact_named(_items(result), product.lieferant_name)
            if len(matches) == 1 and _reference_id(matches[0], "supplier") is not None:
                context["resolvedSupplier"] = {**matches[0], "id": _reference_id(matches[0], "supplier")}

    category_names = [str(value).strip() for value in (
        product.kategorie_1, product.kategorie_2, product.kategorie_3,
        product.kategorie_4, product.kategorie_5, product.kategorie_6,
    ) if value is not None and str(value).strip()] if settings.publish_categories else []
    resolved_ids: list[object] = []
    parent_id: object | None = None
    for index, name in enumerate(category_names):
        matches = _exact_named(
            _items(await client.search_categories(searchable_reference_name(name))),
            name,
        )
        expected_path = tuple(normalized_reference_name(value) for value in category_names[:index + 1])
        path_matches = [item for item in matches if _category_path(item) == expected_path]
        if path_matches:
            matches = path_matches
        elif parent_id is None:
            matches = [item for item in matches if _category_parent_id(item) in (None, 0, "0", "")]
        else:
            matches = [
                item for item in matches if str(_category_parent_id(item)) == str(parent_id)
            ]
        matches = _unique_references(matches, "category")
        category_id = _reference_id(matches[0], "category") if len(matches) == 1 else None
        if category_id is None:
            break
        parent_id = category_id
        resolved_ids.append(parent_id)
    context["resolvedCategoryIds"] = resolved_ids


def _http_error(exc: ArtikelwerkError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": str(exc), "requestId": exc.request_id, "details": exc.details},
    )


async def _remote_contract() -> tuple[dict, dict]:
    try:
        async with ArtikelwerkClient(get_artikelwerk_config()) as client:
            return await client.capabilities(), await client.context()
    except ArtikelwerkError as exc:
        raise _http_error(exc) from exc


async def _preview(sku: str) -> PublicationPreview:
    product = state.get_product(sku)
    if not product:
        raise HTTPException(404, "Produkt nicht gefunden.")
    if product.parent_sku:
        raise HTTPException(409, "Kindartikel werden zusammen mit ihrer Variantengruppe veröffentlicht.")
    settings = get_artikelwerk_settings()
    try:
        async with ArtikelwerkClient(get_artikelwerk_config()) as client:
            capabilities, context = await client.capabilities(), await client.context()
            remote_attributes = {
                str(item["id"]).strip().casefold(): item
                for item in context.get("attributes", [])
            }
            values: dict[str, list] = {}
            for key in product.attributes:
                definition = state.attribute_config.get(key)
                remote_id = configured_attribute_id(key, definition)
                if remote_attributes.get(remote_id, {}).get("allowsCustomValue") is False:
                    values[remote_id] = await client.attribute_values(remote_id)
            context["attributeValues"] = values
            await _resolve_create_references(client, product, context, settings)
    except ArtikelwerkError as exc:
        raise _http_error(exc) from exc
    children = state.get_variants(sku) if product.is_parent else []
    return build_preview(
        product, children=children, attribute_config=state.attribute_config,
        context=context, capabilities=capabilities, settings=settings,
        managed_attribute_ids=get_articlewerk_managed_attribute_ids(product.artikelnummer),
    )


def _require_current_workflow_approval(sku: str) -> None:
    product = state.get_product(sku)
    if not product:
        raise HTTPException(404, "Produkt nicht gefunden.")
    children = state.get_variants(sku) if product.is_parent else []
    workflow = get_product_workflow(sku)
    current_hash = publication_fingerprint(product, children)
    if workflow.get("status") not in {"approved", "published"}:
        raise HTTPException(
            409,
            "Produkt ist noch nicht freigegeben. Verschiebe es im Workflow nach 'Freigegeben'.",
        )
    if workflow.get("approved_hash") != current_hash:
        raise HTTPException(
            409,
            "Produkt wurde seit der Freigabe verändert und muss erneut geprüft und freigegeben werden.",
        )


async def _prepare_publication(sku: str) -> PublicationPreview:
    """Validate approval, immutable preview and existing publication state."""
    _require_current_workflow_approval(sku)
    preview = await _preview(sku)
    if not preview.valid:
        raise HTTPException(
            422,
            {
                "message": f"Die Veröffentlichungsvorschau für {sku} enthält Fehler.",
                "issues": [issue.model_dump() for issue in preview.issues],
            },
        )
    publication = get_articlewerk_publication(sku)
    if publication and publication.get("status") == "published" and publication.get("remote_article_id"):
        create_step = next((step for step in preview.steps if step.operation == "create_article"), None)
        tenant_ids = create_step.payload.get("tenantIds", []) if create_step else []
        if tenant_ids:
            try:
                async with ArtikelwerkClient(get_artikelwerk_config()) as client:
                    await client.get_article(str(publication["remote_article_id"]), int(tenant_ids[0]))
            except ArtikelwerkError as exc:
                if exc.status_code != 404:
                    raise _http_error(exc) from exc
                reset_deleted_articlewerk_publication(sku)
                publication = None
    if publication and publication.get("status") in {"queued", "publishing"}:
        raise HTTPException(409, f"Produkt {sku} ist bereits eingeplant oder wird gerade veröffentlicht.")
    return preview


def _persist_publication_job(sku: str, preview: PublicationPreview) -> dict:
    job_id = str(uuid.uuid4())
    create_articlewerk_job(job_id, sku, len(preview.steps), preview.model_dump())
    upsert_articlewerk_publication(sku, status="queued")
    return {"job_id": job_id, "sku": sku, "status": "queued", "steps": len(preview.steps)}


def _current_product_hash(product) -> str:
    children = state.get_variants(product.artikelnummer) if product.is_parent else []
    return publication_fingerprint(product, children)


@router.get("/connection", response_model=ConnectionStatus)
async def connection_status():
    config = get_artikelwerk_config()
    if not config.configured:
        return ConnectionStatus(configured=False, reachable=False, error="ARTIKELWERK_BASE_URL oder API-Key fehlt.")
    try:
        async with ArtikelwerkClient(config) as client:
            capabilities = await client.capabilities()
        return ConnectionStatus(
            configured=True, reachable=True, base_url=config.base_url,
            provider=capabilities.get("provider"), features=capabilities.get("features", {}),
        )
    except ArtikelwerkError as exc:
        return ConnectionStatus(
            configured=True, reachable=False, base_url=config.base_url,
            error=str(exc), request_id=exc.request_id,
        )


@router.get("/context")
async def integration_context():
    capabilities, context = await _remote_contract()
    return {"capabilities": capabilities, "context": context}


@router.get("/settings", response_model=ArtikelwerkSettings)
def read_settings():
    return get_artikelwerk_settings()


@router.put("/settings", response_model=ArtikelwerkSettings)
def update_settings(body: ArtikelwerkSettings):
    return save_artikelwerk_settings(body)


@router.post("/products/{sku}/preview", response_model=PublicationPreview)
async def preview_product(sku: str):
    return await _preview(sku)


@router.post("/products/{sku}/publish", status_code=202)
async def publish_product(sku: str, background_tasks: BackgroundTasks):
    preview = await _prepare_publication(sku)
    job = _persist_publication_job(sku, preview)
    background_tasks.add_task(run_publication, job["job_id"], preview)
    return job


@router.post("/products/publish-bulk", status_code=202)
async def publish_products_bulk(body: BulkPublicationRequest, background_tasks: BackgroundTasks):
    ordered_skus = sorted(
        {sku.strip() for sku in body.skus if sku.strip()},
        key=_article_number_sort_key,
    )
    if not ordered_skus:
        raise HTTPException(400, "Mindestens eine Artikelnummer ist erforderlich.")

    # Validate the complete batch before persisting any job. A rejected item
    # therefore never leaves a partially queued selection behind.
    prepared = [(sku, await _prepare_publication(sku)) for sku in ordered_skus]
    jobs = [_persist_publication_job(sku, preview) for sku, preview in prepared]
    background_tasks.add_task(
        run_publication_queue,
        [(job["job_id"], preview) for job, (_, preview) in zip(jobs, prepared)],
    )
    return {
        "status": "queued",
        "count": len(jobs),
        "order": ordered_skus,
        "jobs": jobs,
    }


@router.get("/products/{sku}/status")
def publication_status(sku: str):
    return get_articlewerk_publication(sku) or {"artikelnummer": sku, "status": "not_published"}


@router.get("/sync")
def synchronization_overview():
    publications = list_articlewerk_publications()
    jobs = list_articlewerk_jobs(10_000)
    latest_jobs = {}
    for job in jobs:
        latest_jobs.setdefault(job["root_sku"], job)

    items = []
    for product in state.get_all_products():
        if product.parent_sku:
            continue
        publication = publications.get(product.artikelnummer)
        current_hash = _current_product_hash(product)
        last_hash = publication.get("last_synced_product_hash") if publication else None
        local_changed = bool(last_hash and last_hash != current_hash)
        latest_job = latest_jobs.get(product.artikelnummer)
        items.append({
            "artikelnummer": product.artikelnummer,
            "artikelname": product.artikelname,
            "is_group": product.is_parent,
            "archived": product.exported,
            "publication_status": publication.get("status") if publication else "not_published",
            "remote_article_id": publication.get("remote_article_id") if publication else None,
            "last_synced_revision": publication.get("last_synced_revision") if publication else None,
            "last_synced_at": publication.get("last_synced_at") if publication else None,
            "local_changed_since_sync": local_changed,
            "last_error_code": publication.get("last_error_code") if publication else None,
            "last_error_message": publication.get("last_error_message") if publication else None,
            "latest_job": latest_job,
        })
    items.sort(key=lambda item: _article_number_sort_key(item["artikelnummer"]))
    return {
        "items": items,
        "counts": {
            "total": len(items),
            "published": sum(item["publication_status"] == "published" for item in items),
            "local_changes": sum(item["local_changed_since_sync"] for item in items),
            "failed": sum(item["publication_status"] in {"failed", "partial"} for item in items),
            "unchecked_remote_versions": sum(
                bool(item["remote_article_id"]) and not item["last_synced_revision"]
                for item in items
            ),
        },
    }


@router.get("/sync/{sku}")
async def synchronization_detail(sku: str):
    product = state.get_product(sku)
    if not product:
        raise HTTPException(404, "Produkt nicht gefunden.")
    if product.parent_sku:
        raise HTTPException(409, "Kindartikel werden über die Synchronisation ihres Parent-Artikels geprüft.")

    preview = await _preview(sku)
    publication = get_articlewerk_publication(sku)
    remote = None
    current_revision = None
    remote_missing = False
    remote_id = publication.get("remote_article_id") if publication else None
    if remote_id:
        settings = get_artikelwerk_settings()
        if not settings.tenant_ids:
            raise HTTPException(422, "Für den JTL-Vergleich ist ein Artikelwerk-Mandant erforderlich.")
        try:
            async with ArtikelwerkClient(get_artikelwerk_config()) as client:
                response = await client.get_article(str(remote_id), int(settings.tenant_ids[0]))
            remote = response.data
            current_revision = (
                (response.etag or "").strip('"')
                or str(response.data.get("revision", {}).get("rowVersion") or "")
                or None
            )
        except ArtikelwerkError as exc:
            if exc.status_code == 404:
                remote_missing = True
            else:
                raise _http_error(exc) from exc

    last_revision = publication.get("last_synced_revision") if publication else None
    current_product_hash = _current_product_hash(product)
    last_product_hash = publication.get("last_synced_product_hash") if publication else None
    local_changed = bool(last_product_hash and last_product_hash != current_product_hash)
    remote_changed = bool(last_revision and current_revision and last_revision != current_revision)
    current_preview_hash = preview_hash(preview)
    preview_changed = bool(
        publication
        and publication.get("last_synced_preview_hash")
        and publication["last_synced_preview_hash"] != current_preview_hash
    )
    local_changed = local_changed or preview_changed

    if not remote_id:
        sync_status = "not_published"
    elif remote_missing:
        sync_status = "remote_missing"
    elif not preview.valid:
        sync_status = "blocked"
    elif local_changed and remote_changed:
        sync_status = "conflict"
    elif remote_changed:
        sync_status = "jtl_changed"
    elif local_changed:
        sync_status = "local_changed"
    else:
        sync_status = "in_sync"

    jobs = list_articlewerk_jobs(10_000)
    latest_job = next((job for job in jobs if job["root_sku"] == sku), None)
    last_snapshot = publication.get("last_synced_snapshot") if publication else None
    return {
        "artikelnummer": sku,
        "artikelname": product.artikelname,
        "sync_status": sync_status,
        "publication": publication,
        "latest_job": latest_job,
        "versions": {
            "last_synced": last_revision,
            "current_jtl": current_revision,
            "last_synced_at": publication.get("last_synced_at") if publication else None,
            "remote_changed_since_sync": remote_changed,
            "local_changed_since_sync": local_changed,
        },
        "remote_missing": remote_missing,
        "remote": remote,
        "diff": build_business_diff(product, remote, last_snapshot, preview),
        "planned_changes": planned_changes(preview, remote is not None),
        "issues": explain_issues(preview),
        "preview_valid": preview.valid,
        "unsupported_fields": preview.unsupported_fields,
    }


@router.get("/jobs")
def jobs(limit: int = Query(default=50, ge=1, le=200)):
    return list_articlewerk_jobs(limit)


@router.get("/logs")
def publication_logs(
    limit: int = Query(default=100, ge=1, le=500),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
):
    allowed_statuses = {"queued", "publishing", "published", "failed", "partial", "errors"}
    if status and status not in allowed_statuses:
        raise HTTPException(400, "Ungültiger Log-Status.")
    return list_articlewerk_logs(limit=limit, status=status, search=search)


@router.get("/jobs/{job_id}")
def job(job_id: str):
    result = get_articlewerk_job(job_id)
    if not result:
        raise HTTPException(404, "Artikelwerk-Job nicht gefunden.")
    return result


@router.post("/jobs/{job_id}/retry", status_code=202)
async def retry_job(job_id: str, background_tasks: BackgroundTasks):
    previous = get_articlewerk_job(job_id)
    if not previous:
        raise HTTPException(404, "Artikelwerk-Job nicht gefunden.")
    if previous["status"] not in {"failed", "partial"}:
        raise HTTPException(409, "Nur fehlgeschlagene oder teilweise Jobs können wiederholt werden.")
    _require_current_workflow_approval(previous["root_sku"])
    preview = await _preview(previous["root_sku"])
    if not preview.valid:
        raise HTTPException(422, {"message": "Die neue Vorschau enthält Fehler.", "issues": [i.model_dump() for i in preview.issues]})
    new_job_id = str(uuid.uuid4())
    create_articlewerk_job(new_job_id, previous["root_sku"], len(preview.steps), preview.model_dump())
    upsert_articlewerk_publication(previous["root_sku"], status="queued")
    background_tasks.add_task(run_publication, new_job_id, preview)
    return {"job_id": new_job_id, "status": "queued", "steps": len(preview.steps), "retry_of": job_id}
