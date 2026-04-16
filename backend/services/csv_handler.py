"""CSV import and JTL Ameise export logic."""

from __future__ import annotations

import csv
import io
from models.product import Product


class ImportWarning:
    """A non-fatal issue found during CSV import."""
    __slots__ = ("row", "field", "message")

    def __init__(self, row: int, field: str, message: str):
        self.row = row
        self.field = field
        self.message = message

    def to_dict(self) -> dict:
        return {"row": self.row, "field": self.field, "message": self.message}


class ParseResult:
    """Result of CSV parsing with products and warnings."""
    def __init__(self, products: list[Product], warnings: list[ImportWarning], skipped_rows: int):
        self.products = products
        self.warnings = warnings
        self.skipped_rows = skipped_rows


def parse_csv(content: bytes) -> ParseResult:
    """Parse a semicolon-separated CSV with Artikelnummer and Artikelname columns.

    Also recognises optional Stammdaten columns: Preis, Gewicht, Hersteller, EAN.
    Returns a ParseResult with products, warnings, and skipped row count.
    """
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")

    if reader.fieldnames is None:
        raise ValueError("CSV enthält keine Header-Zeile.")

    # Normalize header names (strip whitespace, BOM)
    clean_fields = [f.strip() for f in reader.fieldnames]
    required = {"Artikelnummer", "Artikelname"}
    missing = required - set(clean_fields)
    if missing:
        raise ValueError(f"Fehlende Spalten: {', '.join(missing)}")

    products: list[Product] = []
    warnings: list[ImportWarning] = []
    skipped = 0

    for row_idx, row in enumerate(reader, start=2):  # row 1 = header
        cleaned = {k.strip(): (v.strip() if v else "") for k, v in row.items()}
        sku = cleaned.get("Artikelnummer", "")
        name = cleaned.get("Artikelname", "")

        if not sku:
            skipped += 1
            warnings.append(ImportWarning(row_idx, "Artikelnummer", "Zeile übersprungen: Artikelnummer fehlt"))
            continue

        if not name:
            warnings.append(ImportWarning(row_idx, "Artikelname", f"Artikelname leer für {sku}"))

        ek = _parse_float(cleaned.get("EK", ""))
        if cleaned.get("EK", "").strip() and ek is None:
            warnings.append(ImportWarning(row_idx, "EK", f"EK ungültig für {sku}: '{cleaned.get('EK', '')}'"))

        preis = _parse_float(cleaned.get("Preis", ""))
        if cleaned.get("Preis", "").strip() and preis is None:
            warnings.append(ImportWarning(row_idx, "Preis", f"Preis ungültig für {sku}: '{cleaned.get('Preis', '')}'"))

        gewicht = _parse_float(cleaned.get("Gewicht", ""))
        if cleaned.get("Gewicht", "").strip() and gewicht is None:
            warnings.append(ImportWarning(row_idx, "Gewicht", f"Gewicht ungültig für {sku}: '{cleaned.get('Gewicht', '')}'"))

        hersteller = cleaned.get("Hersteller", "") or None
        ean = cleaned.get("EAN", "") or None

        products.append(Product(
            artikelnummer=sku,
            artikelname=name,
            ek=ek,
            preis=preis,
            gewicht=gewicht,
            hersteller=hersteller,
            ean=ean,
        ))

    return ParseResult(products=products, warnings=warnings, skipped_rows=skipped)


def _parse_float(value: str) -> float | None:
    """Parse a float from a string, accepting both '.' and ',' as decimal separator."""
    if not value:
        return None
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return None


