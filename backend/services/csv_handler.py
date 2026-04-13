"""CSV import and JTL Ameise export logic."""

from __future__ import annotations

import csv
import io
from models.product import Product


def parse_csv(content: bytes) -> list[Product]:
    """Parse a semicolon-separated CSV with Artikelnummer and Artikelname columns.

    Also recognises optional Stammdaten columns: Preis, Gewicht, Hersteller, EAN.
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
    for row in reader:
        cleaned = {k.strip(): (v.strip() if v else "") for k, v in row.items()}
        sku = cleaned.get("Artikelnummer", "")
        name = cleaned.get("Artikelname", "")
        if not sku:
            continue

        ek = _parse_float(cleaned.get("EK", ""))
        preis = _parse_float(cleaned.get("Preis", ""))
        gewicht = _parse_float(cleaned.get("Gewicht", ""))
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

    return products


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
) -> str:
    """Build a JTL Ameise compatible CSV string from products with assigned attributes."""
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")

    writer.writerow([
        "Artikelnummer",
        "Artikelname",
        "Attributgruppe",
        "Funktionsattribut",
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
                "Shopify-Attribute",
                config.id,
                config.name,
                str(attr_value),
            ])

    return output.getvalue()


def build_stammdaten_csv(products: list[Product]) -> str:
    """Build a flat CSV with one row per product containing Stammdaten fields."""
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")

    writer.writerow([
        "Artikelnummer",
        "Artikelname",
        "EK",
        "Preis",
        "Gewicht",
        "Hersteller",
        "EAN",
        "Länge",
        "Breite",
        "Höhe",
        "Verkaufseinheit",
        "Inhalt/Menge",
        "Maßeinheit (Inhalt)",
        "Grundpreis ausweisen",
        "Bezugsmenge",
        "Maßeinheit (Bezug)",
        "Lieferant Name",
        "Lieferant Artikelnummer",
        "Lieferant Artikelname",
        "Lieferant Netto-EK",
        "Bild 1",
        "Bild 2",
        "Bild 3",
        "Bild 4",
        "Bild 5",
        "Bild 6",
        "Bild 7",
        "Bild 8",
        "Bild 9",
        "Kategorie 1",
        "Kategorie 2",
        "Kategorie 3",
        "Kategorie 4",
        "Kategorie 5",
        "Kategorie 6",
    ])

    def _fmt(v: float | None, decimals: int = 2) -> str:
        return f"{v:.{decimals}f}".replace(".", ",") if v is not None else ""

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
