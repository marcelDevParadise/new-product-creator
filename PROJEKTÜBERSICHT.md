# Attribut Generator — Projektübersicht

> Full-Stack-Webanwendung zur Verwaltung von Produktdaten und Shopify-Attributen für E-Commerce. Ermöglicht CSV-Import, Stammdaten-Verwaltung, Attribut-Zuweisung und Export im JTL-Ameise-Format für die Shopify-Integration.

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

| Bereich    | Technologie                                           |
| ---------- | ----------------------------------------------------- |
| Backend    | Python 3.11+, FastAPI, Uvicorn                        |
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui   |
| Datenbank  | SQLite (WAL-Modus)                                    |
| Drag & Drop| @dnd-kit                                              |
| Icons      | lucide-react                                          |
| Start      | Dual-Server via `start.py` (Backend :8000, Frontend :5173) |

---

## 2. Projektstruktur

```
Produkte - Attribut Generator/
├── start.py                              # Startet Backend + Frontend
│
├── backend/
│   ├── main.py                           # FastAPI App + Router-Registrierung
│   ├── state.py                          # AppState Singleton (In-Memory Cache)
│   ├── requirements.txt                  # Python-Abhängigkeiten
│   ├── models/
│   │   ├── attribute.py                  # AttributeDefinition, SmartDefault
│   │   ├── product.py                    # Product Model (30+ Felder)
│   │   └── stats.py                      # DashboardStats, ActivityLog
│   ├── routers/
│   │   ├── products.py                   # Produkt-CRUD, CSV-Import, Archiv
│   │   ├── attributes.py                 # Attribut-Konfiguration & Zuweisung
│   │   ├── export.py                     # Ameise- & Stammdaten-CSV-Export
│   │   ├── templates.py                  # Vorlagen-CRUD & Anwendung
│   │   ├── settings.py                   # Preisberechnung (EK → VK)
│   │   └── stats.py                      # Dashboard-Statistiken & Aktivitätslog
│   ├── services/
│   │   ├── csv_handler.py                # CSV-Parsing & -Erzeugung
│   │   ├── database.py                   # SQLite-Zugriff (Produkte, Attribute, Vorlagen, Log)
│   │   └── data/products.db              # SQLite-Datenbank
│   └── data/
│       ├── attribute_config.json         # Seed-Datei mit ~40 Shopify-Attributen
│       └── settings.json                 # Pricing-Einstellungen
│
└── frontend/
    ├── package.json
    ├── vite.config.ts                    # Vite + API-Proxy → localhost:8000
    └── src/
        ├── App.tsx                       # Routing-Definition
        ├── api/client.ts                 # API-Methoden
        ├── types/index.ts                # TypeScript-Interfaces
        ├── lib/attribute-utils.ts        # Hilfsfunktionen
        ├── pages/
        │   ├── DashboardPage.tsx         # KPI-Karten, Aktivitäten
        │   ├── ImportPage.tsx            # CSV-Upload
        │   ├── ProductsPage.tsx          # Produktliste mit Bulk-Aktionen
        │   ├── ProductDetailPage.tsx     # Attribut-Editor (Drag & Drop)
        │   ├── StammdatenPage.tsx        # Stammdaten-Tabelle
        │   ├── StammdatenEditPage.tsx    # Stammdaten-Formular (30+ Felder)
        │   ├── AttributesPage.tsx        # Attribut-Definitionen verwalten
        │   ├── ExportPage.tsx            # Ameise- & Stammdaten-Export
        │   ├── SettingsPage.tsx          # Preisberechnung konfigurieren
        │   └── ActivityLogPage.tsx       # Aktivitätsprotokoll
        └── components/
            ├── layout/                   # Sidebar, PageHeader
            ├── products/                 # ProductList, AttributeEditor, BulkModal, TemplateModal
            ├── csv/                      # CsvUpload, CsvPreview
            └── ui/                       # shadcn/ui (Button, Card, Dialog, Table, …)
```

---

## 3. Backend-Architektur

### 3.1 Einstiegspunkt (`start.py`)

- Startet FastAPI-Backend (Uvicorn) mit Hot-Reload auf `routers/`, `services/`, `models/`
- Startet Vite-Frontend-Dev-Server
- Öffnet automatisch den Browser auf `http://localhost:5173`

### 3.2 FastAPI-Anwendung

- CORS-Middleware für `localhost:5173`
- 6 Router: Products, Attributes, Export, Templates, Settings, Stats
- Health-Check: `GET /api/health → { "status": "ok" }`

