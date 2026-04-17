# CLAUDE.md — Attribut Generator

## Projekt-Überblick

E-Commerce Produktdaten- und Attributmanagement-Tool für JTL Ameise / Shopify.  
CSV-Import → Stammdaten pflegen → Attribute zuweisen → Varianten verwalten → SEO-Content → 3 Export-Formate.

## Tech Stack

| Schicht      | Technologie                                             |
|-------------|--------------------------------------------------------|
| Backend     | Python 3.11+, FastAPI, Uvicorn, Pydantic 2, SQLite (WAL) |
| Frontend    | React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4       |
| UI          | shadcn/ui, lucide-react, @dnd-kit, TipTap 3 (Rich-Text) |
| Routing     | react-router-dom 7                                      |

## Start

```bash
python start.py    # Backend :8000 + Frontend :5173, öffnet Browser
```

Vite proxied `/api` → `http://localhost:8000`.

## Projektstruktur

```
start.py                          # Startet Backend + Frontend + Browser
backend/
  main.py                         # FastAPI-App, 9 Router, Lifespan, CORS
  state.py                        # AppState-Singleton (In-Memory + SQLite)
  models/                         # Pydantic-Modelle (product, attribute, stats)
  routers/                        # 9 API-Router
    products.py                   # CRUD, Import, Archiv, Klonen, Bulk, History
    attributes.py                 # Definitionen, Zuweisung, Smart Defaults
    export.py                     # 3 Formate: Ameise, Stammdaten, SEO
    templates.py                  # Vorlagen CRUD + Anwenden
    settings.py                   # Preis, Export, Einheiten, Standards, Varianten
    stats.py                      # Dashboard-KPIs, Aktivitätslog, Globale Suche
    validation.py                 # Datenqualitätsprüfung (20+ Regeln)
    variants.py                   # Parent/Child-Gruppen, Vererbung, Diff
    categories.py                 # Kategorienbaum-CRUD
  services/                       # csv_handler, database, validation
  data/                           # attribute_config.json, settings.json, category_tree.json
frontend/src/
  App.tsx                         # 13 Routen + Layout (Sidebar, Toast, SearchDialog)
  api/client.ts                   # ~60 API-Methoden mit Retry-Logik
  types/index.ts                  # Alle TypeScript-Typen
  pages/                          # 13 Seitenkomponenten (*Page.tsx)
  components/
    layout/                       # Sidebar (einklappbar, Dark Mode), PageHeader
    products/                     # AttributeEditor, BulkAttributeModal, BulkStammdatenModal, ProductList, TemplateModal, VariantGroupModal, VariantMatrix
    csv/                          # CsvUpload, CsvPreview
    ui/                           # shadcn/ui + Toast, ConfirmDialog, LoadingSpinner, SearchDialog, HtmlEditor, CategoryCascader
  lib/                            # utils.ts (cn), attribute-utils.ts (getFieldType), use-theme.ts (Dark Mode)
```

## Architektur-Muster

- **AppState-Singleton** (`state.py`): In-Memory-Dict → SQLite. Alle Mutationen über `state`-Methoden.
- **JSON-Seeding**: `attribute_config.json` wird beim Start mit DB synchronisiert (Sortierung, Kategorien, Namen, IDs, suggested_values, descriptions).
- **Lifespan**: `reload_from_db()` bei jedem Server-Start (inkl. Hot-Reload).
- **Activity-Log**: `log_activity(event_type, detail, count)` nach jeder relevanten Aktion.
- **Product-History**: `log_product_history(sku, event_type, field, old, new, detail)` für Feld-Diffs.
- **Router-Pattern**: Jeder Router erstellt `APIRouter(prefix="/api/...", tags=["..."])`, registriert in `main.py`.
- **Frontend-State**: Lokaler `useState` + `useEffect` pro Seite. Kein Redux/Zustand.
- **API-Aufrufe**: Immer via `api.method()` aus `client.ts`, try/catch → `toast()`. Retry-Logik (2 Versuche).
- **Toast-System**: `ToastProvider` → `useToast()` → `toast(msg, 'success'|'error'|'info')`.
- **Varianten-Vererbung**: Parent-Felder werden auf Children vererbt (`resolve_product()`), überschreibbar.

