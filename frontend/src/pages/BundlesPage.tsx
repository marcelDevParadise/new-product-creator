import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Trash2, Edit, X, Search } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/ui/Toast';
import { PageHeader } from '../components/layout/PageHeader';
import type { Bundle, Product } from '../types';

export function BundlesPage() {
  const { toast } = useToast();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<{ artikelnummer: string; quantity: number }[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  const load = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([api.getBundles(), api.getProducts()]);
      setBundles(b);
      setProducts(p);
    } catch {
      toast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (productSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const q = productSearch.toLowerCase();
    setSearchResults(
      products
        .filter(p => p.artikelnummer.toLowerCase().includes(q) || (p.artikelname || '').toLowerCase().includes(q))
        .filter(p => !items.some(i => i.artikelnummer === p.artikelnummer))
        .slice(0, 10)
    );
  }, [productSearch, products, items]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setItems([]);
    setProductSearch('');
    setShowCreate(false);
    setEditId(null);
  };

  const handleSave = async () => {
    if (!name.trim() || items.length === 0) {
      toast('Name und mindestens ein Produkt erforderlich', 'error');
      return;
    }
    try {
      if (editId !== null) {
        await api.updateBundle(editId, { name, description, items });
        toast('Bundle aktualisiert', 'success');
      } else {
        await api.createBundle({ name, description, items });
        toast('Bundle erstellt', 'success');
      }
      resetForm();
      load();
    } catch {
      toast('Fehler beim Speichern', 'error');
    }
  };

  const handleEdit = (bundle: Bundle) => {
    setEditId(bundle.id);
    setName(bundle.name);
    setDescription(bundle.description);
    setItems(bundle.items.map(i => ({ artikelnummer: i.artikelnummer, quantity: i.quantity })));
    setShowCreate(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteBundle(id);
      toast('Bundle gelöscht', 'success');
      load();
    } catch {
      toast('Fehler beim Löschen', 'error');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Bundles & Sets"
        subtitle={`${bundles.length} Bundle${bundles.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={() => { resetForm(); setShowCreate(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Neues Bundle
          </button>
        }
      />

      {/* Create/Edit Form */}
      {showCreate && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{editId ? 'Bundle bearbeiten' : 'Neues Bundle'}</h3>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Bundle-Name" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Beschreibung</label>
              <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Optionale Beschreibung" />
            </div>
          </div>

          {/* Product search */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Produkte hinzufügen</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Artikelnummer oder Name suchen…"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {searchResults.map(p => (
                    <button
                      key={p.artikelnummer}
                      onClick={() => {
                        setItems([...items, { artikelnummer: p.artikelnummer, quantity: 1 }]);
                        setProductSearch('');
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between"
                    >
                      <span className="font-mono text-xs text-gray-500">{p.artikelnummer}</span>
                      <span className="truncate ml-2">{p.artikelname || '—'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          {items.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Artikelnummer</th>
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-center px-4 py-2 font-medium">Menge</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((item, idx) => {
                    const p = products.find(pr => pr.artikelnummer === item.artikelnummer);
                    return (
                      <tr key={item.artikelnummer}>
                        <td className="px-4 py-2 font-mono text-xs">{item.artikelnummer}</td>
                        <td className="px-4 py-2">{p?.artikelname || '—'}</td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => {
                              const updated = [...items];
                              updated[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                              setItems(updated);
                            }}
                            className="w-16 text-center px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
            <button onClick={handleSave} disabled={!name.trim() || items.length === 0} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {editId ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {/* Bundle list */}
      {bundles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Noch keine Bundles erstellt</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bundles.map(bundle => (
            <div key={bundle.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{bundle.name}</h3>
                  {bundle.description && <p className="text-sm text-gray-500 mt-0.5">{bundle.description}</p>}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{bundle.items.length} Produkt{bundle.items.length !== 1 ? 'e' : ''}</span>
                  {bundle.total_ek > 0 && <span>EK: {bundle.total_ek.toFixed(2)} €</span>}
                  {bundle.total_vk > 0 && <span>VK: {bundle.total_vk.toFixed(2)} €</span>}
                  <button onClick={() => handleEdit(bundle)} className="text-indigo-500 hover:text-indigo-700"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(bundle.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">Artikelnummer</th>
                      <th className="text-left px-3 py-1.5 font-medium">Name</th>
                      <th className="text-center px-3 py-1.5 font-medium">Menge</th>
                      <th className="text-right px-3 py-1.5 font-medium">EK</th>
                      <th className="text-right px-3 py-1.5 font-medium">VK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {bundle.items.map(item => (
                      <tr key={item.artikelnummer}>
                        <td className="px-3 py-1.5 font-mono text-xs">{item.artikelnummer}</td>
                        <td className="px-3 py-1.5">{item.artikelname}</td>
                        <td className="px-3 py-1.5 text-center">{item.quantity}</td>
                        <td className="px-3 py-1.5 text-right">{item.ek != null ? `${(item.ek * item.quantity).toFixed(2)} €` : '—'}</td>
                        <td className="px-3 py-1.5 text-right">{item.preis != null ? `${(item.preis * item.quantity).toFixed(2)} €` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
