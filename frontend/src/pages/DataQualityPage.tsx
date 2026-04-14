import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, Search, Filter } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { api } from '../api/client';
import type { ValidationResult, ProductValidation } from '../types';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const severityConfig = {
  ok: { label: 'OK', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', badge: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50' },
  warning: { label: 'Warnung', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', badge: 'bg-amber-50 text-amber-700 hover:bg-amber-50' },
  error: { label: 'Fehler', icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-50 text-red-700 hover:bg-red-50' },
};

export function DataQualityPage() {
  const [data, setData] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning' | 'ok'>('all');
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.getValidation();
      setData(result);
    } catch {
      // handled by empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.products;
    if (filterSeverity !== 'all') {
      list = list.filter((p) => p.severity === filterSeverity);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) => p.artikelnummer.toLowerCase().includes(q) || p.artikelname.toLowerCase().includes(q)
      );
    }
    // Sort: errors first, then warnings, then ok
    const order = { error: 0, warning: 1, ok: 2 };
    return [...list].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [data, filterSeverity, searchQuery]);

  if (loading) {
    return (
      <div className="p-8">
        <PageHeader title="Datenqualität" description="Prüfe deine Produktdaten auf Fehler und Warnungen" />
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <PageHeader title="Datenqualität" description="Prüfe deine Produktdaten auf Fehler und Warnungen" />
        <p className="text-gray-500 text-sm">Keine Daten verfügbar.</p>
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Datenqualität" description="Prüfe deine Produktdaten auf Fehler und Warnungen" />
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Gesamt</CardTitle>
            <ShieldCheck className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.total_products}</div>
            <p className="text-xs text-gray-500 mt-1">{stats.ok_percent}% fehlerfrei</p>
            <div className="h-2 w-full rounded-full bg-gray-100 mt-3">
              <div className="h-2 rounded-full bg-emerald-600 transition-all duration-500" style={{ width: `${stats.ok_percent}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm cursor-pointer hover:bg-emerald-50/50 transition-colors" onClick={() => setFilterSeverity(filterSeverity === 'ok' ? 'all' : 'ok')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Fehlerfrei</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{stats.ok_count}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm cursor-pointer hover:bg-amber-50/50 transition-colors" onClick={() => setFilterSeverity(filterSeverity === 'warning' ? 'all' : 'warning')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Warnungen</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{stats.warning_count}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm cursor-pointer hover:bg-red-50/50 transition-colors" onClick={() => setFilterSeverity(filterSeverity === 'error' ? 'all' : 'error')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Fehler</CardTitle>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.error_count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Issues */}
      {stats.top_issues.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Häufigste Probleme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.top_issues.map((issue) => (
                <Badge key={issue.field} variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                  {issue.field}: {issue.count}×
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SKU oder Name suchen…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as typeof filterSeverity)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Alle Status</option>
            <option value="error">Nur Fehler</option>
            <option value="warning">Nur Warnungen</option>
            <option value="ok">Nur Fehlerfrei</option>
          </select>
        </div>
        <span className="text-xs text-gray-500">{filtered.length} Produkte</span>
      </div>

      {/* Product Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Status</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Artikelname</TableHead>
                <TableHead className="text-right">Fehler</TableHead>
                <TableHead className="text-right">Warnungen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const cfg = severityConfig[p.severity];
                const Icon = cfg.icon;
                const isExpanded = expandedSku === p.artikelnummer;
                return (
                  <ProductRow
                    key={p.artikelnummer}
                    product={p}
                    cfg={cfg}
                    Icon={Icon}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedSku(isExpanded ? null : p.artikelnummer)}
                    onNavigate={() => navigate(`/stammdaten/${encodeURIComponent(p.artikelnummer)}`)}
                  />
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-sm text-gray-500">
                    {filterSeverity !== 'all' || searchQuery ? 'Keine Produkte gefunden.' : 'Keine Produkte vorhanden.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ProductRow({
  product,
  cfg,
  Icon,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  product: ProductValidation;
  cfg: typeof severityConfig.ok;
  Icon: typeof CheckCircle2;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <TableCell>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.bg}`}>
            <Icon className={`w-4 h-4 ${cfg.color}`} />
          </div>
        </TableCell>
        <TableCell className="font-mono text-xs">{product.artikelnummer}</TableCell>
        <TableCell className="max-w-[250px] truncate">{product.artikelname}</TableCell>
        <TableCell className="text-right">
          {product.error_count > 0 && (
            <Badge variant="secondary" className="bg-red-50 text-red-700 hover:bg-red-50">{product.error_count}</Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          {product.warning_count > 0 && (
            <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50">{product.warning_count}</Badge>
          )}
        </TableCell>
      </TableRow>
      {isExpanded && product.issues.length > 0 && (
        <TableRow>
          <TableCell colSpan={5} className="bg-gray-50 px-6 py-3">
            <div className="space-y-2">
              {product.issues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${issue.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div>
                    <span className="font-mono text-xs text-gray-500 mr-2">{issue.field}</span>
                    <span className="text-gray-700">{issue.message}</span>
                    {issue.suggested_fix && (
                      <span className="text-gray-400 ml-2">→ {issue.suggested_fix}</span>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate(); }}
                className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Stammdaten bearbeiten →
              </button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
