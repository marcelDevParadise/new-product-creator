# Attribut Generator — Projektübersicht

> Full-Stack-Webanwendung zur Verwaltung von E-Commerce-Produktdaten, Shopify-Attributen und Varianten. Ermöglicht CSV-Import, Stammdaten-Verwaltung, Attribut-Zuweisung mit Smart Defaults, Vorlagen, Variantenlogik, SEO-Content-Pflege, Datenqualitätsprüfung und Export in drei Formaten (JTL-Ameise, Stammdaten, SEO).

---

## Inhaltsverzeichnis

1. [Tech-Stack](#1-tech-stack)
2. [Projektstruktur](#2-projektstruktur)
3. [Backend-Architektur](#3-backend-architektur)
   - [Einstiegspunkt](#31-einstiegspunkt-startpy)
   - [FastAPI-Anwendung](#32-fastapi-anwendung)
   - [Datenmodelle](#33-datenmodelle)
   - [State Management](#34-state-management)
   - [API-Router](#35-api-router)
   - [Service-Schicht](#36-service-schicht)
   - [Datenbank-Schema](#37-datenbank-schema)
4. [Frontend-Architektur](#4-frontend-architektur)
   - [Routing](#41-routing)
   - [API-Client](#42-api-client)
   - [Seiten](#43-seiten)
   - [Komponenten](#44-komponenten)
5. [Workflows](#5-workflows)
6. [API-Endpunkt-Übersicht](#6-api-endpunkt-übersicht)
7. [Konfiguration & Attribute](#7-konfiguration--attribute)
8. [Entwicklung & Start](#8-entwicklung--start)

---

## 1. Tech-Stack

| Bereich          | Technologie                                                           |
| ---------------- | --------------------------------------------------------------------- |
| Backend          | Python 3.11+, FastAPI, Uvicorn, Pydantic 2                           |
| Frontend         | React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4, shadcn/ui         |
| Rich-Text-Editor | TipTap 3 (ProseMirror-basiert)                                       |
| Datenbank        | SQLite (WAL-Modus) mit In-Memory-Cache                                |
| Drag & Drop      | @dnd-kit (core + sortable)                                            |
| Icons            | lucide-react                                                          |
| Schriftart       | Geist Variable Font                                                   |
| Start            | Dual-Server via `start.py` (Backend :8000, Frontend :5173)            |

---

## 2. Projektstruktur

```
Produkte - Attribut Generator/
├── start.py                              # Startet Backend + Frontend + Browser
│
├── backend/
│   ├── main.py                           # FastAPI App, 9 Router, Lifespan, CORS
│   ├── state.py                          # AppState Singleton (In-Memory + SQLite)
│   ├── requirements.txt                  # Python-Abhängigkeiten
│   ├── models/
│   │   ├── attribute.py                  # AttributeDefinition, SmartDefault
│   │   ├── product.py                    # Product Model (51 Felder)
│   │   └── stats.py                      # DashboardStats, ActivityLog, ProductHistory
│   ├── routers/
│   │   ├── products.py                   # Produkt-CRUD, CSV-Import, Archiv, Klonen
│   │   ├── attributes.py                 # Attribut-Konfiguration, Zuweisung, Smart Defaults
│   │   ├── export.py                     # 3 Export-Formate: Ameise, Stammdaten, SEO
│   │   ├── templates.py                  # Vorlagen-CRUD & Bulk-Anwendung
│   │   ├── settings.py                   # Preis, Export, Einheiten, Varianten-Einstellungen
│   │   ├── stats.py                      # Dashboard-KPIs, Aktivitätslog, Globale Suche
│   │   ├── validation.py                 # Datenqualitätsprüfung (20+ Regeln)
│   │   ├── variants.py                   # Parent/Child-Variantengruppen, Vererbung
│   │   └── categories.py                 # Kategorienbaum-CRUD
│   ├── services/
│   │   ├── csv_handler.py                # CSV-Parsing & 3 Export-Generatoren
│   │   ├── database.py                   # SQLite-Zugriff (5 Tabellen, Migration)
│   │   ├── validation.py                 # Validierungs-Engine mit 20+ Prüfungen
│   │   └── data/products.db              # SQLite-Datenbank
│   └── data/
│       ├── attribute_config.json         # Seed-Datei mit ~40 Shopify-Attributen
│       ├── category_tree.json            # Verschachtelter Kategorienbaum
│       └── settings.json                 # Preis-, Export-, Einheiten-, Varianten-Einstellungen
│
└── frontend/
    ├── package.json                      # 25+ Abhängigkeiten (React 19, TipTap, dnd-kit, ...)
    ├── vite.config.ts                    # Vite + API-Proxy → localhost:8000
    └── src/
        ├── App.tsx                       # 13 Routen + Layout (Sidebar, Toast, Search)
        ├── api/client.ts                 # ~60 API-Methoden mit Retry-Logik
        ├── types/index.ts                # Alle TypeScript-Interfaces
        ├── lib/
        │   ├── utils.ts                  # cn()-Helper (clsx + tailwind-merge)
        │   ├── attribute-utils.ts        # getFieldType() für Metafield-Inputs
        │   └── use-theme.ts              # Dark-Mode-Hook (light/dark/system)
        ├── pages/
        │   ├── DashboardPage.tsx         # KPI-Karten, Aktivitäten, Auto-Refresh
        │   ├── ImportPage.tsx            # CSV-Upload mit Drag & Drop
        │   ├── ProductsPage.tsx          # Attributzuweisung, gespeicherte Filter
        │   ├── ProductDetailPage.tsx     # Attribut-Editor, Smart Defaults, History
        │   ├── StammdatenPage.tsx        # Stammdaten-Tabelle, Varianten, Bulk
        │   ├── StammdatenEditPage.tsx    # 30+-Felder-Formular, Vererbung, Ctrl+S
        │   ├── ContentEditPage.tsx       # WYSIWYG-Editor für SEO-Inhalte
        │   ├── AttributesPage.tsx        # Attribut-Definitionen CRUD
        │   ├── CategoriesPage.tsx        # Kategorienbaum-Editor
        │   ├── ExportPage.tsx            # 3 Exports mit Vorschau & Validierung
        │   ├── SettingsPage.tsx          # 5 Einstellungsbereiche
        │   ├── ActivityLogPage.tsx       # Vollständiges Aktivitätsprotokoll
        │   └── DataQualityPage.tsx       # Datenqualitäts-Dashboard
        └── components/
            ├── layout/                   # Sidebar (einklappbar, Dark Mode), PageHeader
            ├── products/                 # AttributeEditor, BulkAttributeModal, BulkStammdatenModal, ProductList, TemplateModal, VariantGroupModal, VariantMatrix
            ├── csv/                      # CsvUpload, CsvPreview
            └── ui/                       # shadcn/ui + Toast, ConfirmDialog, LoadingSpinner, SearchDialog, HtmlEditor, CategoryCascader
```

---

## 3. Backend-Architektur

### 3.1 Einstiegspunkt (`start.py`)

- Startet FastAPI-Backend (Uvicorn) mit Hot-Reload auf `routers/`, `services/`, `models/`
- Startet Vite-Frontend-Dev-Server
- Öffnet automatisch den Browser auf `http://localhost:5173`

### 3.2 FastAPI-Anwendung

- **Lifespan**: `reload_from_db()` bei jedem Start (auch Hot-Reload)
- **CORS-Middleware**: Erlaubt `localhost:5173`
- **9 Router**: Products, Attributes, Export, Templates, Settings, Stats, Validation, Variants, Categories
- **Health-Check**: `GET /api/health → { "status": "ok" }`
- **Manueller Reload**: `POST /api/reload` — lädt alle Daten aus SQLite neu

### 3.3 Datenmodelle

#### Product (`models/product.py`) — 51 Felder

| Gruppe            | Felder                                                             |
| ----------------- | ------------------------------------------------------------------ |
| Identifikation    | `artikelnummer` (PK, Format: CYL-XXXXX), `artikelname`            |
| Basis-Stammdaten  | `ek`, `preis` (VK), `gewicht`, `hersteller`, `ean`                |
| Maße              | `laenge`, `breite`, `hoehe`                                       |
| Grundpreis        | `verkaufseinheit`, `inhalt_menge`, `inhalt_einheit`, `grundpreis_ausweisen`, `bezugsmenge`, `bezugsmenge_einheit` |
| Lieferant         | `lieferant_name`, `lieferant_artikelnummer`, `lieferant_artikelname`, `lieferant_netto_ek` |
| Bilder            | `bild_1` bis `bild_9` (URLs)                                      |
| Kategorien        | `kategorie_1` bis `kategorie_6`                                   |
| SEO & Content     | `kurzbeschreibung`, `beschreibung`, `url_pfad`, `title_tag`, `meta_description` |
| Varianten         | `parent_sku`, `is_parent`, `variant_attributes` (dict)            |
| Attribute & Status| `attributes` (dict), `exported` (Archiv-Flag), `stammdaten_complete` |

#### AttributeDefinition (`models/attribute.py`)

| Feld                | Beschreibung                                      |
| ------------------- | ------------------------------------------------- |
| `id`                | Shopify-Metafield-ID (z.B. `meta_brand:custom:single_line_text_field`) |
| `category`          | Gruppe (z.B. "Produkt", "Masse & Gewicht")        |
| `name`              | Anzeigename (deutsch)                              |
| `description`       | Hilfetext                                          |
| `required`          | Pflichtfeld für Export                             |
| `required_for_types`| Bedingte Pflicht nach Produkttyp                   |
| `default_value`     | Standardwert                                       |
| `suggested_values`  | Dropdown-Optionen                                  |
| `smart_defaults`    | Auto-Fill-Regeln (`title_contains` → `value`)      |

#### Stats-Modelle (`models/stats.py`)

| Modell               | Felder                                                       |
| -------------------- | ------------------------------------------------------------ |
| `ActivityLog`        | `event_type`, `detail`, `count`, `created_at`                |
| `ProductHistoryEntry`| `artikelnummer`, `event_type`, `field`, `old_value`, `new_value`, `detail`, `created_at` |
| `IncompleteProduct`  | `artikelnummer`, `artikelname`, `stammdaten_complete`, `attribute_count`, `missing` |
| `DashboardStats`     | 25 Felder: Produkt-Counts, Stammdaten-%, Attribut-%, Export-%, Bilder, EAN, SEO, Durchschnitt, Listen |

### 3.4 State Management (`state.py`)

**AppState** — Singleton mit In-Memory-Cache:

- **Initialisierung**: Lädt alle Produkte, Attribute, Vorlagen und Kategorienbaum aus DB/JSON
- **Erststart**: Migriert Attribute von `attribute_config.json` → SQLite
- **Sync**: Bei jedem Start werden Sortierung, Kategorien, Namen, IDs, `suggested_values` und `description` aus JSON synchronisiert; benutzerdefinierte DB-Werte bleiben erhalten
- **Produkt-CRUD**: `add_product()`, `get_product()`, `get_active_products()`, `get_archived_products()`, `delete_product()`, `archive/unarchive_product()`
- **Attribut-CRUD**: `add/update/remove_attribute_definition()`
- **Varianten**: `get_variants()`, `get_variant_group()`, `resolve_product()` (Vererbung)
- **Vorlagen**: CRUD + Seed-Vorlage „GPSR"
- **Kategorienbaum**: Laden/Speichern/Navigieren der verschachtelten JSON-Struktur

### 3.5 API-Router

#### Products (`routers/products.py`) — 14 Endpunkte

- **CSV-Import**: Semikolon-getrennt, UTF-8-SIG, automatisches Merging bei doppelten SKUs
- **CRUD**: Erstellen, Lesen, Aktualisieren, Löschen (einzeln & bulk)
- **Archivierung**: Exportierte Produkte archivieren; Wiederherstellung möglich
- **Nächste SKU**: Gibt nächste freie CYL-XXXXX-Nummer zurück
- **Import-Template**: Leere CSV-Vorlage zum Download
- **Klonen**: Produkt duplizieren mit neuer SKU
- **Änderungshistorie**: Produktbezogenes Änderungslog mit Feld-Diff
- **Bulk-Stammdaten**: Mehrere Produkte gleichzeitig aktualisieren

#### Attributes (`routers/attributes.py`) — 10 Endpunkte

- **Konfiguration**: Vollständige Attribut-Konfiguration abrufen
- **Definitionen**: Erstellen, Bearbeiten, Löschen, Umsortieren
- **Produkt-Attribute**: Einzeln oder in Bulk zuweisen/entfernen
- **Smart Defaults**: Automatische Attribut-Zuweisung basierend auf Titelabgleich + Fallback auf `default_value`

#### Export (`routers/export.py`) — 8 Endpunkte, 3 Export-Formate

| Format     | Spalten                                                | Archiviert? |
| ---------- | ------------------------------------------------------ | ----------- |
| **Ameise** | Artikelnummer, Artikelname, Attributgruppe, Funktionsattribut ID, Attributname, Attributwert | Ja          |
| **Stammdaten** | 34 Spalten (alle Stammdaten, Bilder, Kategorien)  | Nein        |
| **SEO**    | Artikelnummer, Artikelname, Kurzbeschreibung, Beschreibung, URL-Pfad, Title-Tag, Meta-Description | Nein |

- Jeder Export hat Vorschau-Endpoint + Download-Endpoint
- Ameise-Export mit Validierung (fehlende Pflichtattribute prüfen)
- Manuelles Archivieren aller aktiven Produkte über eigenen Endpoint

#### Templates (`routers/templates.py`) — 5 Endpunkte

- Vorlagen erstellen, bearbeiten, löschen, auflisten
- Vorlage auf mehrere Produkte anwenden (leere Werte werden gefiltert)

#### Settings (`routers/settings.py`) — 11 Endpunkte, 5 Bereiche

| Bereich        | Felder                                                              |
| -------------- | ------------------------------------------------------------------- |
| **Pricing**    | `mwst_prozent` (19%), `faktor` (2.37), `rundung` (0.95)            |
| **Export**      | `attributgruppe`, `csv_trennzeichen`, `dezimalformat`, `dateiname_muster` |
| **Einheiten**  | Konfigurierbare Liste (ml, l, g, kg, cm, m, mm, Stück, m², m³, …)  |
| **Standardwerte** | `hersteller`, `lieferant_name`                                   |
| **Varianten**  | `inherit_fields[]` (20 Felder), `variant_axes[]` (Größe, Farbe, Material, Ausführung) |

- VK-Berechnung: `EK × (1 + MwSt%/100) × Faktor` → gerundet auf `x,{rundung}€`
- Alle Einstellungen in `backend/data/settings.json` gespeichert

#### Stats (`routers/stats.py`) — 3 Endpunkte

- **Dashboard-KPIs**: 25 Metriken (Produkte, Stammdaten-%, Attribut-%, Export-%, Bilder, EAN, SEO, Durchschnitt)
- **Globale Suche**: Über Produkte (SKU, Name, EAN, Hersteller), Attribute, Vorlagen
- **Aktivitätslog**: Konfigurierbares Limit (25/50/100/200)

#### Validation (`routers/validation.py`) — 2 Endpunkte

- **Alle validieren**: Datenqualitätsprüfung aller aktiven Produkte
- **Einzeln validieren**: Ein Produkt prüfen
- **20+ Regeln**: Artikelname (≥3 Zeichen), EAN (8–14 Ziffern + Duplikate), Preise (>0, VK≥EK), Gewicht, Maße, Bilder (Anzahl + URL-Format), Kategorien, Grundpreis-Konsistenz, Lieferant, Stammdaten-Vollständigkeit, Pflichtattribute
- **Ampelsystem**: OK / Warnung / Fehler mit `suggested_fix`

#### Variants (`routers/variants.py`) — 10 Endpunkte

- **Gruppen-CRUD**: Erstellen, Auflisten, Detail, Auflösen
- **Children**: Hinzufügen, Entfernen, Aktualisieren, Neu erstellen (Auto-SKU)
- **Vererbung**: `resolve_product()` → geerbte Felder vom Parent werden aufgelöst
- **Diff**: Abweichungen zwischen Parent und Children erkennen
- **Auto-Suggest**: Vorschläge basierend auf SKU-Mustern

#### Categories (`routers/categories.py`) — 6 Endpunkte

- **Baum**: Gesamten Kategorienbaum lesen/ersetzen
- **Navigation**: Kinder eines Knotens abfragen (dot-separated Pfad)
- **CRUD**: Knoten erstellen, umbenennen, löschen

### 3.6 Service-Schicht

#### CSV-Handler (`services/csv_handler.py`)

| Funktion              | Beschreibung                                                |
| --------------------- | ----------------------------------------------------------- |
| `parse_csv()`         | Parst Semikolon-CSV (UTF-8-SIG), erkennt `,` und `.` als Dezimaltrennzeichen |
| `build_ameise_csv()`  | Erzeugt JTL-Ameise-CSV (1 Zeile/Attribut/Produkt)          |
| `build_stammdaten_csv()` | Flache CSV mit 34 Spalten; konfigurierbarer Dezimaltrenner |
| `build_seo_csv()`     | SEO-CSV mit 7 Spalten (SKU, Name, Content-Felder)          |

Zusätzlich: `ParseResult`-Modell mit `products`, `warnings` (Zeile/Feld/Meldung) und `skipped_rows`.

#### Database (`services/database.py`) — 46 Funktionen

- SQLite mit WAL-Modus und Foreign-Key-Unterstützung
- Automatische Schema-Migration (`_migrate_product_columns()` → `ALTER TABLE` für neue Spalten)
- JSON-Serialisierung für komplexe Felder (`attributes`, `suggested_values`, `smart_defaults`, `variant_attributes`)
- **Produkt-History**: `log_product_history()` (Einzeln), `log_product_history_batch()` (Bulk) mit Feld-Diff (old/new)

#### Validation (`services/validation.py`)

- **20+ Prüfregeln** (siehe Router-Beschreibung)
- `validate_product()` → `list[ValidationIssue]` pro Produkt
- `validate_all_products()` → Vollständiger Report mit Severity-Counts
- `compute_quality_stats()` → Aggregierte Statistiken + Top-Issues nach Feld

### 3.7 Datenbank-Schema

```sql
products (
  artikelnummer TEXT PRIMARY KEY,
  artikelname TEXT,
  ek REAL, preis REAL, gewicht REAL,
  hersteller TEXT, ean TEXT,
  attributes TEXT,                   -- JSON
  exported INTEGER,                  -- Boolean
  stammdaten_complete INTEGER,
  laenge REAL, breite REAL, hoehe REAL,
  verkaufseinheit REAL, inhalt_menge REAL, inhalt_einheit TEXT,
  grundpreis_ausweisen INTEGER, bezugsmenge REAL, bezugsmenge_einheit TEXT,
  lieferant_name TEXT, lieferant_artikelnummer TEXT,
  lieferant_artikelname TEXT, lieferant_netto_ek REAL,
  bild_1..bild_9 TEXT,               -- 9 Bild-URLs
  kategorie_1..kategorie_6 TEXT,     -- 6 Kategorie-Ebenen
  kurzbeschreibung TEXT,             -- SEO
  beschreibung TEXT,                 -- SEO (HTML)
  url_pfad TEXT,                     -- SEO
  title_tag TEXT,                    -- SEO
  meta_description TEXT,             -- SEO
  parent_sku TEXT,                   -- Variante: Eltern-SKU
  is_parent INTEGER,                 -- Variante: ist selbst Elternteil
  variant_attributes TEXT            -- JSON (Varianten-Achsen)
)

attribute_definitions (
  key TEXT PRIMARY KEY,
  id TEXT, category TEXT, name TEXT,
  description TEXT,
  required INTEGER,
  required_for_types TEXT,           -- JSON
  default_value TEXT,
  suggested_values TEXT,             -- JSON
  smart_defaults TEXT,               -- JSON
  sort_order INTEGER
)

templates (
  name TEXT PRIMARY KEY,
  attributes TEXT                    -- JSON
)

activity_log (
  id INTEGER PRIMARY KEY,
  event_type TEXT,
  detail TEXT,
  count INTEGER,
  created_at TEXT
)

product_history (
  id INTEGER PRIMARY KEY,
  artikelnummer TEXT,                 -- Index
  event_type TEXT,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  detail TEXT,
  created_at TEXT                    -- Index (DESC)
)
```

---

## 4. Frontend-Architektur

### 4.1 Routing

| Pfad                    | Seite               | Beschreibung                             |
| ----------------------- | ------------------- | ---------------------------------------- |
| `/`                     | DashboardPage       | KPI-Karten, unvollständige Produkte, Aktivitäten |
| `/import`               | ImportPage           | CSV-Upload & Vorschau                    |
| `/products`             | ProductsPage         | Attributzuweisung, gespeicherte Filter, Bulk-Aktionen |
| `/products/:sku`        | ProductDetailPage    | Attribut-Editor (Drag & Drop), History-Tab |
| `/stammdaten`           | StammdatenPage       | Stammdaten-Tabelle mit Variantengruppen, Bulk |
| `/stammdaten/:sku`      | StammdatenEditPage   | 30+-Felder-Formular mit Vererbung & Kategorien |
| `/content/:sku`         | ContentEditPage      | WYSIWYG-Editor (TipTap) für SEO-Content  |
| `/attributes`           | AttributesPage       | Attribut-Definitionen CRUD mit Kategorie-Navigation |
| `/categories`           | CategoriesPage       | Kategorienbaum-Editor (Verschachtelung)  |
| `/export`               | ExportPage           | 3 Exports (Ameise, Stammdaten, SEO) mit Vorschau |
| `/settings`             | SettingsPage         | 5 Einstellungsbereiche (Preis, Export, Einheiten, Standards, Varianten) |
| `/activity`             | ActivityLogPage      | Vollständiges Aktivitätsprotokoll        |
| `/quality`              | DataQualityPage      | Datenqualitäts-Dashboard mit 4 KPIs     |

### 4.2 API-Client (`api/client.ts`)

Zentraler API-Client mit ~60 Methoden und automatischer Retry-Logik (2 Versuche mit exponentiellem Backoff):

- **Products** (14): `getProducts()`, `getProduct()`, `getNextSku()`, `createProduct()`, `importCsv()`, `deleteProducts()`, `archiveProducts()`, `unarchiveProduct()`, `updateStammdaten()`, `bulkUpdateStammdaten()`, `getProductHistory()`, `cloneProduct()`
- **Attributes** (10): `getAttributeConfig()`, `getCategories()`, `createAttributeDefinition()`, `updateAttributeDefinition()`, `deleteAttributeDefinition()`, `reorderAttributeDefinitions()`, `updateAttributes()`, `deleteAttribute()`, `bulkUpdateAttributes()`, `applySmartDefaults()`
- **Export** (8): `getExportPreview()`, `validateExport()`, `downloadExport()`, `getStammdatenPreview()`, `downloadStammdatenExport()`, `getSeoPreview()`, `downloadSeoExport()`, `archiveExported()`
- **Templates** (5): `getTemplates()`, `createTemplate()`, `updateTemplate()`, `deleteTemplate()`, `applyTemplate()`
- **Settings** (12): Pricing, Export, Einheiten, Standardwerte, Varianten — jeweils Get + Update + `calculateVk()` + `getAllSettings()`
- **Stats** (3): `getStats()`, `getActivities()`, `globalSearch()`
- **Validation** (2): `getValidation()`, `getProductValidation()`
- **Categories** (6): `getCategoryTree()`, `getCategoryChildren()`, `saveCategoryTree()`, `addCategoryNode()`, `renameCategoryNode()`, `deleteCategoryNode()`
- **Variants** (11): `getVariantGroups()`, `getVariantGroup()`, `createVariantGroup()`, `deleteVariantGroup()`, `addVariantChild()`, `removeVariantChild()`, `updateVariantChild()`, `suggestVariantGroups()`, `getResolvedProduct()`, `getVariantDiff()`, `createVariantChild()`

### 4.3 Seiten

| Seite                | Features                                                                |
| -------------------- | ----------------------------------------------------------------------- |
| **DashboardPage**    | 6 KPI-Karten (Produkte, Stammdaten, Attribute, Export, Bilder/EAN, SEO/Durchschnitt), paginierte unvollständige Produkte, Aktivitäts-Feed mit Icons, Auto-Refresh (30s), Tab-Visibility-Refresh |
| **ImportPage**       | Drag & Drop CSV-Upload, Template-Download, Import-Ergebnis mit Warnungen, Produkt-Vorschau |
| **ProductsPage**     | Suche, 3 Filter (Stammdaten/Attribute/Archiv), **gespeicherte Filter** (localStorage), Multi-Select, Bulk-Aktionen: BulkAttributeModal + TemplateModal, sortierbare Liste |
| **ProductDetailPage**| Attribut-Editor (Drag & Drop), Smart Defaults, **Tabs: Attribute + History**, Produkt-Metadaten-Header, Archivierung, Status-Badges |
| **StammdatenPage**   | Sortierbare Tabelle, Suche, **Variantengruppen** (aufklappbare Hierarchie), Inline-Editing, Bulk-Aktionen (BulkStammdatenModal, VariantGroupModal), Klonen, Archiv-Tab |
| **StammdatenEditPage**| 7 Formular-Abschnitte (Basis, Maße, Grundpreis, Lieferant, Bilder, Kategorien, SEO), **Varianten-Vererbung** (geerbte Felder mit Badges), **VariantMatrix** (bei Parents), EK→VK-Berechnung, Ctrl+S, Dirty-State-Warnung, Einheiten-Dropdown |
| **ContentEditPage**  | WYSIWYG-Editor (TipTap) für Kurzbeschreibung & Beschreibung, Quelltext-Toggle, Ctrl+S, Dirty-State |
| **AttributesPage**   | Kategorie-Navigation (Sidebar), Suche über alle Kategorien, Pflichtfeld-Filter, CRUD mit Inline-Edit, Sortieren per Buttons, Formular: Key, ID, Name, Kategorie, Beschreibung, Pflicht, Vorschlagswerte, Smart Defaults |
| **CategoriesPage**   | Rekursiver Baumview mit Lazy-Expansion, Knoten erstellen/umbenennen/löschen, Tiefeneinrückung |
| **ExportPage**       | 3 Export-Bereiche (Ameise, Stammdaten, SEO), je mit Vorschau + Download, Ameise mit Validierung, Auto-Archiv-Workflow, Export-Counter |
| **SettingsPage**     | 5 Sektionen (Pricing, Export, Einheiten, Standardwerte, Varianten), je mit eigenem Save-Button, Live EK→VK-Rechner, konfigurierbare Listen (Einheiten, Varianten-Achsen, Vererbungsfelder) |
| **ActivityLogPage**  | Aktivitätstabelle mit Event-Icons + -Farben, konfigurierbares Limit (25/50/100/200), manueller Refresh |
| **DataQualityPage**  | 4 KPI-Metriken (OK/Warnung/Fehler), Top-Issues nach Feld, aufklappbare Produkt-Zeilen → Issues-Liste, Severity-Filter, Suche |

### 4.4 Komponenten

#### Layout
- **Sidebar**: Einklappbar (240px → 64px), 3 Navigations-Abschnitte (Übersicht, Daten, Konfiguration), **Dark-Mode-Toggle**, Such-Button (Ctrl+K), aktiver Link-Highlight
- **PageHeader**: Titel, Beschreibung, optionale Aktions-Buttons, Breadcrumbs

#### Products
- **AttributeEditor**: Drag & Drop (dnd-kit) — verfügbare Attribute links, zugewiesene rechts; dynamische Eingabetypen: Text, Zahl, Boolean (Switch), Textarea, Tags (mit Vorschlag-Picker); Kategorie-Filter; Suche
- **BulkAttributeModal**: Attribute auf mehrere Produkte gleichzeitig anwenden, kategorisierte Attributliste, dynamische Inputs
- **BulkStammdatenModal**: 18 Stammdaten-Felder in Bulk ändern, Feldauswahl per Checkbox, Kategorie-Cascader für Kategoriefelder
- **TemplateModal**: Vorlagen CRUD + Anwendung auf ausgewählte/alle Produkte, Attribut-Editor innerhalb des Modals
- **VariantGroupModal**: Variantengruppen erstellen — manuell (Parent wählen, Children zuordnen) oder per Auto-Suggest
- **VariantMatrix**: Inline-Variantentabelle mit Varianten-Achsen, Diff-Highlighting, Vererbungsanzeige, Erstellen/Löschen von Children
- **ProductList**: Wiederverwendbare sortierbare Tabelle mit Multi-Select und Fortschrittsbalken

#### CSV
- **CsvUpload**: Datei-Input & Drag-Drop-Zone, Upload-Spinner, Ergebnis-Zusammenfassung, einklappbare Warnungen
- **CsvPreview**: Importierte Produkte als Tabelle

#### UI
- **SearchDialog**: Globale Suche (Ctrl+K), 200ms Debounce, 3 Ergebniskategorien (Produkte, Attribute, Vorlagen), Tastaturnavigation (↑↓ Enter Escape)
- **HtmlEditor**: TipTap-basierter WYSIWYG-Editor mit Toolbar (H1-H3, Bold, Italic, Underline, Listen, Alignment, Links, Code, Undo/Redo)
- **CategoryCascader**: 6-stufiger Kategorie-Selector mit dynamischen Dropdowns, Freitext-Eingabe bei unbekannten Werten
- **Toast**: Benachrichtigungssystem (success/error/info), Auto-Dismiss nach 4s, Stacking
- **ConfirmDialog**: Bestätigungsdialog mit `default`/`danger`-Variante
- **LoadingSpinner**: Animierter Ladeanzeiger
- **shadcn/ui**: Button, Badge, Card, Dialog, Input, Label, Select, Switch, Table, Tabs, Textarea, ScrollArea, Separator

---

## 5. Workflows

### Workflow 1: Produkt-Import & Stammdaten

```
CSV-Upload (ImportPage)
  → Backend parst Semikolon-CSV (UTF-8-SIG)
  → Bestehende SKUs: Merge (Name + Stammdaten aktualisiert)
  → Neue SKUs: Produkt angelegt
  → Aktivität + History protokolliert
  → Stammdaten bearbeiten (StammdatenEditPage)
  → EK eingeben → VK automatisch berechnet
  → Speichern → stammdaten_complete = true
```

### Workflow 2: Attribut-Zuweisung

```
Option A — Einzeln (Drag & Drop):
  ProductDetailPage → AttributeEditor
  → Attribute von links nach rechts ziehen
  → Werte eingeben (Text/Zahl/Boolean/Tags) → Speichern

Option B — Bulk:
  ProductsPage → Produkte auswählen
  → BulkAttributeModal → Attribute zuweisen → Speichern

Option C — Smart Defaults:
  ProductDetailPage → "Smart Defaults" klicken
  → Backend gleicht Produkttitel mit title_contains-Regeln ab
  → Treffer: Wert automatisch eingetragen
  → Fallback: default_value verwendet

Option D — Vorlage:
  ProductsPage → Produkte auswählen → TemplateModal
  → Vorlage auswählen → Auf Auswahl oder alle anwenden
```

### Workflow 3: Varianten

```
StammdatenPage → Produkte auswählen → VariantGroupModal
  → Parent-Produkt bestimmen (manuell oder Auto-Suggest)
  → Children zuordnen, Varianten-Attribute vergeben
  → Speichern → Parent/Child-Beziehung erstellt

StammdatenEditPage (Parent) → VariantMatrix
  → Alle Children als Tabelle sehen
  → Varianten-Achsen (Größe, Farbe, ...) inline bearbeiten
  → Diff-Highlighting: Abweichungen vom Parent erkennen
  → Neue Variante erstellen → Auto-SKU + geerbte Felder

StammdatenEditPage (Child) → Vererbung
  → Geerbte Felder mit „Geerbt"-Badge markiert
  → „Eigener Wert" überschreibt Vererbung
```

### Workflow 4: SEO & Content

```
ContentEditPage → Kurzbeschreibung & Beschreibung
  → WYSIWYG-Editor (TipTap) oder Quelltext-Ansicht
  → HTML-Formatierung (H1-H3, Listen, Links, ...)
  → Ctrl+S → Speichern

StammdatenEditPage → SEO-Sektion
  → URL-Pfad, Title-Tag (≤60 Zeichen), Meta-Description (≤155 Zeichen)
  → Zeichenzähler mit visueller Warnung
```

### Workflow 5: Export

```
ExportPage → Exporttyp wählen:

Ameise-Export (Attribute):
  → Validierung (fehlende Pflichtattribute prüfen)
  → Vorschau anzeigen (1 Zeile/Attribut/Produkt)
  → CSV herunterladen
  → Produkte automatisch archiviert

Stammdaten-Export:
  → Vorschau (34 Spalten, 1 Zeile/Produkt)
  → CSV herunterladen
  → Produkte NICHT archiviert

SEO-Export:
  → Vorschau (7 Spalten)
  → CSV herunterladen
  → Produkte NICHT archiviert

Nach 3 Exports → Optional: Alle Produkte archivieren
```

### Workflow 6: Datenqualität

```
DataQualityPage → Validierung aller aktiven Produkte
  → 20+ Regeln geprüft (Name, EAN, Preise, Bilder, ...)
  → Ampelsystem: OK / Warnung / Fehler
  → Top-Issues nach Feld aggregiert
  → Produkt aufklappen → Issues-Details mit suggested_fix
```

---

## 6. API-Endpunkt-Übersicht

### Products (14 Endpunkte)

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/products`                              | Aktive/archivierte Produkte           |
| GET     | `/api/products/next-sku`                     | Nächste freie CYL-XXXXX-SKU          |
| GET     | `/api/products/{sku}`                        | Einzelnes Produkt                     |
| GET     | `/api/products/import/template`              | CSV-Import-Vorlage herunterladen      |
| GET     | `/api/products/{sku}/history`                | Änderungshistorie eines Produkts      |
| POST    | `/api/products`                              | Produkt manuell erstellen             |
| POST    | `/api/products/import`                       | CSV-Import                            |
| POST    | `/api/products/delete`                       | Bestimmte Produkte löschen            |
| POST    | `/api/products/archive`                      | Produkte archivieren                  |
| POST    | `/api/products/{sku}/unarchive`              | Produkt wiederherstellen              |
| POST    | `/api/products/{sku}/clone`                  | Produkt klonen (neue SKU)             |
| POST    | `/api/products/bulk/stammdaten`              | Bulk-Stammdaten-Update                |
| PATCH   | `/api/products/{sku}/stammdaten`             | Stammdaten aktualisieren              |
| DELETE  | `/api/products`                              | Alle Produkte löschen                 |

### Attributes (10 Endpunkte)

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/attributes/config`                     | Attribut-Konfiguration                |
| GET     | `/api/attributes/categories`                 | Kategorieliste                        |
| POST    | `/api/attributes/definitions`                | Attribut erstellen                    |
| PUT     | `/api/attributes/definitions/{key}`          | Attribut bearbeiten                   |
| PUT     | `/api/attributes/definitions/reorder`        | Attribute umsortieren                 |
| PUT     | `/api/attributes/products/{sku}`             | Produkt-Attribute aktualisieren       |
| POST    | `/api/attributes/products/bulk`              | Bulk-Attribut-Aktualisierung          |
| POST    | `/api/attributes/products/{sku}/smart-defaults` | Smart Defaults anwenden            |
| DELETE  | `/api/attributes/definitions/{key}`          | Attribut löschen                      |
| DELETE  | `/api/attributes/products/{sku}/{key}`       | Attribut von Produkt entfernen        |

### Export (8 Endpunkte)

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/export/validate`                       | Export-Validierung                    |
| GET     | `/api/export/preview`                        | Ameise-Export-Vorschau                |
| GET     | `/api/export/stammdaten/preview`             | Stammdaten-Export-Vorschau            |
| GET     | `/api/export/seo/preview`                    | SEO-Export-Vorschau                   |
| POST    | `/api/export/ameise`                         | Ameise-CSV herunterladen              |
| POST    | `/api/export/stammdaten`                     | Stammdaten-CSV herunterladen          |
| POST    | `/api/export/seo`                            | SEO-CSV herunterladen                 |
| POST    | `/api/export/archive-exported`               | Alle aktiven Produkte archivieren     |

### Templates (5 Endpunkte)

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/templates`                             | Vorlagen auflisten                    |
| POST    | `/api/templates`                             | Vorlage erstellen/aktualisieren       |
| PUT     | `/api/templates/{name}`                      | Vorlage bearbeiten                    |
| DELETE  | `/api/templates/{name}`                      | Vorlage löschen                       |
| POST    | `/api/templates/{name}/apply`                | Vorlage auf Produkte anwenden         |

### Settings (11 Endpunkte)

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/settings`                              | Alle Einstellungen kombiniert         |
| GET     | `/api/settings/pricing`                      | Pricing-Einstellungen                 |
| PUT     | `/api/settings/pricing`                      | Pricing aktualisieren                 |
| POST    | `/api/settings/pricing/calculate`            | VK aus EK berechnen                   |
| GET     | `/api/settings/export`                       | Export-Einstellungen                  |
| PUT     | `/api/settings/export`                       | Export-Einstellungen aktualisieren    |
| GET     | `/api/settings/einheiten`                    | Einheiten-Liste                       |
| PUT     | `/api/settings/einheiten`                    | Einheiten aktualisieren               |
| GET     | `/api/settings/defaults`                     | Standardwerte (Hersteller, Lieferant) |
| PUT     | `/api/settings/defaults`                     | Standardwerte aktualisieren           |
| GET     | `/api/settings/varianten`                    | Varianten-Einstellungen               |
| PUT     | `/api/settings/varianten`                    | Varianten-Einstellungen aktualisieren |

### Stats (3 Endpunkte)

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/stats`                                 | Dashboard-KPIs (25 Metriken)          |
| GET     | `/api/stats/activities`                      | Aktivitätsprotokoll                   |
| GET     | `/api/stats/search`                          | Globale Suche                         |

### Validation (2 Endpunkte)

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/validation`                            | Alle Produkte validieren              |
| GET     | `/api/validation/{sku}`                      | Einzelnes Produkt validieren          |

### Variants (10 Endpunkte)

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/variants/groups`                       | Alle Variantengruppen                 |
| GET     | `/api/variants/groups/{parent_sku}`          | Einzelne Variantengruppe              |
| GET     | `/api/variants/resolved/{sku}`               | Aufgelöstes Produkt (mit Vererbung)   |
| GET     | `/api/variants/groups/{parent_sku}/diff`     | Diff Parent vs. Children              |
| POST    | `/api/variants/groups`                       | Variantengruppe erstellen             |
| POST    | `/api/variants/groups/{parent_sku}/children` | Kind hinzufügen                       |
| POST    | `/api/variants/groups/{parent_sku}/children/create` | Kind neu erstellen (Auto-SKU)  |
| PATCH   | `/api/variants/groups/{parent_sku}/children/{child_sku}` | Kind-Attribute aktualisieren |
| DELETE  | `/api/variants/groups/{parent_sku}`          | Gruppe auflösen                       |
| DELETE  | `/api/variants/groups/{parent_sku}/children/{child_sku}` | Kind entfernen           |

### Categories (6 Endpunkte)

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/categories/tree`                       | Gesamten Kategorienbaum abrufen       |
| GET     | `/api/categories/children`                   | Kinder eines Knotens                  |
| PUT     | `/api/categories/tree`                       | Gesamten Baum ersetzen                |
| POST    | `/api/categories/node`                       | Knoten erstellen                      |
| PUT     | `/api/categories/node`                       | Knoten umbenennen                     |
| DELETE  | `/api/categories/node`                       | Knoten löschen                        |

### System (2 Endpunkte)

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/health`                                | Health-Check                          |
| POST    | `/api/reload`                                | Daten aus DB neu laden                |

---

## 7. Konfiguration & Attribute

### Attribut-Kategorien (aus `attribute_config.json`)

- **Produkt**: Marke, Produktlinie, Typ, Farbe, Material, Stärke, geeignete/ungeeignete Materialien, Info-Elemente
- **Produkttyp & Bauart**: Dildo-/Vibrator-/Masturbator-Typ, Öffnungsart, Flexibilität, Basis, Textur, Harness-kompatibel, Anal-sicher, Temperaturspiel, Erfahrungslevel, Handhabung, Diskretes Aussehen
- **Masse & Gewicht**: Gesamtlänge, Einführlänge, Innen-/Außendurchmesser, Artikelgewicht, Versandgewicht, Verpackungsmaße
- Weitere Kategorien nach Bedarf erweiterbar

### Kategorienbaum (`category_tree.json`)

- Verschachtelte Baumstruktur für Produktkategorien
- Bearbeitbar über CategoriesPage (Knoten erstellen, umbenennen, löschen)
- Integration in StammdatenEditPage über 6-stufigen CategoryCascader

### Preisberechnung

```
VK = EK × (1 + MwSt%/100) × Faktor → gerundet auf x,{Rundung}€
```

Standard: MwSt 19%, Faktor 2.37, Rundung 0.95 → Beispiel: EK 10€ → VK 28.95€

### Varianten-Konfiguration

- **Vererbbare Felder** (20): Hersteller, Beschreibung, Kurzbeschreibung, Bilder 1–9, Kategorien 1–6, URL-Pfad, Title-Tag, Meta-Description, Lieferant-Daten
- **Varianten-Achsen** (Standard): Größe, Farbe, Material, Ausführung
- Beides konfigurierbar über SettingsPage

### Einstellungen (`settings.json`)

```json
{
  "mwst_prozent": 19.0,
  "faktor": 2.37,
  "rundung": 0.95,
  "export": {
    "attributgruppe": "Shopify-Attribute",
    "csv_trennzeichen": ";",
    "dezimalformat": ",",
    "dateiname_muster": "{typ}_export_{datum}"
  },
  "einheiten": ["ml", "l", "g", "kg", "cm", "m", "mm", "Stück", "m²", "m³"],
  "standard_werte": {
    "hersteller": "",
    "lieferant_name": ""
  },
  "varianten": {
    "inherit_fields": ["hersteller", "beschreibung", "..."],
    "variant_axes": ["Größe", "Farbe", "Material", "Ausführung"]
  }
}
```

---

## 8. Entwicklung & Start

### Voraussetzungen

- Python 3.11+
- Node.js 18+

### Installation

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Starten

```bash
python start.py
```

Startet automatisch:
- **Backend** auf `http://localhost:8000` (mit Hot-Reload)
- **Frontend** auf `http://localhost:5173` (Vite Dev-Server, Proxy → :8000)
- Öffnet Browser automatisch

### Abhängigkeiten

**Backend** (`requirements.txt`):
- fastapi ≥ 0.128
- uvicorn[standard] ≥ 0.34
- python-multipart ≥ 0.0.20
- pydantic ≥ 2.10

**Frontend** (`package.json`) — 25+ Abhängigkeiten:

| Bereich          | Pakete                                                        |
| ---------------- | ------------------------------------------------------------- |
| Core             | React 19, React Router 7, TypeScript 5.9                      |
| Build            | Vite 8, @vitejs/plugin-react                                  |
| Styling          | Tailwind CSS 4, @tailwindcss/vite, clsx, tailwind-merge, CVA  |
| UI               | shadcn/ui, lucide-react, tw-animate-css, Geist Font           |
| Drag & Drop      | @dnd-kit/core 6, @dnd-kit/sortable 10, @dnd-kit/utilities     |
| Rich-Text        | @tiptap/react 3, starter-kit, link, text-align, underline, placeholder |
| Linting          | ESLint 9, typescript-eslint, react-hooks, react-refresh        |

---

## 9. Feature-Zusammenfassung

### Kern-Features
- **CSV-Import** mit Merge-Logik, Fehlerreport und Import-Vorlage
- **Stammdaten** mit 51 Feldern, Inline-Editing, EK→VK-Berechnung
- **Attribut-Verwaltung** mit ~40 Shopify-Metafield-Definitionen
- **Drag-&-Drop-Editor** für Attribut-Zuweisung
- **Smart Defaults** für automatische Attribut-Befüllung
- **Vorlagen-System** für wiederverwendbare Attribut-Sets

### Erweiterte Features
- **Variantenlogik** — Parent/Child-Gruppen mit Feldvererbung, VariantMatrix, Diff-Erkennung, Auto-Suggest
- **3 Export-Formate** — JTL-Ameise (Attribute), Stammdaten (34 Spalten), SEO (7 Spalten)
- **Datenqualitätsprüfung** — 20+ Validierungsregeln, Ampelsystem, suggested_fix
- **SEO & Content** — TipTap WYSIWYG-Editor, Title-Tag/Meta-Description mit Zeichenzähler
- **Kategorienbaum** — Verschachtelte Hierarchie, 6-stufiger Cascader
- **Gespeicherte Filter** — Wiederverwendbare Arbeitsansichten (localStorage)
- **Globale Suche** — Ctrl+K über Produkte, Attribute, Vorlagen
- **Dark Mode** — Light/Dark/System mit View Transition API
- **Änderungshistorie** — Produktbezogenes Audit-Log mit Feld-Diff
- **Bulk-Aktionen** — Attribute, Stammdaten, Archivierung, Löschen
- **Produkt-Klonen** — Duplizieren mit neuer Auto-SKU
- **Dashboard** — 25 KPIs, Aktivitäts-Feed, Auto-Refresh