def build_ameise_csv(
    products: list[Product],
    attribute_config: dict,
    delimiter: str = ";",
    attributgruppe: str = "Shopify-Attribute",
) -> str:
    """Build a JTL Ameise compatible CSV string from products with assigned attributes."""
    output = io.StringIO()
    writer = csv.writer(output, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")

    writer.writerow([
        "Artikelnummer",
        "Artikelname",
        "Attributgruppe",
        "Funktionsattribut ID",
        "Attributname",
        "Attributwert",
    ])

    for product in products:
        for attr_key, attr_value in product.attributes.items():
            config = attribute_config.get(attr_key)
            if config is None:
                continue
            writer.writerow([
                product.artikelnummer,
                product.artikelname,
                attributgruppe,
                config.id,
                f"{config.name} ({config.id})",
                str(attr_value),
            ])

    return output.getvalue()


def build_stammdaten_csv(products: list[Product], delimiter: str = ";", decimal_sep: str = ",") -> str:
    """Build a flat CSV with one row per product containing Stammdaten fields."""
    output = io.StringIO()
    writer = csv.writer(output, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")

    writer.writerow([
        "Artikelnummer",
        "Artikelname",
        "EK",
        "Brutto-VK",
        "Artikelgewicht",
        "Hersteller",
        "GTIN",
        "Länge",
        "Breite",
        "Höhe",
        "Verkaufseinheit",
        "Inhalt/Menge",
        "Maßeinheit",
        "Grundpreis ausweisen",
        "GP Bezugsmenge",
        "Einheit Bezugsmenge",
        "Lieferant",
        "Artikelnummer (Lieferant)",
        "Artikelname (Lieferant)",
        "Lieferant Netto-EK",
        "Bild 1 Pfad/URL",
        "Bild 2 Pfad/URL",
        "Bild 3 Pfad/URL",
        "Bild 4 Pfad/URL",
        "Bild 5 Pfad/URL",
        "Bild 6 Pfad/URL",
        "Bild 7 Pfad/URL",
        "Bild 8 Pfad/URL",
        "Bild 9 Pfad/URL",
        "Kategorie Ebene 1",
        "Kategorie Ebene 2",
        "Kategorie Ebene 3",
        "Kategorie Ebene 4",
        "Kategorie Ebene 5",
        "Kategorie Ebene 6",
    ])

    def _fmt(v: float | None, decimals: int = 2) -> str:
        if v is None:
            return ""
        formatted = f"{v:.{decimals}f}"
        if decimal_sep != ".":
            formatted = formatted.replace(".", decimal_sep)
        return formatted

    for p in products:
        writer.writerow([
            p.artikelnummer,
            p.artikelname,
            _fmt(p.ek),
            _fmt(p.preis),
            _fmt(p.gewicht / 1000, 3) if p.gewicht is not None else "",
            p.hersteller or "",
            f'="{p.ean}"' if p.ean else "",
            _fmt(p.laenge, 0),
            _fmt(p.breite, 0),
            _fmt(p.hoehe, 0),
            _fmt(p.verkaufseinheit, 0) if p.verkaufseinheit is not None else "",
            _fmt(p.inhalt_menge, 0),
            p.inhalt_einheit or "",
            "1" if p.grundpreis_ausweisen else "0",
            _fmt(p.bezugsmenge, 0),
            p.bezugsmenge_einheit or "",
            p.lieferant_name or "",
            p.lieferant_artikelnummer or "",
            p.lieferant_artikelname or "",
            _fmt(p.lieferant_netto_ek),
            p.bild_1 or "",
            p.bild_2 or "",
            p.bild_3 or "",
            p.bild_4 or "",
            p.bild_5 or "",
            p.bild_6 or "",
            p.bild_7 or "",
            p.bild_8 or "",
            p.bild_9 or "",
            p.kategorie_1 or "",
            p.kategorie_2 or "",
            p.kategorie_3 or "",
            p.kategorie_4 or "",
            p.kategorie_5 or "",
            p.kategorie_6 or "",
        ])

    return output.getvalue()


def build_seo_csv(products: list[Product], delimiter: str = ";") -> str:
    """Build a CSV with SEO & Content fields (one row per product)."""
    output = io.StringIO()
    writer = csv.writer(output, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")

    writer.writerow([
        "Artikelnummer",
        "Artikelname",
        "Kurzbeschreibung",
        "Beschreibung",
        "URL-Pfad",
        "Title-Tag (SEO)",
        "Meta-Description (SEO)",
    ])

    for p in products:
        writer.writerow([
            p.artikelnummer,
            p.artikelname,
            p.kurzbeschreibung or "",
            p.beschreibung or "",
            p.url_pfad or "",
            p.title_tag or "",
            p.meta_description or "",
        ])

    return output.getvalue()
