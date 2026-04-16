# Sidebar Vorlage (Stand: 2026-04-16)

Datei: `frontend/src/components/layout/Sidebar.tsx`

## Struktur
- Dark sidebar (`bg-gray-950`), collapsible (`w-16` / `w-60`)
- Props: `collapsed`, `onToggle`, `onSearch`
- Uses `useTheme()` hook for dark mode toggle

## Sections (NavLink-basiert)
```
Übersicht:
  / → Dashboard (LayoutDashboard)
  /activity → Aktivitäten (Activity)
  /quality → Datenqualität (ShieldCheck)

Daten:
  /import → Import (Upload)
  /stammdaten → Stammdaten (ClipboardList)
  /products → Attribute (Package)

Konfiguration:
  /attributes → Attribut Verwaltung (Settings2)
  /categories → Kategorien (FolderTree)
  /export → Export (Download)
  /settings → Einstellungen (SlidersHorizontal)
```

## Layout-Aufbau (top to bottom)
1. **Logo-Header** — Indigo icon + "Attribut Generator" / "Shopify · JTL Ameise"
2. **Suchbutton** — Ctrl+K Shortcut, `onSearch` callback
3. **Nav-Sections** — Gruppiert mit Section-Headers (collapsed: Divider statt Header)
4. **Footer** — Dark Mode Toggle (Sun/Moon) + Collapse Toggle (PanelLeft/PanelLeftClose)

## Styling-Patterns
- Active link: `bg-indigo-500/15 text-indigo-400`
- Inactive link: `text-gray-400 hover:bg-white/5 hover:text-gray-200`
- Section header: `text-[10px] font-semibold uppercase tracking-widest text-gray-500`
- Nav items: `text-[13px] font-medium`, icons `w-4 h-4`
- Borders: `border-white/10`
- Buttons (footer): `text-gray-500 hover:text-gray-300 hover:bg-white/5`

## Icons (lucide-react)
Upload, Package, Download, Layers, Settings2, ClipboardList, SlidersHorizontal, LayoutDashboard, PanelLeftClose, PanelLeft, Activity, ShieldCheck, FolderTree, Search, Sun, Moon
