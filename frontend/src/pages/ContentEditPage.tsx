import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { Save, ChevronLeft, FileText, Plus, X, CheckCircle2, Tags } from 'lucide-react';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/Toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader';
import { Button } from '@/components/ui/button';
import { HtmlEditor } from '@/components/ui/HtmlEditor';
import type { Product } from '@/types';

export function ContentEditPage() {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [kurzbeschreibung, setKurzbeschreibung] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');

  // Block navigation when dirty
  const blocker = useBlocker(dirty && !saving);

  // Warn on browser close/refresh
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Ctrl+S shortcut
  const handleSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Load product
  useEffect(() => {
    if (!sku) return;
    api.getProduct(decodeURIComponent(sku))
      .then((p) => {
        setProduct(p);
        setKurzbeschreibung(p.kurzbeschreibung ?? '');
        setBeschreibung(p.beschreibung ?? '');
        setSeoKeywords(p.seo_keywords ? p.seo_keywords.split(',').map(k => k.trim()).filter(Boolean) : []);
      })
      .catch((e) => setError(e.message));
  }, [sku]);

  const handleSave = useCallback(async () => {
    if (!product) return;
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {
        kurzbeschreibung: kurzbeschreibung.trim() || null,
        beschreibung: beschreibung.trim() || null,
        seo_keywords: seoKeywords.length > 0 ? seoKeywords.join(', ') : null,
      };
      await api.updateStammdaten(product.artikelnummer, payload);
      setDirty(false);
      toast('Beschreibungen gespeichert', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  }, [product, kurzbeschreibung, beschreibung, seoKeywords, toast]);

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

  if (!product) {
    return <LoadingSpinner className="h-full" />;
  }

  const contentFields = [product.artikelname, kurzbeschreibung, beschreibung, product.title_tag, product.meta_description];
  const contentScore = contentFields.filter((value) => Boolean(value?.trim())).length;

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_32rem)]">
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

      <div className="mx-auto w-full max-w-[1920px] space-y-5 p-4 pb-24 md:p-6 md:pb-24 xl:px-8 xl:py-7 xl:pb-24 2xl:px-10">
        <WorkspaceHeader
          eyebrow={`Content · ${product.artikelnummer}`}
          title={product.artikelname}
          description="Kurzbeschreibung, ausführlichen Produkttext und SEO-Keywords bearbeiten."
          icon={FileText}
          stats={[
            { label: 'Content-Score', value: `${contentScore}/5`, icon: CheckCircle2, tone: contentScore === 5 ? 'emerald' : 'amber' },
            { label: 'SEO-Keywords', value: seoKeywords.length, icon: Tags, tone: 'violet' },
            { label: 'Status', value: dirty ? 'Geändert' : 'Gespeichert', icon: Save, tone: dirty ? 'amber' : 'emerald' },
          ]}
          actions={<Button variant="outline" className="bg-background/70" onClick={() => navigate(`/stammdaten/${encodeURIComponent(product.artikelnummer)}`)}><ChevronLeft className="mr-2 h-4 w-4" />Stammdaten</Button>}
        />

      {/* Content */}
      <div className="rounded-3xl border bg-card/90 p-5 shadow-sm md:p-7">
        <div className="max-w-5xl space-y-8">
          {/* Kurzbeschreibung */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Kurzbeschreibung</label>
            <HtmlEditor
              content={kurzbeschreibung}
              onChange={(html) => { setKurzbeschreibung(html); setDirty(true); }}
              placeholder="Kurzbeschreibung verfassen …"
              minHeight="120px"
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Beschreibung</label>
            <HtmlEditor
              content={beschreibung}
              onChange={(html) => { setBeschreibung(html); setDirty(true); }}
              placeholder="Ausführliche Produktbeschreibung eingeben …"
              minHeight="300px"
            />
          </div>

          {/* SEO Keywords */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">SEO Keywords</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {seoKeywords.map((kw, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-full text-sm"
                >
                  {kw}
                  <button
                    onClick={() => { setSeoKeywords(seoKeywords.filter((_, j) => j !== i)); setDirty(true); }}
                    className="hover:text-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newKeyword.trim()) {
                    e.preventDefault();
                    if (!seoKeywords.includes(newKeyword.trim())) {
                      setSeoKeywords([...seoKeywords, newKeyword.trim()]);
                      setDirty(true);
                    }
                    setNewKeyword('');
                  }
                }}
                placeholder="Keyword eingeben + Enter…"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={() => {
                  if (newKeyword.trim() && !seoKeywords.includes(newKeyword.trim())) {
                    setSeoKeywords([...seoKeywords, newKeyword.trim()]);
                    setDirty(true);
                    setNewKeyword('');
                  }
                }}
                disabled={!newKeyword.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 z-20 flex shrink-0 flex-col-reverse gap-3 border-t bg-background/90 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-4">
        <button
          onClick={() => navigate(`/stammdaten/${encodeURIComponent(product.artikelnummer)}`)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Zurück zu Stammdaten
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Speichern
        </button>
      </div>
    </div>
  );
}
