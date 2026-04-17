---
tags:
  - ideen
  - attribut-generator
  - feature-request
  - übersicht
  - index
date: 2026-04-17
status: aktiv
bereich:
  - alle
---

# Alle Feature-Ideen — Gruppiert nach Thema

> [!info] Kontext
> Konsolidierte Übersicht aller **141 Feature-Ideen** aus 5 Quelldateien, gruppiert in **16 Themenbereiche**.
> 12 erledigte Features wurden in [[Erledigte-Erweiterungen]] verschoben.
> Duplikate wurden zusammengeführt (5 Merges).
>
> **Quellen-Legende:**
> - `Q1` = [[2025-07-13_feature-ideen]] — MVP-Phase
> - `Q2` = [[2026-04-15_feature-ideen]] — KI, Import, UX
> - `Q3` = [[2026-04-17_feature-ideen]] — Workflow, Medien, Export
> - `Q4` = [[2026-04-17_feature-ideen-2]] — Shopify, Preise, Multi-Channel
> - `V` = [[2026-04-17_varianten-ideen]] — Variantenlogik

---

## 1. Import & Datenquellen (11)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Clipboard-Import** | Direkt aus Excel/Sheets einfügen (Ctrl+V), kein CSV-Umweg | Klein | Q2 |
| 2 | **Import-Diff-Vorschau** | Vorher anzeigen welche Felder sich ändern, keine versehentlichen Überschreibungen | Mittel | Q2 |
| 3 | **Auto-Backup vor Bulk-Ops** | DB-Snapshot vor Import, Bulk, Template-Apply. Schnelles Rollback | Klein | Q2 |
| 4 | **Wiederkehrender Import** | Import-Quelle + Mapping speichern, One-Click-Wiederholung | Mittel | Q2 |
| 5 | **Produkt-Merge-Assistent** | Bei Duplikaten: Felder im Dialog zusammenführen | Mittel | Q2 |
| 6 | **Lieferanten-Import** | CSV/Excel von Lieferanten direkt einlesen und Felder mappen | Groß | Q1 |
| 7 | **Import-Rezepte** | Gespeicherte Import-Konfigs inkl. Mapping + automatische Nachbearbeitung | Mittel | Q3 |
| 8 | **Smart Merge bei Re-Import** | Pro Feld: „Immer überschreiben" / „Nur wenn leer" / „Längeren behalten" / „Manuell" | Mittel | Q3 |
| 9 | **Feld-Aliase** | Ein Feld akzeptiert mehrere Import-Namen: „title" = „Name" = „Artikelname" | Klein | Q4 |
| 10 | **Import-Watchfolder** | Ordner überwachen → neue CSV automatisch importieren, Status im Dashboard | Mittel | Q3 |
| 11 | **Import-Statistiken** | Pro Import: neu/aktualisiert/übersprungen/fehlerhaft, Trend über letzte 10 Importe | Klein | Q4 |

---