## Code-Konventionen

### Backend (Python)
- Dateinamen: `snake_case.py`
- Type-Hints: `str | None`, `dict[str, ...]` (Python 3.10+ Syntax)
- Request/Response-Bodies: Pydantic `BaseModel`
- Fehler: `HTTPException` mit Statuscodes (400, 404, 409)
- CSV: Semikolon-getrennt, UTF-8-sig
- Neue Spalten: `_migrate_product_columns()` in `database.py`
- Neue Tabellen: `init_db()` in `database.py`
- DB-Zugriffe: Immer über `state`-Singleton, nie direkt

### Frontend (TypeScript/React)
- Seiten: `PascalCasePage.tsx` (Named Exports)
- Komponenten: `PascalCase.tsx`
- shadcn/ui: `kebab-case.tsx`
- UI-Sprache: **Deutsch** — alle User-facing Strings auf Deutsch
- CSS: Tailwind-Utility-Klassen inline, `cn()` für bedingte Klassen
- Dark Mode: `dark:` Tailwind-Varianten, `useTheme()` Hook
- Pfad-Alias: `@/` → `./src/`
- Strict-Mode: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Neue Types → `types/index.ts`, neue API-Methoden → `api/client.ts`
- Neue Seite → Route in `App.tsx` + Sidebar-Link in `Sidebar.tsx`

## Datenbank (SQLite)

5 Tabellen: `products` (51 Felder), `attribute_definitions`, `templates`, `activity_log`, `product_history`.  
Migration: `_migrate_product_columns()` fügt neue Spalten per `ALTER TABLE` hinzu.

## API-Bereiche

| Prefix               | Zweck                                              |
|----------------------|---------------------------------------------------|
| `/api/products`      | CRUD, Import, Archiv, Bulk, Klonen, History (14)   |
| `/api/attributes`    | Definitionen, Zuweisung, Smart Defaults (10)       |
| `/api/export`        | Ameise-CSV, Stammdaten-CSV, SEO-CSV (8)            |
| `/api/templates`     | Vorlagen CRUD + Anwenden (5)                       |
| `/api/settings`      | Preis, Export, Einheiten, Standards, Varianten (11) |
| `/api/stats`         | Dashboard-KPIs, Aktivitätslog, Globale Suche (3)   |
| `/api/validation`    | Datenqualitätsprüfung mit 20+ Regeln (2)           |
| `/api/variants`      | Parent/Child-Gruppen, Vererbung, Diff (10)         |
| `/api/categories`    | Kategorienbaum CRUD (6)                             |

## Frontend-Routen

| Pfad                | Seite                | Zweck                                      |
|--------------------|----------------------|--------------------------------------------|
| `/`                | DashboardPage        | 25 KPIs, Aktivitäten, Auto-Refresh (30s)  |
| `/import`          | ImportPage           | CSV-Upload mit Fehlerreport                |
| `/products`        | ProductsPage         | Attributzuweisung, gespeicherte Filter     |
| `/products/:sku`   | ProductDetailPage    | Attribut-Editor (Drag & Drop), History-Tab |
| `/stammdaten`      | StammdatenPage       | Stammdaten-Tabelle, Varianten, Bulk        |
| `/stammdaten/:sku` | StammdatenEditPage   | 51-Felder-Formular, Vererbung, Ctrl+S      |
| `/content/:sku`    | ContentEditPage      | WYSIWYG-Editor (TipTap) für SEO-Content    |
| `/attributes`      | AttributesPage       | Attribut-Definitionen CRUD                 |
| `/categories`      | CategoriesPage       | Kategorienbaum-Editor                      |
| `/export`          | ExportPage           | 3 Exports mit Vorschau + Validierung       |
| `/settings`        | SettingsPage         | 5 Einstellungsbereiche                     |
| `/activity`        | ActivityLogPage      | Vollständiges Aktivitätslog                |
| `/quality`         | DataQualityPage      | Datenqualitäts-Dashboard                   |

## Wichtige Regeln

Siehe `rules/`-Ordner für detaillierte Arbeitsregeln.
