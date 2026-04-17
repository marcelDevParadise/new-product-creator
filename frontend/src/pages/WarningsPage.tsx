import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Plus, Trash2, Edit, X, Save } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/ui/Toast';
import { PageHeader } from '../components/layout/PageHeader';
import type { Warning } from '../types';

export function WarningsPage() {
  const { toast } = useToast();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('Allgemein');
  const [filterCategory, setFilterCategory] = useState('');

  const load = useCallback(async () => {
    try {
      setWarnings(await api.getWarnings());
    } catch {
      toast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const categories = [...new Set(warnings.map(w => w.category))].sort();

  const resetForm = () => {
    setCode(''); setTitle(''); setText(''); setCategory('Allgemein');
    setShowForm(false); setEditId(null);
  };

  const handleSave = async () => {
    if (!code.trim() || !title.trim()) {
      toast('Code und Titel erforderlich', 'error');
      return;
    }
    try {
      if (editId !== null) {
        await api.updateWarning(editId, { code, title, text, category });
        toast('Warnhinweis aktualisiert', 'success');
      } else {
        await api.createWarning({ code, title, text, category });
        toast('Warnhinweis erstellt', 'success');
      }
      resetForm();
      load();
    } catch {
      toast('Fehler beim Speichern', 'error');
    }
  };

  const handleEdit = (w: Warning) => {
    setEditId(w.id);
    setCode(w.code);
    setTitle(w.title);
    setText(w.text);
    setCategory(w.category);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteWarning(id);
      toast('Warnhinweis gelöscht', 'success');
      load();
    } catch {
      toast('Fehler beim Löschen', 'error');
    }
  };

  const filtered = filterCategory ? warnings.filter(w => w.category === filterCategory) : warnings;

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Warnhinweis-Manager"
        subtitle={`${warnings.length} Warnhinweis${warnings.length !== 1 ? 'e' : ''}`}
        actions={
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Neuer Warnhinweis
          </button>
        }
      />

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{editId ? 'Warnhinweis bearbeiten' : 'Neuer Warnhinweis'}</h3>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Code</label>
              <input value={code} onChange={e => setCode(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="z.B. W-FLAME" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Titel</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Kurztitel" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Kategorie</label>
              <input value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="z.B. Gefahrstoffe" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Text</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Vollständiger Warnhinweis-Text" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
            <button onClick={handleSave} disabled={!code.trim() || !title.trim()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
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
            Alle ({warnings.length})
          </button>
          {categories.map(cat => {
            const count = warnings.filter(w => w.category === cat).length;
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

      {/* Warning list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Keine Warnhinweise vorhanden</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Titel</th>
                <th className="text-left px-4 py-3 font-medium">Text</th>
                <th className="text-left px-4 py-3 font-medium">Kategorie</th>
                <th className="text-center px-4 py-3 font-medium">Produkte</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(w => (
                <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-amber-700 dark:text-amber-400">{w.code}</td>
                  <td className="px-4 py-3 font-medium">{w.title}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-md truncate">{w.text}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">{w.category}</span></td>
                  <td className="px-4 py-3 text-center text-gray-500">{w.usage_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleEdit(w)} className="text-indigo-500 hover:text-indigo-700"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(w.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
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
