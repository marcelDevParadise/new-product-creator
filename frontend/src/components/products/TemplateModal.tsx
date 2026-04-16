import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Save, Play, Trash2, Plus, FileText, Search, ChevronRight, Package } from 'lucide-react';
import type { Template, AttributeConfig } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface Props {
  selectedSkus: string[];
  attributeConfig: AttributeConfig;
  totalActiveProducts?: number;
  onClose: () => void;
  onApplied: () => void;
}

export function TemplateModal({ selectedSkus, attributeConfig, totalActiveProducts, onClose, onApplied }: Props) {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyMode, setApplyMode] = useState<'selected' | 'all'>(selectedSkus.length > 0 ? 'selected' : 'all');
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchAttr, setSearchAttr] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const activeRef = useRef<string | null>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const loadTemplates = async (selectName?: string) => {
    try {
      const data = await api.getTemplates();
      setTemplates(data);
      const target = selectName ?? activeRef.current;
      if (target && data[target]) {
        setActiveTemplate(target);
        activeRef.current = target;
        setValues({ ...data[target].attributes });
      } else {
        const names = Object.keys(data);
        if (names.length > 0) {
          setActiveTemplate(names[0]);
          activeRef.current = names[0];
          setValues({ ...data[names[0]].attributes });
        }
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Vorlagen konnten nicht geladen werden', 'error');
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const selectTemplate = (name: string) => {
    setActiveTemplate(name);
    activeRef.current = name;
    setValues({ ...templates[name].attributes });
    setSearchAttr('');
  };

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
    if (!activeTemplate) return;
    setSaving(true);
    try {
      await api.updateTemplate(activeTemplate, values);
      toast('Vorlage gespeichert', 'success');
      await loadTemplates(activeTemplate);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (!activeTemplate) return;
    setApplying(true);
    try {
      await api.updateTemplate(activeTemplate, values);
      let skusToApply = selectedSkus;
      if (applyMode === 'all') {
        const allProducts = await api.getProducts();
        skusToApply = allProducts.map((p) => p.artikelnummer);
      }
      if (skusToApply.length === 0) {
        toast('Keine Produkte zum Anwenden gefunden', 'error');
        return;
      }
      const res = await api.applyTemplate(activeTemplate, skusToApply);
      toast(`${res.attributes_applied} Attribute auf ${res.updated} Produkte angewendet`, 'success');
      onApplied();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Anwenden fehlgeschlagen', 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await api.createTemplate(name, {});
      setNewName('');
      setIsCreating(false);
      toast('Vorlage erstellt', 'success');
      await loadTemplates(name);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erstellen fehlgeschlagen', 'error');
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.deleteTemplate(name);
      toast('Vorlage gelöscht', 'success');
      if (activeTemplate === name) {
        setActiveTemplate(null);
        activeRef.current = null;
        setValues({});
      }
      await loadTemplates();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Löschen fehlgeschlagen', 'error');
    }
    setDeleteTarget(null);
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

  // Group active template attributes
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

  const filledCount = Object.values(values).filter((v) => v !== '' && v !== undefined).length;
  const totalAttrs = Object.keys(values).length;
  const applyTargetCount = applyMode === 'selected' ? selectedSkus.length : (totalActiveProducts ?? 0);
  const templateNames = Object.keys(templates);

  // Filter available attributes by search
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Attribut-Vorlagen</h2>
              <p className="text-sm text-gray-500">{templateNames.length} Vorlagen verfügbar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-panel layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel — Template list */}
          <div className="w-64 border-r border-gray-200 flex flex-col shrink-0">
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {templateNames.map((name) => {
                const tpl = templates[name];
                const count = Object.keys(tpl.attributes).length;
                const isActive = activeTemplate === name;
                return (
                  <div
                    key={name}
                    onClick={() => selectTemplate(name)}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                      isActive
                        ? 'bg-indigo-50 ring-1 ring-indigo-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-900' : 'text-gray-700'}`}>
                        {name}
                      </p>
                      <p className="text-xs text-gray-400">{count} Attribute</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(name); }}
                      className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {templateNames.length === 0 && !isCreating && (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Noch keine Vorlagen</p>
                </div>
              )}
            </div>

            {/* Create template */}
            <div className="p-3 border-t border-gray-100">
              {isCreating ? (
                <div className="space-y-2">
                  <input
                    ref={newNameRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Vorlagen-Name..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setIsCreating(false); setNewName(''); } }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={handleCreate} disabled={!newName.trim()} className="flex-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                      Erstellen
                    </button>
                    <button onClick={() => { setIsCreating(false); setNewName(''); }} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-indigo-600 font-medium border border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Neue Vorlage
                </button>
              )}
            </div>
          </div>

          {/* Right panel — Attribute editor */}
          <div className="flex-1 flex flex-col min-w-0">
            {activeTemplate ? (
              <>
                {/* Active attributes */}
                <div className="flex-1 overflow-y-auto">
                  {/* Filled attributes */}
                  {totalAttrs > 0 ? (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Vorlage: {activeTemplate}
                        </h3>
                        <span className="text-xs text-gray-400">
                          {filledCount}/{totalAttrs} ausgefüllt
                        </span>
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
                                  <div className="w-52 shrink-0">
                                    {hasSuggestions ? (
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

                  {/* Add attributes — category browser */}
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
                <div className="border-t border-gray-200 px-4 py-3 shrink-0">
                  <div className="flex items-center gap-3">
                    {/* Apply target */}
                    <div className="flex items-center gap-1.5 mr-auto">
                      <span className="text-xs text-gray-500">Ziel:</span>
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        {selectedSkus.length > 0 && (
                          <button
                            onClick={() => setApplyMode('selected')}
                            className={`px-2.5 py-1 text-xs transition-colors ${
                              applyMode === 'selected'
                                ? 'bg-indigo-600 text-white font-medium'
                                : 'text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {selectedSkus.length} Ausgewählte
                          </button>
                        )}
                        <button
                          onClick={() => setApplyMode('all')}
                          className={`px-2.5 py-1 text-xs transition-colors ${
                            applyMode === 'all'
                              ? 'bg-indigo-600 text-white font-medium'
                              : 'text-gray-500 hover:bg-gray-50'
                          }${selectedSkus.length > 0 ? ' border-l border-gray-200' : ''}`}
                        >
                          Alle{totalActiveProducts != null ? ` (${totalActiveProducts})` : ''}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Speichere...' : 'Speichern'}
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={applying || filledCount === 0}
                      className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      {applying ? 'Anwenden...' : `Auf ${applyTargetCount} anwenden`}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <FileText className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium mb-1">Keine Vorlage ausgewählt</p>
                <p className="text-xs">Wähle links eine Vorlage oder erstelle eine neue</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Vorlage löschen?"
          message={`Die Vorlage "${deleteTarget}" wird unwiderruflich gelöscht.`}
          confirmLabel="Löschen"
          variant="danger"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