## 2. Stammdaten & Produktpflege (12)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Standard-Werte Auto-Ausfüllen** | Neue Produkte erben Standards basierend auf Kategorie | Klein | Q1 |
| 2 | **Produkt klonen** | Produkt als Vorlage für neues nutzen (80% weniger Eingabezeit) | Klein | Q1 |
| 3 | **EAN-Lookup** | EAN eingeben → Produktdaten aus offener Datenbank ziehen | Mittel | Q1 |
| 4 | **Turbo-Modus** | Schnellerfassung: nur Pflichtfelder, Tab-Navigation, Auto-Save | Groß | Q1 |
| 5 | **Inline-Edit in Tabellen** | Zellen per Doppelklick direkt bearbeiten, kein Seitenwechsel | Mittel | Q2 |
| 6 | **Multi-Tab Bearbeitung** | Mehrere Produkte in Tabs öffnen, parallel bearbeiten | Mittel | Q2 |
| 7 | **Berechnete Felder** | Formeln: `Marge = VK - EK`, `Grundpreis = VK / Inhalt`, `Titel = Hersteller + Name` | Mittel | Q3 |
| 8 | **EAN-Prüfziffer-Validierung** | EAN-13 Prüfziffer live berechnen und validieren (Rot/Grün am Feld) | Klein | Q3 |
| 9 | **SKU-Generator** | Konfigurierbares Format `{PREFIX}-{KAT}-{NR}`, Auto-Vorschlag bei Neuanlage | Klein | Q3 |
| 10 | **Dynamische Feld-Typen** | Maßangabe (Wert+Einheit), Preisliste (Key-Value), Farbwahl (Hex-Picker), Toggle | Mittel | Q4 |
| 11 | **Bedingte Sichtbarkeit** | Felder nur anzeigen wenn Bedingungen erfüllt (z.B. Akkulaufzeit nur bei `stromquelle = Akku`) | Mittel | Q4 |
| 12 | **Einheiten-Konverter** | mm ↔ cm ↔ Zoll, g ↔ kg ↔ lb. Einheit pro Feld konfigurierbar | Klein | Q4 |

---

## 3. Preise & Kalkulation (6)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **VK-Autoberechnung** | VK sofort bei EK-Änderung berechnen (MwSt + Faktor) | Klein | Q1 |
| 2 | **Preisstufen-Rechner** | Staffelpreise, Händlerpreise, UVP, Sale-Preis — konfigurierbares Regelwerk | Mittel | Q4 |
| 3 | **Margen-Alarm** | Warnung wenn Marge unter Schwellwert fällt, Badge + Filter „kritische Marge" | Klein | Q4 |
| 4 | **Währungsumrechnung** | EK in Fremdwährung (USD, GBP) → EUR umrechnen, konfigurierbarer/Live-Kurs | Klein | Q4 |
| 5 | **Preis-Rundungsregeln** | Automatisch auf „schöne" Preise runden (.90/.95/.99), konfigurierbar | Klein | Q4 |
| 6 | **Saisonale Automatisierung** | Zeitgesteuerte Aktionen: Ab 01.12. → „Weihnachten"-Tag, ab Datum X → Sale + Preis | Mittel | Q3 |

---

## 4. Attribute & Datenqualität (12)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Duplikat-Erkennung** | Warnung bei ähnlichen SKUs, EANs oder Produktnamen | Klein | Q1 |
| 2 | **Konfigurierbare Validierungsregeln** | Pflichtfelder und Regeln pro Kategorie festlegen | Mittel | Q1 |
| 3 | **Attribut-Konsistenz-Check** | „Schwarz" vs „schwarz" vs „SCHWARZ" finden und normalisieren | Klein | Q2 |
| 4 | **Pflichtfeld-Matrix** | Welche Felder fehlen bei welchen Produkten als Kreuztabelle | Klein | Q2 |
| 5 | **Anomalie-Erkennung** | Ungewöhnliche Werte markieren (Gewicht 0.001 kg, EK 0€) | Klein | Q2 |
| 6 | **Regex-Suche** | Reguläre Ausdrücke über alle Felder suchen | Klein | Q2 |
| 7 | **Auto-Korrektur Vorschläge** | „Meinten Sie Silikon statt Silokon?" — Levenshtein-basiert | Mittel | Q2 |
| 8 | **Normalisierungs-Center** | Alle Werte pro Feld clustern, Ein-Klick-Merge, Case-Normalisierung | Klein–Mittel | Q3 |
| 9 | **Attribut-Versionshistorie** | Attribut-Definitionen versionieren + Rollback bei Fehländerungen | Klein | Q3 |
| 10 | **Produktname-Normalisierung** | Reihenfolge festlegen: Marke → Typ → Variante → Farbe, automatisch umformatieren | Klein–Mittel | Q4 |
| 11 | **Attribut-Nutzungsbericht** | Welches Attribut ist bei wie vielen Produkten gesetzt — tote Attribute finden | Klein | Q2 |
| 12 | **Attribut-Diversitäts-Report** | Pro Attribut: Anzahl verschiedene Werte, Top 10 mit Häufigkeit | Klein | Q4 |

