import { useState, useEffect, useMemo } from 'react';
import { X, Play, FileText, Search, ChevronRight, Folder, ExternalLink, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Template, AttributeConfig } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../ui/Toast';

interface Props {
  selectedSkus: string[];
  attributeConfig: AttributeConfig;
  totalActiveProducts?: number;
  onClose: () => void;
  onApplied: () => void;
}

const UNCATEGORIZED = 'Ohne Kategorie';

export function TemplateModal({ selectedSkus, attributeConfig, totalActiveProducts, onClose, onApplied }: Props) {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyMode, setApplyMode] = useState<'selected' | 'all'>(selectedSkus.length > 0 ? 'selected' : 'all');
  const [searchTemplate, setSearchTemplate] = useState('');
  const [collapsedTemplateCategories, setCollapsedTemplateCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getTemplates();
        setTemplates(data);
        const names = Object.keys(data);
        if (names.length > 0) {
          const first = [...names].sort((a, b) => a.localeCompare(b, 'de'))[0];
          setActiveTemplate(first);
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Vorlagen konnten nicht geladen werden', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const selectTemplate = (name: string) => {
    if (templates[name]) setActiveTemplate(name);
  };

  const toggleTemplateCategory = (cat: string) => {
    setCollapsedTemplateCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const handleApply = async () => {
    if (!activeTemplate) return;
    setApplying(true);
    try {
      let skusToApply = selectedSkus;
      if (applyMode === 'all') {
        const allProducts = await api.getProducts();
        skusToApply = allProducts.map((p) => p.artikelnummer);
      }
      if (skusToApply.length === 0) {
        toast('Keine Produkte zum Anwenden gefunden', 'error');
        return;
      }
      const res = await api.applyTemplate(activeTemplate, skusToApply);
      toast(`${res.attributes_applied} Attribute auf ${res.updated} Produkte angewendet`, 'success');
      onApplied();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Anwenden fehlgeschlagen', 'error');
    } finally {
      setApplying(false);
    }
  };

  // Group templates by their template.category, alphabetically
  const templatesGrouped = useMemo(() => {
    const q = searchTemplate.trim().toLowerCase();
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
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }
    return groups;
  }, [templates, searchTemplate]);

  const sortedTemplateCategories = useMemo(() => {
    return Object.keys(templatesGrouped).sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b, 'de');
    });
  }, [templatesGrouped]);

  // Group active template's attributes by attribute-category (read-only preview)
  const activeGrouped = useMemo(() => {
    const tpl = activeTemplate ? templates[activeTemplate] : null;
    if (!tpl) return {} as Record<string, { key: string; value: string | number | boolean }[]>;
    const result: Record<string, { key: string; value: string | number | boolean }[]> = {};
    for (const [key, val] of Object.entries(tpl.attributes)) {
      const def = attributeConfig[key];
      const cat = def?.category || 'Sonstige';
      if (!result[cat]) result[cat] = [];
      result[cat].push({ key, value: val });
    }
    return result;
  }, [activeTemplate, templates, attributeConfig]);

  const activeTpl = activeTemplate ? templates[activeTemplate] : null;
  const totalAttrs = activeTpl ? Object.keys(activeTpl.attributes).length : 0;
  const filledCount = activeTpl
    ? Object.values(activeTpl.attributes).filter((v) => v !== '' && v !== undefined).length
    : 0;
  const categoryCount = Object.keys(activeGrouped).length;
  const applyTargetCount = applyMode === 'selected' ? selectedSkus.length : (totalActiveProducts ?? 0);
  const templateCount = Object.keys(templates).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Vorlage anwenden</h2>
              <p className="text-sm text-gray-500">{templateCount} Vorlagen verfügbar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/templates"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
              title="Vorlagen-Verwaltung öffnen"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Verwalten
            </Link>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel — Template list */}
          <div className="w-72 border-r border-gray-200 flex flex-col shrink-0">
            {/* Search */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={searchTemplate}
                  onChange={(e) => setSearchTemplate(e.target.value)}
                  placeholder="Vorlagen suchen..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {loading ? (
                <div className="text-center py-8 text-xs text-gray-400">Lade Vorlagen…</div>
              ) : sortedTemplateCategories.map((cat) => {
                const group = templatesGrouped[cat];
                const collapsed = collapsedTemplateCategories.has(cat);
                return (
                  <div key={cat}>
                    <button
                      onClick={() => toggleTemplateCategory(cat)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ChevronRight className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
                      <Folder className="w-3 h-3" />
                      <span className="truncate">{cat}</span>
                      <span className="ml-auto font-normal text-gray-400">{group.length}</span>
                    </button>
                    {!collapsed && (
                      <div className="space-y-0.5 mt-1">
                        {group.map((tpl) => {
                          const count = Object.keys(tpl.attributes).length;
                          const isActive = activeTemplate === tpl.name;
                          return (
                            <div
                              key={tpl.name}
                              onClick={() => selectTemplate(tpl.name)}
                              className={`flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer transition-all ${
                                isActive ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {tpl.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-900' : 'text-gray-700'}`}>
                                  {tpl.name}
                                </p>
                                <p className="text-xs text-gray-400 truncate">
                                  {tpl.description || `${count} Attribute`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {!loading && templateCount === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Noch keine Vorlagen</p>
                  <Link to="/templates" onClick={onClose} className="mt-3 inline-block text-xs text-indigo-600 hover:underline">
                    Zur Verwaltung →
                  </Link>
                </div>
              )}
              {!loading && templateCount > 0 && sortedTemplateCategories.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-xs">Keine Treffer</div>
              )}
            </div>
          </div>

          {/* Right panel — Template preview */}
          <div className="flex-1 flex flex-col min-w-0">
            {activeTpl ? (
              <>
                {/* Meta bar (read-only) */}
                <div className="border-b border-gray-100 px-5 py-3 shrink-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{activeTpl.name}</h3>
                    {activeTpl.category && (
                      <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                        {activeTpl.category}
                      </span>
                    )}
                  </div>
                  {activeTpl.description && (
                    <p className="text-xs text-gray-500">{activeTpl.description}</p>
                  )}
                </div>

                {/* Attributes (read-only) */}
                <div className="flex-1 overflow-y-auto">
                  {totalAttrs > 0 ? (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Attribute
                        </h3>
                        <span className="text-xs text-gray-400">
                          {filledCount}/{totalAttrs} ausgefüllt · {categoryCount} Kategorien
                        </span>
                      </div>

                      {Object.entries(activeGrouped).map(([category, attrs]) => (
                        <div key={category} className="rounded-xl border border-gray-100 overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{category}</span>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {attrs.map(({ key, value }) => {
                              const def = attributeConfig[key];
                              if (!def) return null;
                              const displayValue = value === '' || value === undefined
                                ? <span className="italic text-gray-300">nicht gesetzt</span>
                                : String(value);
                              return (
                                <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-medium text-gray-700">{def.name}</span>
                                      {def.required && <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />}
                                    </div>
                                  </div>
                                  <div className="w-64 shrink-0 text-sm text-gray-600 text-right truncate" title={typeof displayValue === 'string' ? displayValue : undefined}>
                                    {displayValue}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <Package className="w-10 h-10 mb-3 opacity-40" />
                      <p className="text-sm font-medium mb-1">Diese Vorlage enthält keine Attribute</p>
                      <Link to="/templates" onClick={onClose} className="mt-2 text-xs text-indigo-600 hover:underline">
                        In der Verwaltung bearbeiten →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-4 py-3 shrink-0">
                  <div className="flex items-center gap-3">
                    {/* Apply target */}
                    <div className="flex items-center gap-1.5 mr-auto">
                      <span className="text-xs text-gray-500">Ziel:</span>
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        {selectedSkus.length > 0 && (
                          <button
                            onClick={() => setApplyMode('selected')}
                            className={`px-2.5 py-1 text-xs transition-colors ${
                              applyMode === 'selected'
                                ? 'bg-indigo-600 text-white font-medium'
                                : 'text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {selectedSkus.length} Ausgewählte
                          </button>
                        )}
                        <button
                          onClick={() => setApplyMode('all')}
                          className={`px-2.5 py-1 text-xs transition-colors ${
                            applyMode === 'all'
                              ? 'bg-indigo-600 text-white font-medium'
                              : 'text-gray-500 hover:bg-gray-50'
                          }${selectedSkus.length > 0 ? ' border-l border-gray-200' : ''}`}
                        >
                          Alle{totalActiveProducts != null ? ` (${totalActiveProducts})` : ''}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleApply}
                      disabled={applying || filledCount === 0}
                      className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      {applying ? 'Anwenden...' : `Auf ${applyTargetCount} anwenden`}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <FileText className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium mb-1">Keine Vorlage ausgewählt</p>
                <p className="text-xs">Wähle links eine Vorlage zum Anwenden</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
