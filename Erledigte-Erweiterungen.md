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
