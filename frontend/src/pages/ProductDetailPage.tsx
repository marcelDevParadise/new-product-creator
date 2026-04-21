import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, AlertTriangle, Wand2, Archive, History, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import { AttributeEditor } from '../components/products/AttributeEditor';
import { api } from '../api/client';
import type { Product, AttributeConfig, ProductHistoryEntry } from '../types';

export function ProductDetailPage() {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [config, setConfig] = useState<AttributeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'attributes' | 'history'>('attributes');
  const [history, setHistory] = useState<ProductHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { toast } = useToast();

  const handleSmartDefaults = async () => {
    if (!product) return;
    try {
      const { applied, product: updated } = await api.applySmartDefaults(product.artikelnummer);
      setProduct(updated);
      toast(applied > 0 ? `${applied} Attribute automatisch gesetzt` : 'Keine Smart Defaults gefunden', applied > 0 ? 'success' : 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Smart Defaults fehlgeschlagen', 'error');
    }
  };

  const handleArchive = async () => {
    if (!product) return;
    try {
      await api.archiveProducts([product.artikelnummer]);
      toast('Produkt archiviert', 'success');
      navigate('/products');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Archivieren fehlgeschlagen', 'error');
    }
  };

  useEffect(() => {
    if (!sku) return;
    const decodedSku = decodeURIComponent(sku);
    Promise.all([api.getProduct(decodedSku), api.getAttributeConfig()])
      .then(([p, c]) => {
        setProduct(p);
        setConfig(c);
      })
      .catch((e) => setError(e.message));
  }, [sku]);

  useEffect(() => {
    if (tab !== 'history' || !product) return;
    setHistoryLoading(true);
    api.getProductHistory(product.artikelnummer)
      .then(setHistory)
      .catch(() => toast('Historie konnte nicht geladen werden', 'error'))
      .finally(() => setHistoryLoading(false));
  }, [tab, product]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive max-w-md text-center">
          {error}
        </div>
      </div>
    );
  }

  if (!product || !config) {
    return <LoadingSpinner className="h-full" />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-8 py-4 border-b bg-white">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <button onClick={() => navigate('/products')} className="hover:text-foreground transition-colors">
            Produkte
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{product.artikelnummer}</span>
        </nav>
        <div className="flex-1" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold truncate">{product.artikelname}</h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground font-mono">{product.artikelnummer}</span>
            {product.ek != null && (
              <span className="text-xs text-muted-foreground">EK {product.ek.toFixed(2)} €</span>
            )}
            {product.preis != null && (
              <span className="text-xs text-muted-foreground">VK {product.preis.toFixed(2)} €</span>
            )}
            {product.gewicht != null && (
              <span className="text-xs text-muted-foreground">{product.gewicht} g</span>
            )}
            {product.hersteller && (
              <span className="text-xs text-muted-foreground">{product.hersteller}</span>
            )}
            {product.ean && (
              <span className="text-xs text-muted-foreground font-mono">{product.ean}</span>
            )}
          </div>
        </div>
        {product.stammdaten_complete && (
          <Button variant="outline" size="sm" onClick={handleSmartDefaults} className="shrink-0 gap-1.5">
            <Wand2 className="w-3.5 h-3.5" />
            Smart Defaults
          </Button>
        )}
        {product.exported && (
          <Badge variant="secondary" className="shrink-0">Exportiert</Badge>
        )}
        <Button variant="outline" size="sm" onClick={handleArchive} className="shrink-0 gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50">
          <Archive className="w-3.5 h-3.5" />
          Archivieren
        </Button>
      </div>

      <div className="flex-1 overflow-auto flex flex-col">
        {/* Tabs */}
        <div className="px-8 pt-4 flex gap-1 border-b bg-white">
          <button
            onClick={() => setTab('attributes')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
              tab === 'attributes' ? 'bg-gray-50 border border-b-white -mb-px text-indigo-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Attribute
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
              tab === 'history' ? 'bg-gray-50 border border-b-white -mb-px text-indigo-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Historie
          </button>
        </div>

        <div className="flex-1 overflow-auto p-8">
          {tab === 'attributes' && (
            <>
              {!product.stammdaten_complete ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <AlertTriangle className="w-10 h-10 text-amber-400" />
                  <p className="text-sm text-gray-600 text-center max-w-md">
                    Die Stammdaten für dieses Produkt sind noch nicht vollständig ausgefüllt.
                    Bitte zuerst die Stammdaten vervollständigen.
                  </p>
                  <Button
                    onClick={() => navigate(`/stammdaten/${encodeURIComponent(product.artikelnummer)}`)}
                    className="mt-2"
                  >
                    Stammdaten bearbeiten
                  </Button>
                </div>
              ) : (
                <AttributeEditor
                  product={product}
                  attributeConfig={config}
                  onSaved={(updated) => setProduct(updated)}
                />
              )}
            </>
          )}

          {tab === 'history' && (
            <HistoryTab entries={history} loading={historyLoading} />
          )}
        </div>
      </div>
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Erstellt',
  import_update: 'Import-Aktualisierung',
  stammdaten_update: 'Stammdaten geändert',
  bulk_stammdaten: 'Bulk-Stammdaten',
  attribute_update: 'Attribut geändert',
  attribute_removed: 'Attribut entfernt',
  bulk_attribute: 'Bulk-Attribut',
  smart_default: 'Smart Default',
  template_applied: 'Vorlage angewendet',
  archived: 'Archiviert',
  unarchived: 'Wiederhergestellt',
  deleted: 'Gelöscht',
};

const EVENT_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  import_update: 'bg-blue-100 text-blue-700',
  stammdaten_update: 'bg-indigo-100 text-indigo-700',
  bulk_stammdaten: 'bg-indigo-100 text-indigo-700',
  attribute_update: 'bg-violet-100 text-violet-700',
  attribute_removed: 'bg-red-100 text-red-700',
  bulk_attribute: 'bg-violet-100 text-violet-700',
  smart_default: 'bg-amber-100 text-amber-700',
  template_applied: 'bg-teal-100 text-teal-700',
  archived: 'bg-gray-100 text-gray-600',
  unarchived: 'bg-green-100 text-green-700',
  deleted: 'bg-red-100 text-red-700',
};

