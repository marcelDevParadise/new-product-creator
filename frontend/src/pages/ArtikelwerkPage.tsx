import { useCallback, useEffect, useState } from 'react';
import { CloudUpload, RefreshCw, Save, Server, Clock3, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import type { ArtikelwerkConnection, ArtikelwerkContext, ArtikelwerkJob, ArtikelwerkSettings } from '../types';
import { WorkspaceHeader } from '../components/layout/WorkspaceHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '../components/ui/Toast';

const statusClass: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  publishing: 'bg-blue-100 text-blue-700',
  queued: 'bg-gray-100 text-gray-700',
  partial: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

export function ArtikelwerkPage() {
  const [connection, setConnection] = useState<ArtikelwerkConnection | null>(null);
  const [context, setContext] = useState<ArtikelwerkContext | null>(null);
  const [settings, setSettings] = useState<ArtikelwerkSettings | null>(null);
  const [jobs, setJobs] = useState<ArtikelwerkJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const [connectionResult, settingsResult, jobsResult] = await Promise.all([
      api.getArtikelwerkConnection(), api.getArtikelwerkSettings(), api.getArtikelwerkJobs(30),
    ]);
    setConnection(connectionResult);
    setSettings(settingsResult);
    setJobs(jobsResult);
    if (connectionResult.reachable) {
      api.getArtikelwerkContext().then(setContext).catch(() => setContext(null));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => api.getArtikelwerkJobs(30).then(setJobs).catch(() => {}), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      setSettings(await api.updateArtikelwerkSettings(settings));
      toast('Artikelwerk-Einstellungen gespeichert', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally { setSaving(false); }
  };

  const retry = async (job: ArtikelwerkJob) => {
    try {
      await api.retryArtikelwerkJob(job.job_id);
      toast(`Job für ${job.root_sku} erneut gestartet`, 'success');
      setJobs(await api.getArtikelwerkJobs(30));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Wiederholen fehlgeschlagen', 'error');
    }
  };

  const toggle = (key: keyof ArtikelwerkSettings) => {
    if (!settings || typeof settings[key] !== 'boolean') return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_32rem)]">
      <div className="mx-auto w-full max-w-[1920px] space-y-5 p-4 md:p-6 xl:px-8 xl:py-7 2xl:px-10">
      <WorkspaceHeader eyebrow="Integration" title="Artikelwerk" description="Direkte, wiederaufnehmbare Veröffentlichung über die Integrations-API." icon={CloudUpload}
        stats={[
          { label: 'Verbindung', value: connection?.reachable ? 'Online' : 'Offline', icon: Server, tone: connection?.reachable ? 'emerald' : 'amber' },
          { label: 'Jobs', value: jobs.length, icon: Clock3, tone: 'sky' },
          { label: 'Fehler', value: jobs.filter(job => job.status === 'failed' || job.status === 'partial').length, icon: AlertCircle, tone: 'amber' },
        ]}
        actions={<Button variant="outline" className="bg-background/70" onClick={() => load()} disabled={loading}><RefreshCw className="w-4 h-4" /> Aktualisieren</Button>} />

      <section className="space-y-3 rounded-3xl border bg-card/90 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Server className="w-5 h-5 text-indigo-600" /><h3 className="font-semibold">Verbindung</h3></div>
          <Badge className={connection?.reachable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
            {connection?.reachable ? 'Verbunden' : connection?.configured ? 'Nicht erreichbar' : 'Nicht konfiguriert'}
          </Badge>
        </div>
        <p className="text-sm text-gray-500">{connection?.base_url || 'ARTIKELWERK_BASE_URL und ARTIKELWERK_API_KEY im Backend setzen.'}</p>
        {connection?.provider && <p className="text-sm">Provider: <span className="font-medium">{connection.provider}</span></p>}
        {connection?.error && <p className="text-sm text-red-600">{connection.error}{connection.request_id ? ` · Request ${connection.request_id}` : ''}</p>}
      </section>

      {settings && (
        <section className="space-y-5 rounded-3xl border bg-card/90 p-5 shadow-sm">
          <div><h3 className="font-semibold">Veröffentlichungseinstellungen</h3><p className="text-sm text-gray-500">Der geheime API-Key wird hier bewusst nicht angezeigt.</p></div>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="text-sm">Mandanten
              <select multiple className="mt-1 w-full min-h-24 rounded-lg border p-2" value={settings.tenant_ids.map(String)}
                onChange={e => setSettings({ ...settings, tenant_ids: Array.from(e.target.selectedOptions).map(o => Number(o.value)) })}>
                {(context?.context.tenants || []).map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
              </select>
            </label>
            <label className="text-sm">Sprach-ID<input type="number" min={0} className="mt-1 w-full rounded-lg border px-3 py-2" value={settings.language_id} onChange={e => setSettings({ ...settings, language_id: Number(e.target.value) })} /></label>
            <label className="text-sm">Plattform-ID<input type="number" min={0} className="mt-1 w-full rounded-lg border px-3 py-2" value={settings.platform_id} onChange={e => setSettings({ ...settings, platform_id: Number(e.target.value) })} /></label>
            <label className="text-sm">Kundengruppen-ID<input type="number" min={1} className="mt-1 w-full rounded-lg border px-3 py-2" value={settings.customer_group_id} onChange={e => setSettings({ ...settings, customer_group_id: Number(e.target.value) })} /></label>
            <label className="text-sm">Währung<input maxLength={3} className="mt-1 w-full rounded-lg border px-3 py-2 uppercase" value={settings.currency} onChange={e => setSettings({ ...settings, currency: e.target.value.toUpperCase() })} /></label>
            <label className="text-sm">Steuersatz (%)<input type="number" min={0} max={100} step="0.01" className="mt-1 w-full rounded-lg border px-3 py-2" value={settings.tax_rate} onChange={e => setSettings({ ...settings, tax_rate: Number(e.target.value) })} /></label>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {([
              ['inventory_tracking', 'Bestandsführung aktivieren'], ['publish_descriptions', 'Beschreibungen'],
              ['publish_attributes', 'Attribute'], ['publish_images', 'Bilder'],
              ['publish_base_price', 'Grundpreis'], ['publish_variants', 'Varianten'],
              ['publish_price', 'Verkaufspreis'], ['publish_purchase', 'Lieferant und EK'],
              ['publish_manufacturer', 'Hersteller'], ['publish_categories', 'Kategorien'],
            ] as [keyof ArtikelwerkSettings, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(settings[key])} onChange={() => toggle(key)} />{label}</label>
            ))}
          </div>
          <Button onClick={save} disabled={saving}><Save className="w-4 h-4" />{saving ? 'Speichert…' : 'Speichern'}</Button>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border bg-card/90 shadow-sm">
        <div className="p-5 border-b"><h3 className="font-semibold">Veröffentlichungsjobs</h3><p className="text-sm text-gray-500">Der Status wird automatisch aktualisiert.</p></div>
        {jobs.length === 0 ? <p className="p-5 text-sm text-gray-500">Noch keine Veröffentlichungen.</p> : (
          <div className="divide-y">{jobs.map(job => (
            <div key={job.job_id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-40 flex-1"><p className="font-mono text-sm font-medium">{job.root_sku}</p><p className="text-xs text-gray-500">{job.current_phase || '–'} · {job.progress_current}/{job.progress_total}</p></div>
              <Badge className={statusClass[job.status] || 'bg-gray-100 text-gray-700'}>{job.status}</Badge>
              {(job.status === 'failed' || job.status === 'partial') && <Button size="sm" variant="outline" onClick={() => retry(job)}>Wiederholen</Button>}
              {job.last_error && <p className="w-full text-xs text-red-600">{job.last_error}</p>}
            </div>
          ))}</div>
        )}
      </section>
      </div>
    </div>
  );
}
