import { NavLink } from 'react-router-dom';
import { Upload, Package, Download, Layers, Settings2, ClipboardList, SlidersHorizontal, LayoutDashboard, PanelLeftClose, PanelLeft, Activity } from 'lucide-react';

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
      { to: '/export', label: 'Export', icon: Download },
      { to: '/settings', label: 'Einstellungen', icon: SlidersHorizontal },
    ],
  },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: Props) {
  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200`}>
      <div className={`${collapsed ? 'p-3' : 'p-6'} border-b border-gray-200`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 truncate">Attribut Generator</h1>
              <p className="text-xs text-gray-500">Shopify · JTL Ameise</p>
            </div>
          )}
        </div>
      </div>
      <nav className={`flex-1 ${collapsed ? 'p-2' : 'px-4 py-3'} overflow-y-auto`}>
        {sections.map((section, si) => (
          <div key={section.header} className={si > 0 ? 'mt-5' : ''}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {section.header}
              </p>
            )}
            {collapsed && si > 0 && (
              <div className="mx-2 mb-2 border-t border-gray-200" />
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
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title={collapsed ? 'Sidebar einblenden' : 'Sidebar einklappen'}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Einklappen</span>}
        </button>
      </div>
    </aside>
  );
}
