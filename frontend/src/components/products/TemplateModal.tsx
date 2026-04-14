import { useState, useEffect } from 'react';
import { X, Save, Play, Trash2, Plus } from 'lucide-react';
import type { Template, AttributeConfig } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface Props {
  selectedSkus: string[];
  attributeConfig: AttributeConfig;
  onClose: () => void;
  onApplied: () => void;
}

export function TemplateModal({ selectedSkus, attributeConfig, onClose, onApplied }: Props) {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();

  // Esc key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(data);
      // Auto-select first template if none active
      if (!activeTemplate) {
        const names = Object.keys(data);
        if (names.length > 0) {
          setActiveTemplate(names[0]);
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
      await loadTemplates();
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
      const res = await api.applyTemplate(activeTemplate, selectedSkus);
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
      await loadTemplates();
      setActiveTemplate(name);
      setValues({});
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
        setValues({});
      }
      await loadTemplates();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Löschen fehlgeschlagen', 'error');
    }
    setDeleteTarget(null);
  };

  // Get attribute keys that belong to this template
  const templateAttrKeys = activeTemplate
    ? Object.keys(templates[activeTemplate]?.attributes || {})
    : [];

  // Also allow adding attributes not yet in the template
  const availableToAdd = Object.keys(attributeConfig).filter(
    (k) => !templateAttrKeys.includes(k) && !(k in values),
  );

  const filledCount = Object.values(values).filter((v) => v !== '' && v !== undefined).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vorlagen</h2>
            <p className="text-sm text-gray-500">
              {selectedSkus.length > 0
                ? `Vorlage auf ${selectedSkus.length} Produkte anwenden`
                : 'Vorlagen verwalten'}
            </p>
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
              <button
                onClick={handleCreate}
                className="p-1 text-indigo-600 hover:text-indigo-800"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewName(''); }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
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
            <div className="space-y-3">
              {Object.entries(values).map(([key, value]) => {
                const def = attributeConfig[key];
                if (!def) return null;
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
                      <input
                        type="text"
                        value={value !== undefined ? String(value) : ''}
                        onChange={(e) => setValue(key, e.target.value)}
                        placeholder="Wert eingeben..."
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                      <button
                        onClick={() => {
                          setValues((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          });
                        }}
                        className="p-0.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

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
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Wähle eine Vorlage aus oder erstelle eine neue.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
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
                {selectedSkus.length > 0 && (
                  <button
                    onClick={handleApply}
                    disabled={applying || filledCount === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    {applying ? 'Anwenden...' : `Auf ${selectedSkus.length} Produkte anwenden`}
                  </button>
                )}
              </>
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
