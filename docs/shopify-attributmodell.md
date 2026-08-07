# Shopify-Attributmodell

## Grundsatz

JTL-Wawi bleibt Transport- und Redaktionssystem für normale Produktmetafelder. Artikelwerk
serialisiert Werte so, wie Shopify sie im GraphQL-String erwartet:

- Text, URL, Datum und Referenz: String
- Boolean: `true` oder `false`
- Ganzzahl und Dezimalzahl: numerischer String
- Messwert: kompaktes JSON-Objekt, zum Beispiel `{"value":30.0,"unit":"seconds"}`
- Liste: kompaktes JSON-Array, zum Beispiel `["Latex","Polyurethan"]`

Die Produktwerkstatt speichert Messwerte intern als Objekt mit `value` und `unit`. Erst die
Artikelwerk-Übertragung erzeugt den JTL-String. Einheit und Zahl dürfen nicht mehr in einem
unkontrollierten Anzeigetext zusammengeführt werden.

## Verwaltungsmodi

| Modus | Verwendung | Verhalten |
| --- | --- | --- |
| `jtl` | Text, Zahlen, Boolean, Datum, Messwerte und Listen | Definition bei Bedarf über Artikelwerk in JTL anlegen und Wert serialisiert zuweisen |
| `shopify` | Metaobjekt-, Produkt-, Varianten-, Datei- und andere Shopify-Referenzen | Nicht als JTL-Freitext veröffentlichen; stabile `gid://shopify/...`-Referenz in der Produktwerkstatt pflegen |

Referenztypen werden unabhängig von einer fehlerhaften Einstellung niemals als normaler
JTL-Freitext übertragen.

## Korrekturen am empfohlenen Attributkatalog

| Bisherige Beschreibung | Shopify-Typ | Standard-Einheit / Hinweis |
| --- | --- | --- |
| Einwirkzeit, Wirkbeginn, Wirkungsdauer, Aufheizzeit, maximale Tragedauer | `duration` | `minutes` oder fachlich passende Einheit |
| Produktmaße, Durchmesser, Umfang, Hubweg, Verstellbereiche | `dimension` | bevorzugt `millimeters` oder `centimeters` |
| Inhalt | `volume` | bevorzugt `milliliters` |
| Gewicht und Belastungsgrenzen | `weight` | `grams` oder `kilograms` |
| Akkukapazität mAh | `battery_charge_capacity` | `milliamp_hours` |
| Akkukapazität Wh | `battery_energy_capacity` | `watt_hours` |
| Temperatur | `temperature` | `celsius` |
| Lautstärke | `sound_level` | `decibels` |
| Frequenz | `frequency` | `hertz` beziehungsweise passende Einheit |
| Unterdruck | `pressure` | Shopify unterstützt `bars` und `pounds_per_square_inch` |
| Mehrfachauswahlen | `list.single_line_text_field` | JSON-Array statt Trennzeichen-String |
| Hersteller und EU-Verantwortlicher | `metaobject_reference` | Modus `shopify`, stabile Metaobjekt-GID |
| Zubehör, Ersatzteile und Alternativen | `list.product_reference` | Modus `shopify`, Produkt-GIDs |
| Bundle-Bestandteile | `list.metaobject_reference` | Modus `shopify`; Metaobjekt enthält Referenz, Menge und Reihenfolge |

Freitext bleibt nur dort erhalten, wo Shopify keinen fachlich passenderen Typ anbietet oder
wo bewusst redaktioneller Text benötigt wird. Wertebereiche benötigen entweder zwei getrennte
Messfelder (`minimum` und `maximum`) oder ein eigenes Metaobjekt; ein einzelner Messwerttyp
kann keinen Bereich verlustfrei abbilden.

Quelle: <https://shopify.dev/docs/apps/build/metafields/list-of-data-types>
