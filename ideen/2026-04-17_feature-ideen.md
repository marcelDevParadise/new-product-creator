---
tags:
  - ideen
  - attribut-generator
  - feature-request
  - workflow
  - automatisierung
  - datenqualität
  - medien
  - export
date: 2026-04-17
status: aktiv
bereich:
  - workflow
  - automatisierung
  - transparenz
  - medien
  - beziehungen
  - datenqualität
  - visualisierung
  - export
  - snapshots
---

# Feature-Ideen — 2026-04-17 (Runde 1)

> [!info] Kontext
> Dritte Ideenrunde. Keine Duplikate zu [[2025-07-13_feature-ideen]], [[2026-04-15_feature-ideen]] oder [[Projekterweiterungen]].

---

## Workflow & Produktivität

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 1 | **Produkt-Arbeitskorb** | Produkte aus beliebigen Seiten pinnen. Bulk-Aktionen/Export/Vergleich nur für gepinnte. Badge in Sidebar. | Spart Filter-Akrobatik bei willkürlicher Auswahl | Klein |
| 2 | **Tagesziel-Tracker** | Dashboard-Widget: „Heute: 20 Produkte vervollständigen." Fortschrittsbalken, Streak-Counter. | Motiviert bei monotoner Datenpflege | Klein |
| 3 | **Fehlende-Daten-Wizard** | Schlägt effizienteste Reihenfolge vor: „Material bei 47 Produkten setzen → +12 % Vollständigkeit." | Maximiert Impact pro Aktion | Mittel |
| 4 | **Import-Rezepte** | Gespeicherte Import-Konfigs inkl. Mapping + automatische Nachbearbeitung. One-Click. | Spart 15+ Min pro wiederkehrendem Import | Mittel |
| 5 | **Produkt-Timeline** | Visuelle Zeitleiste aller Events: Import → Stammdaten → Attribute → Bilder → Export. Mit Icons. | Sofort sehen wo ein Produkt im Prozess steht | Klein–Mittel |

---

## Berechnungen & Automatisierung

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 6 | **Berechnete Felder** | Formeln: `Marge = VK - EK`, `Grundpreis = VK / Inhalt`, `Titel = Hersteller + Name + Farbe`. Wie Excel. | Eliminiert manuelles Rechnen | Mittel |
| 7 | **Saisonale Automatisierung** | Zeitgesteuerte Tag-Aktionen: Ab 01.12. → „Weihnachten", ab Datum X → „Sale" + Preis neu. | Saisonale Aktionen ohne Eingriff | Mittel |
| 8 | **EAN-Prüfziffer-Validierung** | EAN-13 Prüfziffer live berechnen und validieren. Rot/Grün am Feld. | Verhindert EAN-Tippfehler | Klein |
| 9 | **SKU-Generator** | Konfigurierbares Format: `{PREFIX}-{KAT}-{NR}`. Auto-Vorschlag bei Neuanlage. | Einheitliche SKUs | Klein |

---

## Datenherkunft & Transparenz

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 10 | **Data Lineage** | Pro Feld: WOHER kam der Wert? (Import, Bulk, Template, Smart Default). Badge am Feld. | „Warum steht da dieser Wert?" | Mittel |
| 11 | **Attribut-Versionshistorie** | Attribut-Definitionen versionieren. Rollback bei Fehländerungen. | Wichtig bei mehreren Personen | Klein |
| 12 | **Export-Diff-Changelog** | Was hat sich seit dem letzten Export geändert? Delta-Liste mit Feld-Diffs. | Sicherheit vor Upload | Mittel |

---

## Bilder & Medien

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 13 | **ZIP-Bild-Import** | ZIP mit `CYL-00123_1.jpg` → automatische Zuordnung zu Produkten. Vorschau + Fehlbericht. | Massiv Zeit sparen bei Bild-Updates | Mittel |
| 14 | **Galerie-Ansicht** | Grid-View mit großen Bildern, Qualitäts-Badges, Filter „ohne Bild". | Bildqualität auf einen Blick | Klein–Mittel |
| 15 | **EAN-Barcode-Generator** | EAN-13 Barcodes als SVG/PNG direkt im Tool. | Kein externes Tool nötig | Klein |

