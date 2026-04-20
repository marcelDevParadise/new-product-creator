import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TagPickerProps {
  value: string | number | boolean | undefined;
  suggestions: string[];
  onChange: (val: string) => void;
}

export function TagPicker({ value, suggestions, onChange }: TagPickerProps) {
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
