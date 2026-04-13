import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { ProductList } from '../components/products/ProductList';
import { BulkAttributeModal } from '../components/products/BulkAttributeModal';
import { TemplateModal } from '../components/products/TemplateModal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import type { Product, AttributeConfig } from '../types';
import { Edit, FileText, Search, Filter } from 'lucide-react';

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
  const { toast } = useToast();

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
        </div>
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
