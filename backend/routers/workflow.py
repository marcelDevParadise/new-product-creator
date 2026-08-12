"""Product workflow, approval, assignment, comments, and Kanban board."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.database import (
    add_workflow_comment,
    approve_product_workflow,
    get_product_history,
    get_product_workflow,
    list_product_workflows,
    list_workflow_comments,
    log_activity,
    log_product_history,
    save_product_workflow,
)
from services.validation import validate_all_products
from services.workflow import MANUAL_WORKFLOW_STATUSES, WORKFLOW_STATUSES, publication_fingerprint
from state import state


router = APIRouter(prefix="/api/workflow", tags=["workflow"])

WORKFLOW_COLUMNS = [
    {"id": "draft", "label": "Entwurf", "description": "Noch nicht aktiv bearbeitet"},
    {"id": "in_progress", "label": "In Bearbeitung", "description": "Produktdaten werden ergänzt"},
    {"id": "review", "label": "Prüfung erforderlich", "description": "Bereit für Qualitätsprüfung"},
    {"id": "approved", "label": "Freigegeben", "description": "Unverändert veröffentlichungsbereit"},
    {"id": "published", "label": "Veröffentlicht", "description": "Erfolgreich an JTL übertragen"},
    {"id": "error", "label": "Fehlerhaft", "description": "Blockiert oder Veröffentlichung fehlgeschlagen"},
    {"id": "archived", "label": "Archiviert", "description": "Nicht mehr im aktiven Bestand"},
]


class WorkflowUpdate(BaseModel):
    status: str | None = None
    assignee: str | None = Field(default=None, max_length=120)


class WorkflowBulkStatusUpdate(BaseModel):
    artikelnummern: list[str] = Field(min_length=1, max_length=500)
    status: str


class WorkflowCommentCreate(BaseModel):
    author: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=4000)


def _product_or_404(sku: str):
    product = state.get_product(sku)
    if not product:
        raise HTTPException(404, "Produkt nicht gefunden.")
    return product


def _fingerprint_for(product) -> str:
    children = state.get_variants(product.artikelnummer) if product.is_parent else []
    return publication_fingerprint(product, children)


def _validation_map() -> dict[str, dict]:
    products = list(state.products.values())
    return {
        result["artikelnummer"]: result
        for result in validate_all_products(products, state.attribute_config)
    }


def _validation_for_product(product, validation: dict[str, dict]) -> dict:
    """Aggregate variant errors into the parent approval decision."""
    own = validation.get(product.artikelnummer) or {
        "artikelnummer": product.artikelnummer,
        "artikelname": product.artikelname,
        "severity": "ok",
        "error_count": 0,
        "warning_count": 0,
        "issues": [],
    }
    if not product.is_parent:
        return own

    results = [own, *[
        validation.get(child.artikelnummer) or {}
        for child in state.get_variants(product.artikelnummer)
    ]]
    issues = []
    for result in results:
        result_sku = result.get("artikelnummer")
        for issue in result.get("issues", []):
            if result_sku and result_sku != product.artikelnummer:
                issues.append({**issue, "field": f"{result_sku}: {issue.get('field', 'Produkt')}"})
            else:
                issues.append(issue)
    error_count = sum(int(result.get("error_count", 0)) for result in results)
    warning_count = sum(int(result.get("warning_count", 0)) for result in results)
    return {
        **own,
        "severity": "error" if error_count else "warning" if warning_count else "ok",
        "error_count": error_count,
        "warning_count": warning_count,
        "issues": issues,
    }


def _serialize_item(product, workflow: dict, validation: dict | None = None) -> dict:
    stored_status = workflow.get("status") or "draft"
    current_hash = _fingerprint_for(product)
    approval_stale = (
        stored_status in {"approved", "published"}
        and workflow.get("approved_hash") != current_hash
    )
    if product.exported:
        effective_status = "archived"
    elif approval_stale:
        effective_status = "review"
    else:
        effective_status = stored_status

    quality = validation or {
        "severity": "ok",
        "error_count": 0,
        "warning_count": 0,
    }
    return {
        "artikelnummer": product.artikelnummer,
        "artikelname": product.artikelname,
        "status": effective_status,
        "stored_status": stored_status,
        "assignee": workflow.get("assignee"),
        "approved_at": workflow.get("approved_at"),
        "approval_stale": approval_stale,
        "updated_at": workflow.get("updated_at"),
        "comment_count": workflow.get("comment_count", 0),
        "quality_severity": quality.get("severity", "ok"),
        "error_count": quality.get("error_count", 0),
        "warning_count": quality.get("warning_count", 0),
        "hersteller": product.hersteller,
        "kategorie": product.kategorie_1,
        "bild": product.bild_1,
        "preis": product.preis,
        "is_parent": product.is_parent,
        "parent_sku": product.parent_sku,
    }


@router.get("/board")
def workflow_board():
    records = list_product_workflows()
    validation = _validation_map()
    items = [
        _serialize_item(
            product,
            records.get(product.artikelnummer, {
                "status": "draft",
                "assignee": None,
                "approved_hash": None,
                "approved_at": None,
                "updated_at": None,
                "comment_count": 0,
            }),
            _validation_for_product(product, validation),
        )
        for product in state.get_all_products()
    ]
    assignees = sorted({
        item["assignee"] for item in items if item.get("assignee")
    }, key=str.casefold)
    return {
        "columns": WORKFLOW_COLUMNS,
        "items": items,
        "assignees": assignees,
        "statuses": list(WORKFLOW_STATUSES),
    }


@router.get("/products/{sku}")
def workflow_product(sku: str):
    product = _product_or_404(sku)
    record = get_product_workflow(sku)
    validation_map = _validation_map()
    validation = _validation_for_product(product, validation_map)
    return {
        "item": _serialize_item(product, record, validation),
        "comments": list_workflow_comments(sku),
        "history": get_product_history(sku, 100),
        "validation": validation,
    }


@router.patch("/products/{sku}")
def update_workflow_product(sku: str, body: WorkflowUpdate):
    product = _product_or_404(sku)
    current = get_product_workflow(sku)
    fields_set = body.model_fields_set
    status_requested = "status" in fields_set and body.status is not None
    next_status = body.status if status_requested else current["status"]
    next_assignee = (
        body.assignee.strip() or None
        if "assignee" in fields_set and body.assignee is not None
        else None if "assignee" in fields_set
        else current.get("assignee")
    )

    if status_requested and next_status not in MANUAL_WORKFLOW_STATUSES:
        if next_status == "published":
            raise HTTPException(409, "Der Status 'Veröffentlicht' wird ausschließlich durch einen erfolgreichen Artikelwerk-Job gesetzt.")
        raise HTTPException(400, "Unbekannter Workflow-Status.")

    previous_status = current["status"]
    previous_assignee = current.get("assignee")

    if status_requested and next_status == "approved":
        validation = _validation_for_product(product, _validation_map())
        if validation.get("error_count", 0) > 0:
            raise HTTPException(
                422,
                {
                    "message": "Produkt kann wegen Qualitätsfehlern nicht freigegeben werden.",
                    "issues": validation.get("issues", []),
                },
            )
        result = approve_product_workflow(sku, _fingerprint_for(product), next_assignee)
    elif status_requested:
        result = save_product_workflow(
            sku,
            status=next_status,
            assignee=next_assignee,
            approved_hash=None,
            approved_at=None,
        )
    else:
        result = save_product_workflow(
            sku,
            status=current["status"],
            assignee=next_assignee,
            approved_hash=current.get("approved_hash"),
            approved_at=current.get("approved_at"),
        )

    if status_requested and next_status == "archived" and not product.exported:
        state.archive_product(sku)
    elif status_requested and next_status != "archived" and product.exported:
        state.unarchive_product(sku)

    if previous_status != next_status:
        log_product_history(
            sku,
            "workflow_status_changed",
            field="workflow_status",
            old_value=previous_status,
            new_value=next_status,
            detail=f"Workflow-Status auf {next_status} gesetzt",
        )
        log_activity("workflow_status_changed", f"{sku}: {previous_status} → {next_status}", 1)
    if previous_assignee != next_assignee:
        log_product_history(
            sku,
            "workflow_assignee_changed",
            field="workflow_assignee",
            old_value=previous_assignee,
            new_value=next_assignee,
            detail="Verantwortlichkeit geändert",
        )

    result["comment_count"] = len(list_workflow_comments(sku))
    validation_map = _validation_map()
    return _serialize_item(product, result, _validation_for_product(product, validation_map))


@router.post("/products/bulk/status")
def bulk_update_workflow_status(body: WorkflowBulkStatusUpdate):
    """Move multiple products to one manually managed workflow status."""
    if body.status not in MANUAL_WORKFLOW_STATUSES:
        if body.status == "published":
            raise HTTPException(409, "Der Status 'Veröffentlicht' wird ausschließlich durch einen erfolgreichen Artikelwerk-Job gesetzt.")
        raise HTTPException(400, "Unbekannter Workflow-Status.")

    skus = list(dict.fromkeys(sku.strip() for sku in body.artikelnummern if sku.strip()))
    if not skus:
        raise HTTPException(400, "Mindestens eine Artikelnummer ist erforderlich.")

    missing = [sku for sku in skus if state.get_product(sku) is None]
    if missing:
        raise HTTPException(404, {
            "message": "Mindestens ein Produkt wurde nicht gefunden.",
            "artikelnummern": missing,
        })

    # Validate every selected product before changing anything so a bulk approval
    # cannot leave the selection in a surprising partially updated state.
    if body.status == "approved":
        validation_map = _validation_map()
        blocked = []
        for sku in skus:
            product = state.get_product(sku)
            validation = _validation_for_product(product, validation_map)
            if validation.get("error_count", 0) > 0:
                blocked.append({
                    "artikelnummer": sku,
                    "issues": validation.get("issues", []),
                })
        if blocked:
            raise HTTPException(422, {
                "message": "Auswahl kann wegen Qualitätsfehlern nicht freigegeben werden.",
                "products": blocked,
            })

    items = [
        update_workflow_product(sku, WorkflowUpdate(status=body.status))
        for sku in skus
    ]
    return {"updated": len(items), "items": items}


@router.post("/products/{sku}/comments", status_code=201)
def create_workflow_comment(sku: str, body: WorkflowCommentCreate):
    _product_or_404(sku)
    current = get_product_workflow(sku)
    if current.get("updated_at") is None:
        save_product_workflow(
            sku,
            status=current["status"],
            assignee=current.get("assignee"),
            approved_hash=current.get("approved_hash"),
            approved_at=current.get("approved_at"),
        )
    comment = add_workflow_comment(sku, body.author.strip(), body.body.strip())
    log_product_history(
        sku,
        "workflow_comment_added",
        detail=f"{comment['author']}: {comment['body']}",
    )
    return comment