### 3.3 Datenmodelle

#### Product (`models/product.py`)

| Gruppe            | Felder                                                             |
| ----------------- | ------------------------------------------------------------------ |
| Identifikation    | `artikelnummer` (PK, Format: CYL-XXXXX), `artikelname`            |
| Basis-Stammdaten  | `ek`, `preis` (VK), `gewicht`, `hersteller`, `ean`                |
| Maße              | `laenge`, `breite`, `hoehe`                                       |
| Grundpreis        | `verkaufseinheit`, `inhalt_menge`, `inhalt_einheit`, `grundpreis_ausweisen`, `bezugsmenge`, `bezugsmenge_einheit` |
| Lieferant         | `lieferant_name`, `lieferant_artikelnummer`, `lieferant_artikelname`, `lieferant_netto_ek` |
| Bilder            | `bild_1` bis `bild_9` (URLs)                                      |
| Kategorien        | `kategorie_1` bis `kategorie_6`                                   |
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

#### SmartDefault

```
title_contains: str  →  Suchbegriff im Produkttitel (case-insensitive)
value: str           →  Automatisch einzutragender Wert
```

### 3.4 State Management (`state.py`)

**AppState** — Singleton mit In-Memory-Cache:

- Beim Start: Lädt alle Produkte aus der DB, synchronisiert Attribut-Definitionen aus `attribute_config.json`
- Erststart: Migriert Attribute von JSON nach SQLite
- Danach: Synchronisiert Sortierung, Kategorien und Namen aus JSON; benutzerdefinierte DB-Werte bleiben erhalten
- Verwaltet Produkt-CRUD, Attribut-Definitionen, Vorlagen und eine Seed-Vorlage "GPSR"

### 3.5 API-Router

#### Products (`routers/products.py`)

- **CSV-Import**: Semikolon-getrennt, UTF-8-SIG, automatisches Merging bei doppelten SKUs
- **CRUD**: Erstellen, Lesen, Aktualisieren, Löschen (einzeln & bulk)
- **Archivierung**: Exportierte Produkte werden archiviert; Wiederherstellung möglich
- **Nächste SKU**: Gibt nächste freie CYL-XXXXX-Nummer zurück

#### Attributes (`routers/attributes.py`)

- **Konfiguration**: Vollständige Attribut-Konfiguration abrufen
- **Definitionen**: Erstellen, Bearbeiten, Löschen, Umsortieren
- **Produkt-Attribute**: Einzeln oder in Bulk zuweisen/entfernen
- **Smart Defaults**: Automatische Attribut-Zuweisung basierend auf Titelabgleich

#### Export (`routers/export.py`)

- **Ameise-Export**: CSV mit einer Zeile pro Attribut pro Produkt; archiviert exportierte Produkte
- **Stammdaten-Export**: Flache CSV mit allen Stammdaten-Feldern; **keine** Archivierung
- **Validierung**: Prüft fehlende Pflichtattribute vor Export
- **Vorschau**: JSON-Preview für beide Exportarten

#### Templates (`routers/templates.py`)

- Vorlagen erstellen, bearbeiten, löschen
- Vorlage auf mehrere Produkte anwenden (Bulk)

#### Settings (`routers/settings.py`)

- **Preisberechnung**: `VK = EK × (1 + MwSt%) × Faktor` → gerundet auf x.{Endung}€
- Einstellungen in `backend/data/settings.json` gespeichert

#### Stats (`routers/stats.py`)

- Dashboard-KPIs: Produktanzahl, Stammdaten-%, Attribut-Abdeckung-%, Export-Bereit-%
- Bis zu 10 unvollständige Produkte
- Letzte 5 Aktivitäten
- Vollständiges Aktivitätsprotokoll mit konfigurierbarem Limit

### 3.6 Service-Schicht

#### CSV-Handler (`services/csv_handler.py`)

| Funktion              | Beschreibung                                                |
| --------------------- | ----------------------------------------------------------- |
| `parse_csv()`         | Parst Semikolon-CSV (UTF-8-SIG), erkennt `,` und `.` als Dezimaltrennzeichen |
| `build_ameise_csv()`  | Erzeugt JTL-Ameise-CSV (1 Zeile/Attribut/Produkt)          |
| `build_stammdaten_csv()` | Flache CSV mit allen Stammdaten; EAN in Anführungszeichen |

#### Database (`services/database.py`)

