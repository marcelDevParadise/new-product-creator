import { useCallback, useEffect, useState } from 'react';
import { CloudDownload, CloudUpload, Pencil, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import { api } from '../api/client';
import { PageHeader } from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import type { Supplier, SupplierPayload } from '../types';

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900';

type SupplierForm = {
  name: string;
  supplier_number: string;
  currency: string;
  email: string;
  phone: string;
  website: string;
  active: boolean;
  default_company_id: string;
  default_warehouse_id: string;
};

const emptyForm: SupplierForm = {
  name: '', supplier_number: '', currency: 'EUR', email: '', phone: '', website: '',
  active: true, default_company_id: '', default_warehouse_id: '',
};

function toForm(supplier: Supplier): SupplierForm {
  return {
    name: supplier.name,
    supplier_number: supplier.supplier_number || '',
    currency: supplier.currency || 'EUR',
    email: supplier.email || '',
    phone: supplier.phone || '',
    website: supplier.website || '',
    active: supplier.active,
    default_company_id: supplier.default_company_id?.toString() || '',
    default_warehouse_id: supplier.default_warehouse_id?.toString() || '',
  };
}

function toPayload(form: SupplierForm): SupplierPayload {
  const nullable = (value: string) => value.trim() || null;
  const positiveInt = (value: string) => value ? Number(value) : null;
  return {
    name: form.name.trim(),
    supplier_number: nullable(form.supplier_number),
    currency: form.currency.trim().toUpperCase() || 'EUR',
    email: nullable(form.email),
    phone: nullable(form.phone),
    website: nullable(form.website),
    active: form.active,
    default_company_id: positiveInt(form.default_company_id),
    default_warehouse_id: positiveInt(form.default_warehouse_id),
  };
}

export function SuppliersPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    try {
      setSuppliers(await api.getSuppliers());
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Lieferanten konnten nicht geladen werden', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editingId === null) {
        await api.createSupplier(payload);
        toast('Lieferant angelegt', 'success');
      } else {
        await api.updateSupplier(editingId, payload);
        toast('Lieferant aktualisiert', 'success');
      }
      closeForm();
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Lieferant konnte nicht gespeichert werden', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sync = async (supplier: Supplier) => {
    setSyncingId(supplier.id);
    try {
      await api.publishSupplierToArtikelwerk(supplier.id);
      await load();
      toast('Lieferant wurde in Artikelwerk angelegt', 'success');
    } catch (error) {
      await load();
      toast(error instanceof Error ? error.message : 'Übertragung an Artikelwerk fehlgeschlagen', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  const importFromArtikelwerk = async () => {
    setImporting(true);
    try {
      const result = await api.importSuppliersFromArtikelwerk();
      await load();
      toast(`${result.imported} Lieferanten übernommen (${result.created} neu, ${result.updated} aktualisiert)`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Artikelwerk-Lieferanten konnten nicht geladen werden', 'error');
    } finally {
      setImporting(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteSupplier(deleteTarget.id);
      setDeleteTarget(null);
      await load();
      toast('Lieferant gelöscht', 'success');
    } catch (error) {
      setDeleteTarget(null);
      toast(error instanceof Error ? error.message : 'Lieferant konnte nicht gelöscht werden', 'error');
    }
  };

  const visibleSuppliers = suppliers.filter((supplier) => {
    const query = search.trim().toLowerCase();
    return supplier.name.toLowerCase().includes(query)
      || (supplier.supplier_number || '').toLowerCase().includes(query);
  });

  if (loading) return <LoadingSpinner className="h-full" />;

  return (
    <div className="space-y-6 p-4 md:p-8">
      {deleteTarget && (
        <ConfirmDialog
          title="Lieferant löschen"
          message={`Möchtest du „${deleteTarget.name}“ wirklich löschen?`}
          confirmLabel="Löschen"
          variant="danger"
          onConfirm={remove}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <PageHeader
        title="Lieferanten"
        description={`${suppliers.length} Lieferant${suppliers.length === 1 ? '' : 'en'} angelegt`}
        icon={Truck}
        actions={(
          <>
            <button
              type="button"
              onClick={importFromArtikelwerk}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <CloudDownload className="h-4 w-4" /> {importing ? 'Lädt…' : 'Aus Artikelwerk laden'}
            </button>
            <button
              type="button"
              onClick={() => { setForm(emptyForm); setEditingId(null); setFormOpen(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Neuer Lieferant
            </button>
          </>
        )}
      />

      {formOpen && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{editingId === null ? 'Neuer Lieferant' : 'Lieferant bearbeiten'}</h3>
              <p className="text-xs text-gray-500">Die Artikelwerk-Pflichtfelder sind entsprechend markiert.</p>
            </div>
            <button type="button" onClick={closeForm} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Name *
              <input className={`${inputClass} mt-1`} value={form.name} maxLength={255} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Lieferantennummer (Artikelwerk *)
              <input className={`${inputClass} mt-1`} value={form.supplier_number} maxLength={64} onChange={(event) => setForm({ ...form, supplier_number: event.target.value })} />
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Währung
              <input className={`${inputClass} mt-1 uppercase`} value={form.currency} maxLength={3} onChange={(event) => setForm({ ...form, currency: event.target.value })} />
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">E-Mail
              <input type="email" className={`${inputClass} mt-1`} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Telefon
              <input className={`${inputClass} mt-1`} value={form.phone} maxLength={30} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Website
              <input type="url" className={`${inputClass} mt-1`} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Standardfirma-ID (Artikelwerk *)
              <input type="number" min={1} className={`${inputClass} mt-1`} value={form.default_company_id} onChange={(event) => setForm({ ...form, default_company_id: event.target.value })} />
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Standardlager-ID (Artikelwerk *)
              <input type="number" min={1} className={`${inputClass} mt-1`} value={form.default_warehouse_id} onChange={(event) => setForm({ ...form, default_warehouse_id: event.target.value })} />
            </label>
            <label className="flex items-center gap-2 self-end py-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Aktiv
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">Abbrechen</button>
            <button type="button" onClick={save} disabled={!form.name.trim() || saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Speichert…' : 'Speichern'}</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Alle Lieferanten</h3>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name oder Nummer suchen…" />
          </div>
        </div>

        {visibleSuppliers.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-500"><Truck className="mx-auto mb-3 h-10 w-10 opacity-25" />Noch keine passenden Lieferanten.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {visibleSuppliers.map((supplier) => {
              const readyForArtikelwerk = !!supplier.supplier_number && !!supplier.default_company_id && !!supplier.default_warehouse_id;
              return (
                <div key={supplier.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{supplier.name}</p>
                      {supplier.articlewerk_supplier_id ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Artikelwerk #{supplier.articlewerk_supplier_id}</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800">Nur lokal</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {supplier.supplier_number || 'Keine Lieferantennummer'} · {supplier.product_count} Artikel zugeordnet
                    </p>
                    {supplier.articlewerk_sync_error && <p className="mt-1 text-xs text-red-600">{supplier.articlewerk_sync_error}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 self-end sm:self-auto">
                    {!supplier.articlewerk_supplier_id && (
                      <button
                        type="button"
                        onClick={() => sync(supplier)}
                        disabled={!readyForArtikelwerk || syncingId === supplier.id}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-35 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                        title={readyForArtikelwerk ? 'In Artikelwerk anlegen' : 'Artikelwerk-Pflichtfelder ergänzen'}
                      >
                        <CloudUpload className="h-4 w-4" /> {syncingId === supplier.id ? 'Überträgt…' : 'Artikelwerk'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEditingId(supplier.id); setForm(toForm(supplier)); setFormOpen(true); }}
                      disabled={!!supplier.articlewerk_supplier_id}
                      className="rounded-lg p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-indigo-950/40"
                      title={supplier.articlewerk_supplier_id ? 'Artikelwerk bietet noch keine Lieferanten-Aktualisierung an' : 'Bearbeiten'}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(supplier)} disabled={supplier.product_count > 0 || !!supplier.articlewerk_supplier_id} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/40" title={supplier.articlewerk_supplier_id ? 'Bereits mit Artikelwerk synchronisiert' : supplier.product_count > 0 ? 'Lieferant ist Artikeln zugeordnet' : 'Löschen'}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
