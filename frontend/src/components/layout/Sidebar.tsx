import { NavLink } from 'react-router-dom';
import { Upload, Package, Download, Layers, Settings2, ClipboardList, SlidersHorizontal, LayoutDashboard, PanelLeftClose, PanelLeft, Activity, ShieldCheck, FolderTree, Search, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../lib/use-theme';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Upload;
  end?: boolean;
}

interface NavSection {
  header: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    header: 'Übersicht',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/activity', label: 'Aktivitäten', icon: Activity },
      { to: '/quality', label: 'Datenqualität', icon: ShieldCheck },
    ],
  },
  {
    header: 'Daten',
    items: [
      { to: '/import', label: 'Import', icon: Upload },
      { to: '/stammdaten', label: 'Stammdaten', icon: ClipboardList },
      { to: '/products', label: 'Attribute', icon: Package },
    ],
  },
  {
    header: 'Konfiguration',
    items: [
      { to: '/attributes', label: 'Attribut Verwaltung', icon: Settings2 },
      { to: '/categories', label: 'Kategorien', icon: FolderTree },
      { to: '/export', label: 'Export', icon: Download },
      { to: '/settings', label: 'Einstellungen', icon: SlidersHorizontal },
    ],
  },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  onSearch?: () => void;
}

export function Sidebar({ collapsed, onToggle, onSearch }: Props) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-gray-950 dark:bg-gray-900/80 dark:border-r dark:border-white/10 flex flex-col transition-all duration-200`}>
      <div className={`${collapsed ? 'p-3' : 'px-5 py-5'} border-b border-white/10`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
            <Layers className="w-4.5 h-4.5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white truncate">Attribut Generator</h1>
              <p className="text-[11px] text-gray-500">Shopify · JTL Ameise</p>
            </div>
          )}
        </div>
      </div>
      {/* Search button */}
      <div className={`${collapsed ? 'px-2 pt-3' : 'px-3 pt-4'}`}>
        <button
          onClick={onSearch}
          className={`w-full flex items-center gap-2 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors border border-white/10`}
          title="Suche (Ctrl+K)"
        >
          <Search className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-[13px]">Suche…</span>
              <kbd className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">⌘K</kbd>
            </>
          )}
        </button>
      </div>
      <nav className={`flex-1 ${collapsed ? 'p-2' : 'px-3 py-4'} overflow-y-auto`}>
        {sections.map((section, si) => (
          <div key={section.header} className={si > 0 ? 'mt-6' : ''}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                {section.header}
              </p>
            )}
            {collapsed && si > 0 && (
              <div className="mx-2 mb-3 border-t border-white/10" />
            )}
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center ${collapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-500/15 text-indigo-400'
                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-2 border-t border-white/10 space-y-1">
        <button
          onClick={(e) => setTheme(isDark ? 'light' : 'dark', e.nativeEvent)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
          title={isDark ? 'Light Mode' : 'Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
          title={collapsed ? 'Sidebar einblenden' : 'Sidebar einklappen'}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Einklappen</span>}
        </button>
      </div>
    </aside>
  );
}
