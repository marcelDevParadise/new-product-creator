import { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import { api } from '../api/client';
import { PageHeader } from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import type { Supplier } from '../types';

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900';

export function SuppliersPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
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

  const create = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await api.createSupplier(newName);
      setNewName('');
      await load();
      toast('Lieferant angelegt', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Lieferant konnte nicht angelegt werden', 'error');
    } finally {
      setSaving(false);
    }
  };

  const update = async () => {
    if (editingId === null || !editingName.trim() || saving) return;
    setSaving(true);
    try {
      await api.updateSupplier(editingId, editingName);
      setEditingId(null);
      setEditingName('');
      await load();
      toast('Lieferant aktualisiert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Lieferant konnte nicht aktualisiert werden', 'error');
    } finally {
      setSaving(false);
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

  const visibleSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (loading) return <LoadingSpinner className="h-full" />;

  return (
    <div className="p-4 md:p-8 space-y-6">
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
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Neuen Lieferanten anlegen</h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              autoFocus
              className={inputClass}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') create(); }}
              placeholder="Name des Lieferanten"
              maxLength={200}
            />
            <button
              type="button"
              onClick={create}
              disabled={!newName.trim() || saving}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Anlegen
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Alle Lieferanten</h3>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              className={`${inputClass} pl-9`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Lieferanten suchen…"
            />
          </div>
        </div>

        {visibleSuppliers.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-500">
            <Truck className="mx-auto mb-3 h-10 w-10 opacity-25" />
            {suppliers.length === 0 ? 'Noch keine Lieferanten angelegt.' : 'Keine passenden Lieferanten gefunden.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {visibleSuppliers.map((supplier) => (
              <div key={supplier.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                {editingId === supplier.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      className={inputClass}
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') update();
                        if (event.key === 'Escape') setEditingId(null);
                      }}
                      maxLength={200}
                    />
                    <button type="button" onClick={update} disabled={!editingName.trim() || saving} className="rounded-lg p-2 text-green-600 hover:bg-green-50 disabled:opacity-50 dark:hover:bg-green-950/40" title="Speichern">
                      <Check className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" title="Abbrechen">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{supplier.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {supplier.product_count} Artikel {supplier.product_count === 1 ? 'zugeordnet' : 'zugeordnet'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => { setEditingId(supplier.id); setEditingName(supplier.name); }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40"
                        title="Bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(supplier)}
                        disabled={supplier.product_count > 0}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/40"
                        title={supplier.product_count > 0 ? 'Lieferant ist Artikeln zugeordnet' : 'Löschen'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
