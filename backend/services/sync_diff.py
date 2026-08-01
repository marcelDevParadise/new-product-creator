"""Business-facing local/JTL comparison for the synchronization center."""

from __future__ import annotations

import json
from typing import Any, Callable

from integrations.artikelwerk.schemas import PublicationPreview
from models.product import Product


OPERATION_LABELS = {
    "create_manufacturer": ("Hersteller", "Hersteller in JTL anlegen"),
    "create_article": ("Artikel", "Artikel in JTL anlegen"),
    "sync_article": ("Stammdaten", "Artikelstammdaten aktualisieren"),
    "sync_tenants": ("Mandanten", "Mandantenzuordnung aktualisieren"),
    "sync_categories": ("Kategorien", "Kategoriezuordnung ersetzen"),
    "sync_price": ("Preise", "Verkaufspreis aktualisieren"),
    "sync_supplier": ("Lieferant", "Lieferant und Einkaufspreis aktualisieren"),
    "set_attribute": ("Attribute", "Attributwert setzen"),
    "delete_attribute": ("Attribute", "Nicht mehr gewünschtes Attribut entfernen"),
    "upsert_description": ("Texte & SEO", "Beschreibung und SEO-Daten aktualisieren"),
    "update_base_price": ("Grundpreis", "Grundpreisdaten aktualisieren"),
    "upload_image": ("Bilder", "Bild übertragen"),
    "create_variation": ("Varianten", "Variationsachse anlegen"),
    "create_child": ("Varianten", "Kindartikel anlegen"),
}

ISSUE_EXPLANATIONS = {
    "UNKNOWN_CATEGORY_PATH": (
        "Kategorien",
        "Der lokale Kategoriepfad ist in JTL nicht vollständig vorhanden oder nicht eindeutig.",
        "Prüfe jede Ebene des Pfads im JTL-Kategoriestamm.",
    ),
    "UNKNOWN_MANUFACTURER": (
        "Hersteller",
        "Der Herstellername ist in JTL nicht eindeutig zuordenbar.",
        "Bereinige doppelte Hersteller oder passe den lokalen Namen an.",
    ),
    "UNKNOWN_ATTRIBUTE_VALUE": (
        "Attribute",
        "Der lokale Wert ist für dieses JTL-Attribut nicht zugelassen.",
        "Lege den Wert in JTL an oder verwende einen vorhandenen Wert.",
    ),
    "SKIPPED_ATTRIBUTE": (
        "Attribute",
        "Das lokale Attribut gehört nicht zum schreibbaren Artikelwerk-Attributstamm.",
        "Ordne das Attribut einer vorhandenen JTL-Definition zu.",
    ),
    "EMPTY_ATTRIBUTE": (
        "Attribute",
        "Ein leerer Attributwert wird nicht übertragen.",
        "Trage einen Wert ein oder entferne die lokale Zuordnung.",
    ),
    "UNKNOWN_SUPPLIER": (
        "Lieferant",
        "Der lokale Lieferant wurde in JTL nicht eindeutig gefunden.",
        "Synchronisiere den Lieferantenstamm oder korrigiere den Namen.",
    ),
    "MISSING_SUPPLIER": (
        "Lieferant",
        "Ein Einkaufspreis ist ohne Lieferant nicht fachlich zuordenbar.",
        "Wähle einen Lieferanten oder entferne den Einkaufspreis.",
    ),
    "FEATURE_DISABLED": (
        "Schnittstelle",
        "Die benötigte Schreibfunktion ist in Artikelwerk nicht freigeschaltet.",
        "Prüfe Token-Berechtigungen und Artikelwerk-Funktionsumfang.",
    ),
}


def preview_hash(preview: PublicationPreview) -> str:
    from integrations.artikelwerk.publisher import _payload_hash

    return _payload_hash(preview.model_dump(mode="json"))


def _canonical(value: Any) -> str:
    if isinstance(value, float):
        value = round(value, 4)
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _same(left: Any, right: Any) -> bool:
    return _canonical(left) == _canonical(right)


def _nested(data: dict | None, *keys: str) -> Any:
    current: Any = data or {}
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _remote_gtin(data: dict | None) -> Any:
    return _nested(data, "identifiers", "gtin") or _nested(data, "gtin")


def _remote_price(data: dict | None) -> Any:
    return _nested(data, "pricing", "grossSalesPrice") or _nested(data, "grossSalesPrice")


def _category_paths(data: dict | None) -> list[str]:
    paths = []
    for category in (data or {}).get("categories", []) or []:
        path = category.get("path") if isinstance(category, dict) else None
        if isinstance(path, list) and path:
            paths.append(" › ".join(str(value) for value in path))
    return sorted(set(paths), key=str.casefold)


def _desired_category_paths(product: Product) -> list[str]:
    values = [
        str(value).strip()
        for value in (
            product.kategorie_1, product.kategorie_2, product.kategorie_3,
            product.kategorie_4, product.kategorie_5, product.kategorie_6,
        )
        if value is not None and str(value).strip()
    ]
    return [" › ".join(values[:index]) for index in range(1, len(values) + 1)]


def _description(data: dict | None, payload: dict) -> dict:
    for item in (data or {}).get("descriptions", []) or []:
        if not isinstance(item, dict):
            continue
        if (
            item.get("languageId") == payload.get("languageId")
            and item.get("platformId") == payload.get("platformId")
            and item.get("tenantId") == payload.get("tenantId")
        ):
            return item
    return {}


