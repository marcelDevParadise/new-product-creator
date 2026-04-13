import { useState, useMemo, useEffect } from 'react';
import { X, Search, Save } from 'lucide-react';
import type { AttributeConfig } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';
import { getFieldType } from '@/lib/attribute-utils';

interface Props {
  selectedSkus: string[];
  attributeConfig: AttributeConfig;
  onClose: () => void;
  onSaved: () => void;
}

export function BulkAttributeModal({ selectedSkus, attributeConfig, onClose, onSaved }: Props) {
  const [search, setSearch] = useState('');
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Esc key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const categories = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [key, def] of Object.entries(attributeConfig)) {
      const cat = def.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(key);
    }
    return map;
  }, [attributeConfig]);

  const filteredCategories = useMemo(() => {
    if (!search) return categories;
    const q = search.toLowerCase();
    const filtered = new Map<string, string[]>();
    for (const [cat, keys] of categories) {
      const matchedKeys = keys.filter((key) => {
        const def = attributeConfig[key];
        return (
          def.name.toLowerCase().includes(q) ||
          key.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q)
        );
      });
      if (matchedKeys.length > 0) filtered.set(cat, matchedKeys);
    }
    return filtered;
  }, [categories, attributeConfig, search]);

  const setValue = (key: string, val: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const removeValue = (key: string) => {
    setValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    const cleaned: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v !== '' && v !== undefined) cleaned[k] = v;
    }
    if (Object.keys(cleaned).length === 0) return;

    setSaving(true);
    try {
      await api.bulkUpdateAttributes(selectedSkus, cleaned);
      toast(`Attribute für ${selectedSkus.length} Produkte aktualisiert`, 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Bulk-Aktualisierung fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = Object.keys(values).filter((k) => values[k] !== '' && values[k] !== undefined).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bulk-Bearbeitung</h2>
            <p className="text-sm text-gray-500">
              {selectedSkus.length} Produkte ausgewählt — Attribute werden auf alle angewendet
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Attribut suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Attribute list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
          {Array.from(filteredCategories.entries()).map(([category, keys]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {category}
              </h3>
              <div className="space-y-2">
                {keys.map((key) => {
                  const def = attributeConfig[key];
                  const value = values[key];
                  const isActive = value !== undefined && value !== '';
                  const fieldType = getFieldType(def.id);

                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                        isActive ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-700">{def.name}</span>
                        {def.required && <span className="text-red-500 ml-1 text-xs">*</span>}
                      </div>
                      <div className="w-56 flex items-center gap-2">
                        {fieldType === 'boolean' ? (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={value === true || value === 'true'}
                              onChange={(e) => setValue(key, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                          </label>
                        ) : def.suggested_values && def.suggested_values.length > 0 ? (
                          <select
                            value={value !== undefined ? String(value) : ''}
                            onChange={(e) => setValue(key, e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                          >
                            <option value="">— Auswählen —</option>
                            {def.suggested_values.map((sv) => (
                              <option key={sv} value={sv}>
                                {sv}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={fieldType === 'number' ? 'number' : 'text'}
                            value={value !== undefined ? String(value) : ''}
                            onChange={(e) =>
                              setValue(
                                key,
                                fieldType === 'number' && e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : e.target.value
                              )
                            }
                            placeholder={def.default_value || ''}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        )}
                        {isActive && (
                          <button
                            onClick={() => removeValue(key)}
                            className="p-0.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <span className="text-sm text-gray-500">
            {activeCount} Attribute ausgewählt
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || activeCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving
                ? 'Speichere...'
                : `Auf ${selectedSkus.length} Produkte anwenden`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


