"""Pydantic models for dashboard statistics."""

from pydantic import BaseModel


class ActivityLog(BaseModel):
    event_type: str
    detail: str | None = None
    count: int = 0
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
    incomplete_products: list[IncompleteProduct]
    recent_activities: list[ActivityLog]
