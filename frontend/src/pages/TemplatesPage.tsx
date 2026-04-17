import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Search, Pencil, Copy, FileText, ChevronRight, Folder, Save, X, Package, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { TemplateAttributeEditor } from '../components/products/TemplateAttributeEditor';
import { api } from '../api/client';
import type { Template, AttributeConfig } from '../types';

const UNCATEGORIZED = 'Ohne Kategorie';

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renameOf, setRenameOf] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [cloneOf, setCloneOf] = useState<string | null>(null);
  const [cloneValue, setCloneValue] = useState('');
  const [editMeta, setEditMeta] = useState<string | null>(null);
  const [metaCategory, setMetaCategory] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [attrEditorFor, setAttrEditorFor] = useState<string | null>(null);
  const [attributeConfig, setAttributeConfig] = useState<AttributeConfig>({});
  const { toast } = useToast();

  const load = async () => {
    try {
      const [data, cats, config] = await Promise.all([
        api.getTemplates(),
        api.getTemplateCategories(),
        api.getAttributeConfig(),
      ]);
      setTemplates(data);
      setCategories(cats);
      setAttributeConfig(config);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Laden fehlgeschlagen', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups: Record<string, Template[]> = {};
    for (const tpl of Object.values(templates)) {
      if (q) {
        const hay = `${tpl.name} ${tpl.category} ${tpl.description}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const cat = tpl.category.trim() || UNCATEGORIZED;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tpl);
    }
    for (const c of Object.keys(groups)) {
      groups[c].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }
    return groups;
  }, [templates, search]);

  const sortedCategories = useMemo(() => (
    Object.keys(grouped).sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b, 'de');
    })
  ), [grouped]);

  const toggle = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await api.createTemplate(name, {}, newCategory.trim(), '');
      setNewName(''); setNewCategory(''); setCreating(false);
      toast('Vorlage erstellt', 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erstellen fehlgeschlagen', 'error');
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.deleteTemplate(name);
      toast('Vorlage gelöscht', 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Löschen fehlgeschlagen', 'error');
    }
    setDeleteTarget(null);
  };

  const handleRename = async () => {
    if (!renameOf) return;
    const next = renameValue.trim();
    if (!next || next === renameOf) { setRenameOf(null); return; }
    try {
      await api.renameTemplate(renameOf, next);
      setRenameOf(null);
      toast('Vorlage umbenannt', 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Umbenennen fehlgeschlagen', 'error');
    }
  };

  const handleClone = async () => {
    if (!cloneOf) return;
    const next = cloneValue.trim();
    if (!next) return;
    try {
      await api.cloneTemplate(cloneOf, next);
      setCloneOf(null); setCloneValue('');
      toast('Vorlage dupliziert', 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Klonen fehlgeschlagen', 'error');
    }
  };

  const openMeta = (tpl: Template) => {
    setEditMeta(tpl.name);
    setMetaCategory(tpl.category);
    setMetaDescription(tpl.description);
  };

  const saveMeta = async () => {
    if (!editMeta) return;
    try {
      await api.updateTemplateMeta(editMeta, { category: metaCategory.trim(), description: metaDescription.trim() });
      setEditMeta(null);
      toast('Metadaten gespeichert', 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    }
  };

  if (loading) return <div className="p-10"><LoadingSpinner /></div>;

  const templateCount = Object.keys(templates).length;

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Vorlagen-Verwaltung"
        description={`${templateCount} Vorlagen · ${categories.length} Kategorien`}
        actions={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neue Vorlage
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Name, Kategorie oder Notiz…"
          className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
      </div>

      {/* Create inline */}
      {creating && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Name</label>
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                placeholder="z. B. GPSR Standard"
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Kategorie</label>
              <input
                list="tpl-new-cats"
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="optional"
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <datalist id="tpl-new-cats">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!newName.trim()} className="px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40">
              Erstellen
            </button>
            <button onClick={() => { setCreating(false); setNewName(''); setNewCategory(''); }} className="px-4 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-white">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Groups */}
      {templateCount === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-14 text-center">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">Noch keine Vorlagen angelegt</p>
        </div>
      ) : sortedCategories.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-400">Keine Treffer</div>
      ) : (
        <div className="space-y-5">
          {sortedCategories.map((cat) => {
            const group = grouped[cat];
            const isCollapsed = collapsed.has(cat);
            return (
              <div key={cat}>
                <button
                  onClick={() => toggle(cat)}
                  className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                  <Folder className="w-3.5 h-3.5" />
                  <span>{cat}</span>
                  <span className="font-normal text-gray-400">· {group.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {group.map((tpl) => {
                      const count = Object.keys(tpl.attributes).length;
                      const filled = Object.values(tpl.attributes).filter((v) => v !== '' && v !== undefined).length;
                      const isEditingMeta = editMeta === tpl.name;
                      const isRenaming = renameOf === tpl.name;
                      const isCloning = cloneOf === tpl.name;
                      return (
                        <div key={tpl.name} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2 hover:border-indigo-200 dark:hover:border-indigo-400 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                              {tpl.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              {isRenaming ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameOf(null); }}
                                  onBlur={handleRename}
                                  className="w-full px-2 py-1 text-sm font-semibold border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              ) : (
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{tpl.name}</p>
                              )}
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                <Package className="w-3 h-3 inline -mt-0.5 mr-1" />
                                {filled}/{count} Attribute
                              </p>
                            </div>
                          </div>

                          {isEditingMeta ? (
                            <div className="space-y-2 pt-1">
                              <input
                                list="tpl-cats"
                                type="text"
                                value={metaCategory}
                                onChange={(e) => setMetaCategory(e.target.value)}
                                placeholder="Kategorie…"
                                className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                              <datalist id="tpl-cats">
                                {categories.map((c) => <option key={c} value={c} />)}
                              </datalist>
                              <textarea
                                value={metaDescription}
                                onChange={(e) => setMetaDescription(e.target.value)}
                                rows={2}
                                placeholder="Kurze Beschreibung…"
                                className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                              />
                              <div className="flex gap-1.5">
                                <button onClick={saveMeta} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700">
                                  <Save className="w-3 h-3" /> Speichern
                                </button>
                                <button onClick={() => setEditMeta(null)} className="px-2 py-1 text-xs text-gray-500 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400 min-h-[2rem] line-clamp-2">
                              {tpl.description || <span className="italic text-gray-300 dark:text-gray-600">Keine Notiz</span>}
                            </p>
                          )}

                          {isCloning && (
                            <div className="flex gap-1.5 pt-1">
                              <input
                                autoFocus
                                type="text"
                                value={cloneValue}
                                onChange={(e) => setCloneValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleClone(); if (e.key === 'Escape') setCloneOf(null); }}
                                placeholder="Neuer Name…"
                                className="flex-1 px-2 py-1 text-xs border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                              <button onClick={handleClone} className="px-2 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700">
                                OK
                              </button>
                              <button onClick={() => setCloneOf(null)} className="px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                            <button
                              onClick={() => setAttrEditorFor(tpl.name)}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors font-medium"
                              title="Attribute der Vorlage bearbeiten"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              Attribute
                            </button>
                            <button
                              onClick={() => openMeta(tpl)}
                              disabled={isEditingMeta}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors disabled:opacity-40"
                              title="Kategorie & Notiz"
                            >
                              <Folder className="w-3.5 h-3.5" />
                              Meta
                            </button>
                            <button
                              onClick={() => { setRenameOf(tpl.name); setRenameValue(tpl.name); }}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                              title="Umbenennen"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Umbenennen
                            </button>
                            <button
                              onClick={() => { setCloneOf(tpl.name); setCloneValue(`${tpl.name} (Kopie)`); }}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                              title="Duplizieren"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Duplizieren
                            </button>
                            <button
                              onClick={() => setDeleteTarget(tpl.name)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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

      {attrEditorFor && templates[attrEditorFor] && (
        <TemplateAttributeEditor
          template={templates[attrEditorFor]}
          attributeConfig={attributeConfig}
          onClose={() => setAttrEditorFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
