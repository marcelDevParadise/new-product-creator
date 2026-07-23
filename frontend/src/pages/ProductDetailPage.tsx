import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertTriangle, Wand2, Archive, History, Layers, CloudUpload, Package, CircleCheckBig, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import { AttributeWizard } from '../components/products/wizard/AttributeWizard';
import { api } from '../api/client';
import type { Product, AttributeConfig, ProductHistoryEntry, ArtikelwerkPreview, ArtikelwerkPublication } from '../types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WorkspaceHeader } from '../components/layout/WorkspaceHeader';

export function ProductDetailPage() {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [config, setConfig] = useState<AttributeConfig | null>(null);
  const [parentAttributes, setParentAttributes] = useState<Record<string, string | number | boolean> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'attributes' | 'history'>('attributes');
  const [history, setHistory] = useState<ProductHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [artikelwerkPreview, setArtikelwerkPreview] = useState<ArtikelwerkPreview | null>(null);
  const [artikelwerkStatus, setArtikelwerkStatus] = useState<ArtikelwerkPublication | null>(null);
  const [artikelwerkLoading, setArtikelwerkLoading] = useState(false);
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

  const handleArtikelwerkPreview = async () => {
    if (!product) return;
    setArtikelwerkLoading(true);
    try {
      setArtikelwerkPreview(await api.previewArtikelwerk(product.artikelnummer));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Artikelwerk-Prüfung fehlgeschlagen', 'error');
    } finally { setArtikelwerkLoading(false); }
  };

  const handleArtikelwerkPublish = async () => {
    if (!product) return;
    setArtikelwerkLoading(true);
    try {
      const result = await api.publishArtikelwerk(product.artikelnummer);
      toast(`Artikelwerk-Job mit ${result.steps} Schritten gestartet`, 'success');
      setArtikelwerkPreview(null);
      setArtikelwerkStatus({ artikelnummer: product.artikelnummer, status: 'queued' });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Veröffentlichung fehlgeschlagen', 'error');
    } finally { setArtikelwerkLoading(false); }
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
    api.getArtikelwerkPublication(decodedSku).then(setArtikelwerkStatus).catch(() => {});
  }, [sku]);

  // Fetch parent attributes if this is a variant child, for inheritance display.
  useEffect(() => {
    if (!product?.parent_sku) {
      setParentAttributes(undefined);
      return;
    }
    api.getProduct(product.parent_sku)
      .then(parent => setParentAttributes(parent.attributes))
      .catch(() => setParentAttributes(undefined));
  }, [product?.parent_sku]);

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
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_32rem)]">
      <div className="mx-auto w-full max-w-[1920px] space-y-5 p-4 md:p-6 xl:px-8 xl:py-7 2xl:px-10">
      <WorkspaceHeader
        eyebrow={`Produkt · ${product.artikelnummer}`}
        title={product.artikelname}
        description={[product.hersteller, product.ean ? `EAN ${product.ean}` : null, product.gewicht != null ? `${product.gewicht} g` : null].filter(Boolean).join(' · ') || 'Produktattribute und Historie verwalten.'}
        icon={Package}
        stats={[
          { label: 'Attribute', value: Object.keys(product.attributes).length, icon: Layers, tone: 'indigo' },
          { label: 'Stammdaten', value: product.stammdaten_complete ? 'Komplett' : 'Offen', icon: CircleCheckBig, tone: product.stammdaten_complete ? 'emerald' : 'amber' },
          { label: 'EK-Preis', value: product.ek != null ? `${product.ek.toFixed(2)} €` : '–', icon: Banknote, tone: 'sky' },
          { label: 'VK-Preis', value: product.preis != null ? `${product.preis.toFixed(2)} €` : '–', icon: Banknote, tone: 'violet' },
        ]}
        actions={<>
          <Button variant="outline" className="bg-background/70" onClick={() => navigate('/products')}><ChevronLeft className="mr-2 h-4 w-4" />Produkte</Button>
          {product.stammdaten_complete && (
            <Button variant="outline" onClick={handleSmartDefaults} className="shrink-0 gap-1.5 bg-background/70">
              <Wand2 className="w-3.5 h-3.5" />
              Smart Defaults
            </Button>
          )}
          {product.exported && (
            <Badge variant="secondary" className="shrink-0">Exportiert</Badge>
          )}
          {artikelwerkStatus && artikelwerkStatus.status !== 'not_published' && (
            <Badge variant="secondary" className="shrink-0">Artikelwerk: {artikelwerkStatus.status}</Badge>
          )}
          {!product.parent_sku && (
            <Button variant="outline" onClick={handleArtikelwerkPreview} disabled={artikelwerkLoading} className="shrink-0 gap-1.5 bg-background/70 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
              <CloudUpload className="w-3.5 h-3.5" />
              Artikelwerk
            </Button>
          )}
          <Button variant="outline" onClick={handleArchive} className="shrink-0 gap-1.5 bg-background/70 text-amber-600 border-amber-200 hover:bg-amber-50">
            <Archive className="w-3.5 h-3.5" />
            Archivieren
          </Button>
        </>}
      />

      <section className="rounded-3xl border bg-card/90 shadow-sm">
        {/* Tabs */}
        <div className="flex gap-1 border-b p-2">
          <button
            onClick={() => setTab('attributes')}
            className={`flex min-h-10 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'attributes' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Attribute
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex min-h-10 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'history' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Historie
          </button>
        </div>

        <div className="flex min-h-0 flex-col p-4 md:p-6">
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
                <div className="flex-1 min-h-0 flex flex-col">
                  <AttributeWizard
                    mode="product"
                    attributeConfig={config}
                    initialValues={product.attributes}
                    productTitle={product.artikelname}
                    inheritedValues={parentAttributes}
                    onSave={async (values) => {
                      const updated = await api.updateAttributes(product.artikelnummer, values);
                      setProduct(updated);
                      toast('Attribute gespeichert', 'success');
                    }}
                  />
                </div>
              )}
            </>
          )}

          {tab === 'history' && (
            <HistoryTab entries={history} loading={historyLoading} />
          )}
        </div>
      </section>
      </div>

      <Dialog open={artikelwerkPreview !== null} onOpenChange={open => { if (!open) setArtikelwerkPreview(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Artikelwerk-Veröffentlichung prüfen</DialogTitle>
            <DialogDescription>{artikelwerkPreview?.steps.length || 0} API-Schritte für {product.artikelnummer}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {artikelwerkPreview?.issues.length === 0 && <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">Keine Mapping-Probleme gefunden.</p>}
            {artikelwerkPreview?.issues.map((issue, index) => (
              <div key={`${issue.code}-${index}`} className={`rounded-lg border p-3 text-sm ${issue.severity === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                <span className="font-medium">{issue.code}</span>: {issue.message}
              </div>
            ))}
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium mb-2">Geplante Schritte</p>
              <div className="flex flex-wrap gap-1.5">
                {artikelwerkPreview?.steps.map(step => <Badge key={step.resource_key} variant="secondary">{step.operation}</Badge>)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArtikelwerkPreview(null)}>Abbrechen</Button>
            <Button onClick={handleArtikelwerkPublish} disabled={!artikelwerkPreview?.valid || artikelwerkLoading}>
              <CloudUpload className="w-4 h-4" />{artikelwerkLoading ? 'Startet…' : 'Veröffentlichen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <div className="max-w-4xl space-y-6">
      {Object.entries(grouped).map(([day, items]) => (
        <div key={day}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{day}</h3>
          <div className="space-y-2">
            {items.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-2xl border bg-background/70 px-4 py-3 shadow-sm">
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
