"""Pydantic models for dashboard statistics and product history."""

from pydantic import BaseModel


class ActivityLog(BaseModel):
    event_type: str
    detail: str | None = None
    count: int = 0
    created_at: str


class ProductHistoryEntry(BaseModel):
    id: int
    artikelnummer: str
    event_type: str
    field: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    detail: str | None = None
    created_at: str


class IncompleteProduct(BaseModel):
    artikelnummer: str
    artikelname: str
    stammdaten_complete: bool
    attribute_count: int
    missing: str


class DashboardStats(BaseModel):
    products_total: int
    products_active: int
    products_archived: int
    stammdaten_complete: int
    stammdaten_incomplete: int
    stammdaten_percent: float
    attributes_with: int
    attributes_without: int
    attributes_percent: float
    export_ready: int
    export_not_ready: int
    export_ready_percent: float
    # Extended KPIs
    products_without_images: int
    products_without_ean: int
    products_with_errors: int
    seo_complete: int
    seo_percent: float
    avg_attributes_per_product: float
    # Content Score
    content_score_avg: float
    content_complete: int
    content_partial: int
    content_empty: int
    recently_updated: list[IncompleteProduct]
    incomplete_products: list[IncompleteProduct]
    recent_activities: list[ActivityLog]


class ContentScoreProduct(BaseModel):
    artikelnummer: str
    artikelname: str
    score: int
    score_percent: float
    missing: list[str]


class PriceStats(BaseModel):
    avg_ek: float
    avg_vk: float
    avg_margin: float
    avg_margin_percent: float
    products_without_ek: int
    products_without_vk: int
    products_negative_margin: int
    min_ek: float | None
    max_ek: float | None
    min_vk: float | None
    max_vk: float | None
    critical_margin_products: list[dict]


class SystemHealth(BaseModel):
    db_size_bytes: int
    db_size_display: str
    products_count: int
    activity_log_count: int
    product_history_count: int
    attribute_definitions_count: int
    templates_count: int
    uptime_seconds: float
    uptime_display: str
    python_version: str
    integrity_ok: bool


class HeatmapField(BaseModel):
    field: str
    label: str
    filled_count: int
    total: int
    percent: float


class HeatmapProduct(BaseModel):
    artikelnummer: str
    artikelname: str
    filled_count: int
    total_fields: int
    fields: dict[str, bool]


class HeatmapData(BaseModel):
    field_stats: list[HeatmapField]
    products: list[HeatmapProduct]
    total_products: int


class ExportHistoryEntry(BaseModel):
    id: int
    export_type: str
    filename: str
    product_count: int
    row_count: int
    created_at: str
