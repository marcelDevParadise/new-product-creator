"""Focused tests for the Artikelwerk contract adapter."""

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

from config import ArtikelwerkConfig
from integrations.artikelwerk.client import ArtikelwerkClient, ArtikelwerkError
from integrations.artikelwerk.mapper import build_preview
from integrations.artikelwerk.publisher import (
    _create_or_reuse_article,
    _delete_attribute,
    _sync_article,
    _sync_categories,
    _sync_price,
    _sync_supplier,
    _sync_tenants,
    prepare_image_payload,
)
from integrations.artikelwerk.schemas import ArtikelwerkSettings
from models.attribute import AttributeDefinition
from models.product import Product
from services import database as database_service
from services.sqlite_backend import make_pool as make_sqlite_pool


CAPABILITIES = {
    "provider": "jtl-wawi",
    "features": {
        "articleWrite": True,
        "attributeWrite": True,
        "descriptionWrite": True,
        "imageWrite": True,
        "variationWrite": True,
        "childArticleWrite": True,
        "basePriceWrite": True,
        "priceWrite": True,
        "supplierWrite": True,
        "categoryWrite": True,
    },
}

CONTEXT = {
    "tenants": [{"id": 4, "name": "CYL", "articleCount": 1, "isDefault": True}],
    "units": [{"id": 1, "name": "Milliliter", "code": "ml"}],
    "attributes": [{"id": "material", "name": "Material", "allowsCustomValue": True}],
}


