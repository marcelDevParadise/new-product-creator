import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ArchiveRestore, Upload, Archive, ArrowUp } from 'lucide-react';
import { Button } from '../ui/button';
import type { Product } from '../../types';

interface Props {
  products: Product[];
  selectedSkus?: Set<string>;
  onSelectionChange?: (skus: Set<string>) => void;
  archived?: boolean;
  onUnarchive?: (sku: string) => void;
}

function compareByArtikelnummer(a: Product, b: Product) {
  return a.artikelnummer.localeCompare(b.artikelnummer, undefined, { numeric: true, sensitivity: 'base' });
}

export function ProductList({ products, selectedSkus, onSelectionChange, archived, onUnarchive }: Props) {
  const navigate = useNavigate();
  const selectable = selectedSkus !== undefined && onSelectionChange !== undefined;
  const sorted = useMemo(() => [...products].sort(compareByArtikelnummer), [products]);

  const allSelected = selectable && products.length > 0 && products.every((p) => selectedSkus.has(p.artikelnummer));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(products.map((p) => p.artikelnummer)));
    }
  };

  const toggleOne = (sku: string) => {
    if (!onSelectionChange || !selectedSkus) return;
    const next = new Set(selectedSkus);
    if (next.has(sku)) next.delete(sku);
    else next.add(sku);
    onSelectionChange(next);
  };

  if (products.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed bg-card/70 py-16 text-center text-muted-foreground">
        {archived ? (
          <>
            <Archive className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Keine archivierten Produkte vorhanden.</p>
          </>
        ) : (
          <>
            <Upload className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm mb-3">Keine Produkte vorhanden.</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/import')}>
              CSV importieren
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Mobile Cards (< md) */}
      <div className="md:hidden space-y-2">
        {selectable && (
          <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>{allSelected ? 'Alle abwählen' : 'Alle auswählen'}</span>
            {selectedSkus && selectedSkus.size > 0 && (
              <span className="ml-auto text-indigo-600 font-medium">{selectedSkus.size} ausgewählt</span>
            )}
          </label>
        )}
        {sorted.map((p) => {
          const count = Object.keys(p.attributes).length;
          const isSelected = selectable && selectedSkus.has(p.artikelnummer);
          return (
            <div
              key={p.artikelnummer}
              onClick={() => navigate(p.stammdaten_complete ? `/products/${encodeURIComponent(p.artikelnummer)}` : `/stammdaten/${encodeURIComponent(p.artikelnummer)}`)}
              className={`flex cursor-pointer gap-3 rounded-2xl border bg-card/90 p-3 shadow-sm transition active:bg-accent ${isSelected ? 'border-indigo-300 bg-indigo-50/40' : ''}`}
            >
              {selectable && (
                <div onClick={(e) => e.stopPropagation()} className="pt-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(p.artikelnummer)}
                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-gray-900 font-medium">{p.artikelnummer}</span>
                  {p.is_parent && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                      Parent
                    </span>
                  )}
                  {!p.is_parent && p.parent_sku && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-violet-50 text-violet-600 dark:bg-violet-900 dark:text-violet-300">
                      Variante
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{p.artikelname}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${Math.min((count / 10) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 tabular-nums">{count} Attr.</span>
                </div>
              </div>
              {archived && onUnarchive ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onUnarchive(p.artikelnummer); }}
                  className="p-2 -m-1 text-gray-400 hover:text-indigo-600 self-start"
                  title="Wiederherstellen"
                >
                  <ArchiveRestore className="w-5 h-5" />
                </button>
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400 self-center shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden overflow-hidden rounded-3xl border bg-card/90 shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {selectable && (
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                )}
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1">
                    Artikelnummer
                    <ArrowUp className="w-3 h-3 text-indigo-500" />
                  </span>
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Artikelname
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attribute
                </th>
                {archived && <th className="w-10" />}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((p) => {
                const count = Object.keys(p.attributes).length;
                const isSelected = selectable && selectedSkus.has(p.artikelnummer);
                return (
                  <tr
                    key={p.artikelnummer}
                    onClick={() => navigate(p.stammdaten_complete ? `/products/${encodeURIComponent(p.artikelnummer)}` : `/stammdaten/${encodeURIComponent(p.artikelnummer)}`)}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
                  >
                    {selectable && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(p.artikelnummer)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    <td className="px-5 py-3 font-mono text-gray-900 font-medium">
                      {p.artikelnummer}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      <div className="flex items-center gap-2">
                        <span>{p.artikelname}</span>
                        {p.is_parent && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            Parent
                          </span>
                        )}
                        {!p.is_parent && p.parent_sku && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-violet-50 text-violet-600 dark:bg-violet-900 dark:text-violet-300">
                            Variante
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${Math.min((count / 10) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{count}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </td>
                    {archived && onUnarchive && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onUnarchive(p.artikelnummer)}
                          className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Wiederherstellen"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