- SQLite mit WAL-Modus und Foreign-Key-Unterstützung
- Automatische Schema-Migration (`ALTER TABLE` für neue Spalten)
- JSON-Serialisierung für komplexe Felder (`attributes`, `suggested_values`, `smart_defaults`)

### 3.7 Datenbank-Schema

```sql
products (
  artikelnummer TEXT PRIMARY KEY,
  artikelname TEXT,
  ek REAL, preis REAL, gewicht REAL,
  hersteller TEXT, ean TEXT,
  attributes TEXT,           -- JSON
  exported INTEGER,          -- Boolean
  stammdaten_complete INTEGER,
  laenge REAL, breite REAL, hoehe REAL,
  verkaufseinheit REAL, inhalt_menge REAL, inhalt_einheit TEXT,
  grundpreis_ausweisen INTEGER, bezugsmenge REAL, bezugsmenge_einheit TEXT,
  lieferant_name TEXT, lieferant_artikelnummer TEXT,
  lieferant_artikelname TEXT, lieferant_netto_ek REAL,
  bild_1..bild_9 TEXT,
  kategorie_1..kategorie_6 TEXT
)

attribute_definitions (
  key TEXT PRIMARY KEY,
  id TEXT, category TEXT, name TEXT,
  description TEXT,
  required INTEGER,
  required_for_types TEXT,   -- JSON
  default_value TEXT,
  suggested_values TEXT,     -- JSON
  smart_defaults TEXT,       -- JSON
  sort_order INTEGER
)

templates (
  name TEXT PRIMARY KEY,
  attributes TEXT             -- JSON
)

activity_log (
  id INTEGER PRIMARY KEY,
  event_type TEXT,
  detail TEXT,
  count INTEGER,
  created_at TEXT
)
```

---

## 4. Frontend-Architektur

### 4.1 Routing

| Pfad                    | Seite               | Beschreibung                             |
| ----------------------- | ------------------- | ---------------------------------------- |
| `/`                     | DashboardPage       | KPI-Karten, unvollständige Produkte, Aktivitäten |
| `/import`               | ImportPage           | CSV-Upload & Vorschau                    |
| `/stammdaten`           | StammdatenPage       | Stammdaten-Tabelle mit Suche & Bulk-Aktionen |
| `/stammdaten/:sku`      | StammdatenEditPage   | Stammdaten-Formular (30+ Felder)         |
| `/products`             | ProductsPage         | Produktliste mit Filter & Bulk-Attribut-Zuweisung |
| `/products/:sku`        | ProductDetailPage    | Attribut-Editor (Drag & Drop)            |
| `/attributes`           | AttributesPage       | Attribut-Definitionen verwalten          |
| `/export`               | ExportPage           | Ameise- & Stammdaten-CSV-Export          |
| `/settings`             | SettingsPage         | Preisberechnung konfigurieren            |
| `/aktivitaeten`         | ActivityLogPage      | Vollständiges Aktivitätsprotokoll        |

### 4.2 API-Client (`api/client.ts`)

Zentraler API-Client mit Methoden für alle Backend-Endpunkte:

- **Products**: `getProducts()`, `getProduct()`, `createProduct()`, `importCsv()`, `deleteProducts()`, `archiveProducts()`, `unarchiveProduct()`, `updateStammdaten()`
- **Attributes**: `getAttributeConfig()`, `updateAttributes()`, `bulkUpdateAttributes()`, `applySmartDefaults()`, `createAttributeDefinition()`, `reorderAttributeDefinitions()`
- **Export**: `getExportPreview()`, `validateExport()`, `downloadExport()`, `getStammdatenPreview()`, `downloadStammdatenExport()`
- **Templates**: `getTemplates()`, `createTemplate()`, `applyTemplate()`
- **Settings**: `getPricingSettings()`, `updatePricingSettings()`, `calculateVk()`
- **Stats**: `getStats()`, `getActivities()`

### 4.3 Seiten

