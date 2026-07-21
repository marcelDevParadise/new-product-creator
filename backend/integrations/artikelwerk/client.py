from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx

from config import ArtikelwerkConfig


JsonResponse = dict[str, Any] | list[Any]


@dataclass(frozen=True)
class ETaggedResponse:
    data: JsonResponse
    etag: str | None


def _segment(value: str | int) -> str:
    return quote(str(value), safe="")


class ArtikelwerkError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        status_code: int = 502,
        code: str = "INTEGRATION_ERROR",
        request_id: str | None = None,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.request_id = request_id
        self.details = details


class ArtikelwerkClient:
    """Small contract-focused client for Artikelwerk integration API v1."""

    def __init__(self, config: ArtikelwerkConfig, transport: httpx.AsyncBaseTransport | None = None) -> None:
        if not config.configured:
            raise ArtikelwerkError(
                "Artikelwerk ist nicht konfiguriert.",
                status_code=503,
                code="NOT_CONFIGURED",
            )
        self._client = httpx.AsyncClient(
            base_url=config.base_url + "/",
            headers={"Authorization": f"Bearer {config.api_key}", "Accept": "application/json"},
            timeout=httpx.Timeout(config.timeout_seconds),
            verify=config.verify_tls,
            transport=transport,
        )

    async def __aenter__(self) -> "ArtikelwerkClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, str | int | bool | None] | None = None,
        idempotency_key: str | None = None,
        if_match: str | None = None,
        max_attempts: int = 3,
    ) -> JsonResponse:
        response = await self._request_response(
            method, path, json=json, params=params, idempotency_key=idempotency_key,
            if_match=if_match, max_attempts=max_attempts,
        )
        if response.content:
            return response.json()
        return {}

    async def request_etagged(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str | int | bool | None] | None = None,
    ) -> ETaggedResponse:
        response = await self._request_response(method, path, params=params)
        data: JsonResponse = response.json() if response.content else {}
        return ETaggedResponse(data=data, etag=response.headers.get("ETag"))

    async def _request_response(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, str | int | bool | None] | None = None,
        idempotency_key: str | None = None,
        if_match: str | None = None,
        max_attempts: int = 3,
    ) -> httpx.Response:
        headers: dict[str, str] = {}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        if if_match:
            headers["If-Match"] = if_match
        last_transport_error: Exception | None = None
        for attempt in range(max_attempts):
            try:
                response = await self._client.request(
                    method, path.lstrip("/"), json=json,
                    params={key: value for key, value in (params or {}).items() if value is not None},
                    headers=headers or None,
                )
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_transport_error = exc
                if attempt + 1 < max_attempts:
                    await asyncio.sleep(0.5 * (2**attempt))
                    continue
                raise ArtikelwerkError("Artikelwerk ist nicht erreichbar.", details=str(exc)) from exc

            if response.status_code == 429 and attempt + 1 < max_attempts:
                try:
                    retry_after = max(1, int(response.headers.get("Retry-After", "1")))
                except ValueError:
                    retry_after = 1
                await asyncio.sleep(retry_after)
                continue
            if response.status_code >= 500 and attempt + 1 < max_attempts:
                await asyncio.sleep(0.5 * (2**attempt))
                continue
            if response.is_success:
                return response
            raise self._error_from_response(response)

        raise ArtikelwerkError("Artikelwerk ist nicht erreichbar.", details=str(last_transport_error or ""))

    @staticmethod
    def _error_from_response(response: httpx.Response) -> ArtikelwerkError:
        try:
            body = response.json()
        except ValueError:
            body = {}
        return ArtikelwerkError(
            body.get("error") or f"Artikelwerk antwortete mit HTTP {response.status_code}.",
            status_code=response.status_code,
            code=body.get("code", "INTEGRATION_ERROR"),
            request_id=body.get("requestId"),
            details=body.get("details"),
        )

    async def capabilities(self) -> dict[str, Any]:
        return await self.request("GET", "capabilities")  # type: ignore[return-value]

    async def context(self) -> dict[str, Any]:
        return await self.request("GET", "context")  # type: ignore[return-value]

    async def attribute_values(self, attribute_id: str) -> list[Any]:
        result = await self.request("GET", f"context/attributes/{_segment(attribute_id)}/values")
        return result if isinstance(result, list) else []

    async def next_article_number(self, tenant_id: int) -> dict[str, Any]:
        return await self.request("GET", f"tenants/{tenant_id}/next-article-number")  # type: ignore[return-value]

    async def create_article(self, payload: dict[str, Any], key: str) -> dict[str, Any]:
        return await self.request("POST", "articles", json=payload, idempotency_key=key)  # type: ignore[return-value]

    async def search_articles(
        self,
        tenant_id: int,
        *,
        sku: str | None = None,
        gtin: str | None = None,
        manufacturer_number: str | None = None,
        status: str | None = None,
        modified_since: str | None = None,
    ) -> JsonResponse:
        return await self.request("GET", "articles", params={
            "tenantId": tenant_id, "sku": sku, "gtin": gtin,
            "manufacturerNumber": manufacturer_number, "status": status,
            "modifiedSince": modified_since,
        })

    async def get_article(self, article_id: str, tenant_id: int) -> ETaggedResponse:
        return await self.request_etagged(
            "GET", f"articles/{_segment(article_id)}", params={"tenantId": tenant_id},
        )

    async def patch_article(self, article_id: str, payload: dict[str, Any], etag: str) -> dict[str, Any]:
        return await self.request(
            "PATCH", f"articles/{_segment(article_id)}", json=payload, if_match=etag,
        )  # type: ignore[return-value]

    async def get_article_tenants(self, article_id: str) -> ETaggedResponse:
        return await self.request_etagged("GET", f"articles/{_segment(article_id)}/tenants")

    async def set_article_tenants(self, article_id: str, payload: dict[str, Any], etag: str) -> dict[str, Any]:
        return await self.request(
            "PUT", f"articles/{_segment(article_id)}/tenants", json=payload, if_match=etag,
        )  # type: ignore[return-value]

    async def get_article_prices(self, article_id: str, tenant_id: int) -> ETaggedResponse:
        return await self.request_etagged(
            "GET", f"articles/{_segment(article_id)}/prices", params={"tenantId": tenant_id},
        )

    async def set_article_price(
        self, article_id: str, price_id: str, payload: dict[str, Any], etag: str,
    ) -> dict[str, Any]:
        return await self.request(
            "PUT", f"articles/{_segment(article_id)}/prices/{_segment(price_id)}",
            json=payload, if_match=etag,
        )  # type: ignore[return-value]

    async def get_article_inventory(self, article_id: str) -> ETaggedResponse:
        return await self.request_etagged("GET", f"articles/{_segment(article_id)}/inventory")

    async def adjust_inventory(
        self, article_id: str, payload: dict[str, Any], key: str,
    ) -> dict[str, Any]:
        return await self.request(
            "POST", f"articles/{_segment(article_id)}/inventory-adjustments",
            json=payload, idempotency_key=key,
        )  # type: ignore[return-value]

    async def get_article_categories(self, article_id: str) -> ETaggedResponse:
        return await self.request_etagged("GET", f"articles/{_segment(article_id)}/categories")

    async def set_article_categories(
        self, article_id: str, payload: dict[str, Any], etag: str,
    ) -> dict[str, Any]:
        return await self.request(
            "PUT", f"articles/{_segment(article_id)}/categories", json=payload, if_match=etag,
        )  # type: ignore[return-value]

    async def deactivate_article(
        self, article_id: str, payload: dict[str, Any], key: str,
    ) -> dict[str, Any]:
        return await self.request(
            "POST", f"articles/{_segment(article_id)}/deactivate", json=payload, idempotency_key=key,
        )  # type: ignore[return-value]

    async def activate_article(
        self, article_id: str, payload: dict[str, Any], key: str,
    ) -> dict[str, Any]:
        return await self.request(
            "POST", f"articles/{_segment(article_id)}/activate", json=payload, idempotency_key=key,
        )  # type: ignore[return-value]

    async def get_article_suppliers(self, article_id: str) -> ETaggedResponse:
        return await self.request_etagged("GET", f"articles/{_segment(article_id)}/suppliers")

    async def upsert_article_supplier(
        self, article_id: str, supplier_id: str, payload: dict[str, Any], etag: str,
    ) -> dict[str, Any]:
        return await self.request(
            "PUT", f"articles/{_segment(article_id)}/suppliers/{_segment(supplier_id)}",
            json=payload, if_match=etag,
        )  # type: ignore[return-value]

    async def delete_article_supplier(
        self, article_id: str, supplier_id: str, etag: str,
    ) -> dict[str, Any]:
        return await self.request(
            "DELETE", f"articles/{_segment(article_id)}/suppliers/{_segment(supplier_id)}",
            if_match=etag,
        )  # type: ignore[return-value]

    async def set_attribute(self, article_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request("POST", f"articles/{_segment(article_id)}/attributes", json=payload)  # type: ignore[return-value]

    async def delete_attribute(self, article_id: str, attribute_id: str, etag: str) -> dict[str, Any]:
        return await self.request(
            "DELETE", f"articles/{_segment(article_id)}/attributes/{_segment(attribute_id)}",
            if_match=etag,
        )  # type: ignore[return-value]

    async def get_article_images(self, article_id: str) -> ETaggedResponse:
        return await self.request_etagged("GET", f"articles/{_segment(article_id)}/images")

    async def upload_image(self, article_id: str, payload: dict[str, Any], key: str) -> dict[str, Any]:
        return await self.request("POST", f"articles/{_segment(article_id)}/images", json=payload, idempotency_key=key)  # type: ignore[return-value]

    async def patch_article_image(
        self, article_id: str, image_id: str, payload: dict[str, Any], etag: str,
    ) -> dict[str, Any]:
        return await self.request(
            "PATCH", f"articles/{_segment(article_id)}/images/{_segment(image_id)}",
            json=payload, if_match=etag,
        )  # type: ignore[return-value]

    async def delete_article_image(
        self, article_id: str, image_id: str, etag: str,
        *, tenant_id: int | None = None, physical: bool = False,
    ) -> dict[str, Any]:
        return await self.request(
            "DELETE", f"articles/{_segment(article_id)}/images/{_segment(image_id)}",
            params={"tenantId": tenant_id, "physical": physical}, if_match=etag,
        )  # type: ignore[return-value]

    async def order_article_images(
        self, article_id: str, payload: dict[str, Any], etag: str,
    ) -> dict[str, Any]:
        return await self.request(
            "PUT", f"articles/{_segment(article_id)}/images/order", json=payload, if_match=etag,
        )  # type: ignore[return-value]

    async def create_variation(self, article_id: str, payload: dict[str, Any], key: str) -> dict[str, Any]:
        return await self.request("POST", f"articles/{_segment(article_id)}/variations", json=payload, idempotency_key=key)  # type: ignore[return-value]

    async def patch_variation(
        self, article_id: str, variation_id: str, payload: dict[str, Any], etag: str,
    ) -> dict[str, Any]:
        return await self.request(
            "PATCH", f"articles/{_segment(article_id)}/variations/{_segment(variation_id)}",
            json=payload, if_match=etag,
        )  # type: ignore[return-value]

    async def patch_variation_value(
        self, article_id: str, value_id: str, payload: dict[str, Any], etag: str,
    ) -> dict[str, Any]:
        return await self.request(
            "PATCH", f"articles/{_segment(article_id)}/variation-values/{_segment(value_id)}",
            json=payload, if_match=etag,
        )  # type: ignore[return-value]

    async def delete_variation_value(
        self, article_id: str, value_id: str, etag: str,
    ) -> dict[str, Any]:
        return await self.request(
            "DELETE", f"articles/{_segment(article_id)}/variation-values/{_segment(value_id)}",
            if_match=etag,
        )  # type: ignore[return-value]

    async def create_child(self, article_id: str, payload: dict[str, Any], key: str) -> dict[str, Any]:
        return await self.request("POST", f"articles/{_segment(article_id)}/children", json=payload, idempotency_key=key)  # type: ignore[return-value]

    async def set_child_values(
        self, article_id: str, child_id: str, payload: dict[str, Any], etag: str,
    ) -> dict[str, Any]:
        return await self.request(
            "PUT", f"articles/{_segment(article_id)}/children/{_segment(child_id)}/values",
            json=payload, if_match=etag,
        )  # type: ignore[return-value]

    async def update_base_price(self, article_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request("PATCH", f"articles/{_segment(article_id)}/base-price", json=payload)  # type: ignore[return-value]

    async def upsert_description(self, article_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request("PUT", f"articles/{_segment(article_id)}/descriptions", json=payload)  # type: ignore[return-value]

    async def create_article_update_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request("POST", "jobs/article-updates", json=payload)  # type: ignore[return-value]

    async def get_job(self, job_id: str) -> dict[str, Any]:
        return await self.request("GET", f"jobs/{_segment(job_id)}")  # type: ignore[return-value]

    async def get_job_results(self, job_id: str) -> JsonResponse:
        return await self.request("GET", f"jobs/{_segment(job_id)}/results")

    async def get_changes(
        self, *, since: str | None = None, types: str | None = None, page_size: int = 100,
    ) -> JsonResponse:
        return await self.request(
            "GET", "changes", params={"since": since, "types": types, "pageSize": page_size},
        )
