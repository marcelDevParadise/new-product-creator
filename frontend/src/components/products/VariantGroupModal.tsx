import { useState, useEffect } from 'react';
import { useToast } from '../ui/Toast';
import { api } from '../../api/client';
import type { Product, VariantenSettings, VariantSuggestion } from '../../types';
import { GitBranch, Sparkles, X } from 'lucide-react';

interface Props {
  selectedSkus: string[];
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}

export function VariantGroupModal({ selectedSkus, products, onClose, onSaved }: Props) {
  const [parentSku, setParentSku] = useState(selectedSkus[0] || '');
  const [variantAxes, setVariantAxes] = useState<string[]>([]);
  const [childAttributes, setChildAttributes] = useState<Record<string, Record<string, string>>>({});
  const [mode, setMode] = useState<'manual' | 'suggest'>('manual');
  const [suggestions, setSuggestions] = useState<VariantSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Load available axes from settings
  useEffect(() => {
    api.getVariantenSettings().then((s: VariantenSettings) => {
      setVariantAxes(s.variant_axes);
    }).catch(() => {});
  }, []);

  const selected = products.filter(p => selectedSkus.includes(p.artikelnummer));
  const childSkus = selectedSkus.filter(s => s !== parentSku);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const data = await api.suggestVariantGroups();
      setSuggestions(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Vorschläge konnten nicht geladen werden', 'error');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSave = async () => {
    if (!parentSku || childSkus.length === 0) {
      toast('Mindestens ein Parent und ein Kind-Produkt auswählen', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.createVariantGroup(parentSku, childSkus, childAttributes);
      toast(`Varianten-Gruppe erstellt: ${res.children} Varianten`, 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fehler beim Erstellen der Gruppe', 'error');
    } finally {
      setSaving(false);
    }
  };

  const applySuggestion = (suggestion: VariantSuggestion) => {
    setParentSku(suggestion.suggested_parent);
    setMode('manual');
    // We can't programmatically change selectedSkus from here — user should select from suggestion
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Varianten gruppieren</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{selectedSkus.length} Produkte ausgewählt</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mx-6 mt-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 px-4 py-1.5 text-sm rounded-md transition-colors ${
              mode === 'manual' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Manuell
          </button>
          <button
            onClick={() => { setMode('suggest'); if (suggestions.length === 0) loadSuggestions(); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors ${
              mode === 'suggest' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto-Vorschläge
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {mode === 'manual' ? (
            <>
              {/* Parent selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Parent-Produkt</label>
                <select
                  value={parentSku}
                  onChange={(e) => setParentSku(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                >
                  {selected.map(p => (
                    <option key={p.artikelnummer} value={p.artikelnummer}>
                      {p.artikelnummer} — {p.artikelname}
                    </option>
                  ))}
                </select>
              </div>

              {/* Children with variant attributes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Varianten ({childSkus.length})
                </label>
                <div className="space-y-2">
                  {childSkus.map(sku => {
                    const p = products.find(pr => pr.artikelnummer === sku);
                    if (!p) return null;
                    return (
                      <div key={sku} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {p.artikelnummer} — {p.artikelname}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {variantAxes.map(axis => (
                              <div key={axis} className="flex items-center gap-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400">{axis}:</span>
                                <input
                                  type="text"
                                  value={childAttributes[sku]?.[axis] || ''}
                                  onChange={(e) => {
                                    setChildAttributes(prev => ({
                                      ...prev,
                                      [sku]: { ...(prev[sku] || {}), [axis]: e.target.value },
                                    }));
                                  }}
                                  placeholder="—"
                                  className="w-24 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500 outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Auto-suggest mode */
            <div className="space-y-3">
              {loadingSuggestions ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Suche nach Vorschlägen…</p>
              ) : suggestions.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Keine Vorschläge gefunden. Produkte müssen ähnliche Namen haben.</p>
              ) : (
                suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 transition-colors cursor-pointer"
                    onClick={() => applySuggestion(s)}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.common_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.members.length} Produkte: {s.members.join(', ')}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.differences.map((d, j) => (
                        <span key={j} className="px-2 py-0.5 text-[10px] font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-700">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {mode === 'manual' && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || childSkus.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Erstelle…' : `Gruppe erstellen (${childSkus.length} Varianten)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
