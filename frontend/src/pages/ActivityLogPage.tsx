import { useEffect, useState, useCallback } from 'react';
import {
  Upload,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { api } from '../api/client';
import type { ActivityLog } from '../types';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

function formatTime(isoString: string): string {
  const date = new Date(isoString + 'Z');
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const eventConfig: Record<string, { icon: typeof Upload; color: string; label: string }> = {
  import: { icon: Upload, color: 'text-emerald-600 bg-emerald-50', label: 'Import' },
  export_ameise: { icon: Download, color: 'text-blue-600 bg-blue-50', label: 'Ameise Export' },
  export_stammdaten: { icon: Download, color: 'text-indigo-600 bg-indigo-50', label: 'Stammdaten Export' },
  product_created: { icon: Plus, color: 'text-emerald-600 bg-emerald-50', label: 'Erstellt' },
  product_deleted: { icon: Trash2, color: 'text-red-600 bg-red-50', label: 'Gelöscht' },
};

export function ActivityLogPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getActivities(limit);
      setActivities(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Aktivitätsprotokoll"
        description="Alle Aktivitäten im Überblick"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Aktivitätsprotokoll' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{activities.length} Einträge</Badge>
          <select
            className="text-xs border rounded px-2 py-1"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="text-right">Anzahl</TableHead>
              <TableHead className="text-right">Zeitpunkt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Noch keine Aktivitäten vorhanden.
                </TableCell>
              </TableRow>
            )}
            {activities.map((a, i) => {
              const cfg = eventConfig[a.event_type] ?? {
                icon: Activity,
                color: 'text-gray-600 bg-gray-50',
                label: a.event_type,
              };
              const Icon = cfg.icon;
              return (
                <TableRow key={i}>
                  <TableCell>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{a.detail || '—'}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{a.count}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{formatTime(a.created_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
