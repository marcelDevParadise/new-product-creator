import { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Pencil, Trash2, X, Check, Filter, ArrowUp, ArrowDown,
  Hash, Tag, FileText, List, Settings2, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '../components/ui/Toast';
import { api } from '../api/client';
import type { AttributeConfig, AttributeDefinition } from '../types';

export function AttributesPage() {
  const [config, setConfig] = useState<AttributeConfig>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [requiredFilter, setRequiredFilter] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
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

  // Auto-select first category
  useEffect(() => {
    if (allCategoryNames.length > 0 && (activeCategory === null || !categories.has(activeCategory))) {
      setActiveCategory(allCategoryNames[0]);
    }
  }, [allCategoryNames]);

  // Filtered list for current view
  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase();
    let entries: { key: string; def: AttributeDefinition }[] = [];

    if (q) {
      // Search across all categories
      for (const items of categories.values()) {
        entries.push(...items);
      }
      entries = entries.filter(({ key, def }) =>
        def.name.toLowerCase().includes(q) ||
        key.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q) ||
        def.id.toLowerCase().includes(q)
      );
    } else if (activeCategory) {
      entries = categories.get(activeCategory) ?? [];
    }

    if (requiredFilter) {
      entries = entries.filter(({ def }) => def.required);
    }

    return entries;
  }, [categories, activeCategory, search, requiredFilter]);

  // Category counts (respecting search + required filter)
  const categoryCounts = useMemo(() => {
    const q = search.toLowerCase();
    const counts = new Map<string, number>();
    for (const [cat, items] of categories) {
      let filtered = items;
      if (q) {
        filtered = filtered.filter(({ key, def }) =>
          def.name.toLowerCase().includes(q) ||
          key.toLowerCase().includes(q) ||
          def.description.toLowerCase().includes(q) ||
          def.id.toLowerCase().includes(q)
        );
      }
      if (requiredFilter) {
        filtered = filtered.filter(({ def }) => def.required);
      }
      counts.set(cat, filtered.length);
    }
    return counts;
  }, [categories, search, requiredFilter]);

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

  const totalCount = Object.keys(config).length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-8 space-y-6">
        <PageHeader
          title="Attribute verwalten"
          description={`${totalCount} Attribute in ${allCategoryNames.length} Kategorien`}
          className='mb-4'
          actions={
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Neues Attribut
            </Button>
          }
        />
      </div>

      <div className="flex flex-1 min-h-0 px-8 pb-8 gap-6">
        {/* Sidebar — Category navigation */}
        <div className="w-56 shrink-0 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <button
            onClick={() => setRequiredFilter(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              requiredFilter
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Nur Pflichtfelder
          </button>

          <ScrollArea className="flex-1">
            <nav className="space-y-0.5">
              {allCategoryNames.map(cat => {
                const count = categoryCounts.get(cat) ?? 0;
                const isActive = !search && activeCategory === cat;
                if (search && count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setSearch(''); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-accent text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <span className={`text-xs tabular-nums ${isActive ? 'text-foreground/70' : 'text-muted-foreground/60'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </ScrollArea>
        </div>

        {/* Main content — Attribute list */}
        <div className="flex-1 min-w-0 rounded-lg border bg-card shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* List header */}
              <div className="flex items-center px-5 py-3 border-b text-xs font-medium text-muted-foreground">
                <span className="flex-1">
                  {search ? `Ergebnisse für „${search}"` : activeCategory}
                </span>
                <span className="w-44 shrink-0 text-right">
                  {filteredEntries.length} {filteredEntries.length === 1 ? 'Attribut' : 'Attribute'}
                </span>
              </div>

              {/* Attribute rows */}
              <ScrollArea className="max-h-[calc(100vh-260px)]">
                {filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Search className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">Keine Attribute gefunden</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredEntries.map(({ key, def }) => (
                      <div
                        key={key}
                        className="flex items-center gap-4 px-5 py-3.5 group hover:bg-accent/40 transition-colors"
                      >
                        {/* Left: Name + Description */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium truncate">{def.name}</span>
                            {def.required && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                                Pflicht
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {def.description || '—'}
                          </p>
                        </div>

                        {/* Middle: Key + meta */}
                        <div className="w-44 shrink-0 text-right space-y-0.5">
                          <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                            {key}
                          </code>
                          {def.default_value && (
                            <p className="text-[11px] text-muted-foreground/70 truncate">
                              Standard: {def.default_value}
                            </p>
                          )}
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {!search && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleMove(key, 'up')}
                                title="Nach oben"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleMove(key, 'down')}
                                title="Nach unten"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingKey(key)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setShowDeleteConfirm(key)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
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
    </div>
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
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
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
            <div className="grid grid-cols-2 gap-3">
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

  const update = (field: string, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const suggestedCount = useMemo(
    () => form.suggested_values.split('\n').map(s => s.trim()).filter(Boolean).length,
    [form.suggested_values]
  );

  const handleCreate = async () => {
    if (!form.key.trim() || !form.name.trim() || !form.id.trim()) {
      toast('Key, Name und Metafield ID sind erforderlich', 'error');
      return;
    }

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
        id: form.id.trim(),
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
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <DialogTitle className="text-base font-semibold">Neues Attribut erstellen</DialogTitle>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Lege ein neues Attribut an. Key und Metafield ID müssen eindeutig sein.
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
            <div className="grid grid-cols-2 gap-3">
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
                <Label className="text-xs font-medium">Metafield ID</Label>
                <Input
                  placeholder="meta_weight:custom:number_integer"
                  value={form.id}
                  onChange={e => update('id', e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </section>

          {/* Grundangaben */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Tag className="w-3.5 h-3.5" />
              Grundangaben
            </h3>
            <div className="grid grid-cols-2 gap-3">
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
