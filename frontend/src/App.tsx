import { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
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

function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} onSearch={() => setSearchOpen(true)} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
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
      { path: '/export', element: <ExportPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/activity', element: <ActivityLogPage /> },
      { path: '/quality', element: <DataQualityPage /> },
      { path: '/variants', element: <VariantGroupsPage /> },
      { path: '/bundles', element: <BundlesPage /> },
      { path: '/warnings', element: <WarningsPage /> },
      { path: '/ingredients', element: <IngredientsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
