import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBlocker, Link } from 'react-router-dom';
import { Save, ArrowRight, ChevronRight, GitBranch, ArrowDownFromLine, X, Copy } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { CategoryCascader } from '../components/ui/CategoryCascader';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import { VariantMatrix } from '../components/products/VariantMatrix';
import { slugify } from '../lib/utils';
import type { Product, CategoryTree, VariantenSettings } from '../types';

const EINHEITEN_FALLBACK = ['ml', 'l', 'g', 'kg', 'cm', 'm', 'mm', 'Stück', 'm²', 'm³'];

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
const selectCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children, hint, inherited, parentValue, onClearOwn }: {
  label: string; children: React.ReactNode; hint?: string;
  inherited?: boolean; parentValue?: string; onClearOwn?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-xs font-medium text-gray-600">{label}</label>
        {inherited && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-600 rounded-full">
            <ArrowDownFromLine className="w-3 h-3" />
            Geerbt{parentValue ? `: ${parentValue}` : ''}
          </span>
        )}
        {onClearOwn && !inherited && (
          <button
            type="button"
            onClick={onClearOwn}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors"
            title="Eigenen Wert entfernen → vom Parent erben"
          >
            <X className="w-3 h-3" />
            Eigener Wert
          </button>
        )}
      </div>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

type Form = {
  artikelname: string;
  ek: string; preis: string; gewicht: string; hersteller: string; ean: string;
  laenge: string; breite: string; hoehe: string;
  verkaufseinheit: string; inhalt_menge: string; inhalt_einheit: string;
  grundpreis_ausweisen: boolean;
  bezugsmenge: string; bezugsmenge_einheit: string;
  lieferant_name: string; lieferant_artikelnummer: string; lieferant_artikelname: string; lieferant_netto_ek: string;
  bild_1: string; bild_2: string; bild_3: string; bild_4: string; bild_5: string; bild_6: string; bild_7: string; bild_8: string; bild_9: string;
  kategorie_1: string; kategorie_2: string; kategorie_3: string; kategorie_4: string; kategorie_5: string; kategorie_6: string;
  url_pfad: string; title_tag: string; meta_description: string;
};

function initForm(p: Product): Form {
  const s = (v: string | null | undefined) => v ?? '';
  const n = (v: number | null | undefined) => (v != null ? String(v) : '');
  return {
    artikelname: p.artikelname, ek: n(p.ek), preis: n(p.preis), gewicht: n(p.gewicht), hersteller: s(p.hersteller), ean: s(p.ean),
    laenge: n(p.laenge), breite: n(p.breite), hoehe: n(p.hoehe),
    verkaufseinheit: n(p.verkaufseinheit), inhalt_menge: n(p.inhalt_menge), inhalt_einheit: s(p.inhalt_einheit),
    grundpreis_ausweisen: p.grundpreis_ausweisen,
    bezugsmenge: n(p.bezugsmenge), bezugsmenge_einheit: s(p.bezugsmenge_einheit),
    lieferant_name: s(p.lieferant_name), lieferant_artikelnummer: s(p.lieferant_artikelnummer), lieferant_artikelname: s(p.lieferant_artikelname), lieferant_netto_ek: n(p.lieferant_netto_ek),
    bild_1: s(p.bild_1), bild_2: s(p.bild_2), bild_3: s(p.bild_3), bild_4: s(p.bild_4), bild_5: s(p.bild_5), bild_6: s(p.bild_6), bild_7: s(p.bild_7), bild_8: s(p.bild_8), bild_9: s(p.bild_9),
    kategorie_1: s(p.kategorie_1), kategorie_2: s(p.kategorie_2), kategorie_3: s(p.kategorie_3), kategorie_4: s(p.kategorie_4), kategorie_5: s(p.kategorie_5), kategorie_6: s(p.kategorie_6),
    url_pfad: s(p.url_pfad), title_tag: s(p.title_tag), meta_description: s(p.meta_description),
  };
}

