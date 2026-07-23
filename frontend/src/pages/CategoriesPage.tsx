import { useState, useEffect } from 'react';
import {
  Plus, Trash2, ChevronRight, ChevronDown, Pencil, Check, X, FolderTree,
  Search, Layers3, Network, Sparkles, RotateCcw,
} from 'lucide-react';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../api/client';
import type { CategoryTree } from '../types';

interface TreeNodeProps {
  name: string;
  children: CategoryTree;
  path: string[];
  onAdd: (path: string[], name: string) => void;
  onRename: (path: string[], newName: string) => void;
  onDelete: (path: string[], name: string) => void;
  depth: number;
  forceExpanded?: boolean;
}

function TreeNode({ name, children, path, onAdd, onRename, onDelete, depth, forceExpanded = false }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const childKeys = Object.keys(children).sort();
  const hasChildren = childKeys.length > 0;
  const fullPath = [...path, name];
  const isExpanded = forceExpanded || expanded;

  const handleAdd = () => {
    if (newName.trim()) {
      onAdd(fullPath, newName.trim());
      setNewName('');
      setAdding(false);
      setExpanded(true);
    }
  };

  const handleRename = () => {
    if (editName.trim() && editName.trim() !== name) {
      onRename(fullPath, editName.trim());
    }
    setEditing(false);
  };

  return (
    <div>
      <div
        className={`group flex min-h-11 items-center gap-2 rounded-xl border border-transparent px-2 py-2 transition-all hover:border-border hover:bg-accent/60 ${
          depth === 0 ? 'bg-muted/35 font-medium' : ''
        }`}
        style={{ marginLeft: `${depth * 22}px` }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label={isExpanded ? 'Kategorie einklappen' : 'Kategorie ausklappen'}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-4 h-4 inline-block" />
          )}
        </button>

        {editing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <input
              autoFocus
              className="flex-1 px-2 py-0.5 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <button onClick={handleRename} className="p-1 text-green-600 hover:bg-green-50 rounded">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FolderTree className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
            {hasChildren && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">{childKeys.length}</span>
            )}
            <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
              <button
                onClick={() => { setAdding(true); setExpanded(true); }}
                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="Unterkategorie hinzufügen"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setEditName(name); setEditing(true); }}
                className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                title="Umbenennen"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(path, name)}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Löschen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {isExpanded && (
        <>
          {childKeys.map((childName) => (
            <TreeNode
              key={childName}
              name={childName}
              children={children[childName]}
              path={fullPath}
              onAdd={onAdd}
              onRename={onRename}
              onDelete={onDelete}
              depth={depth + 1}
              forceExpanded={forceExpanded}
            />
          ))}
          {adding && (
            <div
              className="flex items-center gap-1.5 py-1.5 px-2"
              style={{ paddingLeft: `${(depth + 1) * 20 + 8 + 24}px` }}
            >
              <input
                autoFocus
                className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Neue Unterkategorie…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                }}
              />
              <button onClick={handleAdd} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Hinzufügen">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => { setAdding(false); setNewName(''); }} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CategoriesPage() {
  const [tree, setTree] = useState<CategoryTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingRoot, setAddingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ path: string[]; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const loadTree = () => {
    api.getCategoryTree()
      .then((t) => { setTree(t); setLoading(false); })
      .catch((e) => { toast(e.message, 'error'); setLoading(false); });
  };

  useEffect(loadTree, []);

  const handleAdd = async (path: string[], name: string) => {
    try {
      const updated = await api.addCategoryNode(path, name);
      setTree(updated);
      toast(`Kategorie „${name}" hinzugefügt`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fehler', 'error');
    }
  };

  const handleRename = async (fullPath: string[], newName: string) => {
    try {
      const updated = await api.renameCategoryNode(fullPath, newName);
      setTree(updated);
      toast(`Kategorie umbenannt zu „${newName}"`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fehler', 'error');
    }
  };

  const handleDelete = async (path: string[], name: string) => {
    try {
      const updated = await api.deleteCategoryNode(path, name);
      setTree(updated);
      setDeleteTarget(null);
      toast(`Kategorie „${name}" gelöscht`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fehler', 'error');
    }
  };

  const handleAddRoot = async () => {
    if (!newRootName.trim()) return;
    try {
      const updated = await api.addCategoryNode([], newRootName.trim());
      setTree(updated);
      setNewRootName('');
      setAddingRoot(false);
      toast(`Hauptkategorie „${newRootName.trim()}" hinzugefügt`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fehler', 'error');
    }
  };

  if (loading || !tree) {
    return <LoadingSpinner className="h-full" />;
  }

  const rootKeys = Object.keys(tree).sort();
  const totalCount = countNodes(tree);
  const maxDepth = getMaxDepth(tree);
  const leafCount = countLeaves(tree);
  const filteredTree = search.trim() ? filterCategoryTree(tree, search.trim().toLowerCase()) : tree;
  const visibleRootKeys = Object.keys(filteredTree).sort();

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_32rem)]">
      {deleteTarget && (
        <ConfirmDialog
          title="Kategorie löschen"
          message={`Möchtest du „${deleteTarget.name}" und alle Unterkategorien wirklich löschen?`}
          confirmLabel="Löschen"
          variant="danger"
          onConfirm={() => handleDelete(deleteTarget.path, deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="mx-auto w-full max-w-[1920px] space-y-5 p-4 md:p-6 xl:px-8 xl:py-7 2xl:px-10">
        <section className="relative overflow-hidden rounded-3xl border bg-card/90 p-5 shadow-sm md:p-7">
          <div className="pointer-events-none absolute -right-24 -top-36 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
                <FolderTree className="h-6 w-6" />
                <Sparkles className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-card p-0.5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Produktstruktur</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Kategorien</h1>
                <p className="mt-1 text-sm text-muted-foreground">Sortimente hierarchisch organisieren und direkt im Baum bearbeiten.</p>
              </div>
            </div>
            <Button className="shadow-md shadow-primary/20" onClick={() => setAddingRoot(true)}>
              <Plus className="mr-2 h-4 w-4" />Hauptkategorie anlegen
            </Button>
          </div>

          <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
            <CategoryMetric icon={Layers3} value={rootKeys.length} label="Hauptkategorien" tone="indigo" />
            <CategoryMetric icon={Network} value={totalCount} label="Kategorien gesamt" tone="sky" />
            <CategoryMetric icon={FolderTree} value={leafCount} label={`Endkategorien · ${maxDepth} Ebenen`} tone="emerald" />
          </div>
        </section>

        <section className="rounded-3xl border bg-card/90 shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <div>
              <h2 className="font-semibold">Kategoriebaum</h2>
              <p className="text-xs text-muted-foreground">Kategorien aufklappen, ergänzen, umbenennen oder löschen.</p>
            </div>
            <div className="flex w-full gap-2 md:w-auto">
              <div className="relative min-w-0 flex-1 md:w-80">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Kategorien durchsuchen …"
                  className="h-10 rounded-xl bg-background pl-10 pr-9"
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Suche leeren"><X className="h-4 w-4" /></button>}
              </div>
              {search && <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setSearch('')} title="Suche zurücksetzen"><RotateCcw className="h-4 w-4" /></Button>}
            </div>
          </div>

          <div className="p-3 md:p-4">
            {addingRoot && (
              <div className="mb-3 flex items-center gap-2 rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600"><Plus className="h-4 w-4" /></span>
                <input
                  autoFocus
                  className="h-10 min-w-0 flex-1 rounded-xl border border-indigo-300 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="Neue Hauptkategorie…"
                  value={newRootName}
                  onChange={(e) => setNewRootName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddRoot();
                    if (e.key === 'Escape') { setAddingRoot(false); setNewRootName(''); }
                  }}
                />
                <button onClick={handleAddRoot} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setAddingRoot(false); setNewRootName(''); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {visibleRootKeys.length === 0 && !addingRoot ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><Search className="h-6 w-6 text-muted-foreground" /></span>
                <h3 className="font-semibold">{search ? 'Keine Kategorie gefunden' : 'Noch keine Kategorien vorhanden'}</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">{search ? 'Passe den Suchbegriff an oder setze die Suche zurück.' : 'Lege die erste Hauptkategorie an und baue anschließend die gewünschte Struktur auf.'}</p>
                <Button className="mt-4" variant={search ? 'outline' : 'default'} onClick={() => search ? setSearch('') : setAddingRoot(true)}>{search ? 'Suche zurücksetzen' : 'Hauptkategorie anlegen'}</Button>
              </div>
            ) : (
              visibleRootKeys.map((name) => (
                <TreeNode
                  key={name}
                  name={name}
                  children={filteredTree[name]}
                  path={[]}
                  onAdd={handleAdd}
                  onRename={handleRename}
                  onDelete={(path, delName) => setDeleteTarget({ path, name: delName })}
                  depth={0}
                  forceExpanded={Boolean(search)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type CategoryMetricTone = 'indigo' | 'sky' | 'emerald';

function CategoryMetric({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof FolderTree;
  value: number;
  label: string;
  tone: CategoryMetricTone;
}) {
  const tones: Record<CategoryMetricTone, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className="group flex items-center gap-3 rounded-2xl border bg-background/65 p-4 shadow-sm backdrop-blur transition hover:bg-background">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none tabular-nums">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function countNodes(tree: CategoryTree): number {
  let count = 0;
  for (const key of Object.keys(tree)) {
    count += 1 + countNodes(tree[key]);
  }
  return count;
}

function countLeaves(tree: CategoryTree): number {
  let count = 0;
  for (const key of Object.keys(tree)) {
    const children = tree[key];
    count += Object.keys(children).length === 0 ? 1 : countLeaves(children);
  }
  return count;
}

function getMaxDepth(tree: CategoryTree): number {
  const children = Object.values(tree);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map(getMaxDepth));
}

function filterCategoryTree(tree: CategoryTree, query: string): CategoryTree {
  const result: CategoryTree = {};
  for (const [name, children] of Object.entries(tree)) {
    const filteredChildren = filterCategoryTree(children, query);
    if (name.toLowerCase().includes(query) || Object.keys(filteredChildren).length > 0) {
      result[name] = name.toLowerCase().includes(query) ? children : filteredChildren;
    }
  }
  return result;
}
