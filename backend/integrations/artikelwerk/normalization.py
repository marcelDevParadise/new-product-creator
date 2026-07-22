"""Normalization helpers for matching human-readable Artikelwerk references."""

from typing import Any


_APOSTROPHE_TRANSLATION = str.maketrans({
    "\u2018": "'",
    "\u2019": "'",
    "\u00b4": "'",
    "`": "'",
})


def searchable_reference_name(value: Any) -> str:
    """Return a stable search spelling without changing the displayed name."""
    return str(value).translate(_APOSTROPHE_TRANSLATION).strip()


def normalized_reference_name(value: Any) -> str:
    """Normalize punctuation and casing for exact reference-name comparisons."""
    return searchable_reference_name(value).casefold()