---

## 5. Content & SEO (4)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Text-Snippets / Beschreibungs-Bausteine** | Globale Bausteinbibliothek mit Variablen `{hersteller}`, `{material}`. Per Klick in TipTap einfügen | Klein | Q1+Q4 |
| 2 | **SEO-Score** | Live-Bewertung von Titel/Beschreibung (Länge, Keywords) | Klein | Q1 |
| 3 | **Bulk-Content-Editor** | Beschreibungen für mehrere Produkte gleichzeitig bearbeiten | Mittel | Q1 |
| 4 | **Beschreibungs-Analyse** | Zeichenanzahl, Wortanzahl, Lesezeit, Keyword-Dichte, Flesch-Score, Pflicht-Phrasen | Klein | Q4 |

---

## 6. KI & Intelligente Automatisierung (4)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **KI-Produktbeschreibungen** | Kurz-/Langbeschreibung per LLM aus Produktname + Attributen generieren | Mittel | Q2 |
| 2 | **KI-Kategorievorschlag** | Kategorie aus Produktname + Hersteller automatisch ableiten | Klein | Q2 |
| 3 | **KI-SEO-Optimierung** | Title-Tag + Meta-Description automatisch generieren | Klein | Q2 |
| 4 | **Attribut-Wert-Extraktion** | Aus Produktname automatisch Farbe, Material, Größe erkennen | Mittel | Q2 |

---

## 7. Varianten (38)

### 7.1 Erstellung & Konfiguration

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Kartesische Matrix-Generierung** | Achsen definieren (Farbe × Größe) → Children automatisch generieren, Kombis deaktivierbar | Mittel | V |
| 2 | **SKU-Schema für Varianten** | Konfigurierbares Suffix: Parent + Achsen-Kürzel (`CYL-00123-ROT-S`) | Klein | V |
| 3 | **Varianten aus CSV importieren** | CSV mit Parent-SKU + Varianten-Attributen → Children automatisch erzeugen | Mittel | V |
| 4 | **Varianten-Klonen** | Komplette Variantengruppe duplizieren: Parent + alle Children | Klein | V |
| 5 | **Varianten-Achsen dynamisch erweitern** | Neue Achse nachträglich hinzufügen, bestehende Children behalten Werte | Mittel | V |
| 6 | **Regel-basierte Variantenerstellung** | „Kategorie = Unterwäsche → automatisch Größen S/M/L/XL erstellen" | Mittel | V |
| 7 | **Varianten-Template** | Achsen-Kombis als Template speichern: „Farb-Set Basic", „Größen EU" | Klein | V |
| 8 | **Smart Auto-Suggest v2** | Fuzzy-Matching statt nur Suffix-Strip, erkennt Farbname mitten im Titel | Mittel | V |

### 7.2 Übersicht & Navigation

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 10 | **Varianten-Baum-Ansicht** | Hierarchische Tree-View: Parent → Children, Drag & Drop zum Umgruppieren | Klein–Mittel | V |
| 11 | **Varianten-Schnellwechsel** | Im Editor: Dropdown/Tabs mit Geschwister-Varianten, Ein-Klick-Wechsel | Klein | V |
| 13 | **Verwaiste Varianten finden** | Filter: Children deren Parent gelöscht/archiviert oder nicht existent | Klein | V |

### 7.3 Vererbung & Synchronisation

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 14 | **Selektive Vererbungs-Übersteuerung** | Pro Child pro Feld: „Eigener Wert" vs. „Geerbt" explizit schaltbar (Toggle) | Klein–Mittel | V |
| 15 | **Bulk-Sync Parent → Children** | „Alle Children jetzt synchronisieren" mit Vorschau-Diff | Klein | V |
| 16 | **Reverse-Vererbung (Child → Parent)** | Gemeinsame Werte aus Children in den Parent übernehmen (Vorschlag + Bestätigung) | Mittel | V |
| 17 | **Vererbungs-Changelog** | Protokollieren wann geerbte Werte sich durch Parent-Änderung veränderten | Klein | V |
| 18 | **Vererbungs-Profil pro Gruppe** | Pro Variantengruppe konfigurieren welche Felder vererbt werden (statt global) | Mittel | V |

