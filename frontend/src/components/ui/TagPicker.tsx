import { useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TagPickerProps {
  value: string | number | boolean | undefined;
  suggestions: string[];
  onChange: (val: string) => void;
}

interface TagGroup {
  label: string | null;
  tags: string[];
  parentTag: string | null;
  requiresParent: boolean;
}

const SUBCATEGORY_LABEL = /^(?:sub|unter)(?:[\s-]*kategor(?:ie|ien))\b\s*[:\-–—>]*\s*/i;

function categoryKey(value: string): string {
  return value
    .trim()
    .replace(SUBCATEGORY_LABEL, '')
    .replace(/^cat[-_\s]+/i, '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function groupSuggestions(suggestions: string[]): TagGroup[] {
  const groups: TagGroup[] = [];
  let current: TagGroup = { label: null, tags: [], parentTag: null, requiresParent: false };

  for (const raw of suggestions) {
    const item = raw.trim();
    if (!item) continue;
    if (item.startsWith('#')) {
      if (current.tags.length > 0 || current.label !== null) {
        groups.push(current);
      }
      current = {
        label: item.replace(/^#\s*/, '').trim() || 'Sonstige',
        tags: [],
        parentTag: null,
        requiresParent: false,
      };
    } else {
      current.tags.push(item);
    }
  }
  if (current.tags.length > 0 || current.label !== null) {
    groups.push(current);
  }
  const categoryTags = new Map<string, { tag: string; groupIndex: number }>();
  groups.forEach((group, groupIndex) => {
    group.tags.forEach(tag => {
      if (/^cat[-_\s]/i.test(tag)) {
        categoryTags.set(categoryKey(tag), { tag, groupIndex });
      }
    });
  });

  return groups.map((group, groupIndex) => {
    const explicitlyDependent = SUBCATEGORY_LABEL.test(group.label ?? '');
    const parent = findParentTag(group.label, group.tags, groupIndex, categoryTags);

    return {
      ...group,
      parentTag: parent?.groupIndex !== groupIndex ? parent?.tag ?? null : null,
      requiresParent: explicitlyDependent || (parent !== undefined && parent.groupIndex !== groupIndex),
    };
  });
}

function findParentTag(
  label: string | null,
  groupTags: string[],
  groupIndex: number,
  categoryTags: Map<string, { tag: string; groupIndex: number }>,
): { tag: string; groupIndex: number } | undefined {
  if (!label) return undefined;
  const parentByLabel = categoryTags.get(categoryKey(label));
  if (parentByLabel && parentByLabel.groupIndex !== groupIndex) return parentByLabel;

  const childTags = groupTags
    .filter(tag => /^cat[-_\s]/i.test(tag))
    .map(tag => tag.toLocaleLowerCase('de-DE'));
  if (childTags.length === 0) return undefined;

  return [...categoryTags.values()]
    .filter(candidate => (
      candidate.groupIndex !== groupIndex
      && childTags.every(childTag => (
        childTag.startsWith(`${candidate.tag.toLocaleLowerCase('de-DE')}-`)
      ))
    ))
    .sort((a, b) => b.tag.length - a.tag.length)[0];
}

export function TagPicker({ value, suggestions, onChange }: TagPickerProps) {
  const selectedTags = typeof value === 'string' && value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];
  const selectedSet = new Set(selectedTags);

  const groups = useMemo(() => groupSuggestions(suggestions), [suggestions]);
  const hasGroups = groups.some(g => g.label !== null);
  const tagGroupIndexes = useMemo(() => {
    const indexes = new Map<string, number>();
    groups.forEach((group, index) => {
      group.tags.forEach(tag => indexes.set(tag, index));
    });
    return indexes;
  }, [groups]);

  const isGroupVisible = (groupIndex: number, visited = new Set<number>()): boolean => {
    const group = groups[groupIndex];
    if (!group?.requiresParent) return true;
    if (!group.parentTag) return false;
    if (!selectedSet.has(group.parentTag) || visited.has(groupIndex)) return false;

    const parentGroupIndex = tagGroupIndexes.get(group.parentTag);
    if (parentGroupIndex === undefined) return true;

    const nextVisited = new Set(visited);
    nextVisited.add(groupIndex);
    return isGroupVisible(parentGroupIndex, nextVisited);
  };

  const toggle = (tag: string) => {
    const next = selectedSet.has(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onChange(next.join(', '));
  };

  const [custom, setCustom] = useState('');

  const addCustom = () => {
    const t = custom.trim();
    if (t && !selectedSet.has(t) && !t.startsWith('#')) {
      onChange([...selectedTags, t].join(', '));
    }
    setCustom('');
  };

  const renderTagButton = (tag: string) => (
    <button
      key={tag}
      type="button"
      onClick={() => toggle(tag)}
      className="px-2 py-0.5 rounded-md border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      {tag}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-2.5 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Ausgewählt ({selectedTags.length})
          </div>
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
        </div>
      )}

      {/* Grouped suggestions */}
      {hasGroups ? (
        <div className="space-y-2.5">
          {groups.map((group, idx) => {
            if (!isGroupVisible(idx)) return null;
            const visible = group.tags.filter(t => !selectedSet.has(t));
            if (visible.length === 0) return null;
            return (
              <div key={`${group.label ?? 'ungrouped'}-${idx}`}>
                {group.label && (
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    {group.label}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {visible.map(renderTagButton)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {suggestions.filter(s => !selectedSet.has(s) && !s.startsWith('#')).map(renderTagButton)}
        </div>
      )}

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
