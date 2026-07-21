"""Focused tests for the Artikelwerk contract adapter."""

import json
import unittest

import httpx

from config import ArtikelwerkConfig
from integrations.artikelwerk.client import ArtikelwerkClient, ArtikelwerkError
from integrations.artikelwerk.mapper import build_preview
from integrations.artikelwerk.schemas import ArtikelwerkSettings
from models.attribute import AttributeDefinition
from models.product import Product


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
    },
}

CONTEXT = {
    "tenants": [{"id": 4, "name": "CYL", "articleCount": 1, "isDefault": True}],
    "units": [{"id": 1, "name": "Milliliter", "code": "ml"}],
    "attributes": [{"id": "material", "name": "Material", "allowsCustomValue": True}],
}


class MapperTests(unittest.TestCase):
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
            ["create_article", "upsert_description", "set_attribute", "update_base_price"],
        )
        self.assertEqual(preview.steps[0].payload["weight"], 0.25)

    def test_unknown_attribute_blocks_publication(self):
        product = Product(artikelnummer="CYL-TEST", artikelname="Test", attributes={"missing": "x"})
        preview = build_preview(
            product, children=[], attribute_config={}, context=CONTEXT,
            capabilities=CAPABILITIES, settings=ArtikelwerkSettings(tenant_ids=[4]),
        )
        self.assertFalse(preview.valid)
        self.assertIn("UNKNOWN_ATTRIBUTE", {issue.code for issue in preview.issues})


class ClientTests(unittest.IsolatedAsyncioTestCase):
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
            return httpx.Response(409, json={"code": "CONFLICT", "error": "Schon vorhanden", "requestId": "req-1"})

        config = ArtikelwerkConfig("https://example.test/api/integrations/v1", "aw_secret", 5, True)
        async with ArtikelwerkClient(config, transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ArtikelwerkError) as caught:
                await client.create_article({"sku": "CYL-1"}, "job:create:123")
        self.assertEqual(caught.exception.code, "CONFLICT")
        self.assertEqual(caught.exception.request_id, "req-1")

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
            ("POST", "/api/integrations/v1/jobs/article-updates"),
            ("GET", "/api/integrations/v1/changes"),
        }
        self.assertTrue(expected.issubset(seen))


if __name__ == "__main__":
    unittest.main()
