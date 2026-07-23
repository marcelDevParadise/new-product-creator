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
  FileText,
  DollarSign,
  TrendingDown,
  Sparkles,
  ArrowUpRight,
  LayoutDashboard,
} from 'lucide-react';
import { api } from '../api/client';
import type { DashboardStats, PriceStats } from '../types';
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

type DashboardTone = 'indigo' | 'sky' | 'violet' | 'emerald';

function DashboardKpi({
  icon: Icon,
  label,
  value,
  detail,
  progress,
  tone,
}: {
  icon: typeof Package;
  label: string;
  value: string | number;
  detail: string;
  progress?: number;
  tone: DashboardTone;
}) {
  const tones: Record<DashboardTone, { icon: string; bar: string }> = {
    indigo: { icon: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-500' },
    sky: { icon: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', bar: 'bg-sky-500' },
    violet: { icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', bar: 'bg-violet-500' },
    emerald: { icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  };

  return (
    <div className="group rounded-2xl border bg-background/65 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-background hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${tones[tone].icon}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all duration-500 ${tones[tone].bar}`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
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
  const [priceStats, setPriceStats] = useState<PriceStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [incompletePage, setIncompletePage] = useState(0);
  const navigate = useNavigate();

  const loadStats = useCallback(async () => {
    try {
      const [data, prices] = await Promise.all([api.getStats(), api.getPriceStats()]);
      setStats(data);
      setPriceStats(prices);
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

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadStats();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const interval = setInterval(loadStats, 30000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [loadStats]);

  if (error) {
    return (
      <div className="p-4 md:p-8 space-y-6">
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
      <div className="p-4 md:p-8 space-y-6">
        <PageHeader title="Dashboard" description="Übersicht über alle Produkte und Aktivitäten" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
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
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_32rem)]">
      <div className="mx-auto w-full max-w-[1920px] space-y-5 p-4 md:p-6 xl:px-8 xl:py-7 2xl:px-10">
        <section className="relative overflow-hidden rounded-3xl border bg-card/90 p-5 shadow-sm md:p-7">
          <div className="pointer-events-none absolute -right-20 -top-40 h-96 w-96 rounded-full bg-indigo-500/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
                <LayoutDashboard className="h-6 w-6" />
                <Sparkles className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-card p-0.5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Arbeitsübersicht</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">Produktqualität, Bereitschaft und aktuelle Vorgänge auf einen Blick.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {lastRefresh && <span className="mr-1 text-xs text-muted-foreground">Aktualisiert {formatRelativeTime(lastRefresh.toISOString().replace('Z', ''))}</span>}
              <Button variant="outline" className="bg-background/70" onClick={() => navigate('/import')}><Upload className="mr-2 h-4 w-4" />Import starten</Button>
              <Button variant="outline" className="bg-background/70" onClick={() => navigate('/products')}>Produkte öffnen<ArrowUpRight className="ml-2 h-4 w-4" /></Button>
              <Button onClick={handleManualRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Aktualisieren
              </Button>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardKpi icon={Package} label="Produkte" value={stats.products_total} detail={`${stats.products_active} aktiv · ${stats.products_archived} archiviert`} tone="indigo" />
            <DashboardKpi icon={ClipboardCheck} label="Stammdaten vollständig" value={`${stats.stammdaten_percent}%`} detail={`${stats.stammdaten_complete} von ${stats.products_active} Produkten`} progress={stats.stammdaten_percent} tone="sky" />
            <DashboardKpi icon={Tags} label="Attribut-Abdeckung" value={`${stats.attributes_percent}%`} detail={`${stats.attributes_with} Produkte mit Attributen`} progress={stats.attributes_percent} tone="violet" />
            <DashboardKpi icon={Rocket} label="Exportbereit" value={stats.export_ready} detail={`${stats.export_ready_percent}% aller aktiven Produkte`} progress={stats.export_ready_percent} tone="emerald" />
          </div>
        </section>

        <section className="rounded-3xl border bg-card/70 p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Datenqualität</h2>
              <p className="text-xs text-muted-foreground">Content, Auffindbarkeit und fehlende Produktangaben</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/quality')}>Qualität öffnen<ArrowUpRight className="ml-2 h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="rounded-2xl bg-background/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Content-Score</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.content_score_avg}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.content_complete} vollständig · {stats.content_partial} teilweise · {stats.content_empty} leer
            </p>
            <ProgressBar percent={stats.content_score_avg} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-background/70 shadow-sm">
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

        <Card className="rounded-2xl bg-background/70 shadow-sm">
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

        <Card className="rounded-2xl bg-background/70 shadow-sm">
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

        <Card className="rounded-2xl bg-background/70 shadow-sm">
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
        </section>

        {priceStats && (priceStats.avg_ek > 0 || priceStats.avg_vk > 0) && (
          <section className="rounded-3xl border bg-card/70 p-4 shadow-sm md:p-5">
            <div className="mb-4">
              <h2 className="font-semibold">Preise & Wirtschaftlichkeit</h2>
              <p className="text-xs text-muted-foreground">Durchschnittswerte und offene Preisangaben</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="rounded-2xl bg-background/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">⌀ EK-Preis</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{priceStats.avg_ek.toFixed(2)} €</div>
              <p className="text-xs text-muted-foreground mt-1">
                {priceStats.min_ek?.toFixed(2)} € – {priceStats.max_ek?.toFixed(2)} €
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-background/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">⌀ VK-Preis</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{priceStats.avg_vk.toFixed(2)} €</div>
              <p className="text-xs text-muted-foreground mt-1">
                {priceStats.min_vk?.toFixed(2)} € – {priceStats.max_vk?.toFixed(2)} €
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-background/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">⌀ Marge</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{priceStats.avg_margin.toFixed(2)} €</div>
              <p className="text-xs text-muted-foreground mt-1">
                {priceStats.avg_margin_percent}% Durchschnittsmarge
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-background/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Fehlende Preise</CardTitle>
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${(priceStats.products_without_ek + priceStats.products_without_vk) > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {priceStats.products_without_ek + priceStats.products_without_vk}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {priceStats.products_without_ek} ohne EK · {priceStats.products_without_vk} ohne VK
                {priceStats.products_negative_margin > 0 && (
                  <span className="text-red-600 dark:text-red-400"> · {priceStats.products_negative_margin} negative Marge</span>
                )}
              </p>
            </CardContent>
          </Card>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Left: Incomplete Products */}
        <Card className="rounded-3xl bg-card/90 shadow-sm">
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
        <Card className="rounded-3xl bg-card/90 shadow-sm">
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
    </div>
  );
}
