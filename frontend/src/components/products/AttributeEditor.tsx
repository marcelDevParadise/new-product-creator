import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Save, Trash2, Search, Plus, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getFieldType } from '@/lib/attribute-utils';
import type { Product, AttributeConfig, AttributeDefinition } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';

interface Props {
  product: Product;
  attributeConfig: AttributeConfig;
  onSaved: (updated: Product) => void;
}

// --- Draggable item for available attributes ---
function DraggableAttribute({ attrKey, def }: { attrKey: string; def: AttributeDefinition }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `attr-${attrKey}`,
    data: { attrKey, def },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm cursor-grab active:cursor-grabbing hover:bg-accent/50 transition-colors ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <span className="flex-1 min-w-0 truncate">{def.name}</span>
      {def.required && (
        <Badge variant="destructive" className="text-[10px] px-1 py-0 shrink-0">*</Badge>
      )}
    </div>
  );
}

// --- Drop zone for assigned attributes ---
function DropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'assigned-zone' });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] rounded-lg border transition-colors ${
        isOver ? 'border-primary bg-primary/5' : 'border-border bg-card'
      } ${isEmpty ? 'flex items-center justify-center' : ''}`}
    >
      {isEmpty ? (
        <p className="text-sm text-muted-foreground py-12">
          Attribute von links hinzufügen
        </p>
      ) : (
        children
      )}
    </div>
  );
}

// --- Tag picker for multi-select comma-separated tags ---
function TagPicker({
  value,
  suggestions,
  onChange,
}: {
  value: string | number | boolean | undefined;
  suggestions: string[];
  onChange: (val: string) => void;
}) {
  const selectedTags = typeof value === 'string' && value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];
  const selectedSet = new Set(selectedTags);

  const toggle = (tag: string) => {
    const next = selectedSet.has(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onChange(next.join(', '));
  };

  const [custom, setCustom] = useState('');

  const addCustom = () => {
    const t = custom.trim();
    if (t && !selectedSet.has(t)) {
      onChange([...selectedTags, t].join(', '));
    }
    setCustom('');
  };

  return (
    <div className="space-y-2">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/80 transition-colors"
            >
              {tag}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Available suggestions */}
      <div className="flex flex-wrap gap-1">
        {suggestions.filter(s => !selectedSet.has(s)).map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className="px-2 py-0.5 rounded-md border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Custom tag input */}
      <div className="flex gap-1.5">
        <Input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); }}}
          placeholder="Eigenen Tag hinzufügen..."
          className="h-7 text-xs"
        />
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={addCustom} disabled={!custom.trim()}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// --- Inline editor for one assigned attribute ---
function AssignedAttributeRow({
  attrKey: _attrKey,
  def,
  value,
  onChange,
  onRemove,
}: {
  attrKey: string;
  def: AttributeDefinition;
  value: string | number | boolean | undefined;
  onChange: (val: string | number | boolean) => void;
  onRemove: () => void;
}) {
  const fieldType = getFieldType(def.id);
  const isTags = fieldType === 'tags' && def.suggested_values && def.suggested_values.length > 0;

  return (
    <div className={`px-4 py-3 group hover:bg-accent/30 transition-colors ${isTags ? 'space-y-2' : 'flex items-start gap-3'}`}>
      <div className={`${isTags ? '' : 'flex-1'} min-w-0 space-y-1`}>
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{def.name}</Label>
          {def.required && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0">Pflicht</Badge>
          )}
          {!isTags && (
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
        {def.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{def.description}</p>
        )}
      </div>

      {isTags ? (
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <TagPicker
              value={value}
              suggestions={def.suggested_values!}
              onChange={onChange}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive self-start"
            onClick={onRemove}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
      <>
      <div className="w-72 shrink-0">
        {fieldType === 'boolean' ? (
          <div className="flex items-center gap-2 pt-1">
            <Switch
              checked={value === true || value === 'true'}
              onCheckedChange={onChange}
            />
            <span className="text-sm text-muted-foreground">
              {value === true || value === 'true' ? 'Ja' : 'Nein'}
            </span>
          </div>
        ) : fieldType === 'number' ? (
          <Input
            type="number"
            value={value !== undefined ? String(value) : ''}
            onChange={e => onChange(e.target.value ? parseInt(e.target.value, 10) : '')}
          />
        ) : def.suggested_values && def.suggested_values.length > 0 ? (
          <Select
            value={value !== undefined ? String(value) : ''}
            onValueChange={v => { if (v !== null) onChange(v); }}
          >
            <SelectTrigger>
              <SelectValue placeholder="— Auswählen —" />
            </SelectTrigger>
            <SelectContent>
              {def.suggested_values.map(sv => (
                <SelectItem key={sv} value={sv}>{sv}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : fieldType === 'textarea' ? (
          <Textarea
            value={value !== undefined ? String(value) : ''}
            onChange={e => onChange(e.target.value)}
            rows={2}
          />
        ) : (
          <Input
            value={value !== undefined ? String(value) : ''}
            onChange={e => onChange(e.target.value)}
          />
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
      </>
      )}
    </div>
  );
}


export function AttributeEditor({ product, attributeConfig, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Load saved attributes (defaults are applied only when adding via UI)
  useEffect(() => {
    setValues({ ...product.attributes });
  }, [product]);

  // Assigned keys = keys that have a value
  const assignedKeys = useMemo(() => {
    return new Set(Object.keys(values));
  }, [values]);

  // Available attributes grouped by category (not yet assigned)
  const availableByCategory = useMemo(() => {
    const map = new Map<string, { key: string; def: AttributeDefinition }[]>();
    const q = search.toLowerCase();

    for (const [key, def] of Object.entries(attributeConfig)) {
      if (assignedKeys.has(key)) continue;
      if (q && !def.name.toLowerCase().includes(q) && !key.toLowerCase().includes(q)) continue;

      if (!map.has(def.category)) map.set(def.category, []);
      map.get(def.category)!.push({ key, def });
    }
    return map;
  }, [attributeConfig, assignedKeys, search]);

  // Assigned attributes grouped by category
  const assignedByCategory = useMemo(() => {
    const map = new Map<string, { key: string; def: AttributeDefinition }[]>();
    for (const key of assignedKeys) {
      const def = attributeConfig[key];
      if (!def) continue;
      if (!map.has(def.category)) map.set(def.category, []);
      map.get(def.category)!.push({ key, def });
    }
    return map;
  }, [assignedKeys, attributeConfig]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const addAttribute = useCallback((key: string) => {
    const def = attributeConfig[key];
    let val: string | number | boolean = '';

    // Try smart defaults first
    if (def?.smart_defaults && def.smart_defaults.length > 0) {
      const title = product.artikelname.toLowerCase();
      for (const sd of def.smart_defaults) {
        if (title.includes(sd.title_contains.toLowerCase())) {
          val = sd.value;
          break;
        }
      }
    }

    // Fall back to default_value
    if (val === '' && def?.default_value) {
      val = def.default_value;
    }

    setValues(prev => ({ ...prev, [key]: val }));
  }, [attributeConfig, product.artikelname]);

  const removeAttribute = useCallback((key: string) => {
    setValues(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const setValue = useCallback((key: string, val: string | number | boolean) => {
    setValues(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (over?.id === 'assigned-zone' && active.data.current) {
      const attrKey = active.data.current.attrKey as string;
      addAttribute(attrKey);
    }
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const cleaned: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v !== '' && v !== undefined) cleaned[k] = v;
      }
      const updated = await api.updateAttributes(product.artikelnummer, cleaned);
      onSaved(updated);
      toast('Attribute gespeichert', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  }, [values, product.artikelnummer, onSaved, toast]);

  const draggedDef = activeDragId
    ? attributeConfig[activeDragId.replace('attr-', '')]
    : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm text-muted-foreground">
          {assignedKeys.size} von {Object.keys(attributeConfig).length} Attributen zugewiesen
        </span>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Speichere...' : 'Speichern'}
        </Button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Left panel: Available attributes */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Attribut suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-1">
              {Array.from(availableByCategory.entries()).map(([category, entries]) => {
                const isExpanded = expandedCategories.has(category) || search.length > 0;
                return (
                  <div key={category}>
                    <button
                      onClick={() => toggleCategory(category)}
                      className="flex items-center gap-1.5 w-full text-left px-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{category}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground/60">{entries.length}</span>
                    </button>
                    {isExpanded && (
                      <div className="ml-1 mb-2">
                        {entries.map(({ key, def }) => (
                          <div key={key} className="flex items-center gap-0.5 group/item">
                            <div className="flex-1 min-w-0">
                              <DraggableAttribute attrKey={key} def={def} />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
                              onClick={() => addAttribute(key)}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {availableByCategory.size === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {assignedKeys.size === Object.keys(attributeConfig).length
                    ? 'Alle Attribute zugewiesen'
                    : 'Keine Treffer'}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right panel: Assigned attributes */}
        <DropZone isEmpty={assignedKeys.size === 0}>
          <div className="divide-y divide-border">
            {Array.from(assignedByCategory.entries()).map(([category, entries]) => (
              <div key={category}>
                <div className="px-4 py-2 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">
                    {category}
                  </span>
                </div>
                  {entries.map(({ key, def }) => (
                    <AssignedAttributeRow
                      key={key}
                      attrKey={key}
                      def={def}
                      value={values[key]}
                      onChange={val => setValue(key, val)}
                      onRemove={() => removeAttribute(key)}
                    />
                ))}
              </div>
            ))}
          </div>
        </DropZone>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggedDef ? (
          <div className="px-3 py-2 rounded-md border bg-card shadow-lg text-sm font-medium cursor-grabbing">
            {draggedDef.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
