import { useState, useEffect, useRef } from 'react';
import { X, Save, Play, Trash2, Plus, Users } from 'lucide-react';
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
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();
  const activeRef = useRef<string | null>(null);

  // Esc key to close
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

  useEffect(() => {
    loadTemplates();
  }, []);

  const selectTemplate = (name: string) => {
    setActiveTemplate(name);
    activeRef.current = name;
    setValues({ ...templates[name].attributes });
  };

  const setValue = (key: string, val: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [key]: val }));
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
      // Always save current values first, then apply
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
      toast(
        `${res.attributes_applied} Attribute auf ${res.updated} Produkte angewendet`,
        'success',
      );
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
      setShowNewForm(false);
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

  // Group template attributes by category
  const attrEntries = Object.entries(values);
  const grouped: Record<string, [string, string | number | boolean][]> = {};
  for (const [key, val] of attrEntries) {
    const def = attributeConfig[key];
    const cat = def?.category || 'Sonstige';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push([key, val]);
  }

  const availableToAdd = Object.keys(attributeConfig).filter(
    (k) => !(k in values),
  );

  const filledCount = Object.values(values).filter((v) => v !== '' && v !== undefined).length;

  const applyTargetCount = applyMode === 'selected' ? selectedSkus.length : (totalActiveProducts ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vorlagen</h2>
            <p className="text-sm text-gray-500">Attribut-Vorlagen verwalten und anwenden</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template tabs */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 overflow-x-auto">
          {Object.keys(templates).map((name) => (
            <button
              key={name}
              onClick={() => selectTemplate(name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors whitespace-nowrap ${
                activeTemplate === name
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-medium'
                  : 'text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(name);
                }}
                className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </button>
          ))}
          {showNewForm ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name..."
                className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-32"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <button onClick={handleCreate} className="p-1 text-indigo-600 hover:text-indigo-800">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={() => { setShowNewForm(false); setNewName(''); }} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Neue Vorlage
            </button>
          )}
        </div>

        {/* Attribute editor */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTemplate ? (
            <div className="space-y-4">
              {Object.entries(grouped).map(([category, entries]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{category}</h4>
                  <div className="space-y-2">
                    {entries.map(([key, value]) => {
                      const def = attributeConfig[key];
                      if (!def) return null;
                      const hasSuggestions = def.suggested_values && def.suggested_values.length > 0;
                      return (
                        <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-700">{def.name}</span>
                            {def.required && <span className="text-red-500 ml-1 text-xs">*</span>}
                            {def.description && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{def.description}</p>
                            )}
                          </div>
                          <div className="w-56 flex items-center gap-2">
                            {hasSuggestions ? (
                              <select
                                value={value !== undefined ? String(value) : ''}
                                onChange={(e) => setValue(key, e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
                                placeholder="Wert eingeben..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                              />
                            )}
                            <button
                              onClick={() => {
                                setValues((prev) => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return next;
                                });
                              }}
                              className="p-0.5 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                              title="Attribut entfernen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Add attribute to template */}
              {availableToAdd.length > 0 && (
                <div className="pt-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setValue(e.target.value, '');
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-500 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">+ Attribut zur Vorlage hinzufügen...</option>
                    {availableToAdd.map((key) => (
                      <option key={key} value={key}>
                        {attributeConfig[key].name} ({attributeConfig[key].category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Empty state hint */}
              {attrEntries.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  Keine Attribute in dieser Vorlage. Füge über das Dropdown unten Attribute hinzu.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Wähle eine Vorlage aus oder erstelle eine neue.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 space-y-3">
          {/* Apply target selector */}
          {activeTemplate && (
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Anwenden auf:</span>
              <div className="flex gap-2">
                {selectedSkus.length > 0 && (
                  <button
                    onClick={() => setApplyMode('selected')}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                      applyMode === 'selected'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-medium'
                        : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {selectedSkus.length} ausgewählte
                  </button>
                )}
                <button
                  onClick={() => setApplyMode('all')}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                    applyMode === 'all'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-medium'
                      : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Alle aktiven Produkte{totalActiveProducts != null ? ` (${totalActiveProducts})` : ''}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {activeTemplate ? `${filledCount} Attribute ausgefüllt` : ''}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Schließen
              </button>
              {activeTemplate && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Speichere...' : 'Speichern'}
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={applying || filledCount === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    {applying
                      ? 'Anwenden...'
                      : `Auf ${applyTargetCount} Produkte anwenden`}
                  </button>
                </>
              )}
            </div>
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
