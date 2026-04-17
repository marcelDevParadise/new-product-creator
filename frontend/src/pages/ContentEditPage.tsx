import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { Save, ChevronRight, Code, Eye, FileText, Plus, X } from 'lucide-react';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/Toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/layout/PageHeader';
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

  const [showSourceKurz, setShowSourceKurz] = useState(false);
  const [showSourceBeschr, setShowSourceBeschr] = useState(false);

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

  return (
    <div className="h-full flex flex-col">
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

      {/* Header */}
      <div className="shrink-0 px-8 pt-6 pb-4">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
          <button onClick={() => navigate('/stammdaten')} className="hover:text-gray-900 transition-colors">
            Stammdaten
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <button onClick={() => navigate(`/stammdaten/${encodeURIComponent(product.artikelnummer)}`)} className="hover:text-gray-900 transition-colors">
            {product.artikelnummer}
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-900 font-medium">Beschreibungen</span>
        </nav>
        <PageHeader
          title={product.artikelname}
          description="Kurzbeschreibung & Beschreibung als HTML bearbeiten"
        />
        {(() => {
          const fields = [
            { label: 'Artikelname', ok: !!product.artikelname?.trim() },
            { label: 'Kurzbeschreibung', ok: !!kurzbeschreibung.trim() },
            { label: 'Beschreibung', ok: !!beschreibung.trim() },
            { label: 'Title Tag', ok: !!product.title_tag?.trim() },
            { label: 'Meta-Description', ok: !!product.meta_description?.trim() },
          ];
          const score = fields.filter(f => f.ok).length;
          const missing = fields.filter(f => !f.ok);
          return (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className={`text-sm font-semibold ${score === 5 ? 'text-emerald-600' : score >= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                  Content-Score: {score}/5
                </span>
              </div>
              {missing.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {missing.map(f => (
                    <span key={f.label} className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 px-2 py-0.5 rounded-full">
                      {f.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="max-w-4xl space-y-8">
          {/* Kurzbeschreibung */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Kurzbeschreibung</label>
              <button
                type="button"
                onClick={() => setShowSourceKurz((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showSourceKurz ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                {showSourceKurz ? 'Editor' : 'HTML-Quelltext'}
              </button>
            </div>
            {showSourceKurz ? (
              <textarea
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                rows={6}
                value={kurzbeschreibung}
                onChange={(e) => { setKurzbeschreibung(e.target.value); setDirty(true); }}
                placeholder="<p>HTML-Quelltext eingeben…</p>"
              />
            ) : (
              <HtmlEditor
                content={kurzbeschreibung}
                onChange={(html) => { setKurzbeschreibung(html); setDirty(true); }}
                placeholder="Kurze Produktbeschreibung eingeben…"
                minHeight="120px"
              />
            )}
          </div>

          {/* Beschreibung */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Beschreibung</label>
              <button
                type="button"
                onClick={() => setShowSourceBeschr((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showSourceBeschr ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                {showSourceBeschr ? 'Editor' : 'HTML-Quelltext'}
              </button>
            </div>
            {showSourceBeschr ? (
              <textarea
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                rows={14}
                value={beschreibung}
                onChange={(e) => { setBeschreibung(e.target.value); setDirty(true); }}
                placeholder="<p>HTML-Quelltext eingeben…</p>"
              />
            ) : (
              <HtmlEditor
                content={beschreibung}
                onChange={(html) => { setBeschreibung(html); setDirty(true); }}
                placeholder="Ausführliche Produktbeschreibung eingeben…"
                minHeight="300px"
              />
            )}
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

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-8 py-4 bg-white border-t border-gray-200">
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
