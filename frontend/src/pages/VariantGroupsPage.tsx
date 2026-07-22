import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, ChevronRight, ChevronDown, RefreshCw, Trash2, Boxes, Package } from 'lucide-react';
import { WorkspaceHeader } from '../components/layout/WorkspaceHeader';
import { api } from '../api/client';
import { useToast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import type { VariantGroup } from '../types';

export function VariantGroupsPage() {
  const [groups, setGroups] = useState<VariantGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedParent, setExpandedParent] = useState<string | null>(null);
  const [dissolveTarget, setDissolveTarget] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getVariantGroups();
      setGroups(data);
    } catch {
      toast('Variantengruppen konnten nicht geladen werden', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDissolve = async (parentSku: string) => {
    try {
      await api.deleteVariantGroup(parentSku);
      toast('Variantengruppe aufgelöst', 'success');
      setDissolveTarget(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fehler', 'error');
    }
  };

  const totalChildren = groups.reduce((sum, g) => sum + g.children.length, 0);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_32rem)]">
      <div className="mx-auto w-full max-w-[1920px] space-y-5 p-4 md:p-6 xl:px-8 xl:py-7 2xl:px-10">
      <WorkspaceHeader
        eyebrow="Produktbeziehungen"
        title="Variantengruppen"
        description="Parent-Produkte, Variantenachsen und zugehörige Kindartikel zentral verwalten."
        icon={GitBranch}
        stats={[
          { label: 'Gruppen', value: groups.length, icon: Boxes, tone: 'indigo' },
          { label: 'Parent-Produkte', value: groups.length, icon: Package, tone: 'violet' },
          { label: 'Varianten', value: totalChildren, icon: GitBranch, tone: 'sky' },
        ]}
        actions={<Button variant="outline" className="bg-background/70" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Aktualisieren</Button>}
      />

      {/* Group list */}
      {groups.length === 0 && !loading ? (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed bg-card/70 px-6 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><GitBranch className="h-6 w-6 text-muted-foreground" /></span>
          <h3 className="font-semibold">Keine Variantengruppen vorhanden</h3>
          <p className="mt-1 text-sm text-muted-foreground">Erstelle Gruppen über die Stammdaten-Seite.</p>
          <Button className="mt-4" onClick={() => navigate('/stammdaten')}>Stammdaten öffnen</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isExpanded = expandedParent === g.parent.artikelnummer;
            return (
              <div key={g.parent.artikelnummer} className="overflow-hidden rounded-3xl border bg-card/90 shadow-sm transition hover:border-indigo-500/25 hover:shadow-md">
                <div
                  className="flex flex-wrap items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedParent(isExpanded ? null : g.parent.artikelnummer)}
                >
                  <button className="text-gray-400">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-gray-900">{g.parent.artikelnummer}</span>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                        Parent
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{g.parent.artikelname}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    {g.variant_axes.length > 0 && (
                      <div className="flex gap-1">
                        {g.variant_axes.map((axis) => (
                          <Badge key={axis} variant="secondary" className="bg-indigo-50 text-indigo-600 hover:bg-indigo-50 text-[10px]">
                            {axis}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <span className="text-sm text-gray-500">{g.children.length} Varianten</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/stammdaten/${encodeURIComponent(g.parent.artikelnummer)}`); }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDissolveTarget(g.parent.artikelnummer); }}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Gruppe auflösen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-5 py-2 text-xs font-medium text-gray-500">Artikelnummer</th>
                          <th className="text-left px-5 py-2 text-xs font-medium text-gray-500">Artikelname</th>
                          {g.variant_axes.map((axis) => (
                            <th key={axis} className="text-left px-5 py-2 text-xs font-medium text-gray-500">{axis}</th>
                          ))}
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {g.children.map((c) => (
                          <tr key={c.artikelnummer} className="hover:bg-gray-50">
                            <td className="px-5 py-2.5 font-mono text-gray-700">{c.artikelnummer}</td>
                            <td className="px-5 py-2.5 text-gray-600">{c.artikelname}</td>
                            {g.variant_axes.map((axis) => (
                              <td key={axis} className="px-5 py-2.5 text-gray-600">
                                {c.variant_attributes[axis] || '–'}
                              </td>
                            ))}
                            <td className="px-3 py-2.5">
                              <button
                                onClick={() => navigate(`/stammdaten/${encodeURIComponent(c.artikelnummer)}`)}
                                className="text-gray-400 hover:text-indigo-600 transition-colors"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dissolveTarget && (
        <ConfirmDialog
          title="Variantengruppe auflösen"
          message={`Möchtest du die Gruppe "${dissolveTarget}" wirklich auflösen? Die Produkte bleiben erhalten, nur die Parent/Child-Beziehung wird entfernt.`}
          confirmLabel="Auflösen"
          variant="danger"
          onConfirm={() => handleDissolve(dissolveTarget)}
          onCancel={() => setDissolveTarget(null)}
        />
      )}
      </div>
    </div>
  );
}
