import { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Menu, Layers } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { ToastProvider } from './components/ui/Toast';
import { SearchDialog } from './components/ui/SearchDialog';
import { DashboardPage } from './pages/DashboardPage';
import { ImportPage } from './pages/ImportPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { StammdatenPage } from './pages/StammdatenPage';
import { StammdatenEditPage } from './pages/StammdatenEditPage';
import { AttributesPage } from './pages/AttributesPage';
import { ExportPage } from './pages/ExportPage';
import { SettingsPage } from './pages/SettingsPage';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { DataQualityPage } from './pages/DataQualityPage';
import { ContentEditPage } from './pages/ContentEditPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { VariantGroupsPage } from './pages/VariantGroupsPage';
import { BundlesPage } from './pages/BundlesPage';
import { WarningsPage } from './pages/WarningsPage';
import { IngredientsPage } from './pages/IngredientsPage';
import { ArtikelwerkPage } from './pages/ArtikelwerkPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ArtikelwerkLogsPage } from './pages/ArtikelwerkLogsPage';

function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ToastProvider>
      <div className="flex h-screen bg-background">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          onSearch={() => setSearchOpen(true)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile-Topbar mit Burger-Toggle */}
          <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900/80 backdrop-blur sticky top-0 z-30">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
              aria-label="Menü öffnen"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">Attribut Generator</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </ToastProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/import', element: <ImportPage /> },
      { path: '/products', element: <ProductsPage /> },
      { path: '/products/:sku', element: <ProductDetailPage /> },
      { path: '/stammdaten', element: <StammdatenPage /> },
      { path: '/stammdaten/:sku', element: <StammdatenEditPage /> },
      { path: '/content/:sku', element: <ContentEditPage /> },
      { path: '/attributes', element: <AttributesPage /> },
      { path: '/templates', element: <TemplatesPage /> },
      { path: '/categories', element: <CategoriesPage /> },
      { path: '/suppliers', element: <SuppliersPage /> },
      { path: '/export', element: <ExportPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/activity', element: <ActivityLogPage /> },
      { path: '/quality', element: <DataQualityPage /> },
      { path: '/variants', element: <VariantGroupsPage /> },
      { path: '/bundles', element: <BundlesPage /> },
      { path: '/warnings', element: <WarningsPage /> },
      { path: '/ingredients', element: <IngredientsPage /> },
      { path: '/artikelwerk', element: <ArtikelwerkPage /> },
      { path: '/logs', element: <ArtikelwerkLogsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
