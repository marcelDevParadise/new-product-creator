import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Upload, Package, Download, Layers, Settings2, ClipboardList, SlidersHorizontal, LayoutDashboard, PanelLeftClose, PanelLeft, Activity, ShieldCheck, FolderTree, Search, Sun, Moon, FileText, GitBranch, AlertTriangle, FlaskConical, X, CloudUpload } from 'lucide-react';
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
      { to: '/variants', label: 'Varianten', icon: GitBranch },
      { to: '/bundles', label: 'Bundles', icon: Package },
      { to: '/warnings', label: 'Warnhinweise', icon: AlertTriangle },
      { to: '/ingredients', label: 'Inhaltsstoffe', icon: FlaskConical },
    ],
  },
  {
    header: 'Konfiguration',
    items: [
      { to: '/attributes', label: 'Attribut Verwaltung', icon: Settings2 },
      { to: '/templates', label: 'Vorlagen', icon: FileText },
      { to: '/categories', label: 'Kategorien', icon: FolderTree },
      { to: '/export', label: 'Export', icon: Download },
      { to: '/artikelwerk', label: 'Artikelwerk', icon: CloudUpload },
      { to: '/settings', label: 'Einstellungen', icon: SlidersHorizontal },
    ],
  },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onSearch?: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose, onSearch }: Props) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Body-Scroll auf Mobile sperren, wenn Drawer offen
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  // Esc schließt den Drawer
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onMobileClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileOpen, onMobileClose]);

  // Auf Mobile ist die Sidebar nie kollabiert (immer voller Inhalt im Drawer).
  const isCompact = collapsed; // betrifft nur Desktop

  return (
    <>
      {/* Mobile-Backdrop */}
      <div
        onClick={onMobileClose}
        className={`md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden="true"
      />

      <aside
        className={[
          // Layout / Theme
          'bg-gray-950 dark:bg-gray-900/80 dark:border-r dark:border-white/10 flex flex-col transition-all duration-200',
          // Desktop: in-flow, Breite je nach collapsed
          `md:static md:translate-x-0 ${isCompact ? 'md:w-16' : 'md:w-60'}`,
          // Mobile: fixed Off-Canvas-Drawer
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className={`px-5 py-5 ${isCompact ? 'md:p-3' : 'md:px-5 md:py-5'} border-b border-white/10`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
              <Layers className="w-4.5 h-4.5 text-white" />
            </div>
            <div className={`min-w-0 flex-1 ${isCompact ? 'md:hidden' : ''}`}>
              <h1 className="text-sm font-semibold text-white truncate">Attribut Generator</h1>
              <p className="text-[11px] text-gray-500">Shopify · JTL Ameise</p>
            </div>
            {/* Close-Button nur auf Mobile */}
            <button
              onClick={onMobileClose}
              className="md:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Menü schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search button */}
        <div className={`px-3 pt-4 ${isCompact ? 'md:px-2 md:pt-3' : 'md:px-3 md:pt-4'}`}>
          <button
            onClick={() => { onSearch?.(); onMobileClose(); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors border border-white/10 ${isCompact ? 'md:justify-center md:px-2' : 'md:px-3'}`}
            title="Suche (Ctrl+K)"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className={`flex-1 text-left text-[13px] ${isCompact ? 'md:hidden' : ''}`}>Suche…</span>
            <kbd className={`text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 ${isCompact ? 'md:hidden' : ''}`}>⌘K</kbd>
          </button>
        </div>

        <nav className={`flex-1 px-3 py-4 ${isCompact ? 'md:p-2' : 'md:px-3 md:py-4'} overflow-y-auto`}>
          {sections.map((section, si) => (
            <div key={section.header} className={si > 0 ? 'mt-6' : ''}>
              <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500 ${isCompact ? 'md:hidden' : ''}`}>
                {section.header}
              </p>
              {isCompact && si > 0 && (
                <div className="hidden md:block mx-2 mb-3 border-t border-white/10" />
              )}
              <div className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onMobileClose}
                    title={isCompact ? label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isCompact ? 'md:justify-center' : ''} ${
                        isActive
                          ? 'bg-indigo-500/15 text-indigo-400'
                          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className={isCompact ? 'md:hidden' : ''}>{label}</span>
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
            <span className={`text-xs ${isCompact ? 'md:hidden' : ''}`}>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          {/* Desktop-Toggle — auf Mobile ausblenden, da der Drawer immer voll ist */}
          <button
            onClick={onToggle}
            className="hidden md:flex w-full items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
            title={isCompact ? 'Sidebar einblenden' : 'Sidebar einklappen'}
          >
            {isCompact ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            {!isCompact && <span className="text-xs">Einklappen</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
