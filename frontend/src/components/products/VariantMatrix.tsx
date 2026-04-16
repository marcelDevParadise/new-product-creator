import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';
import type { Product, VariantDiff, VariantenSettings } from '../../types';

interface Props {
  parentSku: string;
  childProducts: Product[];
  variantAxes: string[];
  onChildCreated: () => void;
  onChildRemoved: () => void;
}

const cellCls = 'px-3 py-2 text-sm border-b border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-300';
const inputCls = 'w-full px-2 py-1 text-sm border border-gray-200 dark:border-white/15 rounded bg-white dark:bg-white/5 text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export function VariantMatrix({ parentSku, childProducts, variantAxes, onChildCreated, onChildRemoved }: Props) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [diff, setDiff] = useState<VariantDiff>({});
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAttrs, setNewAttrs] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<VariantenSettings | null>(null);

  const loadDiff = useCallback(() => {
    api.getVariantDiff(parentSku).then(setDiff).catch(() => {});
  }, [parentSku]);

  useEffect(() => {
    loadDiff();
    api.getVariantenSettings().then(setSettings).catch(() => {});
  }, [loadDiff]);

  // Core columns always shown
  const coreColumns = ['artikelname', 'ek', 'preis', 'ean', 'gewicht'];

  const handleCreate = async () => {
    if (variantAxes.length > 0 && variantAxes.some(a => !newAttrs[a]?.trim())) {
      toast('Bitte alle Varianten-Achsen ausfüllen', 'error');
      return;
    }
    setCreating(true);
    try {
      await api.createVariantChild(parentSku, newAttrs, newName || undefined);
      toast('Neue Variante erstellt', 'success');
      setNewName('');
      setNewAttrs({});
      onChildCreated();
      loadDiff();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fehler beim Erstellen', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async (childSku: string) => {
    try {
      await api.removeVariantChild(parentSku, childSku);
      toast(`${childSku} aus Gruppe entfernt`, 'success');
      onChildRemoved();
      loadDiff();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fehler', 'error');
    }
  };

  const formatValue = (product: Product, field: string): string => {
    const val = (product as Record<string, unknown>)[field];
    if (val == null || val === '') return '–';
    if (typeof val === 'number') return String(val);
    return String(val);
  };

  const fieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      artikelname: 'Name',
      ek: 'EK',
      preis: 'VK',
      ean: 'EAN',
      gewicht: 'Gewicht',
    };
    return labels[field] || field;
  };

  const inheritFields = settings?.inherit_fields || [];

  return (
    <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Variantenmatrix · {childProducts.length} Varianten
        </h3>
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-white/5">
                <th className={`${cellCls} font-medium text-xs text-gray-500 w-28`}>SKU</th>
                {variantAxes.map(axis => (
                  <th key={axis} className={`${cellCls} font-medium text-xs text-purple-600 dark:text-purple-400`}>{axis}</th>
                ))}
                {coreColumns.map(col => (
                  <th key={col} className={`${cellCls} font-medium text-xs text-gray-500`}>{fieldLabel(col)}</th>
                ))}
                <th className={`${cellCls} font-medium text-xs text-gray-500 w-10`} />
              </tr>
            </thead>
            <tbody>
              {childProducts.map(child => {
                const childDiff = diff[child.artikelnummer] || {};
                return (
                  <tr key={child.artikelnummer} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className={cellCls}>
                      <Link
                        to={`/stammdaten/${encodeURIComponent(child.artikelnummer)}`}
                        className="text-indigo-600 hover:underline font-mono text-xs"
                      >
                        {child.artikelnummer}
                      </Link>
                    </td>
                    {variantAxes.map(axis => (
                      <td key={axis} className={cellCls}>
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                          {child.variant_attributes[axis] || '–'}
                        </span>
                      </td>
                    ))}
                    {coreColumns.map(col => {
                      const hasDiff = !!childDiff[col];
                      const isInherited = inheritFields.includes(col) && !hasDiff &&
                        (((child as Record<string, unknown>)[col]) == null || ((child as Record<string, unknown>)[col]) === '');
                      return (
                        <td key={col} className={`${cellCls} ${hasDiff ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}>
                          <div className="flex items-center gap-1">
                            <span className={`text-sm ${isInherited ? 'text-gray-400 italic' : ''}`}>
                              {formatValue(child, col)}
                            </span>
                            {hasDiff && (
                              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" title={`Abweichung: Parent = ${childDiff[col].parent_value}`} />
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className={cellCls}>
                      <button
                        onClick={() => handleRemove(child.artikelnummer)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Aus Gruppe entfernen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Create new variant row */}
              <tr className="bg-gray-50 dark:bg-white/3">
                <td className={`${cellCls} text-gray-400 dark:text-gray-500 text-xs`}>Neu</td>
                {variantAxes.map(axis => (
                  <td key={axis} className={cellCls}>
                    <input
                      className={inputCls}
                      placeholder={axis}
                      value={newAttrs[axis] || ''}
                      onChange={e => setNewAttrs(prev => ({ ...prev, [axis]: e.target.value }))}
                    />
                  </td>
                ))}
                <td className={cellCls} colSpan={coreColumns.length - 1}>
                  <input
                    className={inputCls}
                    placeholder="Artikelname (optional, vom Parent geerbt)"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                  />
                </td>
                <td className={cellCls} />
                <td className={cellCls}>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="p-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors disabled:opacity-50"
                    title="Neue Variante erstellen"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
