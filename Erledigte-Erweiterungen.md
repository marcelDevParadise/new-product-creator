# Erledigte Erweiterungen

Dieses Dokument enthält alle abgeschlossenen Erweiterungen des Attribut Generators mit Beschreibung der umgesetzten Features.

---

## 1.1 ✅ Erweiterte Validierung / Datenqualitätsprüfung

### Ziel
Nicht nur fehlende Pflichtattribute erkennen, sondern echte Datenfehler und Inkonsistenzen frühzeitig sichtbar machen.

### Umgesetzte Features
- Dedizierter Validation-Service im Backend (`services/validation.py`)
- Eigene Seite „Datenqualität" (`/quality` → DataQualityPage)
- Validation-Router (`/api/validation`)
- Prüfungen: doppelte EANs, fehlende Pflichtattribute, leere/ungültige Bild-URLs, fehlende Herstellerangaben, zu kurze Artikelnamen
- Ampelsystem: OK / Warnung / Fehler
- Filter „nur fehlerhafte Produkte"
- Ergebnisstruktur mit `severity`, `field`, `message`

---

## 1.3 ✅ Bulk-Stammdatenbearbeitung

### Ziel
Nicht nur Attribute, sondern auch Stammdaten gesammelt ändern können.

### Umgesetzte Features
- BulkStammdatenModal-Komponente mit Feldwahl
- Unterstützte Felder: Hersteller, Lieferant, Preise, EAN, Gewicht, Maße, Kategorien, SEO-Felder u.v.m.
- Bulk-Aktionen: Wert setzen, Wert löschen
- Sicherheitsvorschau: „X Produkte werden geändert"
- Änderungsprotokoll im Aktivitätslog

---

## 1.4 ✅ Variantenlogik

### Ziel
Parent-/Child-Produkte oder Varianten sauber abbilden.

### Umgesetzte Features (Phase 1 + Phase 2)
- **Datenmodell**: `parent_sku`, `is_variant_parent`, `variant_attributes` als Produktfelder
- **Backend**: Varianten-Router (`/api/variants`) mit 11 Endpoints
  - Gruppen-CRUD (erstellen, auflisten, Detail, löschen)
  - Children hinzufügen/entfernen/aktualisieren
  - Auto-Suggest für Variantengruppen
  - Resolved Product (Vererbung auflösen)
  - Diff-Prüfung (Parent vs. Children Abweichungen)
  - Varianten-Kind aus Editor erstellen
- **Variantenmatrix**: Inline-Tabelle mit allen Children, Varianten-Achsen, Diff-Highlighting (amber), vererbte Werte (italic), Delete-Button, „Neu"-Zeile zum Erstellen
- **Visuelle Vererbung**: „Geerbt"-Badge (lila) an Feldern, „Eigener Wert"-Button zum Aufheben
- **Abweichungs-Prüfung**: Amber-Highlighting für Felder die vom Parent abweichen
- **Varianten-Einstellungen**: Konfigurierbare `inherit_fields[]` und `default_variant_attr_name`
- **Export-Integration**: Varianten in Ameise-CSV und Stammdaten-CSV berücksichtigt

---

## 1.5 ✅ Gespeicherte Filter und Arbeitsansichten

### Ziel
Wiederkehrende Arbeitszustände schneller erreichbar machen.

### Umgesetzte Features
- Gespeicherte Filter auf ProductsPage und StammdatenPage
- Vordefinierte Filter: Unvollständig, ohne Bilder, ohne EAN, Exportbereit, Archiviert, mit Warnungen
- Filter-Speicherung und Wiederverwendung
- Schnellzugriff über Sidebar-Badges

---

## 2.2 ✅ Produktbezogene Änderungshistorie

### Ziel
Nachvollziehen können, wer wann was geändert hat.

### Umgesetzte Features
- Activity-Log-System mit `log_activity(event_type, detail, count)`
- Eigene Seite „Aktivitäten" (`/activity` → ActivityLogPage)
- Stats-Router (`/api/stats`) für Dashboard-KPIs und Aktivitätslog-Abfragen
- Historien-Einträge: Feld-Änderungen, Attribut-Zuweisungen, Bulk-Aktionen, Exporte, Archivierung
- SQLite-Tabelle `activity_log` mit Timestamp und Details

