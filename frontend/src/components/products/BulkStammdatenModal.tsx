import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';
import type { CategoryTree } from '../../types';

function getCategoryOptions(tree: CategoryTree, path: string[]): string[] {
  let node = tree;
  for (const segment of path) {
    if (!segment || !node[segment]) return [];
    node = node[segment];
  }
  return Object.keys(node).sort();
}

const BULK_FIELDS = [
  { key: 'hersteller', label: 'Hersteller', type: 'text' },
  { key: 'ek', label: 'EK (Netto)', type: 'number' },
  { key: 'preis', label: 'VK (Brutto)', type: 'number' },
  { key: 'gewicht', label: 'Gewicht (g)', type: 'number' },
  { key: 'ean', label: 'EAN', type: 'text' },
  { key: 'laenge', label: 'Länge (cm)', type: 'number' },
  { key: 'breite', label: 'Breite (cm)', type: 'number' },
  { key: 'hoehe', label: 'Höhe (cm)', type: 'number' },
  { key: 'lieferant_name', label: 'Lieferant Name', type: 'text' },
  { key: 'lieferant_artikelnummer', label: 'Lieferant Artikelnummer', type: 'text' },
  { key: 'lieferant_artikelname', label: 'Lieferant Artikelname', type: 'text' },
  { key: 'lieferant_netto_ek', label: 'Lieferant Netto-EK', type: 'number' },
  { key: 'kategorie_1', label: 'Kategorie 1', type: 'category', level: 0 },
  { key: 'kategorie_2', label: 'Kategorie 2', type: 'category', level: 1 },
  { key: 'kategorie_3', label: 'Kategorie 3', type: 'category', level: 2 },
  { key: 'kategorie_4', label: 'Kategorie 4', type: 'category', level: 3 },
  { key: 'kategorie_5', label: 'Kategorie 5', type: 'category', level: 4 },
  { key: 'kategorie_6', label: 'Kategorie 6', type: 'category', level: 5 },
] as const;

interface Props {
  selectedSkus: string[];
  onClose: () => void;
  onSaved: () => void;
}

export function BulkStammdatenModal({ selectedSkus, onClose, onSaved }: Props) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [categoryTree, setCategoryTree] = useState<CategoryTree>({});
  const { toast } = useToast();

  useEffect(() => {
    api.getCategoryTree().then(setCategoryTree).catch(() => {});
  }, []);

  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const fields: Record<string, string | number | null> = {};
    for (const key of selectedFields) {
      const fieldDef = BULK_FIELDS.find((f) => f.key === key);
      const raw = values[key]?.trim() ?? '';
      if (fieldDef?.type === 'number') {
        fields[key] = raw ? parseFloat(raw.replace(',', '.')) : null;
      } else {
        fields[key] = raw || null;
      }
    }

    if (Object.keys(fields).length === 0) {
      toast('Bitte mindestens ein Feld auswählen', 'info');
      return;
    }

    setSaving(true);
    try {
      const result = await api.bulkUpdateStammdaten(selectedSkus, fields);
      toast(`${result.updated} Produkte aktualisiert`, 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Stammdaten Bulk-Bearbeitung</h2>
            <p className="text-xs text-gray-500 mt-0.5">{selectedSkus.length} Produkte ausgewählt</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 space-y-3">
          <p className="text-xs text-gray-500 mb-3">
            Wähle die Felder aus, die du ändern möchtest. Nur ausgewählte Felder werden überschrieben.
          </p>
          {BULK_FIELDS.map((field) => {
            const isSelected = selectedFields.has(field.key);
            const isCategoryField = field.type === 'category';
            let categoryOptions: string[] = [];
            if (isCategoryField) {
              const path: string[] = [];
              for (let i = 0; i < (field as { level: number }).level; i++) {
                const parentKey = `kategorie_${i + 1}`;
                if (values[parentKey]) path.push(values[parentKey]);
                else break;
              }
              categoryOptions = getCategoryOptions(categoryTree, path);
            }
            return (
              <div key={field.key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleField(field.key)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label className="text-sm text-gray-700 w-40 shrink-0">{field.label}</label>
                {isCategoryField && categoryOptions.length > 0 ? (
                  <select
                    value={values[field.key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    disabled={!isSelected}
                    className={`flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isSelected ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-400'
                    }`}
                  >
                    <option value="">– wählen –</option>
                    {categoryOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={values[field.key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    disabled={!isSelected}
                    placeholder={field.type === 'number' ? '0' : ''}
                    className={`flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isSelected ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-400'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-500">
            {selectedFields.size} Feld{selectedFields.size !== 1 ? 'er' : ''} ausgewählt
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedFields.size === 0}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Speichere…' : `${selectedSkus.length} Produkte aktualisieren`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
