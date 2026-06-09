import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import {
  Save, Search, AlertCircle, ChevronLeft, ChevronRight, Sparkles, RotateCcw, Link2Off,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TagPicker } from '@/components/ui/TagPicker';
import { getFieldType } from '@/lib/attribute-utils';
import { cn } from '@/lib/utils';
import type { AttributeConfig, AttributeDefinition } from '../../../types';

type AttrValue = string | number | boolean;
type Values = Record<string, AttrValue>;

export type WizardMode = 'product' | 'template' | 'bulk';

interface AttributeWizardProps {
  attributeConfig: AttributeConfig;
  initialValues: Values;
  mode: WizardMode;
  productTitle?: string;
  inheritedValues?: Values;
  headerSlot?: ReactNode;
  footerInfoSlot?: ReactNode;
  saveLabel?: string;
  onSave: (values: Values) => Promise<void>;
  /** Called whenever the user edits a value (for live preview / parent state). */
  onChange?: (values: Values) => void;
}

export function AttributeWizard({
  attributeConfig,
  initialValues,
  mode,
  productTitle,
  inheritedValues,
  headerSlot,
  footerInfoSlot,
  saveLabel = 'Speichern',
  onSave,
  onChange,
}: AttributeWizardProps) {
  const [values, setValues] = useState<Values>(initialValues);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const initialRef = useRef<Values>(initialValues);

  // Reset when initialValues change (e.g. product switched)
  useEffect(() => {
    setValues(initialValues);
    initialRef.current = initialValues;
  }, [initialValues]);

  const isEmpty = (v: AttrValue | undefined) =>
    v === undefined || v === '' || v === null;

  // Group attributes by category, in definition order
  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; def: AttributeDefinition }[]>();
    for (const [key, def] of Object.entries(attributeConfig)) {
      if (!map.has(def.category)) map.set(def.category, []);
      map.get(def.category)!.push({ key, def });
    }
    return map;
  }, [attributeConfig]);

  const categoryNames = useMemo(() => Array.from(grouped.keys()), [grouped]);

  // Auto-select first category
  useEffect(() => {
    if (categoryNames.length > 0 && (activeCategory === null || !grouped.has(activeCategory))) {
      setActiveCategory(categoryNames[0]);
    }
  }, [categoryNames, activeCategory, grouped]);

  // Per-category stats: filled / total / required-filled / required-total
  const categoryStats = useMemo(() => {
    const stats = new Map<string, { filled: number; total: number; requiredMissing: number }>();
    for (const [cat, entries] of grouped) {
      let filled = 0;
      let requiredMissing = 0;
      for (const { key, def } of entries) {
        const v = values[key];
        const hasValue = !isEmpty(v);
        if (hasValue) filled++;
        if (def.required && !hasValue) requiredMissing++;
      }
      stats.set(cat, { filled, total: entries.length, requiredMissing });
    }
    return stats;
  }, [grouped, values]);

  // Global progress (required only)
  const globalProgress = useMemo(() => {
    let requiredTotal = 0;
    let requiredFilled = 0;
    let filled = 0;
    let total = 0;
    for (const [key, def] of Object.entries(attributeConfig)) {
      total++;
      const hasValue = !isEmpty(values[key]);
      if (hasValue) filled++;
      if (def.required) {
        requiredTotal++;
        if (hasValue) requiredFilled++;
      }
    }
    return { requiredFilled, requiredTotal, filled, total };
  }, [attributeConfig, values]);

  // Dirty tracking
  const dirty = useMemo(() => {
    const init = initialRef.current;
    const keys = new Set([...Object.keys(init), ...Object.keys(values)]);
    for (const k of keys) {
      const a = init[k];
      const b = values[k];
      if (isEmpty(a) && isEmpty(b)) continue;
      if (String(a ?? '') !== String(b ?? '')) return true;
    }
    return false;
  }, [values]);

  const setValue = useCallback((key: string, val: AttrValue) => {
    setValues(prev => {
      const next = { ...prev, [key]: val };
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  const clearValue = useCallback((key: string) => {
    setValues(prev => {
      const next = { ...prev };
      delete next[key];
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // For bulk mode: only send non-empty values
      const payload: Values = mode === 'bulk'
        ? Object.fromEntries(Object.entries(values).filter(([, v]) => !isEmpty(v)))
        : values;
      await onSave(payload);
      initialRef.current = values;
    } finally {
      setSaving(false);
    }
  }, [values, onSave, mode]);

  // Smart-default suggestions for the active category
  const smartSuggestions = useMemo(() => {
    if (!productTitle || !activeCategory) return [];
    const entries = grouped.get(activeCategory) ?? [];
    const title = productTitle.toLowerCase();
    const suggestions: { key: string; def: AttributeDefinition; value: string }[] = [];
    for (const { key, def } of entries) {
      if (!isEmpty(values[key])) continue;
      if (!def.smart_defaults || def.smart_defaults.length === 0) continue;
      for (const sd of def.smart_defaults) {
        if (title.includes(sd.title_contains.toLowerCase())) {
          suggestions.push({ key, def, value: sd.value });
          break;
        }
      }
    }
    return suggestions;
  }, [grouped, activeCategory, values, productTitle]);

  const applySmartSuggestions = () => {
    setValues(prev => {
      const next = { ...prev };
      for (const s of smartSuggestions) next[s.key] = s.value;
      onChange?.(next);
      return next;
    });
  };

  const goToTab = useCallback((dir: 'prev' | 'next') => {
    if (!activeCategory) return;
    const idx = categoryNames.indexOf(activeCategory);
    if (idx < 0) return;
    const nextIdx = dir === 'prev' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= categoryNames.length) return;
    setActiveCategory(categoryNames[nextIdx]);
  }, [activeCategory, categoryNames]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (dirty && !saving) void handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        goToTab('next');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        goToTab('prev');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dirty, saving, handleSave, goToTab]);

  // Search across all categories
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const matches: { category: string; key: string; def: AttributeDefinition }[] = [];
    for (const [cat, entries] of grouped) {
      for (const { key, def } of entries) {
        if (
          def.name.toLowerCase().includes(q) ||
          key.toLowerCase().includes(q) ||
          def.description.toLowerCase().includes(q)
        ) {
          matches.push({ category: cat, key, def });
        }
      }
    }
    return matches;
  }, [search, grouped]);

  const visibleEntries: { key: string; def: AttributeDefinition; category?: string }[] = searchResults
    ? searchResults.map(m => ({ key: m.key, def: m.def, category: m.category }))
    : (activeCategory ? (grouped.get(activeCategory) ?? []) : []);

  const canPrev = activeCategory ? categoryNames.indexOf(activeCategory) > 0 : false;
  const canNext = activeCategory ? categoryNames.indexOf(activeCategory) < categoryNames.length - 1 : false;

  return (
    <div className="flex flex-col h-full min-h-0 bg-card border rounded-lg overflow-hidden">
      {/* HEADER */}
      <div className="border-b bg-card shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Attribut suchen..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="flex-1 min-w-0">
            {globalProgress.requiredTotal > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-xs">
                  <div
                    className={cn(
                      'h-full transition-all',
                      globalProgress.requiredFilled === globalProgress.requiredTotal
                        ? 'bg-green-500'
                        : 'bg-amber-500',
                    )}
                    style={{ width: `${(globalProgress.requiredFilled / globalProgress.requiredTotal) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                  {globalProgress.requiredFilled}/{globalProgress.requiredTotal} Pflicht
                </span>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              {globalProgress.filled} von {globalProgress.total} Attributen befüllt
            </p>
          </div>

          {headerSlot && (
            <div className="flex items-center gap-2 shrink-0">{headerSlot}</div>
          )}
        </div>

        {/* Tab bar */}
        {!searchResults && (
          <div className="px-4 -mb-px overflow-x-auto">
            <div className="flex gap-0.5 min-w-max">
              {categoryNames.map(cat => {
                const stats = categoryStats.get(cat)!;
                const isActive = activeCategory === cat;
                const hasMissing = stats.requiredMissing > 0;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      'group inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                      isActive
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                    )}
                  >
                    {cat}
                    <span className={cn(
                      'tabular-nums text-[10px] px-1.5 py-0.5 rounded',
                      isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground/80',
                    )}>
                      {stats.filled}/{stats.total}
                    </span>
                    {hasMissing && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-red-500"
                        title={`${stats.requiredMissing} Pflichtfeld${stats.requiredMissing === 1 ? '' : 'er'} leer`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* BODY */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {searchResults && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              Keine Treffer für „{search}"
            </p>
          )}

          {!searchResults && smartSuggestions.length > 0 && (
            <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                  {smartSuggestions.length} Smart-Default-Vorschlag{smartSuggestions.length === 1 ? '' : 'e'} verfügbar
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 truncate">
                  {smartSuggestions.map(s => `${s.def.name} → ${s.value}`).join(' · ')}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-300 dark:border-amber-800 shrink-0"
                onClick={applySmartSuggestions}
              >
                Anwenden
              </Button>
            </div>
          )}

          <div className="divide-y divide-border rounded-md border bg-background">
            {visibleEntries.map(entry => (
              <WizardFieldRow
                key={entry.key}
                attrKey={entry.key}
                def={entry.def}
                category={entry.category}
                value={values[entry.key]}
                inheritedValue={inheritedValues?.[entry.key]}
                isEmpty={isEmpty(values[entry.key])}
                onChange={(v) => setValue(entry.key, v)}
                onClear={() => clearValue(entry.key)}
              />
            ))}
            {visibleEntries.length === 0 && !searchResults && (
              <p className="text-sm text-muted-foreground text-center py-12">
                Keine Attribute in dieser Kategorie
              </p>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* FOOTER */}
      <div className="border-t bg-card px-4 py-3 shrink-0 flex items-center gap-3">
        {!searchResults && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => goToTab('prev')}
              disabled={!canPrev}
              title="Vorherige Kategorie (Strg+←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => goToTab('next')}
              disabled={!canNext}
              title="Nächste Kategorie (Strg+→)"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 min-w-0 text-xs text-muted-foreground">
          {footerInfoSlot ?? (
            dirty
              ? <span className="text-amber-600 dark:text-amber-400">Ungespeicherte Änderungen</span>
              : <span>Alle Änderungen gespeichert</span>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Speichere...' : saveLabel}
        </Button>
      </div>
    </div>
  );
}

// --- Single field row -----------------------------------------------------

interface FieldRowProps {
  attrKey: string;
  def: AttributeDefinition;
  category?: string;
  value: AttrValue | undefined;
  inheritedValue?: AttrValue;
  isEmpty: boolean;
  onChange: (v: AttrValue) => void;
  onClear: () => void;
}

function WizardFieldRow({ attrKey, def, category, value, inheritedValue, isEmpty, onChange, onClear }: FieldRowProps) {
  const fieldType = getFieldType(def.id);
  const isInherited = isEmpty && inheritedValue !== undefined && inheritedValue !== '' && inheritedValue !== null;
  const displayValue: AttrValue | undefined = isInherited ? inheritedValue : value;
  const isOverridden = inheritedValue !== undefined && !isEmpty && String(value) !== String(inheritedValue);

  const hasSuggestions = (def.suggested_values?.length ?? 0) > 0;
  const isTagField = fieldType === 'tags' && hasSuggestions;

  return (
    <div
      className={cn(
        'group px-4 py-3 transition-colors',
        isEmpty && !isInherited ? 'bg-background' : 'bg-accent/20',
        def.required && isEmpty && !isInherited && 'bg-red-50/40 dark:bg-red-950/10',
      )}
    >
      <div className={cn('flex gap-3', isTagField ? 'flex-col' : 'items-start')}>
        {/* Label column */}
        <div className={cn('min-w-0', isTagField ? '' : 'w-64 shrink-0')}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium">{def.name}</span>
            {def.required && (
              <Badge variant="destructive" className="text-[9px] px-1 py-0 leading-tight">Pflicht</Badge>
            )}
            {category && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{category}</span>
            )}
            {isInherited && (
              <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                Vom Parent geerbt
              </span>
            )}
            {isOverridden && (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded"
                title={`Parent: ${inheritedValue}`}
              >
                <Link2Off className="w-2.5 h-2.5" />
                Überschrieben
              </span>
            )}
            {def.required && isEmpty && !isInherited && (
              <AlertCircle className="w-3 h-3 text-red-500" />
            )}
          </div>
          {def.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{def.description}</p>
          )}
        </div>

        {/* Input column */}
        <div className={cn('flex items-start gap-1.5', isTagField ? 'w-full' : 'flex-1 min-w-0')}>
          <div className="flex-1 min-w-0">
            <FieldInput
              def={def}
              fieldType={fieldType}
              value={displayValue}
              isInherited={isInherited}
              onChange={onChange}
            />
          </div>
          {!isEmpty && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onClear}
              title={isOverridden ? 'Auf Parent-Wert zurücksetzen' : 'Wert entfernen'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- The actual input based on type ---------------------------------------

interface FieldInputProps {
  def: AttributeDefinition;
  fieldType: ReturnType<typeof getFieldType>;
  value: AttrValue | undefined;
  isInherited: boolean;
  onChange: (v: AttrValue) => void;
}

function FieldInput({ def, fieldType, value, isInherited, onChange }: FieldInputProps) {
  const hasSuggestions = (def.suggested_values?.length ?? 0) > 0;
  const placeholder = def.default_value ?? '';
  const wrapperClass = isInherited ? 'opacity-70' : '';

  if (fieldType === 'boolean') {
    return (
      <div className={cn('flex items-center gap-2', wrapperClass)}>
        <Switch
          checked={value === true || value === 'true'}
          onCheckedChange={onChange}
        />
        <span className="text-xs text-muted-foreground">
          {value === true || value === 'true' ? 'Ja' : 'Nein'}
        </span>
      </div>
    );
  }

  if (fieldType === 'tags' && hasSuggestions) {
    return (
      <div className={wrapperClass}>
        <TagPicker
          value={value}
          suggestions={def.suggested_values!}
          onChange={onChange}
        />
      </div>
    );
  }

  if (hasSuggestions) {
    return (
      <Select
        value={value !== undefined ? String(value) : ''}
        onValueChange={v => { if (v !== null) onChange(v); }}
      >
        <SelectTrigger className={cn('h-8 text-sm', wrapperClass)}>
          <SelectValue placeholder="— Auswählen —" />
        </SelectTrigger>
        <SelectContent>
          {def.suggested_values!.map(sv => (
            <SelectItem key={sv} value={sv}>{sv}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (fieldType === 'number') {
    return (
      <Input
        type="number"
        value={value !== undefined ? String(value) : ''}
        onChange={e => onChange(e.target.value ? parseInt(e.target.value, 10) : '')}
        placeholder={placeholder}
        className={cn('h-8 text-sm', wrapperClass)}
      />
    );
  }

  if (fieldType === 'textarea') {
    return (
      <Textarea
        value={value !== undefined ? String(value) : ''}
        onChange={e => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className={cn('text-sm resize-y', wrapperClass)}
      />
    );
  }

  return (
    <Input
      value={value !== undefined ? String(value) : ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn('h-8 text-sm', wrapperClass)}
    />
  );
}
