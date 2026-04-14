import { AlertTriangle } from 'lucide-react';
import type { CategoryTree } from '../../types';

interface Props {
  tree: CategoryTree;
  values: string[];
  onChange: (level: number, value: string) => void;
}

const selectCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
const warnCls = 'w-full px-3 py-2 text-sm border border-amber-300 rounded-lg bg-amber-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

function getOptionsAtLevel(tree: CategoryTree, values: string[], level: number): string[] {
  let node = tree;
  for (let i = 0; i < level; i++) {
    const selected = values[i];
    if (!selected || !node[selected]) return [];
    node = node[selected];
  }
  return Object.keys(node).sort();
}

function isValueInTree(tree: CategoryTree, values: string[], level: number): boolean {
  if (!values[level]) return true; // empty is fine
  const options = getOptionsAtLevel(tree, values, level);
  return options.includes(values[level]);
}

export function CategoryCascader({ tree, values, onChange }: Props) {
  const levels = [1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-3">
      {levels.map((levelNum) => {
        const idx = levelNum - 1;
        const options = getOptionsAtLevel(tree, values, idx);
        const currentValue = values[idx] || '';
        const hasOptions = options.length > 0;
        const isInTree = isValueInTree(tree, values, idx);
        const isDisabled = idx > 0 && !values[idx - 1];
        const showFreetext = currentValue && !isInTree;

        return (
          <div key={levelNum}>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Kategorie Ebene {levelNum}
            </label>
            {showFreetext ? (
              <div className="space-y-1">
                <div className="flex gap-2">
                  <input
                    className={warnCls}
                    value={currentValue}
                    onChange={(e) => onChange(idx, e.target.value)}
                  />
                  {hasOptions && (
                    <select
                      className="px-2 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) onChange(idx, e.target.value);
                      }}
                    >
                      <option value="">Baum</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="w-3 h-3" />
                  Wert nicht im Kategorie-Baum
                </p>
              </div>
            ) : hasOptions ? (
              <select
                className={selectCls}
                value={currentValue}
                onChange={(e) => onChange(idx, e.target.value)}
                disabled={isDisabled}
              >
                <option value="">– wählen –</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                className={`${selectCls} ${isDisabled ? 'bg-gray-50 text-gray-400' : ''}`}
                value={currentValue}
                onChange={(e) => onChange(idx, e.target.value)}
                disabled={isDisabled}
                placeholder={isDisabled ? 'Vorherige Ebene wählen' : 'Freitext eingeben'}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