### 7.4 Matrix & Inline-Editing

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 19 | **Matrix-Inline-Bearbeitung** | Doppelklick auf Zelle → Inline-Input → Enter → gespeichert | Mittel | V |
| 20 | **Matrix-Spalten konfigurieren** | Wählbar welche Felder die VariantMatrix zeigt | Klein | V |
| 21 | **Matrix-Sortierung** | Nach Achsenwert, Preis, SKU oder per Drag & Drop manuell sortieren | Klein | V |
| 22 | **Matrix-Zellenfarben** | Grün = eigener Wert, grau = geerbt, amber = abweichend, rot = fehlt | Klein | V |
| 23 | **Matrix-CSV-Export** | Aktuelle Matrixansicht als CSV exportieren (nur sichtbare Spalten) | Klein | V |

### 7.5 Varianten-Preise

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 24 | **Varianten-Aufpreis-System** | Aufpreis pro Achsenwert: Größe XL = +5€, Basis-VK + Aufpreise automatisch | Mittel | V |
| 25 | **Staffelpreise pro Variante** | Mengenrabatte die pro Variante unterschiedlich sein können | Mittel | V |
| 26 | **Preis-Sync-Optionen** | Pro Gruppe: „VK vom Parent" / „individuell" / „Parent + Aufpreis" | Klein | V |

### 7.6 Varianten-Shopify

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 27 | **Shopify-Varianten-Vorschau** | Live-Vorschau: Farbwahl-Swatches, Größen-Buttons, Preis-Range | Klein–Mittel | V |
| 28 | **Option-Value-Mapping** | Interne Werte auf Shopify-Werte mappen: `rot` → `Rot`, `s` → `Small` | Klein | V |
| 29 | **Varianten-Bild-Zuordnung** | Pro Achsenwert ein Bild → Shopify `Variant Image` | Mittel | V |
| 30 | **Shopify-Varianten-Limit-Check** | Warnung bei >100 Varianten oder >3 Achsen (Shopify-Limits) | Klein | V |
| 31 | **Varianten-Metafield-Export** | Pro Variante eigene Metafields exportieren (z.B. `variant.metafields.custom.ean`) | Mittel | V |

### 7.7 Varianten-Qualität

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 32 | **Varianten-Vollständigkeits-Check** | Pro Gruppe: gleiche Achsen? EANs vorhanden? Preis gesetzt? Score | Klein | V |
| 33 | **Achsenwert-Konsistenz** | „Rot"/„rot"/„ROT" oder „M"/„Medium"/„mittel" prüfen + normalisieren | Klein | V |
| 34 | **Fehlende-Varianten-Erkennung** | Lücken in der Matrix finden: „Es fehlt Blau/L" → One-Click erstellen | Klein–Mittel | V |
| 35 | **Varianten-Diff-Report exportierbar** | Bestehenden Diff (Parent vs Children) als CSV/PDF exportieren | Klein | V |
| 36 | **Auto-Gruppierung bei Import** | Zusammengehörige CSV-Zeilen erkennen → Parent automatisch erstellen | Mittel | V |

### 7.8 Erweiterte Strukturen

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 37 | **Multi-Level-Varianten** | Parent → Sub-Parent → Child (Serie → Modell → Farbe) | Groß | V |
| 38 | **Varianten-Sets / Swatches-Daten** | Pro Achsenwert: Hex-Code, Bild-Swatch. Exportierbar für Color-Picker | Klein–Mittel | V |
| 39 | **Varianten-Gruppen verschmelzen** | Zwei Gruppen zu einer zusammenführen | Mittel | V |
| 40 | **Varianten-Gruppe aufsplitten** | Eine Gruppe in zwei aufteilen, jeweils eigener Parent | Klein–Mittel | V |

