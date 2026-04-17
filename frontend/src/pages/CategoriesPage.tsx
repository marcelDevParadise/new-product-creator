import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronRight, ChevronDown, Pencil, Check, X, FolderTree } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
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
}

function TreeNode({ name, children, path, onAdd, onRename, onDelete, depth }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const childKeys = Object.keys(children).sort();
  const hasChildren = childKeys.length > 0;
  const fullPath = [...path, name];

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
        className={`group flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors ${
          depth === 0 ? 'font-medium' : ''
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-5 h-5 flex items-center justify-center shrink-0 text-gray-400 hover:text-gray-600"
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
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
            <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{name}</span>
            {hasChildren && (
              <span className="text-[10px] text-gray-400 shrink-0">{childKeys.length}</span>
            )}
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
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

      {expanded && (
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

  return (
    <div className="h-full flex flex-col">
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

      <div className="p-8 space-y-6">
        <PageHeader
          title="Kategorien"
          description={`${rootKeys.length} Hauptkategorien · ${totalCount} Kategorien gesamt`}
        />
      </div>

      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700">Kategorie-Baum</h3>
            </div>
            <button
              onClick={() => setAddingRoot(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Hauptkategorie
            </button>
          </div>

          <div className="p-3">
            {addingRoot && (
              <div className="flex items-center gap-1.5 py-1.5 px-2 mb-2">
                <input
                  autoFocus
                  className="flex-1 px-3 py-1.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

            {rootKeys.length === 0 && !addingRoot ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Noch keine Kategorien angelegt. Klicke „Hauptkategorie" um zu starten.
              </p>
            ) : (
              rootKeys.map((name) => (
                <TreeNode
                  key={name}
                  name={name}
                  children={tree[name]}
                  path={[]}
                  onAdd={handleAdd}
                  onRename={handleRename}
                  onDelete={(path, delName) => setDeleteTarget({ path, name: delName })}
                  depth={0}
                />
              ))
            )}
          </div>
        </div>
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
