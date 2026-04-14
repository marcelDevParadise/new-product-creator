"""Validation service — data quality checks for products."""

from __future__ import annotations

import re
from collections import Counter
from models.product import Product
from models.attribute import AttributeDefinition


class ValidationIssue:
    """A single validation finding."""

    __slots__ = ("severity", "field", "message", "suggested_fix")

    def __init__(self, severity: str, field: str, message: str, suggested_fix: str | None = None):
        self.severity = severity  # "error" | "warning"
        self.field = field
        self.message = message
        self.suggested_fix = suggested_fix

    def to_dict(self) -> dict:
        d: dict = {"severity": self.severity, "field": self.field, "message": self.message}
        if self.suggested_fix:
            d["suggested_fix"] = self.suggested_fix
        return d


def validate_product(
    product: Product,
    all_products: list[Product],
    attribute_config: dict[str, AttributeDefinition],
    ean_counts: Counter | None = None,
) -> list[ValidationIssue]:
    """Run all validation rules on a single product and return issues."""
    issues: list[ValidationIssue] = []

    # ── Artikelname ──
    if not product.artikelname or len(product.artikelname.strip()) < 3:
        issues.append(ValidationIssue("error", "artikelname", "Artikelname fehlt oder ist zu kurz (< 3 Zeichen)"))

    # ── EAN ──
    if not product.ean:
        issues.append(ValidationIssue("warning", "ean", "Keine EAN/GTIN hinterlegt"))
    else:
        if not re.match(r'^\d{8,14}$', product.ean):
            issues.append(ValidationIssue("error", "ean", "EAN hat ein ungültiges Format (erwartet: 8–14 Ziffern)", "EAN prüfen und korrigieren"))
        if ean_counts and ean_counts[product.ean] > 1:
            issues.append(ValidationIssue("error", "ean", f"Doppelte EAN: {product.ean} wird von {ean_counts[product.ean]} Produkten verwendet"))

    # ── Preise ──
    if product.ek is None:
        issues.append(ValidationIssue("warning", "ek", "Kein Einkaufspreis (EK) hinterlegt"))
    elif product.ek <= 0:
        issues.append(ValidationIssue("error", "ek", "EK muss größer als 0 sein"))

    if product.preis is None:
        issues.append(ValidationIssue("warning", "preis", "Kein Verkaufspreis (VK) hinterlegt"))
    elif product.preis <= 0:
        issues.append(ValidationIssue("error", "preis", "VK muss größer als 0 sein"))

    if product.ek is not None and product.preis is not None and product.ek > 0 and product.preis > 0:
        if product.preis < product.ek:
            issues.append(ValidationIssue("warning", "preis", "VK ist kleiner als EK — gewollt?"))

    # ── Gewicht ──
    if product.gewicht is None:
        issues.append(ValidationIssue("warning", "gewicht", "Kein Gewicht hinterlegt"))
    elif product.gewicht <= 0:
        issues.append(ValidationIssue("error", "gewicht", "Gewicht muss größer als 0 sein"))
    elif product.gewicht > 50000:
        issues.append(ValidationIssue("warning", "gewicht", f"Gewicht sehr hoch: {product.gewicht}g — korrekt?"))

    # ── Hersteller ──
    if not product.hersteller:
        issues.append(ValidationIssue("warning", "hersteller", "Kein Hersteller hinterlegt"))

    # ── Maße ──
    for dim_field, dim_label in [("laenge", "Länge"), ("breite", "Breite"), ("hoehe", "Höhe")]:
        val = getattr(product, dim_field)
        if val is not None and val <= 0:
            issues.append(ValidationIssue("error", dim_field, f"{dim_label} muss größer als 0 sein"))

    # ── Bilder ──
    image_count = sum(1 for i in range(1, 10) if getattr(product, f"bild_{i}"))
    if image_count == 0:
        issues.append(ValidationIssue("warning", "bilder", "Keine Bilder hinterlegt"))
    elif image_count < 2:
        issues.append(ValidationIssue("warning", "bilder", "Nur 1 Bild hinterlegt — empfohlen: mindestens 2"))

    # Check image URLs
    for i in range(1, 10):
        url = getattr(product, f"bild_{i}")
        if url and not (url.startswith("http://") or url.startswith("https://")):
            issues.append(ValidationIssue("warning", f"bild_{i}", f"Bild {i} ist keine gültige URL (beginnt nicht mit http(s)://)"))

    # ── Kategorien ──
    if not product.kategorie_1:
        issues.append(ValidationIssue("warning", "kategorie_1", "Keine Kategorie hinterlegt"))

    # ── Grundpreis ──
    if product.grundpreis_ausweisen:
        if not product.bezugsmenge:
            issues.append(ValidationIssue("error", "bezugsmenge", "Grundpreis ausweisen aktiv, aber Bezugsmenge fehlt"))
        if not product.bezugsmenge_einheit:
            issues.append(ValidationIssue("error", "bezugsmenge_einheit", "Grundpreis ausweisen aktiv, aber Bezugseinheit fehlt"))
        if not product.inhalt_menge:
            issues.append(ValidationIssue("error", "inhalt_menge", "Grundpreis ausweisen aktiv, aber Inhalt/Menge fehlt"))

    # ── Lieferant ──
    if not product.lieferant_name:
        issues.append(ValidationIssue("warning", "lieferant_name", "Kein Lieferant hinterlegt"))

    # ── Stammdaten ──
    if not product.stammdaten_complete:
        issues.append(ValidationIssue("warning", "stammdaten_complete", "Stammdaten sind nicht als vollständig markiert"))

    # ── Attribute ──
    if not product.attributes:
        issues.append(ValidationIssue("warning", "attributes", "Keine Attribute zugewiesen"))
    else:
        required_attrs = {k: v for k, v in attribute_config.items() if v.required}
        for attr_key, attr_def in required_attrs.items():
            if attr_key not in product.attributes:
                issues.append(ValidationIssue("error", f"attributes.{attr_key}", f"Pflichtattribut fehlt: {attr_def.name}"))

    return issues