---

## 2.5 ✅ Import-Center mit Fehlerreport

### Ziel
CSV-Import robuster und transparenter machen.

### Umgesetzte Features
- Import-Seite (`/import` → ImportPage) mit CSV-Upload
- CsvUpload-Komponente mit Drag & Drop
- CsvPreview mit Vorschau der zu importierenden Daten
- Fehlerreport bei Import-Problemen (ungültige Zeilen, fehlende Pflichtfelder)
- Semikolon-CSV, UTF-8-sig Support
- CSV-Handler-Service im Backend (`services/csv_handler.py`)

---

## 4.6 ✅ SEO & Content Export

### Ziel
SEO-relevante Produktdaten pflegen und als eigenen CSV-Export bereitstellen.

### Umgesetzte Features
- 5 Stammdaten-Felder: `kurzbeschreibung`, `beschreibung`, `url_pfad`, `title_tag`, `meta_description`
- Rich-Text-Editor (TipTap/HtmlEditor) für Kurzbeschreibung & Beschreibung
- Eigene Content-Edit-Seite (`/content/:sku` → ContentEditPage)
- SEO & Content Sektion im Stammdaten-Editor mit Zeichenzähler (Title ≤60, Meta ≤155)
- Neuer Export-Typ: SEO & Content CSV (Vorschau + Download)
- Bulk-Stammdaten-Bearbeitung unterstützt SEO-Felder

---

## 5.1 ✅ Medien-Management mit Vorschaubildern

### Ziel
Bildpflege komfortabler machen.

### Umgesetzte Features
- Thumbnail-Vorschau im Stammdaten-Editor
- Bild-URLs pflegen (bis zu 10 Bilder pro Produkt)
- Markierung des Hauptbilds
- Bilder-Sektion im StammdatenEditPage

---

## 5.4 ✅ Verbesserte Dashboard-Ansichten

### Ziel
Dashboard mit relevanten KPIs ausstatten.

### Umgesetzte Features
- DashboardPage (`/`) mit KPI-Cards
- Unvollständige Produkte Übersicht
- Aktivitäts-Feed (letzte Änderungen)
- Produkte mit Fehlern / Warnungen
- Stats-API für aggregierte Daten

---

## 5.6 ✅ Globale Suche

### Ziel
Über alle Bereiche hinweg suchen.

### Umgesetzte Features
- SearchDialog-Komponente (Ctrl+K Trigger)
- Suche über Produkte und Attribute
- Ergebnisse gruppiert nach Typ
- Schnellnavigation zum Treffer
- Integration in Sidebar

---

## 5.7 ✅ Dark Mode

### Ziel
Optionales dunkles Farbschema.

### Umgesetzte Features
- `useTheme()` Hook mit drei Modi: light / dark / system
- View Transition API für smooth Animation beim Umschalten
- Toggle in der Sidebar
- Präferenz in localStorage gespeichert
- System-Präferenz (prefers-color-scheme) respektiert
- Custom CSS Variant: `@custom-variant dark (&:is(.dark *))`
- Globale Dark-Mode-Overrides in index.css
- Alle Komponenten mit `dark:` Tailwind-Varianten

---

## Zusätzliche Features (ohne Projekterweiterungen-Eintrag)

### Kategorien-Management
- Eigene Seite (`/categories` → CategoriesPage)
- Backend-Router (`/api/categories`) mit CRUD
- Kategorienbaum als verschachtelte JSON-Struktur
- CategoryCascader-UI-Komponente
- Kategorie-Zuweisung pro Produkt

### Rich-Text-Editor
- TipTap-basierter HtmlEditor mit Toolbar
- Headings, Listen, Links, Code Blocks, Blockquotes
- Eigene Content-Edit-Seite pro Produkt

