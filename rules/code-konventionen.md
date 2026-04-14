# Code-Konventionen

## Backend (Python / FastAPI)

- Neue Endpunkte als eigener Router in `backend/routers/` → in `main.py` registrieren.
- Request/Response-Bodies immer als Pydantic `BaseModel`.
- Fehler mit `HTTPException(status_code=..., detail=...)`.
- Nach relevanten Aktionen: `state.log_activity(event_type, detail, count)`.
- CSV: Semikolon-getrennt, UTF-8-sig Encoding.
- Type-Hints: Python 3.10+ Syntax (`str | None`, `list[str]`).
- Dateinamen: `snake_case.py`.

## Frontend (React / TypeScript)

- Seiten: `PascalCasePage.tsx` in `frontend/src/pages/`, Named Exports.
- Komponenten: `PascalCase.tsx` in passenden Unterordner von `components/`.
- Neue Types → in `frontend/src/types/index.ts` ergänzen.
- Neue API-Methoden → in `frontend/src/api/client.ts` ergänzen.
- UI-Sprache: **Immer Deutsch**. Alle Labels, Buttons, Meldungen auf Deutsch.
- Toast für Feedback: `const { toast } = useToast()` → `toast(msg, 'success'|'error')`.
- Loading-States: `LoadingSpinner` Komponente verwenden.
- Modals: `fixed inset-0 z-50` Pattern oder `ConfirmDialog` für Bestätigungen.
- shadcn/ui: Importiere von `@/components/ui/...`.
- Icons: `lucide-react`.
- CSS: Tailwind-Utility-Klassen. `cn()` aus `@/lib/utils` für bedingte Klassen.
- Kein Redux/Zustand — lokaler State mit `useState` + `useEffect`.

## Routing

- Neue Seite → Route in `App.tsx` hinzufügen + Sidebar-Link in `Sidebar.tsx`.
- Sidebar-Icons: `lucide-react`.

## Datenbank

- Neue Spalten in `products`: In `_migrate_product_columns()` in `database.py` ergänzen.
- Neue Tabellen: In `init_db()` in `database.py` erstellen.
- Alle DB-Zugriffe über `state`-Singleton, nicht direkt.