class MapperTests(unittest.TestCase):
    def test_creates_missing_manufacturer_before_article(self):
        product = Product(artikelnummer="CYL-MAN", artikelname="Test", hersteller="Neue Marke")
        preview = build_preview(
            product, children=[], attribute_config={},
            context={**CONTEXT, "manufacturerNeedsCreate": True}, capabilities=CAPABILITIES,
            settings=ArtikelwerkSettings(tenant_ids=[4]),
        )
        self.assertTrue(preview.valid, preview.issues)
        self.assertEqual([step.operation for step in preview.steps[:2]], ["create_manufacturer", "create_article"])
        self.assertEqual(preview.steps[0].payload, {"name": "Neue Marke"})

    def test_uses_stable_context_attribute_id(self):
        product = Product(artikelnummer="CYL-ATTR", artikelname="Test", attributes={"meta_brand": "Acme"})
        definition = AttributeDefinition(
            id="meta_brand:custom:single_line_text_field", category="Shopify", name="Marke",
        )
        preview = build_preview(
            product, children=[], attribute_config={"meta_brand": definition},
            context={**CONTEXT, "attributes": [{"id": "meta_brand", "name": "meta_brand", "allowsCustomValue": True}]},
            capabilities=CAPABILITIES, settings=ArtikelwerkSettings(tenant_ids=[4]),
        )
        self.assertTrue(preview.valid, preview.issues)
        attribute_step = next(step for step in preview.steps if step.operation == "set_attribute")
        self.assertEqual(attribute_step.payload["attributeId"], "meta_brand")

    def test_maps_price_purchase_manufacturer_and_categories_into_create(self):
        product = Product(
            artikelnummer="CYL-FULL", artikelname="Vollständig", preis=119, ek=40,
            hersteller="Acme", lieferant_name="Supply", lieferant_artikelnummer="SUP-1",
            lieferant_artikelname="Name beim Lieferanten",
            lieferant_netto_ek=35, kategorie_1="Pflege", kategorie_2="Leder",
        )
        context = {
            **CONTEXT, "resolvedManufacturerId": 12,
            "resolvedSupplier": {"id": "42", "currency": "EUR"},
            "resolvedCategoryIds": [600, 615],
        }
        preview = build_preview(
            product, children=[], attribute_config={}, context=context, capabilities=CAPABILITIES,
            settings=ArtikelwerkSettings(tenant_ids=[4], tax_rate=19),
        )
        self.assertTrue(preview.valid, preview.issues)
        payload = preview.steps[0].payload
        self.assertEqual(payload["manufacturerId"], 12)
        self.assertEqual(payload["price"]["net"], 100)
        self.assertEqual(payload["purchase"]["supplierId"], "42")
        self.assertEqual(payload["purchase"]["purchasePriceNet"], 35)
        price_step = next(step for step in preview.steps if step.operation == "sync_price")
        supplier_step = next(step for step in preview.steps if step.operation == "sync_supplier")
        self.assertEqual(price_step.payload["net"], 100)
        self.assertNotIn("articleName", supplier_step.payload)
        self.assertIn("UNSUPPORTED_SUPPLIER_ARTICLE_NAME", {issue.code for issue in preview.issues})
        self.assertEqual(preview.steps[-2].operation, "sync_price")
        self.assertEqual(preview.steps[-1].operation, "sync_supplier")
        self.assertEqual(payload["categories"], {"categoryIds": [600, 615], "defaultCategoryId": 615})
        category_step = next(step for step in preview.steps if step.operation == "sync_categories")
        self.assertEqual(category_step.payload, payload["categories"])
        self.assertEqual(preview.unsupported_fields, [])

    def test_maps_article_attribute_description_and_base_price(self):
        product = Product(
            artikelnummer="CYL-TEST", artikelname="Test", beschreibung="Lang", gewicht=250,
            attributes={"material": "Leder"}, grundpreis_ausweisen=True,
            inhalt_menge=500, inhalt_einheit="ml", bezugsmenge=1000, bezugsmenge_einheit="ml",
        )
        preview = build_preview(
            product, children=[],
            attribute_config={"material": AttributeDefinition(id="material", category="Produkt", name="Material")},
            context=CONTEXT, capabilities=CAPABILITIES,
            settings=ArtikelwerkSettings(tenant_ids=[4]),
        )
        self.assertTrue(preview.valid, preview.issues)
        self.assertEqual(
            [s.operation for s in preview.steps],
            ["create_article", "upsert_description", "set_attribute", "update_base_price",
             "sync_article", "sync_tenants"],
        )
        self.assertEqual(preview.steps[0].payload["weight"], 0.25)
        article_step = next(step for step in preview.steps if step.operation == "sync_article")
        self.assertEqual(article_step.payload["article"]["weight"], 0.25)
        self.assertEqual(article_step.payload["tenantId"], 4)
        description_step = next(step for step in preview.steps if step.operation == "upsert_description")
        self.assertEqual(description_step.payload["tenantId"], 0)
        self.assertEqual(description_step.resource_key, "description:0:1:1")

    def test_creates_only_one_global_description_for_multiple_tenants(self):
        product = Product(
            artikelnummer="CYL-SEO", artikelname="SEO Test", title_tag="Globaler Titel",
            meta_description="Globale Beschreibung",
        )
        context = {
            **CONTEXT,
            "tenants": [
                *CONTEXT["tenants"],
                {"id": 5, "name": "Weiterer Shop", "articleCount": 0, "isDefault": False},
            ],
        }
        preview = build_preview(
            product, children=[], attribute_config={}, context=context, capabilities=CAPABILITIES,
            settings=ArtikelwerkSettings(tenant_ids=[4, 5]),
        )
        descriptions = [step for step in preview.steps if step.operation == "upsert_description"]
        self.assertEqual(len(descriptions), 1)
        self.assertEqual(descriptions[0].payload["tenantId"], 0)

    def test_unknown_attribute_is_skipped_without_blocking_publication(self):
        product = Product(artikelnummer="CYL-TEST", artikelname="Test", attributes={"missing": "x"})
        preview = build_preview(
            product, children=[], attribute_config={}, context=CONTEXT,
            capabilities=CAPABILITIES, settings=ArtikelwerkSettings(tenant_ids=[4]),
        )
        self.assertTrue(preview.valid)
        self.assertIn("SKIPPED_ATTRIBUTE", {issue.code for issue in preview.issues})
        self.assertNotIn("set_attribute", {step.operation for step in preview.steps})

    def test_deletes_only_previously_managed_missing_attributes(self):
        product = Product(
            artikelnummer="CYL-ATTR-SYNC", artikelname="Test", attributes={"material": "Leder"},
        )
        context = {
            **CONTEXT,
            "attributes": [
                *CONTEXT["attributes"],
                {"id": "color", "name": "Farbe", "allowsCustomValue": True},
                {"id": "external", "name": "Extern", "allowsCustomValue": True},
            ],
        }
        preview = build_preview(
            product, children=[],
            attribute_config={
                "material": AttributeDefinition(id="material", category="Produkt", name="Material"),
            },
            context=context, capabilities=CAPABILITIES,
            settings=ArtikelwerkSettings(tenant_ids=[4]),
            managed_attribute_ids={"material", "color"},
        )
        deletes = [step for step in preview.steps if step.operation == "delete_attribute"]
        self.assertEqual([step.payload["attributeId"] for step in deletes], ["color"])
        self.assertNotIn("external", {step.payload["attributeId"] for step in deletes})


