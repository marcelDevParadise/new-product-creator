import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { ProductList } from '../components/products/ProductList';
import { BulkAttributeModal } from '../components/products/BulkAttributeModal';
import { TemplateModal } from '../components/products/TemplateModal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import type { Product, AttributeConfig } from '../types';
import { Edit, FileText, Search, Filter, Bookmark, BookmarkPlus, X, Trash2 } from 'lucide-react';

interface SavedFilter {
  name: string;
  searchQuery: string;
  filterStammdaten: 'all' | 'complete' | 'incomplete';
  filterAttributes: 'all' | 'has' | 'none';
}

const FILTERS_STORAGE_KEY = 'attributGenerator_savedFilters_products';

function loadSavedFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistFilters(filters: SavedFilter[]) {
  localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [attributeConfig, setAttributeConfig] = useState<AttributeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStammdaten, setFilterStammdaten] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [filterAttributes, setFilterAttributes] = useState<'all' | 'has' | 'none'>('all');
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(loadSavedFilters);
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const { toast } = useToast();

  const hasActiveFilter = searchQuery.trim() !== '' || filterStammdaten !== 'all' || filterAttributes !== 'all';

  const saveCurrentFilter = useCallback(() => {
    const name = newFilterName.trim();
    if (!name) return;
    const filter: SavedFilter = { name, searchQuery, filterStammdaten, filterAttributes };
    const updated = [...savedFilters.filter((f) => f.name !== name), filter];
    setSavedFilters(updated);
    persistFilters(updated);
    setNewFilterName('');
    setShowSaveFilter(false);
    toast(`Filter "${name}" gespeichert`, 'success');
  }, [newFilterName, searchQuery, filterStammdaten, filterAttributes, savedFilters]);

  const applyFilter = useCallback((f: SavedFilter) => {
    setSearchQuery(f.searchQuery);
    setFilterStammdaten(f.filterStammdaten);
    setFilterAttributes(f.filterAttributes);
  }, []);

  const deleteFilter = useCallback((name: string) => {
    const updated = savedFilters.filter((f) => f.name !== name);
    setSavedFilters(updated);
    persistFilters(updated);
  }, [savedFilters]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterStammdaten('all');
    setFilterAttributes('all');
  }, []);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) => p.artikelnummer.toLowerCase().includes(q) || p.artikelname.toLowerCase().includes(q)
      );
    }
    if (filterStammdaten === 'complete') list = list.filter((p) => p.stammdaten_complete);
    if (filterStammdaten === 'incomplete') list = list.filter((p) => !p.stammdaten_complete);
    if (filterAttributes === 'has') list = list.filter((p) => Object.keys(p.attributes).length > 0);
    if (filterAttributes === 'none') list = list.filter((p) => Object.keys(p.attributes).length === 0);
    return list;
  }, [products, searchQuery, filterStammdaten, filterAttributes]);

  const reload = async () => {
    setLoading(true);
    try {
      const active = await api.getProducts();
      setProducts(active);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Produkte konnten nicht geladen werden', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    api.getAttributeConfig().then(setAttributeConfig).catch((e) => {
      toast(e instanceof Error ? e.message : 'Attribut-Konfiguration konnte nicht geladen werden', 'error');
    });
  }, []);

  const handleBulkSaved = () => {
    setSelectedSkus(new Set());
    reload();
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Attribute"
        description={`${products.length} aktive Produkte`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Vorlagen
            </button>
            {selectedSkus.size > 0 && (
              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <Edit className="w-4 h-4" />
                {selectedSkus.size} bearbeiten
              </button>
            )}
          </div>
        }
      />

      {/* Search bar + Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SKU oder Name suchen…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={filterStammdaten}
              onChange={(e) => setFilterStammdaten(e.target.value as 'all' | 'complete' | 'incomplete')}
              className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Stammdaten: Alle</option>
              <option value="complete">Stammdaten: Vollständig</option>
              <option value="incomplete">Stammdaten: Unvollständig</option>
            </select>
            <select
              value={filterAttributes}
              onChange={(e) => setFilterAttributes(e.target.value as 'all' | 'has' | 'none')}
              className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Attribute: Alle</option>
              <option value="has">Attribute: Vorhanden</option>
              <option value="none">Attribute: Keine</option>
            </select>
            {hasActiveFilter && (
              <>
                <button
                  onClick={resetFilters}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-2"
                  title="Filter zurücksetzen"
                >
                  <X className="w-3.5 h-3.5" /> Zurücksetzen
                </button>
                <button
                  onClick={() => setShowSaveFilter(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-2"
                  title="Aktuellen Filter speichern"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" /> Speichern
                </button>
              </>
            )}
          </div>
        </div>
        {/* Save filter input */}
        {showSaveFilter && (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentFilter(); if (e.key === 'Escape') setShowSaveFilter(false); }}
              placeholder="Filtername eingeben…"
              className="text-xs border border-indigo-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
            />
            <button onClick={saveCurrentFilter} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Speichern</button>
            <button onClick={() => setShowSaveFilter(false)} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700">Abbrechen</button>
          </div>
        )}
        {/* Saved filter chips */}
        {savedFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Bookmark className="w-3.5 h-3.5 text-gray-400" />
            {savedFilters.map((sf) => (
              <span
                key={sf.name}
                className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors group"
              >
                <button onClick={() => applyFilter(sf)} className="hover:underline">{sf.name}</button>
                <button onClick={() => deleteFilter(sf.name)} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 hover:text-red-500" title="Filter löschen">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSpinner className="py-16" />
      ) : (
        <ProductList
          products={filteredProducts}
          selectedSkus={selectedSkus}
          onSelectionChange={setSelectedSkus}
        />
      )}

      {showBulkModal && attributeConfig && (
        <BulkAttributeModal
          selectedSkus={Array.from(selectedSkus)}
          attributeConfig={attributeConfig}
          onClose={() => setShowBulkModal(false)}
          onSaved={handleBulkSaved}
        />
      )}
      {showTemplateModal && attributeConfig && (
        <TemplateModal
          selectedSkus={Array.from(selectedSkus)}
          attributeConfig={attributeConfig}
          onClose={() => setShowTemplateModal(false)}
          onApplied={() => { setSelectedSkus(new Set()); reload(); }}
        />
      )}
    </div>
  );
}