function HistoryTab({ entries, loading }: { entries: ProductHistoryEntry[]; loading: boolean }) {
  if (loading) return <LoadingSpinner className="h-40" />;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
        <History className="w-10 h-10" />
        <p className="text-sm">Noch keine Änderungen erfasst</p>
      </div>
    );
  }

  // Group entries by date
  const grouped: Record<string, ProductHistoryEntry[]> = {};
  for (const e of entries) {
    const day = (new Date(e.created_at + 'Z')).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    (grouped[day] ??= []).push(e);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {Object.entries(grouped).map(([day, items]) => (
        <div key={day}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{day}</h3>
          <div className="space-y-2">
            {items.map((e) => (
              <div key={e.id} className="flex items-start gap-3 bg-white border rounded-lg px-4 py-3">
                <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${EVENT_COLORS[e.event_type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {EVENT_LABELS[e.event_type] ?? e.event_type}
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  {e.field && (
                    <span className="font-medium text-gray-700">{e.field}</span>
                  )}
                  {e.old_value != null && e.new_value != null && (
                    <span className="text-gray-500">
                      {' '}<span className="line-through text-red-400">{truncate(e.old_value)}</span>
                      {' → '}<span className="text-green-600">{truncate(e.new_value)}</span>
                    </span>
                  )}
                  {e.old_value != null && e.new_value == null && (
                    <span className="text-red-400 line-through ml-1">{truncate(e.old_value)}</span>
                  )}
                  {e.old_value == null && e.new_value != null && (
                    <span className="text-green-600 ml-1">{truncate(e.new_value)}</span>
                  )}
                  {e.detail && !e.field && (
                    <span className="text-gray-600">{e.detail}</span>
                  )}
                  {e.detail && e.field && (
                    <span className="text-gray-400 ml-2 text-xs">({e.detail})</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {(new Date(e.created_at + 'Z')).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function truncate(val: string, max = 80) {
  return val.length > max ? val.slice(0, max) + '…' : val;
}