class ImagePayloadTests(unittest.TestCase):
    def test_image_url_query_is_mapped_to_stable_article_filename(self):
        product = Product(
            artikelnummer="CYL-IMG", artikelname="Bild", bild_1="https://example.test/images/a/b.webp?v=2",
        )
        preview = build_preview(
            product, children=[], attribute_config={}, context=CONTEXT,
            capabilities=CAPABILITIES, settings=ArtikelwerkSettings(tenant_ids=[4]),
        )
        step = next(step for step in preview.steps if step.operation == "upload_image")
        self.assertEqual(step.payload["filename"], "CYL-IMG-01.webp")

    def test_maps_public_image_url_to_local_library(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "produkte" / "brand" / "produkt" / "bild.webp"
            image.parent.mkdir(parents=True)
            image.write_bytes(b"test-image")
            with patch.dict(os.environ, {"IMAGE_LIBRARY_ROOT": directory}):
                payload = prepare_image_payload({
                    "source": "https://raspberrypi.example/images/produkte/brand/produkt/bild.webp?cache=1",
                    "filename": "bild.webp", "tenantIds": [4], "order": 1,
                })
        self.assertEqual(payload["filename"], "bild.webp")
        self.assertEqual(payload["tenantIds"], [4])
        self.assertTrue(payload["imageBase64"])


class DatabaseCompatibilityTests(unittest.TestCase):
    def test_managed_attribute_lookup_works_with_sqlite(self):
        previous_pool = database_service._pool
        with tempfile.TemporaryDirectory() as directory:
            db_path = (Path(directory) / "attributes.db").as_posix()
            pool = make_sqlite_pool(f"sqlite:///{db_path}")
            database_service._pool = pool
            try:
                with database_service.get_conn() as conn, conn.cursor() as cur:
                    cur.execute("""
                        CREATE TABLE articlewerk_operations (
                            operation_id TEXT PRIMARY KEY,
                            artikelnummer TEXT NOT NULL,
                            operation_type TEXT NOT NULL,
                            resource_key TEXT NOT NULL,
                            status TEXT NOT NULL,
                            updated_at TEXT NOT NULL
                        )
                    """)
                    cur.executemany(
                        "INSERT INTO articlewerk_operations VALUES (%s,%s,%s,%s,%s,%s)",
                        [
                            ("1", "CYL-1", "set_attribute", "attribute:material", "succeeded", "2026-01-01 10:00:00"),
                            ("2", "CYL-1", "set_attribute", "attribute:color", "succeeded", "2026-01-01 10:01:00"),
                            ("3", "CYL-1", "delete_attribute", "attribute:color", "succeeded", "2026-01-01 10:02:00"),
                        ],
                    )
                self.assertEqual(
                    database_service.get_articlewerk_managed_attribute_ids("CYL-1"),
                    {"material"},
                )
            finally:
                pool.close()
                database_service._pool = previous_pool


class ClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_deletes_managed_attribute_with_fresh_article_etag(self):
        requests = []

        async def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if request.method == "GET":
                return httpx.Response(200, headers={"ETag": '"attribute-rev"'}, json={})
            return httpx.Response(200, json={"deleted": True})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            await _delete_attribute(client, "12", {"attributeId": "color", "tenantId": 4})

        self.assertEqual(requests[0].url.path, "/api/integrations/v1/articles/12")
        self.assertEqual(requests[1].url.path, "/api/integrations/v1/articles/12/attributes/color")
        self.assertEqual(requests[1].headers["If-Match"], '"attribute-rev"')

    async def test_syncs_existing_article_state_with_fresh_etags(self):
        requests = []

        async def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if request.method == "GET":
                return httpx.Response(200, headers={"ETag": '"fresh-rev"'}, json={})
            return httpx.Response(200, json={"updated": True})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            await _sync_article(client, "12", {
                "tenantId": 4,
                "article": {"name": "Neu", "gtin": "123", "weight": 0.25},
            })
            await _sync_tenants(client, "12", {"tenantIds": [4, 5]})
            await _sync_categories(client, "12", {
                "categoryIds": [600, 615], "defaultCategoryId": 615,
            })

        self.assertEqual(
            [(request.method, request.url.path) for request in requests],
            [
                ("GET", "/api/integrations/v1/articles/12"),
                ("PATCH", "/api/integrations/v1/articles/12"),
                ("GET", "/api/integrations/v1/articles/12/tenants"),
                ("PUT", "/api/integrations/v1/articles/12/tenants"),
                ("GET", "/api/integrations/v1/articles/12/categories"),
                ("PUT", "/api/integrations/v1/articles/12/categories"),
            ],
        )
        for request in requests[1::2]:
            self.assertEqual(request.headers["If-Match"], '"fresh-rev"')
        self.assertEqual(json.loads(requests[1].content), {
            "name": "Neu", "gtin": "123", "weight": 0.25,
        })
        self.assertEqual(json.loads(requests[3].content), {"tenantIds": [4, 5]})
        self.assertEqual(json.loads(requests[5].content), {
            "categoryIds": [600, 615], "defaultCategoryId": 615,
        })

    async def test_rejects_update_without_etag(self):
        async def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ArtikelwerkError) as caught:
                await _sync_article(client, "12", {
                    "tenantId": 4, "article": {"name": "Neu"},
                })
        self.assertEqual(caught.exception.code, "MISSING_ETAG")

    async def test_syncs_existing_price_with_etag(self):
        requests = []

        async def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if request.method == "GET":
                return httpx.Response(200, headers={"ETag": '"price-rev"'}, json={
                    "items": [{"priceId": "retail", "customerGroupId": 1, "quantityFrom": 1}],
                })
            return httpx.Response(200, json={"updated": True})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        payload = {"tenantId": 4, "customerGroupId": 1, "currency": "EUR", "net": 10,
                   "taxRate": 19, "quantityFrom": 1}
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            await _sync_price(client, "12", payload)
        self.assertEqual(requests[1].url.path, "/api/integrations/v1/articles/12/prices/retail")
        self.assertEqual(requests[1].headers["If-Match"], '"price-rev"')

    async def test_syncs_supplier_with_etag(self):
        requests = []

        async def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if request.method == "GET":
                return httpx.Response(200, headers={"ETag": '"supplier-rev"'}, json={"items": []})
            return httpx.Response(200, json={"updated": True})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        payload = {"supplierId": "42", "articleNumber": "SUP-1", "purchasePriceNet": 5,
                   "currency": "EUR", "isDefault": True}
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            await _sync_supplier(client, "12", payload)
        self.assertEqual(requests[1].url.path, "/api/integrations/v1/articles/12/suppliers/42")
        self.assertNotIn("articleName", json.loads(requests[1].content))

    async def test_reuses_existing_article_without_second_create(self):
        methods = []

        async def handler(request: httpx.Request) -> httpx.Response:
            methods.append(request.method)
            return httpx.Response(200, json={
                "items": [{"id": "12", "sku": "CYL-1", "name": "Vorhanden"}],
            })

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            result = await _create_or_reuse_article(
                client, {"sku": "CYL-1", "name": "Test", "tenantIds": [4]}, "article:create:1",
            )
        self.assertEqual(methods, ["GET"])
        self.assertTrue(result["reusedExisting"])
        self.assertEqual(result["article"]["id"], "12")

    async def test_understands_nested_article_number_search_response(self):
        methods = []

        async def handler(request: httpx.Request) -> httpx.Response:
            methods.append(request.method)
            return httpx.Response(200, json={
                "data": {"items": [{"articleId": "14", "articleNumber": "CYL-1"}], "total": 1},
            })

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            result = await _create_or_reuse_article(
                client, {"sku": "CYL-1", "name": "Test", "tenantIds": [4]}, "article:create:1",
            )
        self.assertEqual(methods, ["GET"])
        self.assertEqual(result["article"]["id"], "14")
        self.assertEqual(result["article"]["sku"], "CYL-1")

    async def test_blocks_create_for_unknown_search_response_shape(self):
        methods = []

        async def handler(request: httpx.Request) -> httpx.Response:
            methods.append(request.method)
            return httpx.Response(200, json={"unexpected": {"records": []}})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ArtikelwerkError) as caught:
                await _create_or_reuse_article(
                    client, {"sku": "CYL-1", "name": "Test", "tenantIds": [4]}, "article:create:1",
                )
        self.assertEqual(methods, ["GET"])
        self.assertEqual(caught.exception.code, "INVALID_ARTICLE_SEARCH_RESPONSE")

    async def test_reconciles_failed_create_by_sku_without_reposting(self):
        methods = []
        searches = 0

        async def handler(request: httpx.Request) -> httpx.Response:
            nonlocal searches
            methods.append(request.method)
            if request.method == "POST":
                return httpx.Response(500, json={"code": "INTERNAL_ERROR", "error": "Unklare Antwort"})
            searches += 1
            items = [] if searches == 1 else [{"id": "13", "sku": "CYL-1", "name": "Angelegt"}]
            return httpx.Response(200, json={"items": items})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            result = await _create_or_reuse_article(
                client, {"sku": "CYL-1", "name": "Test", "tenantIds": [4]}, "article:create:1",
            )
        self.assertEqual(methods, ["GET", "POST", "GET"])
        self.assertTrue(result["createErrorReconciled"])
        self.assertEqual(result["article"]["id"], "13")

    async def test_reconciles_existing_sku_hidden_in_another_tenant(self):
        requests = []

        async def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if request.method == "POST":
                return httpx.Response(409, json={
                    "code": "CONFLICT",
                    "error": "Artikelnummer 'CYL-00030' ist bereits vorhanden.",
                    "requestId": "req-5x",
                })
            if request.url.path.endswith("/context"):
                return httpx.Response(200, json={
                    "tenants": [{"id": 4}, {"id": 5}], "units": [], "attributes": [],
                })
            tenant_id = request.url.params.get("tenantId")
            items = ([{"id": "30", "sku": "CYL-00030", "name": "Vorhanden"}]
                     if tenant_id == "5" else [])
            return httpx.Response(200, json={"items": items})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            result = await _create_or_reuse_article(
                client, {"sku": "CYL-00030", "name": "Test", "tenantIds": [4]},
                "article:create:00030",
            )

        self.assertTrue(result["createErrorReconciled"])
        self.assertEqual(result["article"]["id"], "30")
        self.assertEqual(result["originalRequestId"], "req-5x")
        self.assertEqual(
            [(request.method, request.url.path, request.url.params.get("tenantId")) for request in requests],
            [
                ("GET", "/api/integrations/v1/articles", "4"),
                ("POST", "/api/integrations/v1/articles", None),
                ("GET", "/api/integrations/v1/articles", "4"),
                ("GET", "/api/integrations/v1/context", None),
                ("GET", "/api/integrations/v1/articles", "5"),
            ],
        )

    async def test_creates_manufacturer_idempotently(self):
        seen = {}

        async def handler(request: httpx.Request) -> httpx.Response:
            seen["path"] = request.url.path
            seen["key"] = request.headers.get("Idempotency-Key")
            seen["body"] = json.loads(request.content)
            return httpx.Response(201, headers={"X-Idempotent-Replay": "false"}, json={
                "operationId": "f9be70ad-24b9-45b6-9301-32173972f457",
                "manufacturer": {"id": 12, "name": "Acme"},
            })

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            result = await client.create_manufacturer({"name": "Acme"}, "manufacturer:acme")
        self.assertEqual(seen, {
            "path": "/api/integrations/v1/manufacturers",
            "key": "manufacturer:acme", "body": {"name": "Acme"},
        })
        self.assertEqual(result["operationId"], "f9be70ad-24b9-45b6-9301-32173972f457")
        self.assertEqual(result["manufacturer"]["id"], 12)

    async def test_searches_manufacturers_and_categories(self):
        seen = []

        async def handler(request: httpx.Request) -> httpx.Response:
            seen.append((request.url.path, dict(request.url.params)))
            return httpx.Response(200, json={"items": []})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            await client.search_manufacturers("Acme")
            await client.search_categories("Leder")

        self.assertEqual(seen[0][0], "/api/integrations/v1/manufacturers")
        self.assertEqual(seen[0][1]["search"], "Acme")
        self.assertEqual(seen[1][0], "/api/integrations/v1/categories")
        self.assertEqual(seen[1][1]["pageSize"], "100")

    async def test_sends_bearer_and_idempotency_headers(self):
        seen = {}

        async def handler(request: httpx.Request) -> httpx.Response:
            seen["auth"] = request.headers.get("Authorization")
            seen["key"] = request.headers.get("Idempotency-Key")
            seen["body"] = json.loads(request.content)
            return httpx.Response(201, json={"operationId": "op", "article": {"id": "12"}})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            await client.create_article({"sku": "CYL-1"}, "job:create:123")
        self.assertEqual(seen["auth"], "Bearer aw_secret")
        self.assertEqual(seen["key"], "job:create:123")
        self.assertEqual(seen["body"]["sku"], "CYL-1")

    async def test_exposes_stable_error_fields(self):
        async def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(409, json={
                "code": "CONFLICT", "error": "Schon vorhanden", "requestId": "req-1",
                "details": {"field": "sku", "reason": "CYL-1 ist bereits vergeben"},
            })

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ArtikelwerkError) as caught:
                await client.create_article({"sku": "CYL-1"}, "job:create:123")
        self.assertEqual(caught.exception.code, "CONFLICT")
        self.assertEqual(caught.exception.request_id, "req-1")
        self.assertEqual(caught.exception.details["field"], "sku")

    async def test_reads_fastapi_validation_details_and_request_header(self):
        async def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(422, headers={"X-Request-ID": "req-validation"}, json={
                "detail": [{"loc": ["body", "manufacturerId"], "msg": "Referenz unbekannt", "type": "value_error"}],
            })

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ArtikelwerkError) as caught:
                await client.create_article({"sku": "CYL-1"}, "job:create:123")
        self.assertEqual(caught.exception.status_code, 422)
        self.assertEqual(caught.exception.request_id, "req-validation")
        self.assertEqual(caught.exception.details[0]["loc"], ["body", "manufacturerId"])

    async def test_loads_next_article_number_for_tenant(self):
        seen = {}

        async def handler(request: httpx.Request) -> httpx.Response:
            seen["path"] = request.url.path
            return httpx.Response(200, json={
                "tenantId": 4, "tenantName": "CleanYourLeather", "prefix": "CYL-",
                "number": "CYL-00999", "sequence": 999,
            })

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            result = await client.next_article_number(4)
        self.assertEqual(seen["path"], "/api/integrations/v1/tenants/4/next-article-number")
        self.assertEqual(result["number"], "CYL-00999")

    async def test_reads_etag_and_sends_if_match_for_article_updates(self):
        seen = []

        async def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request)
            if request.method == "GET":
                return httpx.Response(200, headers={"ETag": '"0xA1"'}, json={"id": "12"})
            return httpx.Response(200, json={"operationId": "op-update"})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            article = await client.get_article("12", 4)
            await client.patch_article("12", {"name": "Neu"}, article.etag or "")

        self.assertEqual(article.data, {"id": "12"})
        self.assertEqual(article.etag, '"0xA1"')
        self.assertEqual(seen[0].url.params["tenantId"], "4")
        self.assertEqual(seen[1].headers["If-Match"], '"0xA1"')

    async def test_maps_new_v11_route_families(self):
        seen: set[tuple[str, str]] = set()

        async def handler(request: httpx.Request) -> httpx.Response:
            seen.add((request.method, request.url.path))
            return httpx.Response(200, headers={"ETag": '"0xA1"'}, json={})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            await client.search_articles(4, sku="CYL-1")
            await client.get_article_tenants("12")
            await client.set_article_tenants("12", {"tenantIds": [4]}, '"0xA1"')
            await client.get_article_prices("12", 4)
            await client.set_article_price("12", "retail", {"net": 10}, '"0xA1"')
            await client.get_article_inventory("12")
            await client.adjust_inventory("12", {"delta": 1}, "inventory:key")
            await client.get_article_categories("12")
            await client.set_article_categories("12", {"categoryIds": [1]}, '"0xA1"')
            await client.deactivate_article("12", {}, "lifecycle:off")
            await client.activate_article("12", {}, "lifecycle:on")
            await client.create_supplier({
                "name": "Lieferant GmbH",
                "supplierNumber": "L-10042",
                "defaultCompanyId": 1,
                "defaultWarehouseId": 1,
            }, "supplier-master:10042")
            await client.search_suppliers(supplier_number="L-10042", active=True, page=2, page_size=50)
            await client.get_article_suppliers("12")
            await client.upsert_article_supplier("12", "7", {"net": 5}, '"0xA1"')
            await client.delete_article_supplier("12", "7", '"0xA1"')
            await client.get_article_images("12")
            await client.patch_article_image("12", "8", {"order": 2}, '"0xA1"')
            await client.delete_article_image("12", "8", '"0xA1"', tenant_id=4)
            await client.order_article_images("12", {"imageIds": [8]}, '"0xA1"')
            await client.delete_attribute("12", "material", '"0xA1"')
            await client.patch_variation("12", "9", {"name": "Farbe"}, '"0xA1"')
            await client.patch_variation_value("12", "10", {"name": "Rot"}, '"0xA1"')
            await client.delete_variation_value("12", "10", '"0xA1"')
            await client.set_child_values("12", "13", {"valueIds": [10]}, '"0xA1"')
            await client.create_article_update_job({"articles": []})
            await client.get_job("00000000-0000-0000-0000-000000000001")
            await client.get_job_results("00000000-0000-0000-0000-000000000001")
            await client.get_changes(since="cursor", types="article", page_size=50)

        expected = {
            ("GET", "/api/integrations/v1/articles"),
            ("PATCH", "/api/integrations/v1/articles/12/variations/9"),
            ("PUT", "/api/integrations/v1/articles/12/suppliers/7"),
            ("POST", "/api/integrations/v1/articles/12/inventory-adjustments"),
            ("POST", "/api/integrations/v1/suppliers"),
            ("POST", "/api/integrations/v1/jobs/article-updates"),
            ("GET", "/api/integrations/v1/changes"),
        }
        self.assertTrue(expected.issubset(seen))

    async def test_searches_global_suppliers_with_filters(self):
        seen = {}

        async def handler(request: httpx.Request) -> httpx.Response:
            seen["path"] = request.url.path
            seen["params"] = dict(request.url.params)
            return httpx.Response(200, json={
                "items": [{
                    "id": "42", "name": "Lieferant GmbH", "supplierNumber": "L-10042",
                    "currency": "EUR", "email": None, "phone": None, "website": None,
                    "active": True, "revision": "0xA1",
                }],
                "page": 2, "pageSize": 50, "total": 1, "totalPages": 1,
            })

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            result = await client.search_suppliers(
                supplier_number="L-10042", name="GmbH", active=True, page=2, page_size=50,
            )

        self.assertEqual(seen["path"], "/api/integrations/v1/suppliers")
        self.assertEqual(seen["params"], {
            "supplierNumber": "L-10042", "name": "GmbH", "active": "true", "page": "2", "pageSize": "50",
        })
        self.assertEqual(result["items"][0]["revision"], "0xA1")

    async def test_creates_supplier_with_idempotency_key(self):
        seen = {}

        async def handler(request: httpx.Request) -> httpx.Response:
            seen["path"] = request.url.path
            seen["key"] = request.headers.get("Idempotency-Key")
            seen["body"] = json.loads(request.content)
            return httpx.Response(201, json={
                "operationId": "f9be70ad-24b9-45b6-9301-32173972f457",
                "supplier": {"id": "42", "name": "Lieferant GmbH", "supplierNumber": "L-10042"},
            })

        payload = {
            "name": "Lieferant GmbH",
            "supplierNumber": "L-10042",
            "currency": "EUR",
            "defaultCompanyId": 1,
            "defaultWarehouseId": 1,
        }
        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            result = await client.create_supplier(payload, "supplier-master:10042")

        self.assertEqual(seen["path"], "/api/integrations/v1/suppliers")
        self.assertEqual(seen["key"], "supplier-master:10042")
        self.assertEqual(seen["body"], payload)
        self.assertEqual(result["supplier"]["id"], "42")


if __name__ == "__main__":
    unittest.main()
