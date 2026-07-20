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


if __name__ == "__main__":
    unittest.main()
