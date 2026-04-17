import { useState, useEffect, useCallback } from 'react';
import { FlaskConical, Plus, Trash2, Edit, X, Save } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/ui/Toast';
import { PageHeader } from '../components/layout/PageHeader';
import type { Ingredient } from '../types';

export function IngredientsPage() {
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [inciName, setInciName] = useState('');
  const [casNumber, setCasNumber] = useState('');
  const [category, setCategory] = useState('Allgemein');
  const [filterCategory, setFilterCategory] = useState('');

  const load = useCallback(async () => {
    try {
      setIngredients(await api.getIngredients());
    } catch {
      toast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const categories = [...new Set(ingredients.map(i => i.category))].sort();

  const resetForm = () => {
    setName(''); setInciName(''); setCasNumber(''); setCategory('Allgemein');
    setShowForm(false); setEditId(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast('Name erforderlich', 'error');
      return;
    }
    try {
      if (editId !== null) {
        await api.updateIngredient(editId, { name, inci_name: inciName, cas_number: casNumber, category });
        toast('Inhaltsstoff aktualisiert', 'success');
      } else {
        await api.createIngredient({ name, inci_name: inciName, cas_number: casNumber, category });
        toast('Inhaltsstoff erstellt', 'success');
      }
      resetForm();
      load();
    } catch {
      toast('Fehler beim Speichern', 'error');
    }
  };

  const handleEdit = (ing: Ingredient) => {
    setEditId(ing.id);
    setName(ing.name);
    setInciName(ing.inci_name);
    setCasNumber(ing.cas_number);
    setCategory(ing.category);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteIngredient(id);
      toast('Inhaltsstoff gelöscht', 'success');
      load();
    } catch {
      toast('Fehler beim Löschen', 'error');
    }
  };

  const filtered = filterCategory ? ingredients.filter(i => i.category === filterCategory) : ingredients;

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Inhaltsstoff-Deklaration"
        subtitle={`${ingredients.length} Inhaltsstoff${ingredients.length !== 1 ? 'e' : ''}`}
        actions={
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Neuer Inhaltsstoff
          </button>
        }
      />

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{editId ? 'Inhaltsstoff bearbeiten' : 'Neuer Inhaltsstoff'}</h3>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Inhaltsstoff-Name" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">INCI-Name</label>
              <input value={inciName} onChange={e => setInciName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="z.B. Aqua" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">CAS-Nummer</label>
              <input value={casNumber} onChange={e => setCasNumber(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="z.B. 7732-18-5" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Kategorie</label>
              <input value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="z.B. Tenside" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
            <button onClick={handleSave} disabled={!name.trim()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {editId ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      {categories.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory('')}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${!filterCategory ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            Alle ({ingredients.length})
          </button>
          {categories.map(cat => {
            const count = ingredients.filter(i => i.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${filterCategory === cat ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Ingredient list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Keine Inhaltsstoffe vorhanden</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">INCI-Name</th>
                <th className="text-left px-4 py-3 font-medium">CAS-Nr.</th>
                <th className="text-left px-4 py-3 font-medium">Kategorie</th>
                <th className="text-center px-4 py-3 font-medium">Produkte</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(ing => (
                <tr key={ing.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{ing.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{ing.inci_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{ing.cas_number || '—'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">{ing.category}</span></td>
                  <td className="px-4 py-3 text-center text-gray-500">{ing.usage_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleEdit(ing)} className="text-indigo-500 hover:text-indigo-700"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(ing.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
