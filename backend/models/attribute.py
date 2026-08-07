from typing import Any, Literal

from pydantic import BaseModel, field_validator


AttributeValue = str | int | float | bool | list[Any] | dict[str, Any]
AttributeManagement = Literal["jtl", "shopify"]


class SmartDefault(BaseModel):
    title_contains: str
    value: AttributeValue


class AttributeDefinition(BaseModel):
    id: str
    category: str
    name: str
    description: str = ""
    required: bool = False
    required_for_types: list[str] = []
    default_value: str | None = None
    suggested_values: list[str] = []
    smart_defaults: list[SmartDefault] = []
    shopify_type: str = "single_line_text_field"
    unit: str | None = None
    management: AttributeManagement = "jtl"

    @field_validator("shopify_type")
    @classmethod
    def validate_shopify_type(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("shopify_type darf nicht leer sein")
        return normalized


class AttributeDefinitionCreate(BaseModel):
    key: str
    id: str
    category: str
    name: str
    description: str = ""
    required: bool = False
    required_for_types: list[str] = []
    default_value: str | None = None
    suggested_values: list[str] = []
    smart_defaults: list[SmartDefault] = []
    shopify_type: str = "single_line_text_field"
    unit: str | None = None
    management: AttributeManagement = "jtl"


class AttributeDefinitionUpdate(BaseModel):
    id: str | None = None
    category: str | None = None
    name: str | None = None
    description: str | None = None
    required: bool | None = None
    required_for_types: list[str] | None = None
    default_value: str | None = None
    suggested_values: list[str] | None = None
    smart_defaults: list[SmartDefault] | None = None
    shopify_type: str | None = None
    unit: str | None = None
    management: AttributeManagement | None = None


class AttributeUpdate(BaseModel):
    attributes: dict[str, AttributeValue]


class BulkAttributeUpdate(BaseModel):
    artikelnummern: list[str]
    attributes: dict[str, AttributeValue]
