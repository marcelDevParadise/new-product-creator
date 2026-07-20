from __future__ import annotations

import asyncio
from typing import Any

import httpx

from config import ArtikelwerkConfig


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
        idempotency_key: str | None = None,
        max_attempts: int = 3,
    ) -> dict[str, Any] | list[Any]:
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        last_transport_error: Exception | None = None
        for attempt in range(max_attempts):
            try:
                response = await self._client.request(method, path.lstrip("/"), json=json, headers=headers)
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
                if response.content:
                    return response.json()
                return {}
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
        result = await self.request("GET", f"context/attributes/{attribute_id}/values")
        return result if isinstance(result, list) else []

    async def next_article_number(self, tenant_id: int) -> dict[str, Any]:
        return await self.request("GET", f"tenants/{tenant_id}/next-article-number")  # type: ignore[return-value]

    async def create_article(self, payload: dict[str, Any], key: str) -> dict[str, Any]:
        return await self.request("POST", "articles", json=payload, idempotency_key=key)  # type: ignore[return-value]

    async def set_attribute(self, article_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request("POST", f"articles/{article_id}/attributes", json=payload)  # type: ignore[return-value]

    async def upload_image(self, article_id: str, payload: dict[str, Any], key: str) -> dict[str, Any]:
        return await self.request("POST", f"articles/{article_id}/images", json=payload, idempotency_key=key)  # type: ignore[return-value]

    async def create_variation(self, article_id: str, payload: dict[str, Any], key: str) -> dict[str, Any]:
        return await self.request("POST", f"articles/{article_id}/variations", json=payload, idempotency_key=key)  # type: ignore[return-value]

    async def create_child(self, article_id: str, payload: dict[str, Any], key: str) -> dict[str, Any]:
        return await self.request("POST", f"articles/{article_id}/children", json=payload, idempotency_key=key)  # type: ignore[return-value]

    async def update_base_price(self, article_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request("PATCH", f"articles/{article_id}/base-price", json=payload)  # type: ignore[return-value]

    async def upsert_description(self, article_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request("PUT", f"articles/{article_id}/descriptions", json=payload)  # type: ignore[return-value]