| Seite                | Features                                                                |
| -------------------- | ----------------------------------------------------------------------- |
| **DashboardPage**    | 4 KPI-Karten mit Fortschrittsbalken, paginierte unvollständige Produkte, Aktivitätslog, Auto-Refresh (30s) |
| **ImportPage**       | Drag & Drop CSV-Upload, Importvorschau                                  |
| **ProductsPage**     | Suche, Filter (Stammdaten/Attribute), Multi-Select, Bulk-Attribute, Vorlagen-Anwendung |
| **ProductDetailPage**| Produkt-Header, Attribut-Editor (Drag & Drop), Smart Defaults, Archivierung |
| **StammdatenPage**   | Sortierbare Tabelle, Suche, Neues Produkt anlegen, Archiv-Tab           |
| **StammdatenEditPage**| Formular mit Abschnitten: Basis, Maße, Grundpreis, Lieferant, Bilder, Kategorien; EK→VK Auto-Berechnung; Ctrl+S; Dirty-State-Warnung |
| **AttributesPage**   | Kategorie-Navigation, Suche, Pflichtfeld-Filter, Erstellen/Bearbeiten/Löschen/Sortieren |
| **ExportPage**       | Zwei Export-Bereiche mit Vorschau & Validierung; Ameise archiviert Produkte |
| **SettingsPage**     | MwSt-%, Faktor, Rundung konfigurieren; Live-Vorschau                   |
| **ActivityLogPage**  | Aktivitätstabelle mit konfigurierbarem Limit (25/50/100/200)            |

### 4.4 Komponenten

#### Layout
- **Sidebar**: Einklappbare Navigation mit Abschnitten (Übersicht, Daten, Konfiguration), aktiver Zustand
- **PageHeader**: Titel, Beschreibung, optionale Aktions-Buttons

#### Products
- **ProductList**: Sortierbare Tabelle mit Multi-Select, Fortschrittsbalken für Attribut-Abdeckung
- **AttributeEditor**: Drag & Drop—verfügbare Attribute links, zugewiesene rechts; Eingabetypen: Text, Zahl, Boolean, Textarea, Tags
- **BulkAttributeModal**: Attribute auf mehrere Produkte gleichzeitig anwenden
- **TemplateModal**: Vorlage auf ausgewählte Produkte anwenden

#### CSV
- **CsvUpload**: Datei-Input & Drag-Drop-Zone
- **CsvPreview**: Tabelle der importierten Produkte

#### UI (shadcn/ui)
Button, Input, Select, Textarea, Dialog, Badge, Card, Table, Tabs, Switch, Label, ScrollArea, Separator, Toast, ConfirmDialog, LoadingSpinner

---

## 5. Workflows

### Workflow 1: Produkt-Import & Stammdaten

```
CSV-Upload (ImportPage)
  → Backend parst Semikolon-CSV (UTF-8-SIG)
  → Bestehende SKUs: Merge (Name + Stammdaten aktualisiert)
  → Neue SKUs: Produkt angelegt
  → Aktivität protokolliert
  → Stammdaten bearbeiten (StammdatenEditPage)
  → EK eingeben → VK automatisch berechnet
  → Speichern → stammdaten_complete = true
```

### Workflow 2: Attribut-Zuweisung

```
Option A — Einzeln:
  ProductDetailPage → AttributeEditor (Drag & Drop)
  → Attribute von links nach rechts ziehen
  → Werte eingeben → Speichern

Option B — Bulk:
  ProductsPage → Produkte auswählen
  → BulkAttributeModal → Attribute zuweisen → Speichern

Option C — Smart Defaults:
  ProductDetailPage → "Smart Defaults" klicken
  → Backend gleicht Produkttitel mit title_contains-Regeln ab
  → Treffer: Wert automatisch eingetragen
  → Fallback: default_value verwendet
```

### Workflow 3: Vorlagen

```
Vorlage erstellen/bearbeiten (SettingsPage oder ProductsPage)
  → Vorlage auf ausgewählte Produkte anwenden
  → Alle Nicht-leeren Attribut-Werte der Vorlage werden übertragen
```

### Workflow 4: Export

```
ExportPage → Exportart wählen:

Ameise-Export:
  → Validierung (fehlende Pflichtattribute prüfen)
  → Vorschau anzeigen
  → CSV herunterladen (1 Zeile/Attribut/Produkt)
  → Produkte automatisch archiviert
  → Aktivität protokolliert

Stammdaten-Export:
  → Vorschau anzeigen
  → CSV herunterladen (1 Zeile/Produkt, alle Felder)
  → Produkte NICHT archiviert
```

---

## 6. API-Endpunkt-Übersicht