def compute_severity(issues: list[ValidationIssue]) -> str:
    """Determine the overall severity for a product: 'ok', 'warning', 'error'."""
    if not issues:
        return "ok"
    if any(i.severity == "error" for i in issues):
        return "error"
    return "warning"


def validate_all_products(
    products: list[Product],
    attribute_config: dict[str, AttributeDefinition],
) -> list[dict]:
    """Validate all products and return a list of product validation results."""
    # Pre-compute EAN counts for duplicate detection
    ean_counts: Counter = Counter()
    for p in products:
        if p.ean:
            ean_counts[p.ean] += 1

    results = []
    for p in products:
        issues = validate_product(p, products, attribute_config, ean_counts)
        severity = compute_severity(issues)
        results.append({
            "artikelnummer": p.artikelnummer,
            "artikelname": p.artikelname,
            "severity": severity,
            "error_count": sum(1 for i in issues if i.severity == "error"),
            "warning_count": sum(1 for i in issues if i.severity == "warning"),
            "issues": [i.to_dict() for i in issues],
        })

    return results


def compute_quality_stats(results: list[dict]) -> dict:
    """Compute aggregate quality statistics."""
    total = len(results)
    ok = sum(1 for r in results if r["severity"] == "ok")
    warnings = sum(1 for r in results if r["severity"] == "warning")
    errors = sum(1 for r in results if r["severity"] == "error")

    # Collect issue counts by field
    field_counts: Counter = Counter()
    for r in results:
        for issue in r["issues"]:
            field_counts[issue["field"]] += 1

    top_issues = [{"field": f, "count": c} for f, c in field_counts.most_common(10)]

    return {
        "total_products": total,
        "ok_count": ok,
        "warning_count": warnings,
        "error_count": errors,
        "ok_percent": round(ok / total * 100, 1) if total else 0,
        "top_issues": top_issues,
    }
