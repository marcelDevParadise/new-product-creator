# CLAUDE.md — Attribut Generator

## Projekt-Überblick

E-Commerce Produktdaten- und Attributmanagement-Tool für JTL Ameise / Shopify.  
Semikolon-CSV-Import → Stammdaten pflegen → Attribute zuweisen → Export.

## Tech Stack

| Schicht     | Technologie                                        |
|-------------|---------------------------------------------------|
| Backend     | Python 3.11+, FastAPI, Uvicorn, Pydantic, SQLite (WAL) |
| Frontend    | React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4  |
| UI          | shadcn/ui, lucide-react, @dnd-kit                  |
| Routing     | react-router-dom 7                                 |

## Start

```bash
python start.py    # Backend :8000 + Frontend :5173, öffnet Browser
```

Vite proxied `/api` → `http://localhost:8000`.

## Projektstruktur

```
start.py                          # Startet Backend + Frontend
backend/
  main.py                         # FastAPI-App, Router-Registrierung, CORS
  state.py                        # AppState-Singleton (In-Memory + SQLite)
  models/                         # Pydantic-Modelle (product, attribute, stats)
  routers/                        # API-Router (products, attributes, export, templates, settings, stats, validation)
  services/                       # csv_handler, database, validation
  data/                           # attribute_config.json, settings.json
frontend/src/
  App.tsx                         # Router-Definition
  api/client.ts                   # Zentraler API-Client mit Retry-Logik
  types/index.ts                  # Alle TypeScript-Typen
  pages/                          # Seitenkomponenten (*Page.tsx)
  components/
    layout/                       # Sidebar, PageHeader
    products/                     # AttributeEditor, BulkAttributeModal, ProductList, TemplateModal, BulkStammdatenModal
    csv/                          # CsvUpload, CsvPreview
    ui/                           # shadcn/ui + eigene (Toast, ConfirmDialog, LoadingSpinner)
  lib/                            # utils.ts (cn-Helper), attribute-utils.ts
```

## Architektur-Muster

- **AppState-Singleton** (`state.py`): In-Memory-Dict → SQLite. Alle Mutationen über `state`-Methoden.
- **JSON-Seeding**: `attribute_config.json` wird beim Start mit DB synchronisiert.
- **Activity-Log**: `log_activity(event_type, detail, count)` nach jeder relevanten Aktion.
- **Router-Pattern**: Jeder Router erstellt `APIRouter(prefix="/api/...", tags=["..."])`, registriert in `main.py`.
- **Frontend-State**: Lokaler `useState` + `useEffect` pro Seite. Kein Redux/Zustand.
- **API-Aufrufe**: Immer via `api.method()` aus `client.ts`, try/catch → `toast()`.
- **Toast-System**: `ToastProvider` → `useToast()` → `toast(msg, 'success'|'error'|'info')`.

## Code-Konventionen

### Backend (Python)
- Dateinamen: `snake_case.py`
- Type-Hints: `str | None`, `dict[str, ...]` (Python 3.10+ Syntax)
- Request/Response-Bodies: Pydantic `BaseModel`
- Fehler: `HTTPException` mit Statuscodes (400, 404, 409)
- CSV: Semikolon-getrennt, UTF-8-sig

### Frontend (TypeScript/React)
- Seiten: `PascalCasePage.tsx` (Named Exports)
- Komponenten: `PascalCase.tsx`
- shadcn/ui: `kebab-case.tsx`
- UI-Sprache: **Deutsch** — alle User-facing Strings auf Deutsch
- CSS: Tailwind-Utility-Klassen inline, `cn()` für bedingte Klassen
- Pfad-Alias: `@/` → `./src/`
- Strict-Mode: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`

## Datenbank (SQLite)

4 Tabellen: `products`, `attribute_definitions`, `templates`, `activity_log`.  
Migration: `_migrate_product_columns()` fügt neue Spalten per `ALTER TABLE` hinzu.

## API-Bereiche

| Prefix               | Zweck                             |
|----------------------|-----------------------------------|
| `/api/products`      | CRUD, Import, Archiv, Bulk        |
| `/api/attributes`    | Definitionen, Zuweisung, Smart Defaults |
| `/api/export`        | Ameise-CSV, Stammdaten-CSV, SEO-CSV, Validierung |
| `/api/templates`     | Vorlagen CRUD + Anwenden          |
| `/api/settings`      | Preiskalkulation (MwSt, Faktor)   |
| `/api/stats`         | Dashboard-KPIs, Aktivitätslog     |
| `/api/validation`    | Datenqualitätsprüfung             |

## Frontend-Routen

| Pfad                | Seite                | Zweck                                  |
|--------------------|----------------------|----------------------------------------|
| `/`                | DashboardPage        | KPIs, unvollständige Produkte, Aktivitäten |
| `/import`          | ImportPage           | CSV-Upload mit Fehlerreport            |
| `/products`        | ProductsPage         | Attributzuweisung, gespeicherte Filter |
| `/products/:sku`   | ProductDetailPage    | Attribut-Editor mit Drag & Drop        |
| `/stammdaten`      | StammdatenPage       | Produktliste, Archiv, Bulk-Aktionen    |
| `/stammdaten/:sku` | StammdatenEditPage   | Stammdaten-Formular (30+ Felder)       |
| `/attributes`      | AttributesPage       | Attribut-Definitionen verwalten        |
| `/export`          | ExportPage           | Export-Vorschau + Download             |
| `/settings`        | SettingsPage         | Preisformel-Konfiguration              |
| `/activity`        | ActivityLogPage      | Vollständiges Aktivitätslog            |
| `/quality`         | DataQualityPage      | Datenqualitäts-Dashboard               |

## Wichtige Regeln

Siehe `rules/`-Ordner für detaillierte Arbeitsregeln.
