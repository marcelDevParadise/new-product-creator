"""Settings router — pricing, export, and unit configuration."""

import json
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_PATH = Path(__file__).parent.parent / "data" / "settings.json"

_DEFAULTS: dict = {
    "mwst_prozent": 19.0,
    "faktor": 2.37,
    "rundung": 0.95,
    "export": {
        "attributgruppe": "Shopify-Attribute",
        "csv_trennzeichen": ";",
        "dezimalformat": ",",
        "dateiname_muster": "{typ}_export_{datum}",
    },
    "einheiten": ["ml", "l", "g", "kg", "cm", "m", "mm", "Stück", "m²", "m³"],
    "standard_werte": {
        "hersteller": "",
        "lieferant_name": "",
    },
}


class PricingSettings(BaseModel):
    mwst_prozent: float = 19.0
    faktor: float = 2.37
    rundung: float = 0.95


class ExportSettings(BaseModel):
    attributgruppe: str = "Shopify-Attribute"
    csv_trennzeichen: str = ";"
    dezimalformat: str = ","
    dateiname_muster: str = "{typ}_export_{datum}"


class DefaultValues(BaseModel):
    hersteller: str = ""
    lieferant_name: str = ""


def _load_settings() -> dict:
    if SETTINGS_PATH.exists():
        raw = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        # Merge with defaults so new keys are always present
        merged = json.loads(json.dumps(_DEFAULTS))
        merged.update(raw)
        for section in ("export", "standard_werte"):
            if section in _DEFAULTS and isinstance(_DEFAULTS[section], dict):
                merged[section] = {**_DEFAULTS[section], **raw.get(section, {})}
        return merged
    return json.loads(json.dumps(_DEFAULTS))


def _save_settings(data: dict) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def get_pricing_settings() -> PricingSettings:
    raw = _load_settings()
    return PricingSettings(**{k: raw.get(k, v) for k, v in {
        "mwst_prozent": 19.0, "faktor": 2.37, "rundung": 0.95
    }.items()})


def get_export_settings() -> ExportSettings:
    raw = _load_settings().get("export", {})
    return ExportSettings(**raw)


def get_einheiten() -> list[str]:
    return _load_settings().get("einheiten", _DEFAULTS["einheiten"])


def get_default_values() -> DefaultValues:
    raw = _load_settings().get("standard_werte", {})
    return DefaultValues(**raw)


def calculate_vk(ek: float, settings: PricingSettings | None = None) -> float:
    """Calculate VK from EK: EK × (1 + MwSt/100) × Faktor, rounded to x,??€ ending."""
    if settings is None:
        settings = get_pricing_settings()
    raw_vk = ek * (1 + settings.mwst_prozent / 100) * settings.faktor
    # Round to ending: e.g. 0.95 → 12.95, 22.95, etc.
    whole = int(raw_vk)
    ending = settings.rundung - int(settings.rundung)  # e.g. 0.95
    if raw_vk - whole >= ending:
        result = whole + ending
    else:
        result = (whole - 1) + ending
    # Make sure we don't go below EK
    if result < ek:
        result = whole + ending
    return round(result, 2)


@router.get("/pricing")
def get_pricing():
    return get_pricing_settings()


@router.put("/pricing")
def update_pricing(body: PricingSettings):
    data = body.model_dump()
    _save_settings(data)
    return data


@router.post("/pricing/calculate")
def calculate(body: dict):
    """Calculate VK for a given EK using current settings."""
    ek = body.get("ek")
    if ek is None or not isinstance(ek, (int, float)) or ek < 0:
        return {"vk": None}
    settings = get_pricing_settings()
    vk = calculate_vk(float(ek), settings)
    return {"vk": vk}


# --- Export Settings ---

@router.get("/export")
def get_export():
    return get_export_settings()


@router.put("/export")
def update_export(body: ExportSettings):
    data = _load_settings()
    data["export"] = body.model_dump()
    _save_settings(data)
    return data["export"]


# --- Einheiten ---

@router.get("/einheiten")
def get_units():
    return get_einheiten()


@router.put("/einheiten")
def update_units(body: list[str]):
    data = _load_settings()
    # Deduplicate while preserving order
    seen: set[str] = set()
    clean: list[str] = []
    for u in body:
        u = u.strip()
        if u and u not in seen:
            clean.append(u)
            seen.add(u)
    data["einheiten"] = clean
    _save_settings(data)
    return clean


# --- Standard-Werte ---

@router.get("/defaults")
def get_defaults():
    return get_default_values()


@router.put("/defaults")
def update_defaults(body: DefaultValues):
    data = _load_settings()
    data["standard_werte"] = body.model_dump()
    _save_settings(data)
    return data["standard_werte"]


# --- All Settings (combined read) ---

@router.get("")
def get_all_settings():
    """Return all settings in one request."""
    return {
        "pricing": get_pricing_settings().model_dump(),
        "export": get_export_settings().model_dump(),
        "einheiten": get_einheiten(),
        "standard_werte": get_default_values().model_dump(),
    }
