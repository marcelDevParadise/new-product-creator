import { useCallback, useState, useEffect, useMemo } from 'react';
import type { DragEvent } from 'react';
import {
  Search, Plus, Pencil, Trash2, X, Check, Filter, ArrowUp, ArrowDown,
  Hash, Tag, FileText, List, Settings2, AlertCircle, Download, Upload,
  ChevronLeft, ChevronRight, Layers3, Asterisk, FolderTree, RotateCcw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import type { AttributeConfig, AttributeDefinition, AttributeImportResult } from '../types';

export function AttributesPage() {
  const [config, setConfig] = useState<AttributeConfig>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [requiredFilter, setRequiredFilter] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const reload = async () => {
    setLoading(true);
    try {
      const c = await api.getAttributeConfig();
      setConfig(c);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fehler beim Laden der Attribute', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  // Group by category
  const categories = useMemo(() => {
    const map = new Map<string, { key: string; def: AttributeDefinition }[]>();
    for (const [key, def] of Object.entries(config)) {
      if (!map.has(def.category)) map.set(def.category, []);
      map.get(def.category)!.push({ key, def });
    }
    return map;
  }, [config]);

  const allCategoryNames = useMemo(() => Array.from(categories.keys()), [categories]);

  // Keep a selected category valid after imports and deletions.
  useEffect(() => {
    if (activeCategory !== null && !categories.has(activeCategory)) {
      setActiveCategory(null);
    }
  }, [activeCategory, categories]);

  // Filtered list for current view
  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase();
    let entries: { key: string; def: AttributeDefinition }[] = [];

    if (q || activeCategory === null) {
      for (const items of categories.values()) {
        entries.push(...items);
      }
      if (q) {
        entries = entries.filter(({ key, def }) =>
          def.name.toLowerCase().includes(q) ||
          key.toLowerCase().includes(q) ||
          def.description.toLowerCase().includes(q) ||
          def.id.toLowerCase().includes(q) ||
          def.category.toLowerCase().includes(q)
        );
      }
    } else if (activeCategory) {
      entries = categories.get(activeCategory) ?? [];
    }

    if (requiredFilter) {
      entries = entries.filter(({ def }) => def.required);
    }

    return entries;
  }, [categories, activeCategory, search, requiredFilter]);

  const handleDelete = async (key: string) => {
    try {
      await api.deleteAttributeDefinition(key);
      toast('Attribut gelöscht', 'success');
      setShowDeleteConfirm(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Löschen fehlgeschlagen', 'error');
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const result = await api.resetAttributeDefinitions();
      toast(`${result.deleted} Attributdefinitionen gelöscht`, 'success');
      setShowDeleteAllConfirm(false);
      setActiveCategory(null);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Zurücksetzen fehlgeschlagen', 'error');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleMove = async (key: string, direction: 'up' | 'down') => {
    if (!activeCategory || search) return;
    const items = categories.get(activeCategory);
    if (!items) return;
    const idx = items.findIndex((i) => i.key === key);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    // Build full ordered key list with the swap applied
    const allKeys = Object.keys(config);
    const globalIdx = allKeys.indexOf(key);
    const globalSwap = allKeys.indexOf(items[swapIdx].key);
    const reordered = [...allKeys];
    [reordered[globalIdx], reordered[globalSwap]] = [reordered[globalSwap], reordered[globalIdx]];
    try {
      await api.reorderAttributeDefinitions(reordered);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sortierung fehlgeschlagen', 'error');
    }
  };

  const handleMoveCategory = async (category: string, direction: 'up' | 'down') => {
    const idx = allCategoryNames.indexOf(category);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= allCategoryNames.length) return;

    const newCatOrder = [...allCategoryNames];
    [newCatOrder[idx], newCatOrder[swapIdx]] = [newCatOrder[swapIdx], newCatOrder[idx]];

    // Build full key list: all keys grouped by the new category order,
    // preserving existing order within each category.
    const reordered: string[] = [];
    for (const cat of newCatOrder) {
      for (const { key } of categories.get(cat) ?? []) {
        reordered.push(key);
      }
    }
    try {
      await api.reorderAttributeDefinitions(reordered);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sortierung fehlgeschlagen', 'error');
    }
  };

  const totalCount = Object.keys(config).length;
  const requiredCount = Object.values(config).filter((def) => def.required).length;
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const visibleEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, activeCategory, requiredFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const clearFilters = () => {
    setSearch('');
    setActiveCategory(null);
    setRequiredFilter(false);
  };

  return (
    <div className="min-h-full">
      <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_28rem)]">
        <div className="mx-auto w-full max-w-[1680px] space-y-5 p-4 md:p-6 xl:p-8">
          <header className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                <Settings2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Konfiguration</p>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Attribute</h1>
                <p className="mt-1 text-sm text-muted-foreground">Produktdaten zentral strukturieren und pflegen.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="mr-2 h-4 w-4" />CSV importieren
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await api.downloadAttributesJson();
                    toast('JSON-Export gestartet', 'success');
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Export fehlgeschlagen', 'error');
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />Exportieren
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={totalCount === 0}
                onClick={() => setShowDeleteAllConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />Alle löschen
              </Button>
              <Button className="shadow-md shadow-primary/15" onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />Neues Attribut
              </Button>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-3">
            <MetricCard icon={Layers3} value={totalCount} label="Attribute insgesamt" tone="indigo" />
            <MetricCard icon={FolderTree} value={allCategoryNames.length} label="Kategorien" tone="sky" />
            <MetricCard icon={Asterisk} value={requiredCount} label="Pflichtattribute" tone="amber" />
          </section>

          <section className="rounded-2xl border bg-card/90 p-3 shadow-sm backdrop-blur md:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_minmax(250px,360px)_auto]">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Name, Key, Beschreibung oder Kategorie suchen …"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 rounded-xl bg-background pl-10 pr-10"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Suche leeren">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Select
                  value={activeCategory ?? '__all__'}
                  onValueChange={(value) => {
                    setActiveCategory(value === '__all__' ? null : value);
                    setSearch('');
                  }}
                >
                  <SelectTrigger className="h-11 flex-1 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Alle Kategorien ({totalCount})</SelectItem>
                    {allCategoryNames.map((category) => (
                      <SelectItem key={category} value={category}>{category} ({categories.get(category)?.length ?? 0})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeCategory && !search && (
                  <div className="flex rounded-xl border bg-background p-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={allCategoryNames.indexOf(activeCategory) === 0} onClick={() => handleMoveCategory(activeCategory, 'up')} title="Kategorie nach oben"><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={allCategoryNames.indexOf(activeCategory) === allCategoryNames.length - 1} onClick={() => handleMoveCategory(activeCategory, 'down')} title="Kategorie nach unten"><ArrowDown className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>

              <Button variant={requiredFilter ? 'default' : 'outline'} className="h-11 rounded-xl" onClick={() => setRequiredFilter((value) => !value)}>
                <Filter className="mr-2 h-4 w-4" />Nur Pflichtfelder
              </Button>
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">{search ? `Suchergebnisse für „${search}“` : activeCategory ?? 'Alle Attribute'}</h2>
                <p className="text-xs text-muted-foreground">{filteredEntries.length} {filteredEntries.length === 1 ? 'Eintrag' : 'Einträge'} gefunden</p>
              </div>
              {(search || activeCategory || requiredFilter) && (
                <Button variant="ghost" size="sm" onClick={clearFilters}><RotateCcw className="mr-2 h-3.5 w-3.5" />Filter zurücksetzen</Button>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-80 items-center justify-center rounded-2xl border bg-card/80">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 px-6 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><Search className="h-6 w-6 text-muted-foreground" /></span>
                <h3 className="font-semibold">Keine Attribute gefunden</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">Passe deine Suche oder Filter an – oder lege direkt ein neues Attribut an.</p>
                <div className="mt-4 flex gap-2"><Button variant="outline" onClick={clearFilters}>Filter zurücksetzen</Button><Button onClick={() => setShowCreateDialog(true)}><Plus className="mr-2 h-4 w-4" />Attribut anlegen</Button></div>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {visibleEntries.map(({ key, def }) => {
                  const categoryEntries = categories.get(def.category) ?? [];
                  const categoryIndex = categoryEntries.findIndex((entry) => entry.key === key);
                  const canReorder = !search && activeCategory === def.category;
                  return (
                    <article key={key} className="group rounded-2xl border bg-card/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-md">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-sm font-semibold text-indigo-600 dark:text-indigo-400">{def.name.trim().charAt(0).toUpperCase() || '#'}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold">{def.name}</h3>
                            {def.required && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">Pflicht</Badge>}
                          </div>
                          <p className="mt-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">{def.category}</p>
                        </div>
                        <div className="flex shrink-0 items-center rounded-lg border bg-background/80 p-0.5">
                          {canReorder && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={categoryIndex <= 0} onClick={() => handleMove(key, 'up')} title="Nach oben"><ArrowUp className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={categoryIndex === categoryEntries.length - 1} onClick={() => handleMove(key, 'down')} title="Nach unten"><ArrowDown className="h-3.5 w-3.5" /></Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingKey(key)} title="Bearbeiten"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(key)} title="Löschen"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{def.description || 'Keine Beschreibung hinterlegt.'}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-[11px] text-muted-foreground">
                        <code className="max-w-full truncate rounded-md bg-muted px-2 py-1 font-mono text-foreground/80">{key}</code>
                        {def.default_value && <span className="rounded-md border px-2 py-1">Standard: {def.default_value}</span>}
                        {!!def.suggested_values?.length && <span className="rounded-md border px-2 py-1">{def.suggested_values.length} Vorschläge</span>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!loading && filteredEntries.length > 0 && (
              <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border bg-card/80 px-4 py-3 sm:flex-row">
                <p className="text-xs text-muted-foreground">Einträge {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredEntries.length)} von {filteredEntries.length}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Zurück</Button>
                  <span className="min-w-20 text-center text-xs font-medium">Seite {page} / {pageCount}</span>
                  <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Weiter<ChevronRight className="ml-1 h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>


      {/* Edit Dialog */}
      {editingKey && config[editingKey] && (
        <EditAttributeDialog
          attrKey={editingKey}
          def={config[editingKey]}
          categories={allCategoryNames}
          onSave={async (updated) => {
            try {
              await api.updateAttributeDefinition(editingKey, updated);
              toast('Attribut aktualisiert', 'success');
              setEditingKey(null);
              reload();
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
            }
          }}
          onCancel={() => setEditingKey(null)}
        />
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateAttributeDialog
          categories={allCategoryNames}
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => {
            setShowCreateDialog(false);
            reload();
          }}
        />
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <ImportAttributesDialog
          onClose={() => setShowImportDialog(false)}
          onImported={reload}
        />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <Dialog open onOpenChange={() => setShowDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attribut löschen?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Das Attribut <strong>{config[showDeleteConfirm]?.name}</strong> ({showDeleteConfirm}) wird unwiderruflich gelöscht.
              Es wird NICHT aus bestehenden Produkten entfernt.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(showDeleteConfirm)}>
                Löschen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete all definitions confirm */}
      {showDeleteAllConfirm && (
        <Dialog open onOpenChange={(open) => !deletingAll && setShowDeleteAllConfirm(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alle Attributdefinitionen löschen?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Es werden <strong className="text-foreground">{totalCount} Attributdefinitionen</strong> gelöscht.
                Nach einem Neustart werden sie nicht erneut aus der alten JSON-Datei angelegt.
              </p>
              <p>
                Bereits gespeicherte Attributwerte in Produkten und Vorlagen bleiben erhalten. Werden beim Neuimport
                dieselben Keys verwendet, sind diese Werte wieder mit den neuen Definitionen verknüpft.
              </p>
              <p className="font-medium text-destructive">
                Exportiere die aktuelle Konfiguration vorab als JSON und veröffentliche während des Neuaufbaus keine
                Produkte an Artikelwerk.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={deletingAll} onClick={() => setShowDeleteAllConfirm(false)}>
                Abbrechen
              </Button>
              <Button variant="destructive" disabled={deletingAll} onClick={handleDeleteAll}>
                {deletingAll ? 'Wird gelöscht…' : 'Alle Definitionen löschen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

type MetricTone = 'indigo' | 'sky' | 'amber';

function MetricCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Layers3;
  value: number;
  label: string;
  tone: MetricTone;
}) {
  const tones: Record<MetricTone, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card/90 p-4 shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}


// --- Import Attributes Dialog ---

function ImportAttributesDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttributeImportResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Nur CSV-Dateien sind erlaubt.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.importAttributeDefinitionsCsv(file);
      setResult(res);
      toast(`${res.imported} Attribute importiert`, 'success');
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [onImported, toast]);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <DialogTitle className="text-base font-semibold">Attribute per CSV importieren</DialogTitle>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            UTF-8, Semikolon-getrennt. Bestehende Keys werden aktualisiert, neue Keys werden angelegt.
          </p>
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Pflichtspalten
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['key', 'Eindeutiger technischer Attribut-Key'],
                ['id', 'Metafield/Funktionsattribut-ID für den Export'],
                ['category', 'Kategorie für Navigation und Gruppierung'],
                ['name', 'Anzeigename im Editor'],
              ].map(([column, description]) => (
                <div key={column} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                  <code className="text-xs font-mono text-indigo-700 dark:text-indigo-300">{column}</code>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Optional: <code>description</code>, <code>required</code>, <code>required_for_types</code>, <code>default_value</code>, <code>suggested_values</code> und <code>smart_defaults</code>. Listenwerte mit <code>|</code> trennen, Titelregeln als <code>Titel=&gt;Wert</code> angeben.
            </p>
          </section>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
                : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950/30 hover:border-gray-400'
            }`}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
            <div className="flex flex-col items-center gap-3">
              {loading ? (
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              ) : (
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  CSV hierher ziehen oder Datei auswählen
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Spalten: key; id; category; name
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg text-sm text-green-700 dark:text-green-300">
                <FileText className="w-4 h-4 flex-shrink-0" />
                <div>
                  <span className="font-medium">{result.imported} Attribute importiert</span>
                  <span className="ml-1 text-green-600 dark:text-green-400">· {result.total} Attribute gesamt</span>
                  <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-green-600 dark:text-green-400">
                    <span>{result.created} neu</span>
                    <span>{result.updated} aktualisiert</span>
                    {result.skipped > 0 && <span className="text-amber-600 dark:text-amber-400">{result.skipped} übersprungen</span>}
                  </div>
                </div>
              </div>

              {result.warnings.length > 0 && (
                <div className="border border-amber-200 dark:border-amber-900 rounded-lg overflow-hidden">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-800 dark:text-amber-300 font-medium">
                    {result.warnings.length} Hinweis{result.warnings.length !== 1 ? 'e' : ''} beim Import
                  </div>
                  <div className="divide-y divide-amber-100 dark:divide-amber-900 max-h-40 overflow-auto">
                    {result.warnings.map((warning, i) => (
                      <div key={i} className="px-3 py-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                        <span className="font-mono">Zeile {warning.row}</span>
                        <span className="mx-1.5">·</span>
                        <span className="font-medium">{warning.field}</span>
                        <span className="mx-1.5">-</span>
                        {warning.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40">
          <Button variant="outline" onClick={async () => {
            try {
              await api.downloadAttributeImportTemplate();
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Download fehlgeschlagen', 'error');
            }
          }}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Beispiel CSV
          </Button>
          <Button variant="outline" onClick={onClose}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// --- Edit Attribute Dialog ---

function EditAttributeDialog({
  attrKey,
  def,
  categories,
  onSave,
  onCancel,
}: {
  attrKey: string;
  def: AttributeDefinition;
  categories: string[];
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    id: def.id,
    name: def.name,
    category: def.category,
    description: def.description,
    required: def.required ?? false,
    default_value: def.default_value ?? '',
    suggested_values: (def.suggested_values ?? []).join('\n'),
  });

  const update = (field: string, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const suggestedCount = useMemo(
    () => form.suggested_values.split('\n').map(s => s.trim()).filter(Boolean).length,
    [form.suggested_values]
  );

  const handleSubmit = () => {
    const sv = form.suggested_values.trim()
      ? form.suggested_values.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
    onSave({
      id: form.id,
      name: form.name,
      category: form.category,
      description: form.description,
      required: form.required,
      default_value: form.default_value || undefined,
      suggested_values: sv.length > 0 ? sv : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40">
          <div className="flex items-center gap-2 mb-1">
            <Pencil className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <DialogTitle className="text-base font-semibold">Attribut bearbeiten</DialogTitle>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 font-mono text-xs">
              <Hash className="w-3 h-3" />
              {attrKey}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Key ist unveränderlich
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-6">
          {/* Grundangaben */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Tag className="w-3.5 h-3.5" />
              Grundangaben
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Anzeigename</Label>
                <Input
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="z.B. Gewicht"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Metafield ID</Label>
                <Input
                  value={form.id}
                  onChange={e => update('id', e.target.value)}
                  className="font-mono text-xs"
                  placeholder="meta_weight:custom:number_integer"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kategorie</Label>
                <Select value={form.category} onValueChange={v => update('category', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Standardwert</Label>
                <Input
                  value={form.default_value}
                  onChange={e => update('default_value', e.target.value)}
                  placeholder="(optional)"
                />
              </div>
            </div>
          </section>

          {/* Beschreibung */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <FileText className="w-3.5 h-3.5" />
              Beschreibung
            </h3>
            <Textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              rows={3}
              placeholder="Hilfetext, der bei der Zuweisung angezeigt wird…"
              className="resize-none"
            />
          </section>

          {/* Vorgeschlagene Werte */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <List className="w-3.5 h-3.5" />
                Vorgeschlagene Werte
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {suggestedCount} {suggestedCount === 1 ? 'Wert' : 'Werte'}
              </span>
            </div>
            <Textarea
              value={form.suggested_values}
              onChange={e => update('suggested_values', e.target.value)}
              rows={8}
              placeholder={'Ein Wert pro Zeile\nz.B.\nRot\nGrün\nBlau'}
              className="font-mono text-xs resize-y"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Wird als Dropdown angeboten. Leere Liste = Freitexteingabe.
            </p>
          </section>

          {/* Verhalten */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Settings2 className="w-3.5 h-3.5" />
              Verhalten
            </h3>
            <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="flex items-start gap-2">
                <AlertCircle className={`w-4 h-4 mt-0.5 ${form.required ? 'text-amber-500' : 'text-gray-400'}`} />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Pflichtfeld</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Produkte werden in der Qualitätsprüfung markiert, wenn dieses Attribut fehlt.
                  </div>
                </div>
              </div>
              <Switch checked={form.required} onCheckedChange={v => update('required', v)} />
            </label>
          </section>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40">
          <Button variant="outline" onClick={onCancel}>
            <X className="w-3.5 h-3.5 mr-1" />
            Abbrechen
          </Button>
          <Button onClick={handleSubmit}>
            <Check className="w-3.5 h-3.5 mr-1" />
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// --- Create Attribute Dialog ---

function CreateAttributeDialog({
  categories,
  onClose,
  onCreated,
}: {
  categories: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    key: '',
    id: '',
    name: '',
    category: categories[0] || '',
    description: '',
    required: false,
    default_value: '',
    suggested_values: '',
    newCategory: '',
  });
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);

  const buildMetafieldId = (key: string) => {
    const k = key.trim();
    if (!k) return '';
    const prefixed = k.startsWith('meta_') ? k : `meta_${k}`;
    return `${prefixed}:custom:single_line_text_field`;
  };

  const update = (field: string, value: unknown) =>
    setForm(prev => {
      // Auto-build the Metafield ID from the key unless the user already typed one in manually.
      if (field === 'key' && !idManuallyEdited) {
        return { ...prev, key: value as string, id: buildMetafieldId((value as string).trim()) };
      }
      if (field === 'id') {
        setIdManuallyEdited(true);
      }
      return { ...prev, [field]: value };
    });

  const suggestedCount = useMemo(
    () => form.suggested_values.split('\n').map(s => s.trim()).filter(Boolean).length,
    [form.suggested_values]
  );

  const handleCreate = async () => {
    if (!form.key.trim() || !form.name.trim()) {
      toast('Key und Name sind erforderlich', 'error');
      return;
    }
    const finalId = (form.id.trim() || buildMetafieldId(form.key.trim()));

    const category = useNewCategory ? form.newCategory.trim() : form.category;
    if (!category) {
      toast('Bitte eine Kategorie wählen oder eingeben', 'error');
      return;
    }

    const sv = form.suggested_values.trim()
      ? form.suggested_values.split('\n').map(s => s.trim()).filter(Boolean)
      : [];

    try {
      await api.createAttributeDefinition({
        key: form.key.trim(),
        id: finalId,
        category,
        name: form.name.trim(),
        description: form.description.trim(),
        required: form.required,
        default_value: form.default_value.trim() || undefined,
        suggested_values: sv.length > 0 ? sv : undefined,
      });
      toast('Attribut erstellt', 'success');
      onCreated();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erstellen fehlgeschlagen', 'error');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <DialogTitle className="text-base font-semibold">Neues Attribut erstellen</DialogTitle>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Lege ein neues Attribut an. Key muss eindeutig sein. Die Metafield ID wird automatisch als <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">meta_&lt;key&gt;:custom:single_line_text_field</code> gebaut.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-6">
          {/* Identifier */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Hash className="w-3.5 h-3.5" />
              Kennungen
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Key (eindeutig)</Label>
                <Input
                  placeholder="meta_weight"
                  value={form.key}
                  onChange={e => update('key', e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Metafield ID</Label>
                  {idManuallyEdited && (
                    <button
                      type="button"
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                      onClick={() => { setIdManuallyEdited(false); setForm(prev => ({ ...prev, id: buildMetafieldId(prev.key.trim()) })); }}
                    >
                      ↻ Auto
                    </button>
                  )}
                </div>
                <Input
                  placeholder="wird aus dem Key gebaut…"
                  value={form.id}
                  onChange={e => update('id', e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Format: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">meta_&lt;key&gt;:custom:single_line_text_field</code>
                </p>
              </div>
            </div>
          </section>

          {/* Grundangaben */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Tag className="w-3.5 h-3.5" />
              Grundangaben
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Anzeigename</Label>
                <Input
                  placeholder="z.B. Gewicht"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Standardwert</Label>
                <Input
                  value={form.default_value}
                  onChange={e => update('default_value', e.target.value)}
                  placeholder="(optional)"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Kategorie</Label>
                  <button
                    type="button"
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    onClick={() => setUseNewCategory(v => !v)}
                  >
                    {useNewCategory ? '← Bestehende wählen' : '+ Neue Kategorie'}
                  </button>
                </div>
                {useNewCategory ? (
                  <Input
                    placeholder="Name der neuen Kategorie…"
                    value={form.newCategory}
                    onChange={e => update('newCategory', e.target.value)}
                    autoFocus
                  />
                ) : (
                  <Select value={form.category} onValueChange={v => update('category', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie wählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </section>

          {/* Beschreibung */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <FileText className="w-3.5 h-3.5" />
              Beschreibung
            </h3>
            <Textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              rows={3}
              placeholder="Hilfetext, der bei der Zuweisung angezeigt wird…"
              className="resize-none"
            />
          </section>

          {/* Vorgeschlagene Werte */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <List className="w-3.5 h-3.5" />
                Vorgeschlagene Werte
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {suggestedCount} {suggestedCount === 1 ? 'Wert' : 'Werte'}
              </span>
            </div>
            <Textarea
              value={form.suggested_values}
              onChange={e => update('suggested_values', e.target.value)}
              rows={6}
              placeholder={'Ein Wert pro Zeile\nz.B.\nRot\nGrün\nBlau'}
              className="font-mono text-xs resize-y"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Wird als Dropdown angeboten. Leere Liste = Freitexteingabe.
            </p>
          </section>

          {/* Verhalten */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Settings2 className="w-3.5 h-3.5" />
              Verhalten
            </h3>
            <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="flex items-start gap-2">
                <AlertCircle className={`w-4 h-4 mt-0.5 ${form.required ? 'text-amber-500' : 'text-gray-400'}`} />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Pflichtfeld</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Produkte werden in der Qualitätsprüfung markiert, wenn dieses Attribut fehlt.
                  </div>
                </div>
              </div>
              <Switch checked={form.required} onCheckedChange={v => update('required', v)} />
            </label>
          </section>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40">
          <Button variant="outline" onClick={onClose}>
            <X className="w-3.5 h-3.5 mr-1" />
            Abbrechen
          </Button>
          <Button onClick={handleCreate}>
            <Check className="w-3.5 h-3.5 mr-1" />
            Erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