---

## 8. Bilder & Medien (4)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Bild-URL-Vorschau** | Thumbnail für hinterlegte Bild-URLs anzeigen | Klein | Q1 |
| 2 | **ZIP-Bild-Import** | ZIP mit `CYL-00123_1.jpg` → automatische Zuordnung zu Produkten + Fehlbericht | Mittel | Q3 |
| 3 | **Galerie-Ansicht** | Grid-View mit großen Bildern, Qualitäts-Badges, Filter „ohne Bild" | Klein–Mittel | Q3 |
| 4 | **EAN-Barcode-Generator** | EAN-13 Barcodes als SVG/PNG direkt im Tool generieren | Klein | Q3 |

---

## 9. Export & Integration (6)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Geplante Exporte** | Exporte zeitgesteuert oder bei Änderung automatisch auslösen | Mittel | Q1 |
| 3 | **Export-Changelog** | Was hat sich seit dem letzten Export geändert? Delta-Liste mit Feld-Diffs | Mittel | Q2+Q3 |
| 4 | **Export-Transformationen** | Beim Export: Uppercase, Prefix/Suffix, Werte mappen, Felder concatenieren | Mittel | Q3 |
| 5 | **Produktdaten-API** | Read-Only REST-API mit JSON-Endpunkten + API-Key-Auth (Headless) | Mittel–Groß | Q3 |
| 6 | **Collection Mapping** | Shopify Collections aus Kategorien/Attributen/Tags ableiten und exportieren | Mittel | Q3 |
| 7 | **Datenblatt-Export** | PDF-Datenblatt pro Produkt für B2B und Lieferanten | Mittel | Q1 |

---

## 10. Shopify & Multi-Channel (10)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Shopify-Tag-Manager** | Dediziertes UI: Batch-Zuweisen, -Entfernen, Tag-Gruppen, Regeln | Klein–Mittel | Q4 |
| 2 | **Shopify-Variant-Options-Builder** | Varianten-Achsen per UI → Matrix → Shopify-CSV mit Option1/Option2/Option3 | Mittel | Q4 |
| 3 | **Inventory-Location-Mapping** | Lagerstandorte pro Produkt/Variante zuweisen (Multi-Location) | Klein | Q4 |
| 4 | **Shopify Liquid-Snippet-Export** | Aus Attributen Liquid-Code generieren: Metafield-Anzeige, Vergleichstabellen | Klein | Q4 |
| 5 | **Shop-Vorschau** | Vorschau wie Produktkarte im Shop aussieht: Bild + Titel + Preis + Badge | Klein–Mittel | Q1+Q3 |
| 6 | **Google Merchant Center Feed** | Export im Google Product Data Format (XML/TSV) für Google Shopping | Mittel | Q1+Q4 |
| 7 | **Amazon Flat-File Generator** | Export im Amazon Inventory-Flat-File-Format nach Produktkategorie | Mittel–Groß | Q4 |
| 8 | **Kanal-spezifische Feldwerte** | Pro Feld alternative Werte: `title_shopify`, `title_amazon`, `title_ebay` | Mittel | Q4 |
| 9 | **Plattform-Vollständigkeits-Check** | Pro Kanal prüfen: erfüllt alle Shopify- / Amazon-Anforderungen? | Mittel | Q4 |
| 10 | **Marktplatz-Validator** | Prüfung gegen Amazon/eBay-Anforderungen, weniger Listing-Ablehnungen | Groß | Q1 |

---

