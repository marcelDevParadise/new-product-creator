import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ClipboardCheck,
  Tags,
  Rocket,
  Upload,
  Download,
  Trash2,
  Plus,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Barcode,
  Globe,
  Archive,
} from 'lucide-react';
import { api } from '../api/client';
import type { DashboardStats } from '../types';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 mt-3">
      <div
        className="h-2 rounded-full bg-indigo-600 transition-all duration-500"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString + 'Z');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Gestern';
  return `vor ${diffD} Tagen`;
}

const eventConfig: Record<string, { icon: typeof Upload; color: string; label: string }> = {
  import: { icon: Upload, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400', label: 'Import' },
  export_ameise: { icon: Download, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400', label: 'Ameise Export' },
  export_stammdaten: { icon: Download, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-400', label: 'Stammdaten Export' },
  export_seo: { icon: Download, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400', label: 'SEO Export' },
  archive_after_export: { icon: Archive, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400', label: 'Archiviert' },
  product_created: { icon: Plus, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400', label: 'Erstellt' },
  product_deleted: { icon: Trash2, color: 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400', label: 'Gelöscht' },
};

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [incompletePage, setIncompletePage] = useState(0);
  const navigate = useNavigate();

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
      setError(null);
      setLastRefresh(new Date());
    } catch {
      setError('Dashboard-Daten konnten nicht geladen werden.');
    }
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  useEffect(() => {
    loadStats();

    const onFocus = () => loadStats();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });

    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  if (error) {
    return (
      <div className="p-8">
        <PageHeader title="Dashboard" description="Übersicht über alle Produkte und Aktivitäten" />
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <PageHeader title="Dashboard" description="Übersicht über alle Produkte und Aktivitäten" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><div className="h-4 w-24 bg-gray-100 rounded animate-pulse" /></CardHeader>
              <CardContent><div className="h-8 w-16 bg-gray-100 rounded animate-pulse" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Dashboard" description="Übersicht über alle Produkte und Aktivitäten" />
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Aktualisiert {formatRelativeTime(lastRefresh.toISOString().replace('Z', ''))}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* KPI Cards - Primary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Produkte</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.products_total}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400">
                {stats.products_active} aktiv
              </Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400">
                {stats.products_archived} archiviert
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stammdaten</CardTitle>
            <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.stammdaten_percent}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.stammdaten_complete} von {stats.products_active} vollständig
            </p>
            <ProgressBar percent={stats.stammdaten_percent} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attribut-Abdeckung</CardTitle>
            <Tags className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.attributes_percent}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.attributes_with} von {stats.products_active} mit Attributen
            </p>
            <ProgressBar percent={stats.attributes_percent} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Export-Bereit</CardTitle>
            <Rocket className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.export_ready}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.export_ready_percent}% — Stammdaten ✓ + Attribute ✓
            </p>
            <ProgressBar percent={stats.export_ready_percent} />
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards - Secondary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SEO-Abdeckung</CardTitle>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.seo_percent}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.seo_complete} von {stats.products_active} mit SEO-Daten
            </p>
            <ProgressBar percent={stats.seo_percent} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ohne Bilder</CardTitle>
            <ImageOff className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.products_without_images > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              {stats.products_without_images}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              von {stats.products_active} Produkten
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ohne EAN</CardTitle>
            <Barcode className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.products_without_ean > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              {stats.products_without_ean}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              von {stats.products_active} Produkten
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">⌀ Attribute</CardTitle>
            <Tags className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avg_attributes_per_product}</div>
            <p className="text-xs text-muted-foreground mt-1">
              pro Produkt (Durchschnitt)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Incomplete Products */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Unvollständige Produkte</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.incomplete_products.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                Alle Produkte sind vollständig — bereit zum Export!
              </p>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.incomplete_products.slice(incompletePage * 5, incompletePage * 5 + 5).map((p) => (
                    <TableRow
                      key={p.artikelnummer}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        navigate(
                          p.stammdaten_complete
                            ? `/products/${encodeURIComponent(p.artikelnummer)}`
                            : `/stammdaten/${encodeURIComponent(p.artikelnummer)}`
                        )
                      }
                    >
                      <TableCell className="font-mono text-xs">{p.artikelnummer}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{p.artikelname}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Badge
                          variant="secondary"
                          className={
                            p.stammdaten_complete
                               ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400'
                               : 'bg-red-50 text-red-700 hover:bg-red-50 dark:bg-red-950 dark:text-red-400'
                           }
                         >
                           {p.stammdaten_complete ? 'Stammdaten ✓' : 'Stammdaten ✗'}
                         </Badge>
                         <Badge
                           variant="secondary"
                           className={
                             p.attribute_count > 0
                               ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400'
                               : 'bg-red-50 text-red-700 hover:bg-red-50 dark:bg-red-950 dark:text-red-400'
                          }
                        >
                          {p.attribute_count > 0 ? `${p.attribute_count} Attr.` : 'Attribute ✗'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {stats.incomplete_products.length > 5 && (
                <div className="flex items-center justify-between pt-3 border-t mt-2">
                  <span className="text-xs text-gray-500">
                    {incompletePage * 5 + 1}–{Math.min(incompletePage * 5 + 5, stats.incomplete_products.length)} von {stats.incomplete_products.length}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={incompletePage === 0}
                      onClick={() => setIncompletePage(incompletePage - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={incompletePage >= Math.ceil(stats.incomplete_products.length / 5) - 1}
                      onClick={() => setIncompletePage(incompletePage + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Activity Log */}
        <Card className="shadow-sm">
          <CardHeader
            className="cursor-pointer hover:bg-gray-50 rounded-t-lg transition-colors"
            onClick={() => navigate('/activity')}
          >
            <CardTitle className="text-base">Letzte Aktivitäten</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recent_activities.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                Noch keine Aktivitäten vorhanden.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recent_activities.map((a, i) => {
                  const cfg = eventConfig[a.event_type] || eventConfig.import;
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.detail}</p>
                        <p className="text-xs text-gray-500">{cfg.label}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatRelativeTime(a.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
