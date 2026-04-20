import { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Search, ChevronRight, Package } from 'lucide-react';
import type { Template, AttributeConfig } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';
import { getFieldType } from '@/lib/attribute-utils';
import { TagPicker } from '@/components/ui/TagPicker';

interface Props {
  template: Template;
  attributeConfig: AttributeConfig;
  onClose: () => void;
  onSaved: () => void;
}

export function TemplateAttributeEditor({ template, attributeConfig, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>({ ...template.attributes });
  const [saving, setSaving] = useState(false);
  const [searchAttr, setSearchAttr] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const setValue = (key: string, val: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const removeAttribute = (key: string) => {
    setValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateTemplate(template.name, values, template.category, template.description);
      toast('Attribute gespeichert', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Group all attributes by category for the "add" panel
  const allByCategory = useMemo(() => {
    const result: Record<string, { key: string; name: string; description?: string }[]> = {};
    for (const [key, def] of Object.entries(attributeConfig)) {
      const cat = def.category || 'Sonstige';
      if (!result[cat]) result[cat] = [];
      result[cat].push({ key, name: def.name, description: def.description });
    }
    return result;
  }, [attributeConfig]);

  // Group active values by attribute-category
  const activeGrouped = useMemo(() => {
    const result: Record<string, { key: string; value: string | number | boolean }[]> = {};
    for (const [key, val] of Object.entries(values)) {
      const def = attributeConfig[key];
      const cat = def?.category || 'Sonstige';
      if (!result[cat]) result[cat] = [];
      result[cat].push({ key, value: val });
    }
    return result;
  }, [values, attributeConfig]);

  const filteredCategories = useMemo(() => {
    if (!searchAttr.trim()) return allByCategory;
    const q = searchAttr.toLowerCase();
    const result: Record<string, typeof allByCategory[string]> = {};
    for (const [cat, attrs] of Object.entries(allByCategory)) {
      const matching = attrs.filter(
        (a) => a.name.toLowerCase().includes(q) || a.key.toLowerCase().includes(q) || cat.toLowerCase().includes(q),
      );
      if (matching.length > 0) result[cat] = matching;
    }
    return result;
  }, [allByCategory, searchAttr]);

  const filledCount = Object.values(values).filter((v) => v !== '' && v !== undefined).length;
  const totalAttrs = Object.keys(values).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Attribute bearbeiten</h2>
            <p className="text-sm text-gray-500">
              Vorlage: <span className="font-medium text-gray-700">{template.name}</span>
              {template.category && <> · <span className="text-indigo-600">{template.category}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Filled attributes */}
          {totalAttrs > 0 ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Enthaltene Attribute</h3>
                <span className="text-xs text-gray-400">{filledCount}/{totalAttrs} ausgefüllt</span>
              </div>

              {Object.entries(activeGrouped).map(([category, attrs]) => (
                <div key={category} className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{category}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {attrs.map(({ key, value }) => {
                      const def = attributeConfig[key];
                      if (!def) return null;
                      const hasSuggestions = def.suggested_values && def.suggested_values.length > 0;
                      return (
                        <div key={key} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-gray-700">{def.name}</span>
                              {def.required && <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />}
                            </div>
                            {def.description && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{def.description}</p>
                            )}
                          </div>
                          <div className={`${getFieldType(def.id) === 'tags' && hasSuggestions ? 'flex-1' : 'w-52'} shrink-0`}>
                            {getFieldType(def.id) === 'tags' && hasSuggestions ? (
                              <TagPicker
                                value={value}
                                suggestions={def.suggested_values!}
                                onChange={(val) => setValue(key, val)}
                              />
                            ) : hasSuggestions ? (
                              <select
                                value={value !== undefined ? String(value) : ''}
                                onChange={(e) => setValue(key, e.target.value)}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                              >
                                <option value="">– wählen –</option>
                                {def.suggested_values!.map((sv) => (
                                  <option key={sv} value={sv}>{sv}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={value !== undefined ? String(value) : ''}
                                onChange={(e) => setValue(key, e.target.value)}
                                placeholder="Wert..."
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                              />
                            )}
                          </div>
                          <button
                            onClick={() => removeAttribute(key)}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                            title="Entfernen"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Package className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium mb-1">Noch keine Attribute</p>
              <p className="text-xs">Wähle unten Attribute aus einer Kategorie</p>
            </div>
          )}

          {/* Add attributes */}
          <div className="border-t border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Attribut hinzufügen</h3>
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={searchAttr}
                  onChange={(e) => setSearchAttr(e.target.value)}
                  placeholder="Suchen..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              {Object.entries(filteredCategories).map(([cat, attrs]) => {
                const isExpanded = expandedCategories.has(cat) || searchAttr.trim().length > 0;
                const availableInCat = attrs.filter((a) => !(a.key in values));
                if (availableInCat.length === 0) return null;

                return (
                  <div key={cat} className="rounded-lg border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                    >
                      <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <span className="text-xs font-medium text-gray-600">{cat}</span>
                      <span className="text-xs text-gray-400 ml-auto">{availableInCat.length}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                        {availableInCat.map((attr) => (
                          <button
                            key={attr.key}
                            onClick={() => setValue(attr.key, '')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                            title={attr.description}
                          >
                            <Plus className="w-3 h-3" />
                            {attr.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 shrink-0 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
