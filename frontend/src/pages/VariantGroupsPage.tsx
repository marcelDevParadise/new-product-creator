import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, ChevronRight, ChevronDown, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { api } from '../api/client';
import { useToast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Variantengruppen" description="Übersicht aller Parent/Child-Beziehungen" />
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gruppen</CardTitle>
            <GitBranch className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{groups.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Parent-Produkte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{groups.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Varianten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-violet-600">{totalChildren}</div>
          </CardContent>
        </Card>
      </div>

      {/* Group list */}
      {groups.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-500">
          <GitBranch className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm mb-2">Keine Variantengruppen vorhanden.</p>
          <p className="text-xs text-gray-400">Erstelle Gruppen über die Stammdaten-Seite.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isExpanded = expandedParent === g.parent.artikelnummer;
            return (
              <div key={g.parent.artikelnummer} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
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
                  <div className="flex items-center gap-3">
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
                  <div className="border-t border-gray-100">
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
  );
}