export function StammdatenEditPage() {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<Form | null>(null);
  const [dirty, setDirty] = useState(false);
  const [categoryTree, setCategoryTree] = useState<CategoryTree>({});
  const [einheiten, setEinheiten] = useState<string[]>(EINHEITEN_FALLBACK);
  const [inheritFields, setInheritFields] = useState<string[]>([]);
  const [parentProduct, setParentProduct] = useState<Product | null>(null);
  const [childProducts, setChildProducts] = useState<Product[]>([]);
  const [inheritedFieldSet, setInheritedFieldSet] = useState<Set<string>>(new Set());
  const [resolvedParentValues, setResolvedParentValues] = useState<Record<string, string>>({});
  const [variantAxes, setVariantAxes] = useState<string[]>([]);

  const markDirty = () => setDirty(true);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF((prev) => prev ? { ...prev, [key]: e.target.value } : prev);
    markDirty();
  };

  // Inheritance helpers for child products
  const isChild = !!product?.parent_sku;
  const fieldInherit = (fieldName: string) => {
    if (!isChild) return {};
    const inherited = inheritedFieldSet.has(fieldName);
    const parentVal = resolvedParentValues[fieldName];
    const hasOwnValue = !inherited && inheritFields.includes(fieldName);
    return {
      inherited,
      parentValue: inherited ? parentVal : undefined,
      onClearOwn: hasOwnValue ? () => {
        setF(prev => prev ? { ...prev, [fieldName]: '' } : prev);
        setInheritedFieldSet(prev => new Set([...prev, fieldName]));
        markDirty();
      } : undefined,
    };
  };

  // Block navigation when form is dirty
  const blocker = useBlocker(dirty && !saving);

  // Warn on browser close/refresh
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Ctrl+S shortcut
  const handleSaveRef = useRef<((andContinue: boolean) => void) | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current?.(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!sku) return;
    api.getProduct(decodeURIComponent(sku))
      .then((p) => {
        setProduct(p);
        setF(initForm(p));
        // Load variant context
        if (p.parent_sku) {
          api.getProduct(p.parent_sku).then(setParentProduct).catch(() => {});
          api.getResolvedProduct(p.artikelnummer).then(res => {
            setInheritedFieldSet(new Set(res.inherited_fields));
            // Build map of parent values for inherited fields
            const parentVals: Record<string, string> = {};
            for (const field of res.inherited_fields) {
              const val = (res.product as Record<string, unknown>)[field];
              if (val != null && val !== '') parentVals[field] = String(val);
            }
            setResolvedParentValues(parentVals);
          }).catch(() => {});
        }
        if (p.is_parent) {
          api.getVariantGroup(p.artikelnummer).then(g => {
            setChildProducts(g.children);
            setVariantAxes(g.variant_axes || []);
          }).catch(() => {});
        }
      })
      .catch((e) => setError(e.message));
  }, [sku]);

  useEffect(() => {
    api.getCategoryTree().then(setCategoryTree).catch(() => {});
    api.getEinheiten().then(setEinheiten).catch(() => {});
    api.getVariantenSettings().then((s: VariantenSettings) => setInheritFields(s.inherit_fields)).catch(() => {});
  }, []);

  const handleEkChange = async (value: string) => {
    setF((prev) => prev ? { ...prev, ek: value } : prev);
    markDirty();
    const parsed = parseFloat(value.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      try {
        const { vk } = await api.calculateVk(parsed);
        if (vk != null) setF((prev) => prev ? { ...prev, ek: value, preis: String(vk) } : prev);
      } catch { /* ignore */ }
    }
  };

  const handleSave = useCallback(async (andContinue: boolean) => {
    if (!product || !f) return;
    setSaving(true);
    try {
      const num = (v: string) => v.trim() ? parseFloat(v.replace(',', '.')) : null;
      const str = (v: string) => v.trim() || null;
      const payload: Record<string, string | number | boolean | null> = {
        artikelname: f.artikelname,
        ek: num(f.ek), preis: num(f.preis), gewicht: num(f.gewicht),
        hersteller: str(f.hersteller), ean: str(f.ean),
        laenge: num(f.laenge), breite: num(f.breite), hoehe: num(f.hoehe),
        verkaufseinheit: num(f.verkaufseinheit), inhalt_menge: num(f.inhalt_menge), inhalt_einheit: str(f.inhalt_einheit),
        grundpreis_ausweisen: f.grundpreis_ausweisen,
        bezugsmenge: num(f.bezugsmenge), bezugsmenge_einheit: str(f.bezugsmenge_einheit),
        lieferant_name: str(f.lieferant_name), lieferant_artikelnummer: str(f.lieferant_artikelnummer),
        lieferant_artikelname: str(f.lieferant_artikelname), lieferant_netto_ek: num(f.lieferant_netto_ek),
        bild_1: str(f.bild_1), bild_2: str(f.bild_2), bild_3: str(f.bild_3), bild_4: str(f.bild_4), bild_5: str(f.bild_5),
        bild_6: str(f.bild_6), bild_7: str(f.bild_7), bild_8: str(f.bild_8), bild_9: str(f.bild_9),
        kategorie_1: str(f.kategorie_1), kategorie_2: str(f.kategorie_2), kategorie_3: str(f.kategorie_3),
        kategorie_4: str(f.kategorie_4), kategorie_5: str(f.kategorie_5), kategorie_6: str(f.kategorie_6),
        url_pfad: str(f.url_pfad), title_tag: str(f.title_tag), meta_description: str(f.meta_description),
        stammdaten_complete: true,
      };
      await api.updateStammdaten(product.artikelnummer, payload);
      setDirty(false);
      toast('Stammdaten gespeichert', 'success');
      navigate(andContinue ? `/products/${encodeURIComponent(product.artikelnummer)}` : '/stammdaten');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  }, [product, f, navigate, toast]);

  // Keep ref in sync for Ctrl+S
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600 max-w-md text-center">{error}</div>
      </div>
    );
  }

  if (!product || !f) {
    return <LoadingSpinner className="h-full" />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Blocker dialog for unsaved changes */}
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="Ungespeicherte Änderungen"
          message="Es gibt ungespeicherte Änderungen. Möchtest du die Seite wirklich verlassen?"
          confirmLabel="Verlassen"
          variant="danger"
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}

      {/* Header with breadcrumb */}
      <div className="shrink-0 px-8 pt-6 pb-4">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
          <button onClick={() => navigate('/stammdaten')} className="hover:text-gray-900 transition-colors">
            Stammdaten
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-900 font-medium truncate max-w-[300px]">{product.artikelnummer}</span>
        </nav>
        <PageHeader
          title={product.artikelname}
          description={`Stammdaten für ${product.artikelnummer} bearbeiten`}
          actions={
            <button
              onClick={async () => {
                try {
                  const cloned = await api.cloneProduct(product.artikelnummer);
                  toast(`Geklont als ${cloned.artikelnummer}`, 'success');
                  navigate(`/stammdaten/${encodeURIComponent(cloned.artikelnummer)}`);
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Klonen fehlgeschlagen', 'error');
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Klonen
            </button>
          }
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {/* Variant info banner */}
        {product.parent_sku && parentProduct && (
          <div className="mb-4 flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
            <GitBranch className="w-5 h-5 text-purple-500 shrink-0" />
            <div className="text-sm">
              <span className="text-purple-700 dark:text-purple-300">Variante von </span>
              <Link
                to={`/stammdaten/${encodeURIComponent(parentProduct.artikelnummer)}`}
                className="font-medium text-purple-700 dark:text-purple-300 hover:underline"
              >
                {parentProduct.artikelnummer} — {parentProduct.artikelname}
              </Link>
              {Object.keys(product.variant_attributes).length > 0 && (
                <span className="ml-2 inline-flex gap-1">
                  {Object.entries(product.variant_attributes).map(([k, v]) => (
                    <span key={k} className="px-2 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-800/40 text-purple-600 dark:text-purple-300 rounded-full">
                      {k}: {v}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
        )}
        {product.is_parent && (
          <div className="mb-4">
            <VariantMatrix
              parentSku={product.artikelnummer}
              childProducts={childProducts}
              variantAxes={variantAxes}
              onChildCreated={() => {
                api.getVariantGroup(product.artikelnummer).then(g => {
                  setChildProducts(g.children);
                  setVariantAxes(g.variant_axes || []);
                }).catch(() => {});
              }}
              onChildRemoved={() => {
                api.getVariantGroup(product.artikelnummer).then(g => {
                  setChildProducts(g.children);
                  setVariantAxes(g.variant_axes || []);
                }).catch(() => {});
              }}
            />
          </div>
        )}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ───── Allgemein ───── */}
          <Section title="Allgemein">
            <Field label="Artikelname" {...fieldInherit('artikelname')}>
              <input className={inputCls} value={f.artikelname} onChange={set('artikelname')} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="EK (Netto)" {...fieldInherit('ek')}>
                <input className={inputCls} value={f.ek} onChange={(e) => handleEkChange(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="VK (Brutto)" hint="Wird aus EK berechnet" {...fieldInherit('preis')}>
                <input className={`${inputCls} bg-gray-50`} value={f.preis} onChange={set('preis')} placeholder="wird berechnet" />
              </Field>
            </div>
            <Field label="Hersteller" {...fieldInherit('hersteller')}>
              <input className={inputCls} value={f.hersteller} onChange={set('hersteller')} />
            </Field>
            <Field label="GTIN / EAN" {...fieldInherit('ean')}>
              <input className={`${inputCls} font-mono`} value={f.ean} onChange={set('ean')} placeholder="z.B. 4260605481234" />
            </Field>
          </Section>

          {/* ───── Maße / Gewicht ───── */}
          <Section title="Maße / Gewicht">
            <Field label="Gewicht (g)" {...fieldInherit('gewicht')}>
              <input className={inputCls} value={f.gewicht} onChange={set('gewicht')} placeholder="0" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Länge (cm)" {...fieldInherit('laenge')}>
                <input className={inputCls} value={f.laenge} onChange={set('laenge')} placeholder="0" />
              </Field>
              <Field label="Breite (cm)" {...fieldInherit('breite')}>
                <input className={inputCls} value={f.breite} onChange={set('breite')} placeholder="0" />
              </Field>
              <Field label="Höhe (cm)" {...fieldInherit('hoehe')}>
                <input className={inputCls} value={f.hoehe} onChange={set('hoehe')} placeholder="0" />
              </Field>
            </div>
          </Section>

          {/* ───── Grundpreis ───── */}
          <Section title="Grundpreis">
            <Field label="Verkaufseinheit">
              <input className={inputCls} value={f.verkaufseinheit} onChange={set('verkaufseinheit')} placeholder="1" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Inhalt / Menge">
                <input className={inputCls} value={f.inhalt_menge} onChange={set('inhalt_menge')} placeholder="0" />
              </Field>
              <Field label="Maßeinheit">
                <select className={selectCls} value={f.inhalt_einheit} onChange={set('inhalt_einheit')}>
                  <option value="">– wählen –</option>
                  {einheiten.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="grundpreis_ausweisen"
                checked={f.grundpreis_ausweisen}
                onChange={(e) => { setF((prev) => prev ? { ...prev, grundpreis_ausweisen: e.target.checked } : prev); markDirty(); }}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="grundpreis_ausweisen" className="text-sm text-gray-700 select-none">Grundpreis ausweisen</label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bezugsmenge">
                <input className={inputCls} value={f.bezugsmenge} onChange={set('bezugsmenge')} placeholder="1" />
              </Field>
              <Field label="Maßeinheit">
                <select className={selectCls} value={f.bezugsmenge_einheit} onChange={set('bezugsmenge_einheit')}>
                  <option value="">– wählen –</option>
                  {einheiten.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* ───── Lieferant ───── */}
          <Section title="Lieferant">
            <Field label="Name">
              <input className={inputCls} value={f.lieferant_name} onChange={set('lieferant_name')} />
            </Field>
            <Field label="Artikelnummer">
              <input className={`${inputCls} font-mono`} value={f.lieferant_artikelnummer} onChange={set('lieferant_artikelnummer')} />
            </Field>
            <Field label="Artikelname">
              <input className={inputCls} value={f.lieferant_artikelname} onChange={set('lieferant_artikelname')} />
            </Field>
            <Field label="Netto-EK" hint="Kann aus den Stammdaten EK übernommen werden">
              <div className="flex gap-2">
                <input className={`${inputCls} flex-1`} value={f.lieferant_netto_ek} onChange={set('lieferant_netto_ek')} placeholder="0,00" />
                <button
                  type="button"
                  onClick={() => { setF((prev) => prev ? { ...prev, lieferant_netto_ek: prev.ek } : prev); markDirty(); }}
                  className="px-3 py-2 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
                >
                  Aus EK
                </button>
              </div>
            </Field>
          </Section>

          {/* ───── Bilder ───── */}
          <Section title="Bilder">
            <div className="space-y-3">
              {([1,2,3,4,5,6,7,8,9] as const).map((i) => {
                const key = `bild_${i}` as keyof Form;
                const url = f[key] as string;
                const isUrl = url && (url.startsWith('http://') || url.startsWith('https://'));
                return (
                  <Field key={i} label={`Bild ${i} Pfad / URL`} {...fieldInherit(`bild_${i}`)}>
                    <div className="flex gap-2 items-start">
                      <input className={`${inputCls} font-mono text-xs flex-1`} value={url} onChange={set(key)} placeholder="https:// oder C:\..." />
                      {isUrl && (
                        <div className="group relative shrink-0">
                          <img
                            src={url}
                            alt={`Bild ${i}`}
                            className="w-10 h-10 rounded border border-gray-200 object-cover cursor-pointer"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden w-10 h-10 rounded border border-red-200 bg-red-50 flex items-center justify-center text-red-400 text-xs">✗</div>
                          <div className="hidden group-hover:block absolute z-50 right-0 top-12 p-1 bg-white rounded-lg shadow-xl border border-gray-200">
                            <img
                              src={url}
                              alt={`Bild ${i} Vorschau`}
                              className="max-w-[240px] max-h-[240px] rounded object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                            />
                          </div>
                        </div>
                      )}
                      {url && !isUrl && (
                        <div className="w-10 h-10 rounded border border-amber-200 bg-amber-50 flex items-center justify-center shrink-0" title="Kein gültiger URL">
                          <span className="text-amber-500 text-xs">⚠</span>
                        </div>
                      )}
                    </div>
                  </Field>
                );
              })}
            </div>
            {/* Image summary */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {([1,2,3,4,5,6,7,8,9] as const).filter((i) => (f[`bild_${i}` as keyof Form] as string)?.trim()).length} von 9 Bildern hinterlegt
              </p>
            </div>
          </Section>

          {/* ───── Kategorien ───── */}
          <Section title="Kategorien">
            <CategoryCascader
              tree={categoryTree}
              values={[
                f.kategorie_1, f.kategorie_2, f.kategorie_3,
                f.kategorie_4, f.kategorie_5, f.kategorie_6,
              ]}
              onChange={(level, value) => {
                setF((prev) => {
                  if (!prev) return prev;
                  const updated = { ...prev };
                  const keys: (keyof Form)[] = ['kategorie_1', 'kategorie_2', 'kategorie_3', 'kategorie_4', 'kategorie_5', 'kategorie_6'];
                  updated[keys[level]] = value as never;
                  // Reset all levels below the changed one
                  for (let i = level + 1; i < 6; i++) {
                    updated[keys[i]] = '' as never;
                  }
                  return updated;
                });
                markDirty();
              }}
            />
          </Section>

          {/* ───── SEO ───── */}
          <Section title="SEO">
            <div className="space-y-3">
              <Field label="URL-Pfad">
                <div className="flex gap-2">
                  <input className={`${inputCls} font-mono text-xs flex-1`} value={f.url_pfad} onChange={set('url_pfad')} placeholder="z. B. lovense-lush-3" />
                  <button
                    type="button"
                    className="px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700 dark:hover:bg-indigo-900/50 whitespace-nowrap"
                    onClick={() => { if (f.artikelname) { setF(prev => prev ? { ...prev, url_pfad: slugify(f.artikelname) } : prev); markDirty(); } }}
                    title="URL-Pfad aus Artikelname generieren"
                  >
                    Auto
                  </button>
                </div>
              </Field>
              <Field label="Title Tag (SEO)">
                <div className="space-y-1">
                  <input className={inputCls} value={f.title_tag} onChange={set('title_tag')} placeholder="Max. 60 Zeichen empfohlen" />
                  <p className={`text-xs ${f.title_tag.length > 60 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{f.title_tag.length}/60 Zeichen</p>
                </div>
              </Field>
              <Field label="Meta-Description (SEO)">
                <div className="space-y-1">
                  <textarea className={`${inputCls} resize-y`} rows={2} value={f.meta_description} onChange={set('meta_description')} placeholder="Max. 155 Zeichen empfohlen" />
                  <p className={`text-xs ${f.meta_description.length > 155 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{f.meta_description.length}/155 Zeichen</p>
                </div>
              </Field>
              <div className="pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => navigate(`/content/${encodeURIComponent(product.artikelnummer)}`)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Beschreibungen bearbeiten (HTML-Editor) →
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
      <div className="shrink-0 flex items-center justify-between px-8 py-4 bg-white border-t border-gray-200">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Speichern
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          Speichern & Attribute bearbeiten
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
