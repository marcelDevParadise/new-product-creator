import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  CloudUpload,
  GitCompareArrows,
  History,
  Package,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  ArtikelwerkBusinessDiff,
  ArtikelwerkConnection,
  ArtikelwerkContext,
  ArtikelwerkJob,
  ArtikelwerkSettings,
  ArtikelwerkSyncDetail,
  ArtikelwerkSyncItem,
  ArtikelwerkSyncOverview,
} from '../types';
import { WorkspaceHeader } from '../components/layout/WorkspaceHeader';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/Toast';

const syncStatus: Record<string, { label: string; className: string; description: string }> = {
  in_sync: {
    label: 'Synchron',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    description: 'Lokaler Stand und die aktuell gelesenen JTL-Daten stimmen überein.',
  },
  local_changed: {
    label: 'Lokale Änderungen',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    description: 'Seit der letzten Übertragung wurden lokale Produktdaten geändert.',
  },
  jtl_changed: {
    label: 'In JTL geändert',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    description: 'Die JTL-RowVersion hat sich seit der letzten Übertragung verändert.',
  },
  conflict: {
    label: 'Konflikt',
    className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    description: 'Sowohl lokal als auch in JTL wurden Daten seit der letzten Übertragung geändert.',
  },
  blocked: {
    label: 'Blockiert',
    className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    description: 'Fachliche Probleme verhindern eine sichere Übertragung.',
  },
  not_published: {
    label: 'Noch nicht übertragen',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
    description: 'Für dieses Produkt ist noch kein entfernter JTL-Artikel verknüpft.',
  },
  remote_missing: {
    label: 'In JTL nicht gefunden',
    className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    description: 'Die gespeicherte Remote-ID existiert im ausgewählten JTL-Mandanten nicht mehr.',
  },
};

