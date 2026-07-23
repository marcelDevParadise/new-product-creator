import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Copy, RefreshCw, ScrollText, Search } from 'lucide-react';
import { api } from '../api/client';
import type { ArtikelwerkLogJob } from '../types';
import { WorkspaceHeader } from '../components/layout/WorkspaceHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/Toast';

const statusStyle: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  publishing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  queued: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  succeeded: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  pending: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};

function formatTime(value: string | null): string {
  if (!value) return '–';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return new Date(normalized).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusStyle[status] || statusStyle.queued}>{status}</Badge>;
}

export function ArtikelwerkLogsPage() {
  const [jobs, setJobs] = useState<ArtikelwerkLogJob[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getArtikelwerkLogs({ limit, status: status || undefined, search: search.trim() || undefined });
      setJobs(result.items);
      setTotal(result.total);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Artikelwerk-Logs konnten nicht geladen werden', 'error');
    } finally {
      setLoading(false);
    }
  }, [limit, search, status, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => { load(); }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => { load(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => ({
    failed: jobs.filter(job => job.status === 'failed' || job.status === 'partial').length,
    active: jobs.filter(job => job.status === 'queued' || job.status === 'publishing').length,
    published: jobs.filter(job => job.status === 'published').length,
  }), [jobs]);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast('Request-ID kopiert', 'success');
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_32rem)]">
      <div className="mx-auto w-full max-w-[1920px] space-y-5 p-4 md:p-6 xl:px-8 xl:py-7 2xl:px-10">
      <WorkspaceHeader
        eyebrow="Artikelwerk Integration"
        title="Logs"
        description="Nachvollziehbare API-Schritte für Veröffentlichungen von Artikeln an Artikelwerk."
        icon={ScrollText}
        stats={[
          { label: 'Fehler', value: counts.failed, icon: AlertCircle, tone: 'amber' },
          { label: 'Aktiv', value: counts.active, icon: Clock3, tone: 'sky' },
          { label: 'Veröffentlicht', value: counts.published, icon: CheckCircle2, tone: 'emerald' },
        ]}
        actions={<Button variant="outline" className="bg-background/70" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren</Button>}
      />

      <div className="flex flex-col gap-3 rounded-3xl border bg-card/90 p-4 shadow-sm sm:flex-row sm:items-center md:p-5">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm" value={search} onChange={event => setSearch(event.target.value)} placeholder="SKU, Job-ID, Fehlercode oder Request-ID suchen …" />
        </label>
        <select className="rounded-lg border bg-background px-3 py-2 text-sm" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">Alle Status</option><option value="errors">Nur Fehler</option><option value="published">Veröffentlicht</option><option value="publishing">Wird veröffentlicht</option><option value="queued">Warteschlange</option>
        </select>
        <select className="rounded-lg border bg-background px-3 py-2 text-sm" value={limit} onChange={event => setLimit(Number(event.target.value))}>
          <option value={50}>50 Jobs</option><option value={100}>100 Jobs</option><option value={250}>250 Jobs</option><option value={500}>500 Jobs</option>
        </select>
        <Badge variant="outline">{jobs.length} von {total}</Badge>
      </div>

      <div className="space-y-3">
        {!loading && jobs.length === 0 && <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground"><ScrollText className="mx-auto mb-3 h-8 w-8 opacity-40" />Keine passenden Artikelwerk-Logs vorhanden.</div>}
        {jobs.map(job => {
          const hasError = job.status === 'failed' || job.status === 'partial';
          return (
            <details key={job.job_id} open={hasError} className="group rounded-3xl border bg-card/90 shadow-sm">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                <div className="min-w-40 flex-1"><p className="font-mono text-sm font-semibold">{job.root_sku}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatTime(job.created_at)} · Job {job.job_id.slice(0, 8)}</p></div>
                <span className="text-xs text-muted-foreground">{job.current_phase || '–'} · {job.progress_current}/{job.progress_total}</span>
                <StatusBadge status={job.status} />
                <span className="text-xs text-muted-foreground group-open:rotate-180">⌄</span>
              </summary>
              <div className="space-y-4 border-t p-4">
                {job.last_error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"><p className="font-medium">Fehler in {job.current_phase || 'unbekannter Phase'}</p><p className="mt-1 break-words font-mono text-xs">{job.last_error}</p></div>}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[850px] text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-3 py-2">API-Schritt</th><th className="px-3 py-2">Ressource</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Versuche</th><th className="px-3 py-2">Fehlercode</th><th className="px-3 py-2">Request-ID</th><th className="px-3 py-2">Zeitpunkt</th></tr></thead>
                    <tbody className="divide-y">
                      {job.operations.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Noch kein API-Schritt protokolliert.</td></tr>}
                      {job.operations.map(operation => <tr key={operation.operation_id} className={operation.status === 'failed' ? 'bg-red-50/60 dark:bg-red-950/20' : ''}>
                        <td className="px-3 py-2 font-mono font-medium">{operation.operation_type}</td><td className="px-3 py-2 font-mono text-muted-foreground">{operation.resource_key}</td><td className="px-3 py-2"><StatusBadge status={operation.status} /></td><td className="px-3 py-2">{operation.attempts}</td><td className="px-3 py-2 font-mono text-red-600">{operation.error_code || '–'}</td>
                        <td className="px-3 py-2">{operation.request_id ? <button className="inline-flex items-center gap-1 font-mono text-indigo-600 hover:underline" onClick={() => copy(operation.request_id!)}>{operation.request_id}<Copy className="h-3 w-3" /></button> : '–'}</td><td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatTime(operation.updated_at)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          );
        })}
      </div>
      </div>
    </div>
  );
}