### DB-Reload bei Server-Neustart
- `reload_from_db()` in AppState
- Lifespan-Event in FastAPI für automatischen Reload
- Manueller Reload-Endpoint (`POST /api/reload`)

---

## X ? Vorlagen-Verwaltung & Kategorisierung

### Ziel
Vorlagen �bersichtlich organisieren, suchbar machen und mit Metadaten anreichern � inkl. dedizierter Verwaltungsseite.

### Umgesetzte Features
- **Neue Felder pro Vorlage**: `category` und `description` (SQLite-Migration via ALTER TABLE)
- **Alphabetische Sortierung** der Vorlagen in Modal und Verwaltungsseite
- **Gruppierung nach Kategorie** (einklappbare Sektionen, `Ohne Kategorie` am Ende)
- **Vorlagen-Suche** (Name, Kategorie, Notiz)
- **Umbenennen** (`POST /api/templates/{name}/rename`)
- **Duplizieren** (`POST /api/templates/{name}/clone`)
- **Meta-Editor** pro Vorlage (Kategorie + Notiz/Beschreibung)
- **Datalist-Autovorschl�ge** f�r bestehende Kategorien
- **Dedizierte Verwaltungsseite** `/templates` mit Karten-Layout, Sidebar-Link Vorlagen`n- **�berarbeitetes TemplateModal** mit Meta-Leiste, Rename/Clone-Inline-Editoren und Kategorie-Gruppierung
- **Globale Suche** findet Vorlagen jetzt auch über Kategorie & Beschreibung
- **Seed-Vorlage `GPSR`** erhält Kategorie `Compliance`

---

## ✅ Auto-URL-Slug (5.5)

### Ziel
URL-Slug automatisch aus Produktname generieren.

### Umgesetzte Features
- Backend: `_slugify()` Funktion in `routers/products.py` (Umlaute ä→ae etc., Sonderzeichen → `-`)
- Auto-Fill bei Neuanlage und CSV-Import wenn `url_pfad` leer
- Frontend: `slugify()` in `lib/utils.ts`
- „Auto"-Button neben dem `url_pfad`-Feld in StammdatenEditPage

---

## ✅ Content-Fortschritts-Score (5.7)

### Ziel
Pro Produkt sichtbar machen wie vollständig der SEO-Content ist.

### Umgesetzte Features
- Backend: `_compute_content_score()` prüft 5 Felder (kurzbeschreibung, beschreibung, url_pfad, title_tag, meta_description)
- Dashboard-KPIs: `content_score_avg`, `content_complete`, `content_partial`, `content_empty`
- Neuer Endpoint `GET /api/stats/content-scores`
- Content-Score-Card im Dashboard mit Fortschrittsbalken
- Inline-Score-Anzeige in ContentEditPage mit farbigen Badges für fehlende Felder

---

## ✅ Varianten-Badge in Produktlisten (7.12)

### Ziel
In Produktlisten sofort erkennen ob ein Produkt Parent oder Variante ist.

### Umgesetzte Features
- Purple „Parent"-Badge für `is_parent`-Produkte in ProductList
- Violet „Variante"-Badge für Produkte mit `parent_sku`

---

## ✅ System-Health-Dashboard (16.4 + 16.5)

### Ziel
Systemzustand auf einen Blick: DB-Größe, Integrität, Laufzeit.

### Umgesetzte Features
- Backend: `GET /api/stats/health` (DB-Größe, Produktanzahl, Logs, Templates, Uptime, Python-Version, Integrity-Check)
- Backend: `POST /api/stats/vacuum` für SQLite VACUUM
- Frontend: System-Sektion in SettingsPage mit 8 Stat-Kacheln
- Integritäts-Indikator (grün/rot)
- VACUUM-Button mit Lade-Animation

---

## ✅ Export-Historie (9.2)

### Ziel
Log aller Exporte mit Timestamp und Details.

### Umgesetzte Features
- Neue DB-Tabelle `export_history`
- `log_export()` nach jedem Export (Ameise, Stammdaten, SEO)
- `GET /api/export/history` Endpoint
- Historie-Tabelle in ExportPage mit Typ-Badges, Dateiname, Produkt-/Zeilenanzahl, Datum

---

## ✅ Preis-Dashboard (13.1)

### Ziel
Preisverteilung und Margen als KPIs im Dashboard.

### Umgesetzte Features
- Backend: `GET /api/stats/prices` mit Ø EK, Ø VK, Ø Marge, fehlende Preise, kritische Margen
- Frontend: 4 Preis-KPI-Cards im Dashboard (Ø EK, Ø VK, Ø Marge, fehlende Preise)

---

## ✅ Vollständigkeits-Heatmap (13.2)

### Ziel
Matrix-Ansicht: Produkte × Felder, farbcodiert nach Befüllung.

### Umgesetzte Features
- Backend: `GET /api/validation/heatmap` mit 14 Feldern, Feld-Statistiken + Per-Product-Grid (max 100)
- Frontend: Toggle-Button in DataQualityPage
- Feld-Completeness-Balken
- Per-Product-Grid mit grünen (befüllt) und roten (leer) Zellen

---

## ✅ Variantengruppen-Seite (7.9)

### Ziel
Dedizierte Übersicht aller Parent/Child-Beziehungen.

### Umgesetzte Features
- Neue Seite `VariantGroupsPage` unter `/variants`
- Stats-Cards (Gruppen, Parents, Varianten)
- Aufklappbare Gruppen-Liste mit Varianten-Tabelle
- Auflösen-Funktion mit Bestätigungsdialog
- Sidebar-Link mit GitBranch-Icon

---

## ✅ Keyword-Planer (5.3)

### Ziel
SEO-Keywords pro Produkt manuell pflegen.

### Umgesetzte Features
- Backend: `seo_keywords` Feld im Product-Model (komma-separierter String)
- DB-Migration, Load/Save, StammdatenUpdate
- Frontend: Tag-Input-Widget in ContentEditPage
- Keywords als entfernbare Chips, Eingabefeld + Enter/Button zum Hinzufügen

---

## ✅ Bundles / Sets (14.1)

### Ziel
Produkte zu Sets zusammenfassen mit kombiniertem Preis.

### Umgesetzte Features
- Backend: Router `routers/bundles.py` mit CRUD (5 Endpoints)
- DB-Tabelle `bundles` (Name, Beschreibung, Items als JSON)
- Produktvalidierung beim Erstellen/Aktualisieren
- Preis-Aggregation (Gesamt-EK, Gesamt-VK)
- Frontend: `BundlesPage` unter `/bundles` mit Produkt-Suche, Mengenangabe, Erstellen/Bearbeiten/Löschen
- Sidebar-Link mit Package-Icon

---

## ✅ Warnhinweis-Manager (15.1)

### Ziel
Pflicht-Warnhinweise nach Produkttyp verwalten und Produkten zuweisen.

### Umgesetzte Features
- Backend: Router `routers/warnings.py` mit CRUD + Produkt-Zuweisung (7 Endpoints)
- DB-Tabellen: `warnings` + `product_warnings` (Zuordnung)
- JSON-Seed `data/warnings_seed.json` mit 15 Standard-Warnhinweisen (Gefahrstoffe, Sicherheit, Gesundheit, Regulatorisch)
- Frontend: `WarningsPage` unter `/warnings` mit Kategorie-Filter, CRUD-Formular, Nutzungszähler
- Sidebar-Link mit AlertTriangle-Icon

---

## ✅ Inhaltsstoff-Deklaration (15.3)

### Ziel
Strukturierte INCI-Listen und Materialzusammensetzung pro Produkt.

### Umgesetzte Features
- Backend: Router `routers/ingredients.py` mit CRUD + Produkt-Zuweisung + Reihenfolge (8 Endpoints)
- DB-Tabellen: `ingredients` (Name, INCI-Name, CAS-Nr., Kategorie) + `product_ingredients` (Zuordnung mit Prozentangabe + Position)
- Frontend: `IngredientsPage` unter `/ingredients` mit Kategorie-Filter, CRUD-Formular, Nutzungszähler
- Sidebar-Link mit FlaskConical-Icon
