"""Validation and JTL serialization for Shopify metafield values."""

from __future__ import annotations

import json
import re
from typing import Any


MEASUREMENT_UNITS: dict[str, set[str]] = {
    "area": {"square_centimeters", "square_feet", "square_inches", "square_meters", "square_yards"},
    "battery_charge_capacity": {"milliamp_hours"},
    "battery_energy_capacity": {"watt_hours"},
    "concentration": {"milligrams_per_gram", "milligrams_per_milliliter"},
    "dimension": {"inches", "feet", "yards", "millimeters", "centimeters", "meters"},
    "distance": {"kilometers", "miles"},
    "duration": {"nanoseconds", "microseconds", "milliseconds", "seconds", "minutes", "hours", "days", "months", "years"},
    "frequency": {"hertz", "kilohertz", "megahertz", "gigahertz"},
    "power": {"milliwatts", "watts", "horsepower", "kilowatts"},
    "pressure": {"pounds_per_square_inch", "bars"},
    "rotational_speed": {"revolutions_per_minute"},
    "sound_level": {"decibels"},
    "temperature": {"celsius", "fahrenheit", "kelvin"},
    "voltage": {"volts"},
    "volume": {
        "milliliters", "centiliters", "liters", "cubic_meters",
        "us_fluid_ounces", "us_pints", "us_quarts", "us_gallons",
        "imperial_fluid_ounces", "imperial_pints", "imperial_quarts", "imperial_gallons",
    },
    "weight": {"ounces", "pounds", "grams", "kilograms"},
}

REFERENCE_TYPES = {
    "article_reference", "collection_reference", "company_reference", "customer_reference",
    "file_reference", "metaobject_reference", "mixed_reference", "order_reference",
    "page_reference", "product_reference", "product_taxonomy_value_reference", "variant_reference",
}

_GID_PATTERN = re.compile(r"^gid://shopify/[A-Za-z][A-Za-z0-9]*/[A-Za-z0-9_-]+$")


class MetafieldValueError(ValueError):
    pass


def is_list_type(shopify_type: str) -> bool:
    return shopify_type.startswith("list.")


def base_type(shopify_type: str) -> str:
    return shopify_type[5:] if is_list_type(shopify_type) else shopify_type


def requires_shopify_reference(shopify_type: str) -> bool:
    return base_type(shopify_type) in REFERENCE_TYPES


def jtl_data_type(shopify_type: str) -> str:
    if is_list_type(shopify_type) or base_type(shopify_type) in (set(MEASUREMENT_UNITS) | REFERENCE_TYPES):
        return "text"
    return {
        "number_integer": "integer",
        "number_decimal": "decimal",
        "date": "date",
        "date_time": "date",
        "boolean": "integer",
    }.get(base_type(shopify_type), "text")


def _measurement(value: Any, shopify_type: str, default_unit: str | None) -> dict[str, Any]:
    if isinstance(value, dict):
        amount = value.get("value")
        unit = value.get("unit") or default_unit
    else:
        amount = value
        unit = default_unit
    if isinstance(amount, bool) or not isinstance(amount, (int, float)):
        raise MetafieldValueError(f"{shopify_type} benötigt einen numerischen Wert.")
    allowed = MEASUREMENT_UNITS[shopify_type]
    if unit not in allowed:
        raise MetafieldValueError(
            f"{shopify_type} benötigt eine gültige Einheit ({', '.join(sorted(allowed))})."
        )
    return {"value": float(amount), "unit": unit}


def normalize_value(value: Any, shopify_type: str, default_unit: str | None = None) -> Any:
    """Return the JSON-compatible logical Shopify value and validate its shape."""
    if is_list_type(shopify_type):
        if not isinstance(value, list):
            raise MetafieldValueError(f"{shopify_type} benötigt eine Liste.")
        item_type = base_type(shopify_type)
        return [normalize_value(item, item_type, default_unit) for item in value]

    kind = base_type(shopify_type)
    if kind in MEASUREMENT_UNITS:
        return _measurement(value, kind, default_unit)
    if kind in REFERENCE_TYPES:
        if not isinstance(value, str) or not _GID_PATTERN.fullmatch(value.strip()):
            raise MetafieldValueError(f"{kind} benötigt eine stabile Shopify-GID.")
        return value.strip()
    if kind == "boolean":
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.casefold() in {"true", "false"}:
            return value.casefold() == "true"
        raise MetafieldValueError("boolean benötigt true oder false.")
    if kind == "number_integer":
        if isinstance(value, bool):
            raise MetafieldValueError("number_integer benötigt eine Ganzzahl.")
        try:
            number = int(value)
        except (TypeError, ValueError) as exc:
            raise MetafieldValueError("number_integer benötigt eine Ganzzahl.") from exc
        if str(number) != str(value).strip() and not isinstance(value, int):
            raise MetafieldValueError("number_integer benötigt eine Ganzzahl.")
        return number
    if kind == "number_decimal":
        if isinstance(value, bool):
            raise MetafieldValueError("number_decimal benötigt eine Dezimalzahl.")
        try:
            return float(str(value).replace(",", "."))
        except (TypeError, ValueError) as exc:
            raise MetafieldValueError("number_decimal benötigt eine Dezimalzahl.") from exc
    if kind == "json":
        return value
    if value is None:
        raise MetafieldValueError(f"{kind} darf nicht leer sein.")
    return str(value)


def serialize_for_jtl(value: Any, shopify_type: str, default_unit: str | None = None) -> str:
    """Serialize exactly as Shopify's GraphQL string value expects downstream."""
    normalized = normalize_value(value, shopify_type, default_unit)
    if base_type(shopify_type) == "json" or is_list_type(shopify_type) or isinstance(normalized, (dict, list)):
        return json.dumps(normalized, ensure_ascii=False, separators=(",", ":"))
    if isinstance(normalized, bool):
        return "true" if normalized else "false"
    return str(normalized)