| Methode | Endpunkt                                     | Beschreibung                          |
| ------- | -------------------------------------------- | ------------------------------------- |
| GET     | `/api/health`                                | Health-Check                          |
| GET     | `/api/stats`                                 | Dashboard-Statistiken                 |
| GET     | `/api/stats/activities?limit=`               | Aktivitätsprotokoll                   |
| GET     | `/api/products`                              | Aktive Produkte                       |
| GET     | `/api/products?archived=true`                | Archivierte Produkte                  |
| GET     | `/api/products/:sku`                         | Einzelnes Produkt                     |
| GET     | `/api/products/next-sku`                     | Nächste freie SKU                     |
| POST    | `/api/products`                              | Produkt manuell erstellen             |
| POST    | `/api/products/import`                       | CSV-Import                            |
| DELETE  | `/api/products`                              | Alle Produkte löschen                 |
| POST    | `/api/products/delete`                       | Bestimmte Produkte löschen            |
| POST    | `/api/products/archive`                      | Produkte archivieren                  |
| POST    | `/api/products/:sku/unarchive`               | Produkt wiederherstellen              |
| PATCH   | `/api/products/:sku/stammdaten`              | Stammdaten aktualisieren              |
| GET     | `/api/attributes/config`                     | Attribut-Konfiguration                |
| GET     | `/api/attributes/categories`                 | Kategorieliste                        |
| POST    | `/api/attributes/definitions`                | Attribut erstellen                    |
| PUT     | `/api/attributes/definitions/:key`           | Attribut bearbeiten                   |
| DELETE  | `/api/attributes/definitions/:key`           | Attribut löschen                      |
| PUT     | `/api/attributes/definitions/reorder`        | Attribute umsortieren                 |
| PUT     | `/api/attributes/products/:sku`              | Produkt-Attribute aktualisieren       |
| PUT     | `/api/attributes/products/bulk`              | Bulk-Attribut-Aktualisierung          |
| DELETE  | `/api/attributes/products/:sku/:key`         | Attribut von Produkt entfernen        |
| POST    | `/api/attributes/products/:sku/smart-defaults`| Smart Defaults anwenden              |
| GET     | `/api/export/preview`                        | Ameise-Export-Vorschau                |
| GET     | `/api/export/validate`                       | Export-Validierung                    |
| POST    | `/api/export/ameise`                         | Ameise-CSV herunterladen              |
| GET     | `/api/export/stammdaten/preview`             | Stammdaten-Export-Vorschau            |
| POST    | `/api/export/stammdaten`                     | Stammdaten-CSV herunterladen          |
| GET     | `/api/templates`                             | Vorlagen auflisten                    |
| POST    | `/api/templates`                             | Vorlage erstellen/aktualisieren       |
| PUT     | `/api/templates/:name`                       | Vorlage bearbeiten                    |
| DELETE  | `/api/templates/:name`                       | Vorlage löschen                       |
| POST    | `/api/templates/:name/apply`                 | Vorlage auf Produkte anwenden         |
| GET     | `/api/settings/pricing`                      | Pricing-Einstellungen abrufen         |
| PUT     | `/api/settings/pricing`                      | Pricing-Einstellungen aktualisieren   |
| POST    | `/api/settings/pricing/calculate`            | VK aus EK berechnen                   |

---

## 7. Konfiguration & Attribute

### Attribut-Kategorien (aus `attribute_config.json`)

- **Produkt**: Marke, Produktlinie, Typ, Farbe, Material, Stärke, geeignete/ungeeignete Materialien, Info-Elemente
- **Produkttyp & Bauart**: Dildo-/Vibrator-/Masturbator-Typ, Öffnungsart, Flexibilität, Basis, Textur, Harness-kompatibel, Anal-sicher, Temperaturspiel, Erfahrungslevel, Handhabung, Diskretes Aussehen
- **Masse & Gewicht**: Gesamtlänge, Einführlänge, Innen-/Außendurchmesser, Artikelgewicht, Versandgewicht, Verpackungsmaße
- Weitere Kategorien nach Bedarf erweiterbar

### Preisberechnung

```
VK = EK × (1 + MwSt%) × Faktor → gerundet auf x.{Endung}€
```

Konfigurierbar über `Settings`-Seite. Einstellungen in `backend/data/settings.json`.

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
- **Frontend** auf `http://localhost:5173` (Vite Dev-Server)
- Öffnet Browser automatisch

### Abhängigkeiten

**Backend** (`requirements.txt`):
- fastapi ≥ 0.128
- uvicorn[standard] ≥ 0.34
- python-multipart ≥ 0.0.20
- pydantic ≥ 2.10

**Frontend** (`package.json`):
- React 19, React Router, TypeScript
- Tailwind CSS, @tailwindcss/vite
- @dnd-kit (Drag & Drop)
- lucide-react (Icons)
- class-variance-authority, clsx, tailwind-merge (UI-Utilities)
