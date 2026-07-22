from __future__ import annotations

from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

from integrations.artikelwerk.schemas import (
    ARTIKELWERK_STANDARD_TAX_CLASS_ID,
    ARTIKELWERK_TAX_RATE,
    ArtikelwerkSettings,
    PreviewIssue,
    PublicationPreview,
    PublicationStep,
)
from models.product import Product


def _value_as_string(value: str | int | bool) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _present(value: Any) -> bool:
    return value is not None and value != ""


def build_preview(
    product: Product,
    *,
    children: list[Product],
    attribute_config: dict[str, Any],
    context: dict[str, Any],
    capabilities: dict[str, Any],
    settings: ArtikelwerkSettings,
    managed_attribute_ids: set[str] | None = None,
) -> PublicationPreview:
    issues: list[PreviewIssue] = []
    steps: list[PublicationStep] = []
    state_sync_steps: list[PublicationStep] = []
    features = capabilities.get("features", {})
    tenants = {int(t["id"]): t for t in context.get("tenants", [])}
    units = {str(u.get("code", "")).casefold(): int(u["id"]) for u in context.get("units", []) if u.get("code")}
    remote_attributes = {str(a["id"]): a for a in context.get("attributes", [])}

    if not settings.tenant_ids:
        defaults = [int(t["id"]) for t in context.get("tenants", []) if t.get("isDefault")]
        if defaults:
            settings = settings.model_copy(update={"tenant_ids": defaults})
        else:
            issues.append(PreviewIssue(severity="error", code="NO_TENANT", message="Kein Artikelwerk-Mandant ausgewählt."))
    unknown_tenants = [tid for tid in settings.tenant_ids if tid not in tenants]
    if unknown_tenants:
        issues.append(PreviewIssue(
            severity="error", code="UNKNOWN_TENANT",
            message=f"Nicht aktive oder unbekannte Mandanten: {', '.join(map(str, unknown_tenants))}", field="tenant_ids",
        ))
    if not features.get("articleWrite", False):
        issues.append(PreviewIssue(severity="error", code="FEATURE_DISABLED", message="Artikelanlage ist in Artikelwerk nicht freigeschaltet."))

    article_payload: dict[str, Any] = {
        "sku": product.artikelnummer,
        "name": product.artikelname,
        "tenantIds": settings.tenant_ids,
        "active": True,
        "inventoryTracking": settings.inventory_tracking,
        # JTL derives the effective VAT from the article's tax class. The
        # Artikelwerk API otherwise defaults this field to 0, which creates an
        # article without the standard 19 % tax class even when price.taxRate
        # is correct.
        "taxClassId": ARTIKELWERK_STANDARD_TAX_CLASS_ID,
        "description": product.beschreibung,
        "shortDescription": product.kurzbeschreibung,
        "gtin": product.ean,
        "dimensions": {
            "length": product.laenge or 0,
            "width": product.breite or 0,
            "height": product.hoehe or 0,
        },
        # Local master data stores grams; the existing JTL export and the
        # Artikelwerk/JTL article fields use kilograms.
        "weight": (product.gewicht / 1000) if product.gewicht is not None else 0,
        "shippingWeight": (product.gewicht / 1000) if product.gewicht is not None else 0,
    }
    if settings.publish_manufacturer and _present(product.hersteller):
        manufacturer_id = context.get("resolvedManufacturerId")
        if manufacturer_id is not None:
            article_payload["manufacturerId"] = int(manufacturer_id)
        elif context.get("manufacturerNeedsCreate"):
            steps.append(PublicationStep(
                operation="create_manufacturer", resource_key=f"manufacturer:{product.hersteller}",
                payload={"name": product.hersteller},
            ))
        else:
            issues.append(PreviewIssue(
                severity="error", code="UNKNOWN_MANUFACTURER",
                message=(f"Hersteller '{product.hersteller}' wurde im globalen Artikelwerk-Herstellerstamm "
                         "mehrfach gefunden. Den Herstellerstamm bereinigen oder die "
                         "Hersteller-Übertragung in den Artikelwerk-Einstellungen deaktivieren."),
                field="hersteller",
            ))

    if settings.publish_price and product.preis is not None:
        if not features.get("priceWrite", False):
            issues.append(PreviewIssue(severity="error", code="FEATURE_DISABLED", message="Verkaufspreise sind in Artikelwerk nicht freigeschaltet.", field="preis"))
        elif not settings.tenant_ids:
            issues.append(PreviewIssue(severity="error", code="NO_TENANT", message="Für den Verkaufspreis fehlt ein Mandant.", field="preis"))
        else:
            # Local `preis` is Brutto-VK; Artikelwerk's create contract expects net.
            # The integration's article contract is fixed to 19 % VAT. Use the
            # invariant here as a final safeguard, independent of persisted
            # settings from installations predating this rule.
            net_price = product.preis / (1 + ARTIKELWERK_TAX_RATE / 100)
            article_payload["price"] = {
                "tenantId": settings.tenant_ids[0], "customerGroupId": settings.customer_group_id,
                "currency": settings.currency.upper(), "net": round(net_price, 4),
                "taxRate": ARTIKELWERK_TAX_RATE, "quantityFrom": 1,
            }

    purchase_price = product.lieferant_netto_ek if product.lieferant_netto_ek is not None else product.ek
    if settings.publish_purchase and (_present(product.lieferant_name) or purchase_price is not None):
        if not features.get("supplierWrite", False):
            issues.append(PreviewIssue(severity="error", code="FEATURE_DISABLED", message="Lieferantenzuordnungen sind in Artikelwerk nicht freigeschaltet.", field="lieferant"))
        elif not _present(product.lieferant_name):
            issues.append(PreviewIssue(severity="error", code="MISSING_SUPPLIER", message="Ein Einkaufspreis kann nur zusammen mit einem Lieferanten übertragen werden.", field="ek"))
        elif purchase_price is None:
            issues.append(PreviewIssue(severity="error", code="MISSING_PURCHASE_PRICE", message="Für die Lieferantenzuordnung fehlt der Netto-Einkaufspreis.", field="lieferant_netto_ek"))
        else:
            supplier = context.get("resolvedSupplier") or {}
            if not supplier.get("id"):
                issues.append(PreviewIssue(severity="error", code="UNKNOWN_SUPPLIER", message=f"Lieferant '{product.lieferant_name}' wurde in Artikelwerk nicht eindeutig gefunden.", field="lieferant_name"))
            else:
                article_payload["purchase"] = {
                    "supplierId": str(supplier["id"]), "articleNumber": product.lieferant_artikelnummer,
                    "purchasePriceNet": purchase_price,
                    "currency": str(supplier.get("currency") or settings.currency).upper(), "isDefault": True,
                }

    category_names = [value for value in (
        product.kategorie_1, product.kategorie_2, product.kategorie_3,
        product.kategorie_4, product.kategorie_5, product.kategorie_6,
    ) if _present(value)]
    if settings.publish_categories and category_names:
        if not features.get("categoryWrite", False):
            issues.append(PreviewIssue(severity="error", code="FEATURE_DISABLED", message="Kategorien sind in Artikelwerk nicht freigeschaltet.", field="kategorie_1"))
        else:
            category_ids = context.get("resolvedCategoryIds") or []
            if len(category_ids) != len(category_names):
                issues.append(PreviewIssue(severity="error", code="UNKNOWN_CATEGORY_PATH", message="Der Kategoriepfad wurde in Artikelwerk nicht vollständig und eindeutig gefunden.", field=f"kategorie_{len(category_ids) + 1}"))
            else:
                article_payload["categories"] = {
                    "categoryIds": [int(value) for value in category_ids],
                    "defaultCategoryId": int(category_ids[-1]),
                }
    steps.append(PublicationStep(operation="create_article", resource_key="article", payload=article_payload))

    # POST /articles never updates an existing SKU. Keep the mutable article
    # state as explicit steps; the publisher skips them only when this run
    # actually created the article.
    article_update_payload = {
        "name": product.artikelname,
        "inventoryTracking": settings.inventory_tracking,
        "taxClassId": ARTIKELWERK_STANDARD_TAX_CLASS_ID,
        "gtin": product.ean,
        "dimensions": dict(article_payload["dimensions"]),
        "weight": article_payload["weight"],
        "shippingWeight": article_payload["shippingWeight"],
    }
    if "manufacturerId" in article_payload:
        article_update_payload["manufacturerId"] = article_payload["manufacturerId"]
    state_sync_steps.extend([
        # A globally resolved legacy article may not yet belong to the target
        # tenant. Assign it first so the tenant-scoped detail read used for the
        # article ETag can succeed.
        PublicationStep(
            operation="sync_tenants", resource_key="article-tenants",
            payload={"tenantIds": list(settings.tenant_ids)},
        ),
        PublicationStep(
            operation="sync_article", resource_key="article-master",
            payload={"tenantId": settings.tenant_ids[0] if settings.tenant_ids else None,
                     "article": article_update_payload},
        ),
    ])
    if "categories" in article_payload:
        state_sync_steps.append(PublicationStep(
            operation="sync_categories", resource_key="article-categories",
            payload=dict(article_payload["categories"]),
        ))

    # CreateArticle writes these values for a new article. Keep explicit state
    # steps as well so an existing SKU converges to the local target state.
    if "price" in article_payload:
        state_sync_steps.append(PublicationStep(
            operation="sync_price",
            resource_key=(f"price:{article_payload['price']['tenantId']}:"
                          f"{article_payload['price']['customerGroupId']}:1"),
            payload=dict(article_payload["price"]),
        ))
    if "purchase" in article_payload:
        purchase_payload = dict(article_payload["purchase"])
        if _present(product.lieferant_artikelname):
            issues.append(PreviewIssue(
                severity="warning",
                code="UNSUPPORTED_SUPPLIER_ARTICLE_NAME",
                message=("Der Lieferanten-Artikelname wird von der aktuellen Artikelwerk-v1-Route "
                         "noch nicht angenommen. Lieferant, Artikelnummer und EK werden Ã¼bertragen."),
                field="lieferant_artikelname",
            ))
        state_sync_steps.append(PublicationStep(
            operation="sync_supplier",
            resource_key=f"supplier:{purchase_payload['supplierId']}",
            payload=purchase_payload,
        ))

    if settings.publish_descriptions and any(_present(v) for v in (
        product.beschreibung, product.kurzbeschreibung, product.url_pfad,
        product.title_tag, product.meta_description, product.seo_keywords,
    )):
        if not features.get("descriptionWrite", False):
            issues.append(PreviewIssue(severity="error", code="FEATURE_DISABLED", message="Beschreibungen sind nicht freigeschaltet."))
        steps.append(PublicationStep(
            operation="upsert_description",
            resource_key=f"description:0:{settings.language_id}:{settings.platform_id}",
            payload={
                "languageId": settings.language_id,
                "platformId": settings.platform_id,
                # Artikelwerk/JTL uses tenant 0 for the global description and SEO context.
                "tenantId": 0,
                "name": product.artikelname,
                "description": product.beschreibung,
                "shortDescription": product.kurzbeschreibung,
                "urlPath": product.url_pfad,
                "metaDescription": product.meta_description,
                "titleTag": product.title_tag,
                "metaKeywords": product.seo_keywords,
            },
        ))

    if settings.publish_attributes and (product.attributes or managed_attribute_ids):
        if not features.get("attributeWrite", False):
            issues.append(PreviewIssue(severity="error", code="FEATURE_DISABLED", message="Attribute sind nicht freigeschaltet."))
        desired_attribute_ids: set[str] = set()
        for key, value in product.attributes.items():
            definition = attribute_config.get(key)
            stable_id = key.casefold()
            configured_id = str(getattr(definition, "id", key))
            remote_id = stable_id if stable_id in remote_attributes else configured_id
            if remote_id not in remote_attributes:
                issues.append(PreviewIssue(
                    severity="warning", code="SKIPPED_ATTRIBUTE",
                    message=(f"Attribut '{key}' ({remote_id}) gehört nicht zum schreibbaren "
                             "Artikelwerk-Attributstamm und wird übersprungen."),
                    field=f"attributes.{key}",
                ))
                continue
            text_value = _value_as_string(value)
            if not text_value:
                issues.append(PreviewIssue(severity="warning", code="EMPTY_ATTRIBUTE", message=f"Leeres Attribut '{key}' wird übersprungen."))
                continue
            remote_definition = remote_attributes[remote_id]
            if remote_definition.get("allowsCustomValue") is False:
                values = context.get("attributeValues", {}).get(remote_id, [])
                labels = {str(item.get("label", "")).casefold() for item in values}
                if text_value.casefold() not in labels:
                    issues.append(PreviewIssue(
                        severity="error", code="UNKNOWN_ATTRIBUTE_VALUE",
                        message=f"Wert '{text_value}' ist für Artikelwerk-Attribut '{remote_id}' nicht vorhanden.",
                        field=f"attributes.{key}",
                    ))
                    continue
            steps.append(PublicationStep(
                operation="set_attribute", resource_key=f"attribute:{remote_id}",
                payload={"attributeId": remote_id, "value": text_value},
            ))
            desired_attribute_ids.add(remote_id)
        for remote_id in sorted((managed_attribute_ids or set()) - desired_attribute_ids):
            if remote_id not in remote_attributes:
                continue
            steps.append(PublicationStep(
                operation="delete_attribute", resource_key=f"attribute:{remote_id}",
                payload={"attributeId": remote_id,
                         "tenantId": settings.tenant_ids[0] if settings.tenant_ids else None},
            ))

    if settings.publish_base_price and product.grundpreis_ausweisen:
        if not features.get("basePriceWrite", False):
            issues.append(PreviewIssue(severity="error", code="FEATURE_DISABLED", message="Grundpreise sind nicht freigeschaltet."))
        measure_unit = units.get((product.inhalt_einheit or "").casefold())
        base_unit = units.get((product.bezugsmenge_einheit or "").casefold())
        if measure_unit is None or base_unit is None or not product.inhalt_menge or not product.bezugsmenge:
            issues.append(PreviewIssue(
                severity="error", code="INVALID_BASE_PRICE",
                message="Grundpreismenge oder Maßeinheit kann nicht auf den Artikelwerk-Context abgebildet werden.", field="grundpreis",
            ))
        else:
            steps.append(PublicationStep(
                operation="update_base_price", resource_key="base-price",
                payload={
                    "measureUnitId": measure_unit,
                    "measureQuantity": product.inhalt_menge,
                    "basePriceUnitId": base_unit,
                    "basePriceQuantity": product.bezugsmenge,
                },
            ))

    if settings.publish_images:
        image_values = [getattr(product, f"bild_{idx}") for idx in range(1, 10)]
        new_images = [
            (order, source) for order, source in enumerate(image_values, start=1)
            if _present(source) and str(source).strip()
        ]
        if new_images and not features.get("imageWrite", False):
            issues.append(PreviewIssue(severity="error", code="FEATURE_DISABLED", message="Bilder sind nicht freigeschaltet."))
        # Only explicitly supplied images are synchronized. Empty slots never
        # remove or replace images that already exist in JTL.
        for order, source in new_images:
            source_text = str(source)
            parsed = urlsplit(source_text)
            source_path = unquote(parsed.path) if parsed.scheme in {"http", "https"} else source_text.split("?", 1)[0]
            suffix = Path(source_path).suffix.lower()
            if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
                issues.append(PreviewIssue(
                    severity="error", code="UNSUPPORTED_IMAGE",
                    message=f"Bild {order} hat kein unterstütztes Artikelwerk-Format.", field=f"bild_{order}",
                ))
                continue
            steps.append(PublicationStep(
                operation="upload_image", resource_key=f"image:{order}",
                payload={
                    "source": source_text,
                    "filename": f"{product.artikelnummer}-{order:02d}{suffix}",
                    "tenantIds": settings.tenant_ids,
                    "order": order,
                },
            ))

    if product.is_parent and children and settings.publish_variants:
        if not features.get("variationWrite", False) or not features.get("childArticleWrite", False):
            issues.append(PreviewIssue(severity="error", code="FEATURE_DISABLED", message="Variationen oder Kindartikel sind nicht freigeschaltet."))
        axes = sorted({axis for child in children for axis in child.variant_attributes})
        for child in children:
            missing = [axis for axis in axes if not child.variant_attributes.get(axis)]
            if missing:
                issues.append(PreviewIssue(
                    severity="error", code="INCOMPLETE_VARIANT",
                    message=f"Kind {child.artikelnummer} hat keine Werte für: {', '.join(missing)}.",
                ))
        children_with_details = [
            child.artikelnummer for child in children
            if child.attributes or any(_present(getattr(child, f"bild_{idx}")) for idx in range(1, 10))
            or any(_present(value) for value in (child.beschreibung, child.kurzbeschreibung, child.url_pfad,
                                                  child.title_tag, child.meta_description, child.seo_keywords))
            or child.grundpreis_ausweisen
        ]
        if children_with_details:
            issues.append(PreviewIssue(
                severity="warning", code="CHILD_DETAILS_LIMITED",
                message="Kind-spezifische Inhalte werden in diesem ersten Workflow noch nicht separat übertragen: "
                        + ", ".join(children_with_details),
            ))
        for axis in axes:
            values = sorted({child.variant_attributes[axis] for child in children if child.variant_attributes.get(axis)})
            steps.append(PublicationStep(
                operation="create_variation", resource_key=f"variation:{axis}",
                payload={"name": axis, "type": "SELECTBOX", "values": [{"name": value} for value in values]},
            ))
        for child in children:
            steps.append(PublicationStep(
                operation="create_child", resource_key=f"child:{child.artikelnummer}",
                payload={
                    "sku": child.artikelnummer, "name": child.artikelname,
                    "tenantIds": settings.tenant_ids, "active": True,
                    "inventoryTracking": settings.inventory_tracking, "gtin": child.ean,
                    "_variationValues": child.variant_attributes,
                },
            ))

    # State updates come last so a missing legacy price or supplier assignment
    # cannot prevent descriptions, base-price data, images or variants from
    # reaching Artikelwerk.
    steps.extend(state_sync_steps)

    unsupported: list[str] = []

    return PublicationPreview(
        sku=product.artikelnummer,
        is_group=bool(product.is_parent and children),
        valid=not any(issue.severity == "error" for issue in issues),
        issues=issues,
        steps=steps,
        unsupported_fields=unsupported,
    )