## 11. UX & Produktivität (12)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Globale Cmd+K Suche** | Spotlight-artige Suche über alles | Mittel | Q1 |
| 2 | **Zuletzt bearbeitet** | Letzte 10 Produkte in der Sidebar | Klein | Q1 |
| 3 | **Custom Tags** | Eigene Tags pro Produkt + Filter | Klein | Q1 |
| 4 | **Tastenkürzel-Übersicht** | Overlay mit allen Shortcuts | Klein | Q1 |
| 5 | **Bookmark/Favoriten** | Produkte als Favorit markieren, Schnellzugriff | Klein | Q2 |
| 6 | **Kontext-Aktionen (Rechtsklick)** | Rechtsklick → Klonen, Archivieren, Exportieren | Klein | Q2 |
| 7 | **Drag & Drop Sortierung** | Produkte manuell sortieren/priorisieren | Klein | Q2 |
| 8 | **Statusleiste (Footer)** | „42 aktiv · 3 Fehler · Export: vor 2h" — immer sichtbar | Klein | Q2 |
| 9 | **Persönlicher Workspace** | Gespeicherte Ansichten: Filter + Spalten + Sortierung, mehrere schaltbar | Mittel | Q4 |
| 10 | **Kontextuelle Hilfe-Tooltips** | ⓘ-Icon pro Feld: „Wird als Shopify Metafield exportiert. Erlaubte Werte: ..." | Klein | Q4 |
| 11 | **Quick-Actions von Dashboard** | Widgets als Aktionen: „3 ohne EAN" → Klick → gefilterte Liste → Inline bearbeiten | Klein–Mittel | Q4 |
| 12 | **Fokus-Modus** | Alles ausblenden außer aktuellem Produkt, Keyboard-Navigation | Klein | Q4 |

---

## 12. Workflow & Prozesse (7)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Produkt-Arbeitskorb** | Produkte aus beliebigen Seiten pinnen → Bulk-Aktionen/Export/Vergleich | Klein | Q3 |
| 2 | **Kanban-Board** | Produkte als Karten in Spalten: Entwurf → Komplett → Exportiert | Mittel | Q1 |
| 3 | **Tagesziel-Tracker** | Dashboard-Widget: „Heute: 20 Produkte vervollständigen", Fortschrittsbalken | Klein | Q3 |
| 4 | **Fehlende-Daten-Wizard** | Effizienteste Reihenfolge vorschlagen: „Material bei 47 Produkten → +12% Vollständigkeit" | Mittel | Q3 |
| 5 | **Produkt-Timeline** | Visuelle Zeitleiste: Import → Stammdaten → Attribute → Bilder → Export | Klein–Mittel | Q3 |
| 6 | **Onboarding-Pipeline** | Step-by-Step: Stammdaten → Bilder → Attribute → SEO → Freigabe, Progress pro Produkt | Mittel | Q3 |
| 7 | **Produkt-Tagging-Engine** | Regelbasiertes Auto-Tagging: Material=Silikon + Kategorie=Toys → Tags: `body-safe`, `premium` | Klein–Mittel | Q4 |

---

## 13. Analyse & Reporting (6)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 3 | **Produkt-Vergleich** | Zwei Produkte nebeneinander, Unterschiede markiert | Mittel | Q1 |
| 4 | **Preisverlauf pro Produkt** | EK/VK-Änderungen über Zeit als Sparkline | Mittel | Q2 |
| 5 | **Sortiment-Matrix** | Kategorien × Hersteller → Produktanzahl pro Zelle, Lücken erkennen | Klein | Q2 |
| 6 | **Vollständigkeits-Trend** | Chart: Datenvollständigkeit über Zeit, Fortschritt sichtbar | Mittel | Q2 |
| 7 | **Feature Matrix** | Produkte als Zeilen, Attribute als Spalten. Exportierbar als HTML-Snippet | Mittel | Q3 |
| 8 | **Hersteller-Dashboard** | Pro Hersteller: Produktanzahl, ∅-Preis, Vollständigkeit, häufigste Lücken | Klein | Q4 |

---

## 14. Beziehungen & Sets (2)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 2 | **Cross-Sell-Verknüpfung** | „passt zu" / „Alternative" / „Zubehör für", exportierbar als Metafield | Mittel | Q3 |
| 3 | **Ähnlichkeitsindex** | Automatisch ähnliche Produkte finden (87% Attribut-Match) | Mittel | Q3 |

