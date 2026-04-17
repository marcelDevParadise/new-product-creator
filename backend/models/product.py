from pydantic import BaseModel


class Product(BaseModel):
    artikelnummer: str
    artikelname: str
    ek: float | None = None
    preis: float | None = None
    gewicht: float | None = None
    hersteller: str | None = None
    ean: str | None = None
    # Maße
    laenge: float | None = None
    breite: float | None = None
    hoehe: float | None = None
    # Grundpreis
    verkaufseinheit: float | None = None
    inhalt_menge: float | None = None
    inhalt_einheit: str | None = None
    grundpreis_ausweisen: bool = False
    bezugsmenge: float | None = None
    bezugsmenge_einheit: str | None = None
    # Lieferant
    lieferant_name: str | None = None
    lieferant_artikelnummer: str | None = None
    lieferant_artikelname: str | None = None
    lieferant_netto_ek: float | None = None
    # Bilder
    bild_1: str | None = None
    bild_2: str | None = None
    bild_3: str | None = None
    bild_4: str | None = None
    bild_5: str | None = None
    bild_6: str | None = None
    bild_7: str | None = None
    bild_8: str | None = None
    bild_9: str | None = None
    # Kategorien
    kategorie_1: str | None = None
    kategorie_2: str | None = None
    kategorie_3: str | None = None
    kategorie_4: str | None = None
    kategorie_5: str | None = None
    kategorie_6: str | None = None
    # SEO & Content
    kurzbeschreibung: str | None = None
    beschreibung: str | None = None
    url_pfad: str | None = None
    title_tag: str | None = None
    meta_description: str | None = None
    seo_keywords: str | None = None
    # Varianten
    parent_sku: str | None = None
    is_parent: bool = False
    variant_attributes: dict[str, str] = {}
    #
    attributes: dict[str, str | int | bool] = {}
    exported: bool = False
    stammdaten_complete: bool = False
