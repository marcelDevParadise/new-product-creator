import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Tags, Layers, Archive, X } from 'lucide-react';
import { api } from '../../api/client';
import type { GlobalSearchResult } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api.globalSearch(q);
      setResults(data);
      setSelectedIndex(0);
    } catch {
      // ignore search errors
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 200);
  };

  const allItems = buildFlatList(results);
  const totalResults = allItems.length;

  const handleSelect = (item: FlatItem) => {
    onClose();
    if (item.type === 'product') navigate(`/stammdaten/${encodeURIComponent(item.id)}`);
    else if (item.type === 'attribute') navigate('/attributes');
    else if (item.type === 'template') navigate('/products');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, totalResults - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(allItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Produkt, Attribut oder Vorlage suchen…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
          />
          <div className="flex items-center gap-2">
            {loading && <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />}
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[24rem] overflow-y-auto">
          {query.length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Mind. 2 Zeichen eingeben…
            </div>
          ) : results && totalResults === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Keine Treffer für „{query}"
            </div>
          ) : results ? (
            <div className="py-2">
              {results.products.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    Produkte
                  </div>
                  {results.products.map((p, i) => {
                    const flatIdx = i;
                    return (
                      <button
                        key={p.artikelnummer}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          selectedIndex === flatIdx ? 'bg-indigo-50 dark:bg-indigo-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => handleSelect({ type: 'product', id: p.artikelnummer })}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                      >
                        <Package className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.artikelname}</span>
                          <span className="ml-2 text-xs font-mono text-gray-400">{p.artikelnummer}</span>
                        </div>
                        {p.archived && <Archive className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {results.attributes.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    Attribute
                  </div>
                  {results.attributes.map((a, i) => {
                    const flatIdx = results.products.length + i;
                    return (
                      <button
                        key={a.key}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          selectedIndex === flatIdx ? 'bg-indigo-50 dark:bg-indigo-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => handleSelect({ type: 'attribute', id: a.key })}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                      >
                        <Tags className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.name}</span>
                          <span className="ml-2 text-xs text-gray-400">{a.category}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {results.templates.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    Vorlagen
                  </div>
                  {results.templates.map((t, i) => {
                    const flatIdx = results.products.length + results.attributes.length + i;
                    return (
                      <button
                        key={t.name}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          selectedIndex === flatIdx ? 'bg-indigo-50 dark:bg-indigo-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => handleSelect({ type: 'template', id: t.name })}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                      >
                        <Layers className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</span>
                          <span className="ml-2 text-xs text-gray-400">{t.attribute_count} Attribute</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-400">
          <span>↑↓ Navigieren · ↵ Öffnen · Esc Schließen</span>
          {totalResults > 0 && <span>{totalResults} Treffer</span>}
        </div>
      </div>
    </div>
  );
}

interface FlatItem {
  type: 'product' | 'attribute' | 'template';
  id: string;
}

function buildFlatList(results: GlobalSearchResult | null): FlatItem[] {
  if (!results) return [];
  const items: FlatItem[] = [];
  for (const p of results.products) items.push({ type: 'product', id: p.artikelnummer });
  for (const a of results.attributes) items.push({ type: 'attribute', id: a.key });
  for (const t of results.templates) items.push({ type: 'template', id: t.name });
  return items;
}
