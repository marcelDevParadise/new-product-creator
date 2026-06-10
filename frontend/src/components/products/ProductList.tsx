import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ArchiveRestore, Upload, Archive, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../ui/button';
import type { Product } from '../../types';

type SortKey = 'artikelnummer' | 'artikelname' | 'attributes';
type SortDir = 'asc' | 'desc';

interface Props {
  products: Product[];
  selectedSkus?: Set<string>;
  onSelectionChange?: (skus: Set<string>) => void;
  archived?: boolean;
  onUnarchive?: (sku: string) => void;
}

export function ProductList({ products, selectedSkus, onSelectionChange, archived, onUnarchive }: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const selectable = selectedSkus !== undefined && onSelectionChange !== undefined;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />;
  };

  const sorted = sortKey
    ? [...products].sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'artikelnummer') cmp = a.artikelnummer.localeCompare(b.artikelnummer);
        else if (sortKey === 'artikelname') cmp = a.artikelname.localeCompare(b.artikelname);
        else if (sortKey === 'attributes') cmp = Object.keys(a.attributes).length - Object.keys(b.attributes).length;
        return sortDir === 'desc' ? -cmp : cmp;
      })
    : products;

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
      <div className="text-center py-16 text-gray-500">
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
              className={`bg-white rounded-lg border ${isSelected ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200'} shadow-sm p-3 flex gap-3 cursor-pointer active:bg-gray-50`}
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
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
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
                <th
                  className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                  onClick={() => toggleSort('artikelnummer')}
                >
                  <span className="inline-flex items-center gap-1">Artikelnummer <SortIcon col="artikelnummer" /></span>
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                  onClick={() => toggleSort('artikelname')}
                >
                  <span className="inline-flex items-center gap-1">Artikelname <SortIcon col="artikelname" /></span>
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                  onClick={() => toggleSort('attributes')}
                >
                  <span className="inline-flex items-center gap-1">Attribute <SortIcon col="attributes" /></span>
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
