import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import type { Product } from '../types';
import { BulkStammdatenModal } from '../components/products/BulkStammdatenModal';
import { VariantGroupModal } from '../components/products/VariantGroupModal';
import { Pencil, CheckCircle2, AlertCircle, Search, Upload, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2, Archive, X, ClipboardEdit, ChevronRight, ChevronDown, GitBranch, Unlink, Copy, Check } from 'lucide-react';

type SortKey = 'artikelnummer' | 'artikelname' | 'ek' | 'preis' | 'gewicht' | 'hersteller' | 'ean' | 'status';
type SortDir = 'asc' | 'desc';
type EditingCell = { sku: string; field: string } | null;

export function StammdatenPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [archivedProducts, setArchivedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showArchive, setShowArchive] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newEk, setNewEk] = useState('');
  const [newPreis, setNewPreis] = useState('');
  const [newGewicht, setNewGewicht] = useState('');
  const [newHersteller, setNewHersteller] = useState('');
  const [newEan, setNewEan] = useState('');
  const [addError, setAddError] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkStammdaten, setShowBulkStammdaten] = useState(false);
  const [showVariantGroupModal, setShowVariantGroupModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const startEdit = useCallback((sku: string, field: string, currentValue: string) => {
    setEditingCell({ sku, field });
    setEditValue(currentValue);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingCell) return;
    const { sku, field } = editingCell;
    const numericFields = ['ek', 'preis', 'gewicht'];
    const val = editValue.trim();
    let payload: Record<string, string | number | null>;
    if (numericFields.includes(field)) {
      const parsed = val ? parseFloat(val.replace(',', '.')) : null;
      payload = { [field]: isNaN(parsed as number) ? null : parsed };
    } else {
      payload = { [field]: val || null };
    }
    try {
      const updated = await api.updateStammdaten(sku, payload);
      setProducts(prev => prev.map(p => p.artikelnummer === sku ? updated : p));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    }
    setEditingCell(null);
  }, [editingCell, editValue, toast]);

  const cancelEdit = useCallback(() => setEditingCell(null), []);

  const handleClone = useCallback(async (sku: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const cloned = await api.cloneProduct(sku);
      toast(`Geklont als ${cloned.artikelnummer}`, 'success');
      navigate(`/stammdaten/${encodeURIComponent(cloned.artikelnummer)}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Klonen fehlgeschlagen', 'error');
    }
  }, [toast, navigate]);

  const toggleGroupExpand = useCallback((parentSku: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(parentSku)) next.delete(parentSku);
      else next.add(parentSku);
      return next;
    });
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />;
  };

  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) => p.artikelnummer.toLowerCase().includes(q) || p.artikelname.toLowerCase().includes(q) ||
          (p.hersteller && p.hersteller.toLowerCase().includes(q)) ||
          (p.ean && p.ean.toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'status') cmp = Number(a.stammdaten_complete) - Number(b.stammdaten_complete);
        else if (sortKey === 'ek') cmp = (a.ek ?? -1) - (b.ek ?? -1);
        else if (sortKey === 'preis') cmp = (a.preis ?? -1) - (b.preis ?? -1);
        else if (sortKey === 'gewicht') cmp = (a.gewicht ?? -1) - (b.gewicht ?? -1);
        else {
          const va = (a[sortKey] as string | null) ?? '';
          const vb = (b[sortKey] as string | null) ?? '';
          cmp = va.localeCompare(vb);
        }
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return list;
  }, [products, searchQuery, sortKey, sortDir]);

  // Group products: parents with children, standalone products
  type GroupedRow = { type: 'standalone'; product: Product } | { type: 'parent'; product: Product; childCount: number } | { type: 'child'; product: Product; parentSku: string };
  const groupedRows = useMemo<GroupedRow[]>(() => {
    const childMap = new Map<string, Product[]>();
    const parentSet = new Set<string>();
    const childSet = new Set<string>();
    for (const p of filteredProducts) {
      if (p.is_parent) parentSet.add(p.artikelnummer);
      if (p.parent_sku) {
        childSet.add(p.artikelnummer);
        const list = childMap.get(p.parent_sku) || [];
        list.push(p);
        childMap.set(p.parent_sku, list);
      }
    }
    const rows: GroupedRow[] = [];
    for (const p of filteredProducts) {
      if (childSet.has(p.artikelnummer)) continue; // children rendered under parent
      if (parentSet.has(p.artikelnummer)) {
        const children = childMap.get(p.artikelnummer) || [];
        rows.push({ type: 'parent', product: p, childCount: children.length });
        if (expandedGroups.has(p.artikelnummer)) {
          for (const c of children) {
            rows.push({ type: 'child', product: c, parentSku: p.artikelnummer });
          }
        }
      } else {
        rows.push({ type: 'standalone', product: p });
      }
    }
    return rows;
  }, [filteredProducts, expandedGroups]);

  const filteredArchived = useMemo(() => {
    if (!searchQuery.trim()) return archivedProducts;
    const q = searchQuery.toLowerCase();
    return archivedProducts.filter(
      (p) => p.artikelnummer.toLowerCase().includes(q) || p.artikelname.toLowerCase().includes(q)
    );
  }, [archivedProducts, searchQuery]);

  const reload = async () => {
    setLoading(true);
    try {
      const [active, archived] = await Promise.all([
        api.getProducts(),
        api.getProducts(true),
      ]);
      setProducts(active);
      setArchivedProducts(archived);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Produkte konnten nicht geladen werden', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleClear = async () => {
    try {
      await api.clearProducts();
      setProducts([]);
      setArchivedProducts([]);
      toast('Alle Produkte gelöscht', 'success');
      navigate('/import');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Löschen fehlgeschlagen', 'error');
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const skus = Array.from(selectedSkus);
      const res = await api.deleteProducts(skus);
      setSelectedSkus(new Set());
      toast(`${res.deleted} Produkte gelöscht`, 'success');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Löschen fehlgeschlagen', 'error');
    }
  };

  const handleArchiveSelected = async () => {
    try {
      const skus = Array.from(selectedSkus);
      const res = await api.archiveProducts(skus);
      setSelectedSkus(new Set());
      toast(`${res.archived} Produkte archiviert`, 'success');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Archivieren fehlgeschlagen', 'error');
    }
  };

  const handleUnarchive = async (sku: string) => {
    try {
      await api.unarchiveProduct(sku);
      toast('Produkt wiederhergestellt', 'success');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Wiederherstellen fehlgeschlagen', 'error');
    }
  };

  const handleAddProduct = async () => {
    setAddError('');
    if (!newSku.trim() || !newName.trim()) {
      setAddError('Artikelnummer und Artikelname müssen ausgefüllt sein.');
      return;
    }
    try {
      await api.createProduct({
        artikelnummer: newSku.trim(),
        artikelname: newName.trim(),
        ek: newEk ? parseFloat(newEk.replace(',', '.')) : null,
        preis: newPreis ? parseFloat(newPreis.replace(',', '.')) : null,
        gewicht: newGewicht ? parseFloat(newGewicht.replace(',', '.')) : null,
        hersteller: newHersteller.trim() || null,
        ean: newEan.trim() || null,
      });
      setNewSku(''); setNewName(''); setNewEk(''); setNewPreis('');
      setNewGewicht(''); setNewHersteller(''); setNewEan('');
      setShowAddForm(false);
      toast('Produkt angelegt', 'success');
      navigate(`/stammdaten/${encodeURIComponent(newSku.trim())}`);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Fehler beim Anlegen');
    }
  };

  const allSelected = filteredProducts.length > 0 && selectedSkus.size === filteredProducts.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedSkus(new Set());
    } else {
      setSelectedSkus(new Set(filteredProducts.map((p) => p.artikelnummer)));
    }
  };
  const toggleSelect = (sku: string) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Stammdaten"
        description={`${products.length} aktiv · ${archivedProducts.length} archiviert`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const opening = !showAddForm;
                setShowAddForm(opening);
                if (opening) {
                  try {
                    const { sku } = await api.getNextSku();
                    setNewSku(sku);
                  } catch { /* leave empty */ }
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Artikel hinzufügen
            </button>
            {selectedSkus.size > 0 && !showArchive && (
              <>
                <button
                  onClick={() => setShowVariantGroupModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  <GitBranch className="w-4 h-4" />
                  Varianten gruppieren
                </button>
                <button
                  onClick={() => setShowBulkStammdaten(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <ClipboardEdit className="w-4 h-4" />
                  {selectedSkus.size} Stammdaten
                </button>
                <button
                  onClick={handleArchiveSelected}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  {selectedSkus.size} archivieren
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {selectedSkus.size} löschen
                </button>
              </>
            )}
            {products.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Alle löschen
              </button>
            )}
          </div>
        }
      />

      {/* Search + Archive toggle */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SKU, Name, Hersteller oder GTIN suchen…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setShowArchive(false); setSelectedSkus(new Set()); }}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              !showArchive
                ? 'bg-white text-gray-900 font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Aktiv ({products.length})
          </button>
          <button
            onClick={() => { setShowArchive(true); setSelectedSkus(new Set()); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors ${
              showArchive
                ? 'bg-white text-gray-900 font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Archiv ({archivedProducts.length})
          </button>
        </div>
      </div>

      {/* Inline Add Product Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Artikelnummer *</label>
              <input type="text" value={newSku} onChange={(e) => setNewSku(e.target.value)} placeholder="z.B. CYL-00999"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Artikelname *</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="z.B. Vibrator Deluxe"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">EK (Netto)</label>
              <input type="text" value={newEk}
                onChange={async (e) => {
                  const val = e.target.value;
                  setNewEk(val);
                  const parsed = parseFloat(val.replace(',', '.'));
                  if (!isNaN(parsed) && parsed > 0) {
                    try { const { vk } = await api.calculateVk(parsed); if (vk != null) setNewPreis(String(vk)); } catch { /* ignore */ }
                  }
                }}
                placeholder="z.B. 15,00"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Preis (VK)</label>
              <input type="text" value={newPreis} onChange={(e) => setNewPreis(e.target.value)} placeholder="z.B. 49,90"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Gewicht (g)</label>
              <input type="text" value={newGewicht} onChange={(e) => setNewGewicht(e.target.value)} placeholder="z.B. 250"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hersteller</label>
              <input type="text" value={newHersteller} onChange={(e) => setNewHersteller(e.target.value)} placeholder="z.B. Lovense"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">GTIN</label>
              <input type="text" value={newEan} onChange={(e) => setNewEan(e.target.value)} placeholder="z.B. 4260605481234"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleAddProduct}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              Anlegen
            </button>
            <button onClick={() => { setShowAddForm(false); setAddError(''); }}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner className="py-16" />
      ) : products.length === 0 && !showArchive ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">Keine aktiven Produkte vorhanden.</p>
          <button
            onClick={() => navigate('/import')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Produkte importieren
          </button>
        </div>
      ) : !showArchive ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="w-8 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="w-8 px-4 py-3 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('status')}>
                    <SortIcon col="status" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-[140px] cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('artikelnummer')}>
                    <span className="inline-flex items-center gap-1">Artikelnr. <SortIcon col="artikelnummer" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('artikelname')}>
                    <span className="inline-flex items-center gap-1">Artikelname <SortIcon col="artikelname" /></span>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 w-[100px] cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('ek')}>
                    <span className="inline-flex items-center gap-1 justify-end">EK (Netto) <SortIcon col="ek" /></span>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 w-[100px] cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('preis')}>
                    <span className="inline-flex items-center gap-1 justify-end">VK (Brutto) <SortIcon col="preis" /></span>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 w-[100px] cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('gewicht')}>
                    <span className="inline-flex items-center gap-1 justify-end">Gewicht (g) <SortIcon col="gewicht" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-[140px] cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('hersteller')}>
                    <span className="inline-flex items-center gap-1">Hersteller <SortIcon col="hersteller" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-[140px] cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('ean')}>
                    <span className="inline-flex items-center gap-1">GTIN <SortIcon col="ean" /></span>
                  </th>
                  <th className="px-4 py-3 w-[80px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupedRows.map((row) => {
                  const p = row.product;
                  const isChild = row.type === 'child';
                  const isParent = row.type === 'parent';
                  const expanded = isParent && expandedGroups.has(p.artikelnummer);
                  return (
                  <tr
                    key={p.artikelnummer}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedSkus.has(p.artikelnummer) ? 'bg-indigo-50/50' : ''} ${isChild ? 'bg-purple-50/30' : ''}`}
                    onClick={() => navigate(`/stammdaten/${encodeURIComponent(p.artikelnummer)}`)}
                  >
                    <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedSkus.has(p.artikelnummer)}
                        onChange={() => toggleSelect(p.artikelnummer)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      {p.stammdaten_complete ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">
                      <span className={`inline-flex items-center gap-1 ${isChild ? 'pl-6' : ''}`}>
                        {isParent && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleGroupExpand(p.artikelnummer); }}
                            className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                          >
                            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-purple-500" /> : <ChevronRight className="w-3.5 h-3.5 text-purple-500" />}
                          </button>
                        )}
                        {isChild && <span className="w-3 border-l-2 border-b-2 border-purple-200 h-3 mr-1 rounded-bl-sm" />}
                        {p.artikelnummer}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700 truncate max-w-[250px]">
                      <span className="inline-flex items-center gap-2">
                        {p.artikelname}
                        {isParent && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded-full dark:bg-purple-900/30 dark:text-purple-300">
                            <GitBranch className="w-3 h-3" />
                            Parent · {(row as { childCount: number }).childCount}
                          </span>
                        )}
                        {isChild && Object.entries(p.variant_attributes).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-600 rounded-full border border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700">
                            {v}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600 tabular-nums" onClick={(e) => { e.stopPropagation(); startEdit(p.artikelnummer, 'ek', p.ek != null ? p.ek.toFixed(2) : ''); }}>
                      {editingCell?.sku === p.artikelnummer && editingCell.field === 'ek' ? (
                        <input ref={editInputRef} type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          onBlur={saveEdit}
                          className="w-full px-1.5 py-0.5 text-sm text-right border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                      ) : (
                        <span className="cursor-pointer hover:text-indigo-600 hover:underline decoration-dashed underline-offset-2">{p.ek != null ? `${p.ek.toFixed(2)} €` : <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900 font-medium tabular-nums" onClick={(e) => { e.stopPropagation(); startEdit(p.artikelnummer, 'preis', p.preis != null ? p.preis.toFixed(2) : ''); }}>
                      {editingCell?.sku === p.artikelnummer && editingCell.field === 'preis' ? (
                        <input ref={editInputRef} type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          onBlur={saveEdit}
                          className="w-full px-1.5 py-0.5 text-sm text-right border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                      ) : (
                        <span className="cursor-pointer hover:text-indigo-600 hover:underline decoration-dashed underline-offset-2">{p.preis != null ? `${p.preis.toFixed(2)} €` : <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900 tabular-nums" onClick={(e) => { e.stopPropagation(); startEdit(p.artikelnummer, 'gewicht', p.gewicht != null ? String(p.gewicht) : ''); }}>
                      {editingCell?.sku === p.artikelnummer && editingCell.field === 'gewicht' ? (
                        <input ref={editInputRef} type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          onBlur={saveEdit}
                          className="w-full px-1.5 py-0.5 text-sm text-right border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                      ) : (
                        <span className="cursor-pointer hover:text-indigo-600 hover:underline decoration-dashed underline-offset-2">{p.gewicht != null ? `${p.gewicht} g` : <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600" onClick={(e) => { e.stopPropagation(); startEdit(p.artikelnummer, 'hersteller', p.hersteller || ''); }}>
                      {editingCell?.sku === p.artikelnummer && editingCell.field === 'hersteller' ? (
                        <input ref={editInputRef} type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          onBlur={saveEdit}
                          className="w-full px-1.5 py-0.5 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                      ) : (
                        <span className="cursor-pointer hover:text-indigo-600 hover:underline decoration-dashed underline-offset-2">{p.hersteller || <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500" onClick={(e) => { e.stopPropagation(); startEdit(p.artikelnummer, 'ean', p.ean || ''); }}>
                      {editingCell?.sku === p.artikelnummer && editingCell.field === 'ean' ? (
                        <input ref={editInputRef} type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          onBlur={saveEdit}
                          className="w-full px-1.5 py-0.5 text-sm font-mono border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                      ) : (
                        <span className="cursor-pointer hover:text-indigo-600 hover:underline decoration-dashed underline-offset-2">{p.ean || <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>
                    <td className="px-4 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center gap-0.5">
                        <button
                          onClick={(e) => handleClone(p.artikelnummer, e)}
                          className="p-1 rounded hover:bg-indigo-50 transition-colors"
                          title="Produkt klonen"
                        >
                          <Copy className="w-4 h-4 text-gray-400 hover:text-indigo-500" />
                        </button>
                        {isParent ? (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await api.deleteVariantGroup(p.artikelnummer);
                                toast('Varianten-Gruppe aufgelöst', 'success');
                                reload();
                              } catch (err) {
                                toast(err instanceof Error ? err.message : 'Fehler', 'error');
                              }
                            }}
                            className="p-1 rounded hover:bg-red-50 transition-colors"
                            title="Gruppe auflösen"
                          >
                            <Unlink className="w-4 h-4 text-gray-400 hover:text-red-500" />
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/stammdaten/${encodeURIComponent(p.artikelnummer)}`)}
                            className="p-1 rounded hover:bg-gray-100 transition-colors"
                            title="Bearbeiten"
                          >
                            <Pencil className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                  );
                })}
                {groupedRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-sm text-gray-400">
                      Keine Treffer für „{searchQuery}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Archive view */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-[140px]">Artikelnr.</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Artikelname</th>
                  <th className="px-4 py-3 w-[120px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredArchived.map((p) => (
                  <tr key={p.artikelnummer} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{p.artikelnummer}</td>
                    <td className="px-4 py-2 text-gray-700">{p.artikelname}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleUnarchive(p.artikelnummer)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Wiederherstellen
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredArchived.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-sm text-gray-400">
                      Keine archivierten Produkte.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <ConfirmDialog
          title="Alle Produkte löschen?"
          message={`Es werden ${products.length} aktive Produkte unwiderruflich gelöscht.`}
          confirmLabel="Alle löschen"
          variant="danger"
          onConfirm={() => { setShowClearConfirm(false); handleClear(); }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Ausgewählte Produkte löschen?"
          message={`${selectedSkus.size} Produkt${selectedSkus.size > 1 ? 'e werden' : ' wird'} unwiderruflich gelöscht.`}
          confirmLabel="Löschen"
          variant="danger"
          onConfirm={() => { setShowDeleteConfirm(false); handleDeleteSelected(); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {showBulkStammdaten && (
        <BulkStammdatenModal
          selectedSkus={Array.from(selectedSkus)}
          onClose={() => setShowBulkStammdaten(false)}
          onSaved={() => { setSelectedSkus(new Set()); reload(); }}
        />
      )}
      {showVariantGroupModal && (
        <VariantGroupModal
          selectedSkus={Array.from(selectedSkus)}
          products={products}
          onClose={() => setShowVariantGroupModal(false)}
          onSaved={() => { setSelectedSkus(new Set()); reload(); }}
        />
      )}
    </div>
  );
}
