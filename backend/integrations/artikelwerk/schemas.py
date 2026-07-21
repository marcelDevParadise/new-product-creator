from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ArtikelwerkSettings(StrictModel):
    tenant_ids: list[int] = Field(default_factory=list)
    language_id: int = Field(default=1, ge=0)
    platform_id: int = Field(default=1, ge=0)
    inventory_tracking: bool = True
    customer_group_id: int = Field(default=1, ge=1)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    tax_rate: float = Field(default=19.0, ge=0, le=100)
    publish_price: bool = True
    publish_purchase: bool = True
    publish_manufacturer: bool = True
    publish_categories: bool = True
    publish_images: bool = True
    publish_descriptions: bool = True
    publish_attributes: bool = True
    publish_base_price: bool = True
    publish_variants: bool = True


class PublishRequest(StrictModel):
    dry_run: bool = False


class PreviewIssue(StrictModel):
    severity: Literal["error", "warning"]
    code: str
    message: str
    field: str | None = None


class PublicationStep(StrictModel):
    operation: str
    resource_key: str
    payload: dict[str, Any]


class PublicationPreview(StrictModel):
    sku: str
    is_group: bool
    valid: bool
    issues: list[PreviewIssue]
    steps: list[PublicationStep]
    unsupported_fields: list[str]


class ConnectionStatus(StrictModel):
    configured: bool
    reachable: bool
    base_url: str | None = None
    provider: str | None = None
    features: dict[str, bool] = Field(default_factory=dict)
    error: str | None = None
    request_id: str | None = None