const directionMeta: Record<ArtikelwerkBusinessDiff['direction'], { label: string; className: string }> = {
  same: { label: 'Gleich', className: 'bg-emerald-100 text-emerald-700' },
  local_to_jtl: { label: 'Lokal → JTL', className: 'bg-sky-100 text-sky-700' },
  jtl_changed: { label: 'In JTL geändert', className: 'bg-amber-100 text-amber-800' },
  conflict: { label: 'Konflikt', className: 'bg-red-100 text-red-700' },
  jtl_only: { label: 'Nur in JTL', className: 'bg-violet-100 text-violet-700' },
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '–';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (typeof value === 'number') return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 }).format(value);
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(', ') : '–';
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${displayValue(item)}`)
      .join(' · ');
  }
  return String(value);
}

function versionValue(value: string | null): string {
  return value || 'Noch nicht erfasst';
}

function summaryStatus(item: ArtikelwerkSyncItem): { label: string; className: string } {
  if (item.publication_status === 'failed' || item.publication_status === 'partial') {
    return { label: 'Fehler', className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' };
  }
  if (item.publication_status === 'queued' || item.publication_status === 'publishing') {
    return { label: 'In Warteschlange', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' };
  }
  if (item.local_changed_since_sync) {
    return { label: 'Lokale Änderungen', className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' };
  }
  if (item.publication_status === 'published') {
    return { label: 'JTL-Prüfung möglich', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' };
  }
  return { label: 'Nicht übertragen', className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300' };
}

export function ArtikelwerkPage() {
  const [connection, setConnection] = useState<ArtikelwerkConnection | null>(null);
  const [context, setContext] = useState<ArtikelwerkContext | null>(null);
  const [settings, setSettings] = useState<ArtikelwerkSettings | null>(null);
  const [overview, setOverview] = useState<ArtikelwerkSyncOverview | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArtikelwerkSyncDetail | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'changes' | 'errors' | 'unpublished'>('all');
  const [showEqual, setShowEqual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadDetail = useCallback(async (sku: string) => {
    setSelectedSku(sku);
    setDetailLoading(true);
    try {
      setDetail(await api.getArtikelwerkSyncDetail(sku));
    } catch (error) {
      setDetail(null);
      toast(error instanceof Error ? error.message : 'JTL-Vergleich konnte nicht geladen werden', 'error');
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  const load = useCallback(async (keepSelection = true) => {
    setLoading(true);
    try {
      const [connectionResult, settingsResult, overviewResult] = await Promise.all([
        api.getArtikelwerkConnection(),
        api.getArtikelwerkSettings(),
        api.getArtikelwerkSyncOverview(),
      ]);
      setConnection(connectionResult);
      setSettings(settingsResult);
      setOverview(overviewResult);
      if (connectionResult.reachable) {
        api.getArtikelwerkContext().then(setContext).catch(() => setContext(null));
      }
      const preferred = keepSelection && selectedSku
        ? overviewResult.items.find(item => item.artikelnummer === selectedSku)
        : overviewResult.items.find(item =>
          item.publication_status === 'failed'
          || item.publication_status === 'partial'
          || item.local_changed_since_sync
        ) || overviewResult.items[0];
      if (preferred && connectionResult.reachable) await loadDetail(preferred.artikelnummer);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Synchronisationscenter konnte nicht geladen werden', 'error');
    } finally {
      setLoading(false);
    }
  }, [loadDetail, selectedSku, toast]);

  useEffect(() => { load(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (overview?.items || []).filter(item => {
      if (query && !`${item.artikelnummer} ${item.artikelname}`.toLowerCase().includes(query)) return false;
      if (filter === 'changes') return item.local_changed_since_sync;
      if (filter === 'errors') return item.publication_status === 'failed' || item.publication_status === 'partial';
      if (filter === 'unpublished') return item.publication_status === 'not_published';
      return true;
    });
  }, [filter, overview, search]);

  const visibleDiff = useMemo(
    () => (detail?.diff || []).filter(item => showEqual || !item.equal),
    [detail, showEqual],
  );

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      setSettings(await api.updateArtikelwerkSettings(settings));
      toast('Artikelwerk-Einstellungen gespeichert', 'success');
      if (selectedSku) await loadDetail(selectedSku);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  };

  const retry = async (job: ArtikelwerkJob) => {
    setRetrying(true);
    try {
      await api.retryArtikelwerkJob(job.job_id);
      toast(`Job für ${job.root_sku} erneut eingeplant`, 'success');
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Wiederholen fehlgeschlagen', 'error');
    } finally {
      setRetrying(false);
    }
  };

  const toggle = (key: keyof ArtikelwerkSettings) => {
    if (!settings || typeof settings[key] !== 'boolean') return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const detailStatus = detail ? syncStatus[detail.sync_status] : null;
  const failedJob = detail?.latest_job
    && ['failed', 'partial'].includes(detail.latest_job.status)
    ? detail.latest_job
    : null;

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_32rem)]">
      <div className="mx-auto w-full max-w-[2200px] space-y-5 p-4 md:p-6 xl:px-8 xl:py-7">
        <WorkspaceHeader
          eyebrow="Artikelwerk Integration"
          title="JTL-Synchronisationscenter"
          description="Lokale Produktdaten fachlich mit dem tatsächlich gelesenen JTL-Stand vergleichen."
          icon={GitCompareArrows}
          stats={[
            { label: 'Verbindung', value: connection?.reachable ? 'Online' : 'Offline', icon: Server, tone: connection?.reachable ? 'emerald' : 'amber' },
            { label: 'In JTL', value: overview?.counts.published || 0, icon: CheckCircle2, tone: 'emerald' },
            { label: 'Lokale Änderungen', value: overview?.counts.local_changes || 0, icon: History, tone: 'sky' },
            { label: 'Fehler', value: overview?.counts.failed || 0, icon: AlertCircle, tone: 'amber' },
          ]}
          actions={
            <Button variant="outline" className="bg-background/70" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Übersicht aktualisieren
            </Button>
          }
        />

        {!connection?.reachable && !loading && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>Kein Live-Vergleich möglich.</strong>{' '}
            {connection?.error || 'Artikelwerk ist nicht konfiguriert oder nicht erreichbar.'}
          </section>
        )}

        {loading && !overview ? <LoadingSpinner className="min-h-96" /> : (
          <div className="grid min-h-[42rem] gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl border bg-card/90 shadow-sm">
              <div className="space-y-3 border-b p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="SKU oder Produkt suchen …" className="pl-9" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['all', 'Alle'],
                    ['changes', 'Geändert'],
                    ['errors', 'Fehler'],
                    ['unpublished', 'Neu'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${filter === value ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {filteredItems.map(item => {
                  const status = summaryStatus(item);
                  return (
                    <button
                      type="button"
                      key={item.artikelnummer}
                      onClick={() => loadDetail(item.artikelnummer)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${selectedSku === item.artikelnummer ? 'border-indigo-400 bg-indigo-500/5 ring-2 ring-indigo-500/10' : 'border-transparent hover:bg-muted/60'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.artikelname}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.artikelnummer}</p>
                        </div>
                        {item.is_group && <Package className="h-4 w-4 shrink-0 text-violet-500" />}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Badge className={status.className}>{status.label}</Badge>
                        {item.last_synced_revision && <span className="truncate font-mono text-[9px] text-muted-foreground">{item.last_synced_revision}</span>}
                      </div>
                    </button>
                  );
                })}
                {filteredItems.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Keine passenden Produkte.</p>}
              </div>
            </aside>

            <main className="min-w-0 space-y-4">
              {detailLoading ? <LoadingSpinner className="min-h-96 rounded-3xl border bg-card/90" /> : !detail ? (
                <section className="flex min-h-96 items-center justify-center rounded-3xl border bg-card/90 p-8 text-center text-sm text-muted-foreground">
                  Wähle ein Produkt aus, um den Live-Stand aus JTL zu lesen.
                </section>
              ) : (
                <>
                  <section className="rounded-3xl border bg-card/90 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{detail.artikelnummer}</p>
                        <h2 className="mt-1 text-xl font-semibold">{detail.artikelname}</h2>
                        {detailStatus && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{detailStatus.description}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {detailStatus && <Badge className={detailStatus.className}>{detailStatus.label}</Badge>}
                        <Button variant="outline" size="sm" onClick={() => navigate(`/stammdaten/${encodeURIComponent(detail.artikelnummer)}`)}>
                          Produkt öffnen<ArrowRight className="h-4 w-4" />
                        </Button>
                        {failedJob && (
                          <Button size="sm" onClick={() => retry(failedJob)} disabled={retrying}>
                            <RotateCcw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />Job wiederholen
                          </Button>
                        )}
                      </div>
                    </div>

                    {(detail.versions.remote_changed_since_sync || detail.sync_status === 'conflict') && (
                      <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                          <p className="font-semibold">JTL wurde seit der letzten Übertragung verändert.</p>
                          <p className="mt-1">
                            Prüfe die markierten Felder. Eine erneute Übertragung könnte diese JTL-Änderungen überschreiben.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Zuletzt übertragen</p>
                        <p className="mt-1 break-all font-mono text-xs">{versionValue(detail.versions.last_synced)}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Aktuell in JTL</p>
                        <p className="mt-1 break-all font-mono text-xs">{versionValue(detail.versions.current_jtl)}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Zeitpunkt</p>
                        <p className="mt-1 text-xs">{detail.versions.last_synced_at || 'Noch kein Snapshot gespeichert'}</p>
                      </div>
                    </div>
                  </section>

                  {detail.issues.length > 0 && (
                    <section className="space-y-3 rounded-3xl border border-red-200 bg-card/90 p-5 shadow-sm">
                      <div className="flex items-center gap-2"><Wrench className="h-5 w-5 text-red-600" /><h3 className="font-semibold">Fachliche Probleme</h3></div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {detail.issues.map((issue, index) => (
                          <div key={`${issue.code}-${index}`} className={`rounded-2xl border p-4 ${issue.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold">{issue.area}</p>
                              <Badge variant="secondary">{issue.code}</Badge>
                            </div>
                            <p className="mt-2 text-sm"><strong>Ursache:</strong> {issue.cause}</p>
                            <p className="mt-1 text-sm"><strong>Lösung:</strong> {issue.recommended_action}</p>
                            {issue.message !== issue.cause && <p className="mt-2 text-xs text-muted-foreground">{issue.message}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="overflow-hidden rounded-3xl border bg-card/90 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                      <div>
                        <h3 className="font-semibold">Fachlicher Vergleich</h3>
                        <p className="text-sm text-muted-foreground">Nicht nur Requests, sondern verständliche Produktwerte auf beiden Seiten.</p>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={showEqual} onChange={event => setShowEqual(event.target.checked)} />
                        Gleiche Werte anzeigen
                      </label>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px] text-sm">
                        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Bereich / Feld</th>
                            <th className="px-4 py-3">Lokal</th>
                            <th className="px-4 py-3">Aktuell in JTL</th>
                            <th className="px-4 py-3">Bewertung</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {visibleDiff.map(item => {
                            const direction = directionMeta[item.direction];
                            return (
                              <tr key={item.field} className={item.direction === 'conflict' ? 'bg-red-50/60 dark:bg-red-500/5' : ''}>
                                <td className="px-4 py-3">
                                  <p className="font-medium">{item.label}</p>
                                  <p className="text-[11px] text-muted-foreground">{item.area}</p>
                                </td>
                                <td className="max-w-xs px-4 py-3 align-top">{displayValue(item.local_value)}</td>
                                <td className="max-w-xs px-4 py-3 align-top">{displayValue(item.jtl_value)}</td>
                                <td className="px-4 py-3"><Badge className={direction.className}>{direction.label}</Badge></td>
                              </tr>
                            );
                          })}
                          {visibleDiff.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-sm text-emerald-700">Alle verglichenen Fachwerte stimmen überein.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-3xl border bg-card/90 p-5 shadow-sm">
                    <div className="flex items-center gap-2"><CloudUpload className="h-5 w-5 text-indigo-600" /><h3 className="font-semibold">Geplante Änderungen bei der nächsten Übertragung</h3></div>
                    <p className="mt-1 text-sm text-muted-foreground">{detail.planned_changes.length} fachliche Schritte in verbindlicher Reihenfolge.</p>
                    <div className="mt-4 grid gap-2 lg:grid-cols-2">
                      {detail.planned_changes.map(change => (
                        <details key={`${change.order}-${change.resource_key}`} className="rounded-2xl border bg-background/60 p-3">
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center gap-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">{change.order}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{change.label}</p>
                                <p className="truncate text-[11px] text-muted-foreground">{change.area} · {change.resource_key}</p>
                              </div>
                            </div>
                          </summary>
                          <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 text-[10px] text-slate-100">{JSON.stringify(change.payload, null, 2)}</pre>
                        </details>
                      ))}
                      {detail.planned_changes.length === 0 && <p className="text-sm text-muted-foreground">Keine Übertragungsschritte geplant.</p>}
                    </div>
                  </section>
                </>
              )}
            </main>
          </div>
        )}

        {settings && (
          <details className="rounded-3xl border bg-card/90 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5">
              <Settings2 className="h-5 w-5 text-indigo-600" />
              <div>
                <h3 className="font-semibold">Synchronisationseinstellungen</h3>
                <p className="text-sm text-muted-foreground">Mandanten und übertragene Datenbereiche konfigurieren.</p>
              </div>
            </summary>
            <div className="space-y-5 border-t p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm">Mandanten
                  <select
                    multiple
                    className="mt-1 min-h-24 w-full rounded-lg border bg-background p-2"
                    value={settings.tenant_ids.map(String)}
                    onChange={event => setSettings({
                      ...settings,
                      tenant_ids: Array.from(event.target.selectedOptions).map(option => Number(option.value)),
                    })}
                  >
                    {(context?.context.tenants || []).map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.id})</option>)}
                  </select>
                </label>
                <label className="text-sm">Sprach-ID
                  <Input type="number" min={0} className="mt-1" value={settings.language_id} onChange={event => setSettings({ ...settings, language_id: Number(event.target.value) })} />
                </label>
                <label className="text-sm">Plattform-ID
                  <Input type="number" min={0} className="mt-1" value={settings.platform_id} onChange={event => setSettings({ ...settings, platform_id: Number(event.target.value) })} />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  ['inventory_tracking', 'Bestandsführung aktivieren'],
                  ['publish_descriptions', 'Beschreibungen & SEO'],
                  ['publish_attributes', 'Attribute'],
                  ['publish_images', 'Bilder'],
                  ['publish_base_price', 'Grundpreis'],
                  ['publish_variants', 'Varianten'],
                  ['publish_price', 'Verkaufspreis'],
                  ['publish_purchase', 'Lieferant und EK'],
                  ['publish_manufacturer', 'Hersteller'],
                  ['publish_categories', 'Kategorien'],
                ] as [keyof ArtikelwerkSettings, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(settings[key])} onChange={() => toggle(key)} />{label}
                  </label>
                ))}
              </div>
              <Button onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? 'Speichert …' : 'Einstellungen speichern'}</Button>
            </div>
          </details>
        )}

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card/90 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CircleDot className="h-5 w-5 text-indigo-600" />
            <div><p className="font-semibold">Technische Einzelprotokolle</p><p className="text-sm text-muted-foreground">Request-IDs, Operationen und Rohfehler bleiben separat nachvollziehbar.</p></div>
          </div>
          <Button variant="outline" onClick={() => navigate('/logs')}>Logs öffnen<ArrowRight className="h-4 w-4" /></Button>
        </section>
      </div>
    </div>
  );
}
