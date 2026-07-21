from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from config import get_artikelwerk_config
from integrations.artikelwerk.client import ArtikelwerkClient, ArtikelwerkError
from integrations.artikelwerk.mapper import build_preview
from integrations.artikelwerk.publisher import run_publication
from integrations.artikelwerk.schemas import ArtikelwerkSettings, ConnectionStatus, PublicationPreview
from routers.settings import get_artikelwerk_settings, save_artikelwerk_settings
from services.database import (
    create_articlewerk_job,
    get_articlewerk_job,
    get_articlewerk_publication,
    list_articlewerk_logs,
    list_articlewerk_jobs,
    reset_deleted_articlewerk_publication,
    upsert_articlewerk_publication,
)
from state import state


router = APIRouter(prefix="/api/articlewerk", tags=["articlewerk"])


def _items(result: object) -> list[dict]:
    if isinstance(result, list):
        return [item for item in result if isinstance(item, dict)]
    if isinstance(result, dict):
        values = result.get("items", [])
        return [item for item in values if isinstance(item, dict)] if isinstance(values, list) else []
    return []


def _exact_named(items: list[dict], name: str) -> list[dict]:
    target = name.strip().casefold()
    return [
        item for item in items
        if str(item.get("name") or item.get("label") or "").strip().casefold() == target
    ]


def _reference_id(item: dict, kind: str) -> object | None:
    return item.get("id") if item.get("id") is not None else item.get(f"{kind}Id")


async def _resolve_create_references(
    client: ArtikelwerkClient, product, context: dict, settings: ArtikelwerkSettings,
) -> None:
    """Resolve human-readable local master data to global Artikelwerk IDs."""
    if settings.publish_manufacturer and product.hersteller:
        matches = _exact_named(_items(await client.search_manufacturers(product.hersteller)), product.hersteller)
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

    category_names = [value for value in (
        product.kategorie_1, product.kategorie_2, product.kategorie_3,
        product.kategorie_4, product.kategorie_5, product.kategorie_6,
    ) if value] if settings.publish_categories else []
    resolved_ids: list[object] = []
    parent_id: object | None = None
    for name in category_names:
        matches = _exact_named(_items(await client.search_categories(name)), name)
        if parent_id is None:
            matches = [
                item for item in matches
                if (item.get("parentId") if "parentId" in item else item.get("parentCategoryId")) in (None, 0, "0", "")
            ]
        else:
            matches = [
                item for item in matches
                if str(item.get("parentId") if "parentId" in item else item.get("parentCategoryId")) == str(parent_id)
            ]
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
            remote_attributes = {str(item["id"]): item for item in context.get("attributes", [])}
            values: dict[str, list] = {}
            for key in product.attributes:
                definition = state.attribute_config.get(key)
                stable_id = key.casefold()
                configured_id = str(getattr(definition, "id", key))
                remote_id = stable_id if stable_id in remote_attributes else configured_id
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
    )


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
    preview = await _preview(sku)
    if not preview.valid:
        raise HTTPException(422, {"message": "Die Veröffentlichungsvorschau enthält Fehler.", "issues": [i.model_dump() for i in preview.issues]})
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
    if publication and publication.get("status") in {"queued", "publishing", "published"}:
        raise HTTPException(409, "Produkt ist bereits eingeplant oder an Artikelwerk veröffentlicht.")
    job_id = str(uuid.uuid4())
    create_articlewerk_job(job_id, sku, len(preview.steps), preview.model_dump())
    upsert_articlewerk_publication(sku, status="queued")
    background_tasks.add_task(run_publication, job_id, preview)
    return {"job_id": job_id, "status": "queued", "steps": len(preview.steps)}


@router.get("/products/{sku}/status")
def publication_status(sku: str):
    return get_articlewerk_publication(sku) or {"artikelnummer": sku, "status": "not_published"}


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
    preview = await _preview(previous["root_sku"])
    if not preview.valid:
        raise HTTPException(422, {"message": "Die neue Vorschau enthält Fehler.", "issues": [i.model_dump() for i in preview.issues]})
    new_job_id = str(uuid.uuid4())
    create_articlewerk_job(new_job_id, previous["root_sku"], len(preview.steps), preview.model_dump())
    upsert_articlewerk_publication(previous["root_sku"], status="queued")
    background_tasks.add_task(run_publication, new_job_id, preview)
    return {"job_id": new_job_id, "status": "queued", "steps": len(preview.steps), "retry_of": job_id}