---

## Produkt-Beziehungen & Sets

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 16 | **Bundles / Sets** | Produkte zu Sets (≠ Varianten). Eigene SKU, kombinierter Preis, verlinkte Einzelprodukte. | Sets ohne manuelles Zusammenstellen | Mittel |
| 17 | **Cross-Sell-Verknüpfung** | „passt zu" / „Alternative" / „Zubehör für". Exportierbar als Metafield. | Höherer Warenkorb-Wert | Mittel |
| 18 | **Ähnlichkeitsindex** | Automatisch ähnliche Produkte finden (87 % Attribut-Match). | Duplikate + Kannibalisierung erkennen | Mittel |

---

## Datenqualität & Normalisierung

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 19 | **Normalisierungs-Center** | Alle Werte pro Feld, Cluster bilden, Ein-Klick-Merge. Levenshtein + Case-Norm. | Daten säubern ohne KI | Klein–Mittel |
| 20 | **Coverage-Heatmap** | Matrix: Produkte × Attribute, farbcodiert. Klick auf Zelle → editieren. | Lücken auf einen Blick | Mittel |
| 21 | **Smart Merge bei Re-Import** | Pro Feld: „Immer überschreiben" / „Nur wenn leer" / „Längeren behalten" / „Manuell". | Flexibler als alles-oder-nichts | Mittel |

---

## Visualisierung & Shop

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 22 | **Shop-Karten-Vorschau** | Wie sieht die Produktkarte im Shop aus? Bild + Titel + Preis + Badge. | QA: Titel zu lang? Bild fehlt? | Klein |
| 23 | **Feature Matrix** | Produkte als Zeilen, Attribute als Spalten. Exportierbar als HTML-Snippet. | „Alle Vibratoren im Vergleich" | Mittel |
| 24 | **Onboarding-Pipeline** | Step-by-Step: Stammdaten → Bilder → Attribute → SEO → Freigabe. Progress pro Produkt. | Daten-Fortschritt statt Business-Status | Mittel |

---

## Export & Integration

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 25 | **Export-Transformationen** | Beim Export: Uppercase, Prefix/Suffix, Werte mappen, Felder concatenieren. | Kein manuelles CSV-Nachbearbeiten | Mittel |
| 26 | **Produktdaten-API** | Read-Only REST-API. JSON-Endpunkte. API-Key-Auth. Shop holt Daten live. | Headless-Ansatz, kein Export-Zyklus | Mittel–Groß |
| 27 | **Collection Mapping** | Shopify Collections aus Kategorien/Attributen/Tags ableiten. Export als CSV. | Weniger manuelle Shopify-Arbeit | Mittel |
| 28 | **Import-Watchfolder** | Ordner überwachen → neue CSV automatisch importieren. Status im Dashboard. | Zero-Touch Import | Mittel |

---

## Snapshots & Rollback

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 29 | **Produkt-Zeitreise** | Vollständiger Snapshot + Diff + Rollback per Klick. Wie Git für Produkte. | Kompletter Zustand wiederherstellbar | Mittel |
| 30 | **Multi-Source Conflicts** | Gleiche Produkte aus verschiedenen Quellen: Konflikte visualisieren, Quelle wählen. | Kritisch bei >1 Datenquelle | Groß |

---

> [!tip] Top 5 Empfehlungen
> 1. **Produkt-Arbeitskorb** — Klein, sofort nützlich
> 2. **Berechnete Felder** — Eliminiert Kopfrechnen (Marge, Grundpreis)
> 3. **Normalisierungs-Center** — Datenqualität massiv verbessern ohne KI
> 4. **ZIP-Bild-Import** — Riesige Zeitersparnis bei Bild-Updates
> 5. **SKU-Generator** — Klein, spart Nachdenken bei jedem neuen Produkt
