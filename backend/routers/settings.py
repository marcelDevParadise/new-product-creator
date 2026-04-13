"""Settings router — pricing configuration."""

import json
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_PATH = Path(__file__).parent.parent / "data" / "settings.json"

_DEFAULTS = {
    "mwst_prozent": 19.0,
    "faktor": 2.37,
    "rundung": 0.95,
}


class PricingSettings(BaseModel):
    mwst_prozent: float = 19.0
    faktor: float = 2.37
    rundung: float = 0.95


def _load_settings() -> dict:
    if SETTINGS_PATH.exists():
        return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    return dict(_DEFAULTS)


def _save_settings(data: dict) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_pricing_settings() -> PricingSettings:
    raw = _load_settings()
    return PricingSettings(**{k: raw.get(k, v) for k, v in _DEFAULTS.items()})


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
