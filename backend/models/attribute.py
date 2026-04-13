from pydantic import BaseModel


class SmartDefault(BaseModel):
    title_contains: str
    value: str


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


class AttributeUpdate(BaseModel):
    attributes: dict[str, str | int | bool]


class BulkAttributeUpdate(BaseModel):
    artikelnummern: list[str]
    attributes: dict[str, str | int | bool]
