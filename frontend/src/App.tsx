import { useState } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { ToastProvider } from './components/ui/Toast';
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

function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50/80">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
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
      { path: '/categories', element: <CategoriesPage /> },
      { path: '/export', element: <ExportPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/activity', element: <ActivityLogPage /> },
      { path: '/quality', element: <DataQualityPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