---

## 15. Compliance & Recht (1)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 2 | **Versandklassen-Zuordnung** | Auto-Zuordnung: >5 kg → Sperrgut, >200€ → versichert. Shopify-exportierbar | Klein | Q4 |

---

## 16. System & Betrieb (5)

| # | Idee | Beschreibung | Aufwand | Quelle |
|---|------|-------------|--------|--------|
| 1 | **Data Lineage** | Pro Feld: WOHER kam der Wert? (Import, Bulk, Template, Smart Default) — Badge am Feld | Mittel | Q3 |
| 2 | **Produkt-Zeitreise** | Vollständiger Snapshot + Diff + Rollback per Klick (Git für Produkte) | Mittel | Q3 |
| 3 | **Multi-Source Conflicts** | Gleiche Produkte aus verschiedenen Quellen: Konflikte visualisieren, Quelle wählen | Groß | Q3 |
| 6 | **Konfigurations-Export/Import** | Alle Settings, Attribut-Definitionen, Templates als JSON — Backup/Transfer | Klein | Q4 |
| 7 | **Changelog pro Release** | „Seit letztem Start: 12 Produkte geändert, 3 Exporte, 2 Importe" | Klein | Q4 |

---

## Zusammenfassung

| Bereich | Anzahl | Davon Klein | Davon Mittel | Davon Groß |
|---------|--------|-------------|-------------|------------|
| 1. Import & Datenquellen | 11 | 3 | 7 | 1 |
| 2. Stammdaten & Produktpflege | 12 | 5 | 6 | 1 |
| 3. Preise & Kalkulation | 6 | 4 | 2 | – |
| 4. Attribute & Datenqualität | 12 | 8 | 4 | – |
| 5. Content & SEO | 4 | 2 | 2 | – |
| 6. KI & Automatisierung | 4 | 2 | 2 | – |
| 7. Varianten | 38 | 13 | 21 | 4 |
| 8. Bilder & Medien | 4 | 2 | 2 | – |
| 9. Export & Integration | 6 | 1 | 4 | 1 |
| 10. Shopify & Multi-Channel | 10 | 3 | 5 | 2 |
| 11. UX & Produktivität | 12 | 8 | 4 | – |
| 12. Workflow & Prozesse | 7 | 3 | 4 | – |
| 13. Analyse & Reporting | 6 | 1 | 5 | – |
| 14. Beziehungen & Sets | 2 | – | 2 | – |
| 15. Compliance & Recht | 1 | 1 | – | – |
| 16. System & Betrieb | 5 | 2 | 2 | 1 |
| **Gesamt** | **141** | **57** | **74** | **10** |

> [!tip] Quick Wins (Klein + hoher Impact)
> - Import: **Clipboard-Import**, **Feld-Aliase**
> - Preise: **Margen-Alarm**, **Preis-Rundungsregeln**
> - Content: **Text-Snippets**
> - Attribute: **Attribut-Konsistenz-Check**, **Pflichtfeld-Matrix**
> - Varianten: **Varianten-Schnellwechsel**, **Matrix-Zellenfarben**, **Varianten-Template**
> - UX: **Statusleiste**, **Kontext-Aktionen**, **Bookmark/Favoriten**
> - System: **Konfigurations-Export/Import**

> [!abstract] Quelldateien
> - [[2025-07-13_feature-ideen]] — 28 Ideen (MVP-Phase)
> - [[2026-04-15_feature-ideen]] — 25 Ideen (KI, Import, UX)
> - [[2026-04-17_feature-ideen]] — 30 Ideen (Workflow, Medien, Export)
> - [[2026-04-17_feature-ideen-2]] — 35 Ideen (Shopify, Preise, Multi-Channel)
> - [[2026-04-17_varianten-ideen]] — 40 Ideen (Variantenlogik)