def _direction(local: Any, remote: Any, last_remote: Any, has_snapshot: bool) -> str:
    if _same(local, remote):
        return "same"
    if not has_snapshot:
        if local in (None, "", [], {}) and remote not in (None, "", [], {}):
            return "jtl_only"
        return "local_to_jtl"
    local_changed = not _same(local, last_remote)
    remote_changed = not _same(remote, last_remote)
    if local_changed and remote_changed:
        return "conflict"
    if remote_changed:
        return "jtl_changed"
    return "local_to_jtl"


def build_business_diff(
    product: Product,
    remote: dict | None,
    last_snapshot: dict | None,
    preview: PublicationPreview,
) -> list[dict]:
    """Compare fields users recognize and explain which side changed."""
    fields: list[dict] = []
    has_snapshot = last_snapshot is not None

    def add(
        area: str,
        field: str,
        label: str,
        local: Any,
        remote_value: Any,
        last_getter: Callable[[dict | None], Any],
    ) -> None:
        direction = _direction(local, remote_value, last_getter(last_snapshot), has_snapshot)
        fields.append({
            "area": area,
            "field": field,
            "label": label,
            "local_value": local,
            "jtl_value": remote_value,
            "last_synced_value": last_getter(last_snapshot) if has_snapshot else None,
            "equal": direction == "same",
            "direction": direction,
        })

    add("Stammdaten", "artikelname", "Artikelname", product.artikelname,
        _nested(remote, "name"), lambda data: _nested(data, "name"))
    add("Stammdaten", "ean", "GTIN/EAN", product.ean, _remote_gtin(remote), _remote_gtin)
    add("Stammdaten", "hersteller", "Hersteller", product.hersteller,
        _nested(remote, "manufacturer"), lambda data: _nested(data, "manufacturer"))
    add("Preise", "preis", "Verkaufspreis brutto", product.preis,
        _remote_price(remote), _remote_price)
    local_weight = round(product.gewicht / 1000, 4) if product.gewicht is not None else None
    add("Logistik", "gewicht", "Gewicht in JTL (kg)", local_weight,
        _nested(remote, "dimensions", "weight"),
        lambda data: _nested(data, "dimensions", "weight"))
    add("Kategorien", "kategorien", "Kategoriepfade", _desired_category_paths(product),
        _category_paths(remote), _category_paths)

    supplier_step = next((step for step in preview.steps if step.operation == "sync_supplier"), None)
    if supplier_step:
        desired_supplier = {
            "name": product.lieferant_name,
            "articleNumber": supplier_step.payload.get("articleNumber"),
            "purchasePriceNet": supplier_step.payload.get("purchasePriceNet"),
        }

        def supplier_value(data: dict | None) -> Any:
            suppliers = (data or {}).get("suppliers", []) or []
            item = next((value for value in suppliers if isinstance(value, dict) and value.get("isDefault")), None)
            if item is None and suppliers:
                item = suppliers[0]
            return {
                "name": item.get("name"),
                "articleNumber": item.get("articleNumber"),
                "purchasePriceNet": item.get("purchasePriceNet"),
            } if isinstance(item, dict) else None

        add("Lieferant", "lieferant", "Standardlieferant und EK", desired_supplier,
            supplier_value(remote), supplier_value)

    description_step = next((step for step in preview.steps if step.operation == "upsert_description"), None)
    if description_step:
        for field, label in (
            ("description", "Beschreibung"),
            ("shortDescription", "Kurzbeschreibung"),
            ("urlPath", "URL-Pfad"),
            ("metaDescription", "Meta-Description"),
            ("titleTag", "Title-Tag"),
        ):
            payload = description_step.payload
            getter = lambda data, field=field, payload=payload: _description(data, payload).get(field)
            add("Texte & SEO", field, label, payload.get(field), getter(remote), getter)

    remote_attributes = {
        str(item.get("attributeId")): item.get("valueLabel")
        for item in (remote or {}).get("attributes", []) or []
        if isinstance(item, dict) and item.get("attributeId") is not None
    }
    last_attributes = {
        str(item.get("attributeId")): item.get("valueLabel")
        for item in (last_snapshot or {}).get("attributes", []) or []
        if isinstance(item, dict) and item.get("attributeId") is not None
    }
    for step in preview.steps:
        if step.operation != "set_attribute":
            continue
        attribute_id = str(step.payload.get("attributeId"))
        local_value = step.payload.get("value")
        direction = _direction(
            local_value, remote_attributes.get(attribute_id),
            last_attributes.get(attribute_id), has_snapshot,
        )
        fields.append({
            "area": "Attribute",
            "field": f"attributes.{attribute_id}",
            "label": f"Attribut {attribute_id}",
            "local_value": local_value,
            "jtl_value": remote_attributes.get(attribute_id),
            "last_synced_value": last_attributes.get(attribute_id) if has_snapshot else None,
            "equal": direction == "same",
            "direction": direction,
        })

    return sorted(fields, key=lambda item: (item["equal"], item["area"], item["label"]))


def explain_issues(preview: PublicationPreview) -> list[dict]:
    result = []
    for issue in preview.issues:
        area, cause, action = ISSUE_EXPLANATIONS.get(
            issue.code,
            ("Übertragung", issue.message, "Prüfe die betroffenen Stammdaten und Einstellungen."),
        )
        result.append({
            **issue.model_dump(),
            "area": area,
            "cause": cause,
            "recommended_action": action,
        })
    return result


def planned_changes(preview: PublicationPreview, remote_exists: bool) -> list[dict]:
    result = []
    for index, step in enumerate(preview.steps, start=1):
        if remote_exists and step.operation == "create_article":
            continue
        area, label = OPERATION_LABELS.get(
            step.operation,
            ("Übertragung", step.operation.replace("_", " ")),
        )
        result.append({
            "order": index,
            "operation": step.operation,
            "resource_key": step.resource_key,
            "area": area,
            "label": label,
            "payload": step.payload,
        })
    return result
