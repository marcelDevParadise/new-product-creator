import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  GripVertical,
  History,
  KanbanSquare,
  MessageSquare,
  Package,
  RefreshCw,
  Search,
  Send,
  UserRound,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  ProductHistoryEntry,
  WorkflowBoard,
  WorkflowColumn,
  WorkflowItem,
  WorkflowProductDetail,
  WorkflowStatus,
} from '../types';
import { useToast } from '../components/ui/Toast';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { WorkspaceHeader } from '../components/layout/WorkspaceHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const statusStyles: Record<WorkflowStatus, { border: string; badge: string; icon: typeof CircleDot }> = {
  draft: { border: 'border-slate-300/70', badge: 'bg-slate-100 text-slate-700', icon: CircleDot },
  in_progress: { border: 'border-sky-300/70', badge: 'bg-sky-100 text-sky-700', icon: Clock3 },
  review: { border: 'border-amber-300/70', badge: 'bg-amber-100 text-amber-700', icon: ClipboardCheck },
  approved: { border: 'border-emerald-300/70', badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  published: { border: 'border-indigo-300/70', badge: 'bg-indigo-100 text-indigo-700', icon: Send },
  error: { border: 'border-red-300/70', badge: 'bg-red-100 text-red-700', icon: XCircle },
  archived: { border: 'border-zinc-300/70', badge: 'bg-zinc-100 text-zinc-700', icon: Archive },
};

function WorkflowCard({
  item,
  onOpen,
  disabled,
}: {
  item: WorkflowItem;
  onOpen: () => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `workflow:${item.artikelnummer}`,
    data: { item },
    disabled,
  });

  return (
    <article
      ref={setNodeRef}
      className={`group rounded-2xl border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        statusStyles[item.status].border
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
          title="Produkt verschieben"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <p className="truncate text-sm font-semibold">{item.artikelname}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.artikelnummer}</p>
        </button>
        {item.bild ? (
          <img src={item.bild} alt="" className="h-10 w-10 shrink-0 rounded-lg border object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Package className="h-4 w-4 text-muted-foreground" />
          </span>
        )}
      </div>

      <button type="button" onClick={onOpen} className="mt-3 w-full space-y-2 text-left">
        <div className="flex flex-wrap gap-1.5">
          {item.approval_stale && <Badge className="bg-amber-100 text-amber-700">Nach Freigabe geändert</Badge>}
          {item.error_count > 0 && <Badge className="bg-red-100 text-red-700">{item.error_count} Fehler</Badge>}
          {item.warning_count > 0 && <Badge className="bg-amber-100 text-amber-700">{item.warning_count} Hinweise</Badge>}
          {item.is_parent && <Badge variant="secondary">Parent</Badge>}
          {item.parent_sku && <Badge variant="secondary">Variante</Badge>}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1 truncate">
            <UserRound className="h-3.5 w-3.5 shrink-0" />
            {item.assignee || 'Nicht zugewiesen'}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {item.comment_count}
          </span>
        </div>
      </button>
    </article>
  );
}

function WorkflowLane({
  column,
  items,
  onOpen,
  moving,
}: {
  column: WorkflowColumn;
  items: WorkflowItem[];
  onOpen: (item: WorkflowItem) => void;
  moving: boolean;
}) {
  const manualDropAllowed = column.id !== 'published';
  const { setNodeRef, isOver } = useDroppable({
    id: `workflow-lane:${column.id}`,
    data: { status: column.id },
    disabled: !manualDropAllowed || moving,
  });
  const Icon = statusStyles[column.id].icon;

  return (
    <section
      ref={setNodeRef}
      className={`flex max-h-[calc(100vh-17rem)] min-h-[28rem] flex-col rounded-3xl border bg-muted/20 transition ${
        isOver ? 'border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/15' : statusStyles[column.id].border
      }`}
    >
      <div className="border-b p-3.5">
        <div className="flex items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${statusStyles[column.id].badge}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{column.label}</h2>
            <p className="truncate text-[10px] text-muted-foreground">{column.description}</p>
          </div>
          <Badge variant="secondary" className="tabular-nums">{items.length}</Badge>
        </div>
        {!manualDropAllowed && (
          <p className="mt-2 text-[10px] text-indigo-600">Wird automatisch nach erfolgreicher Veröffentlichung gesetzt.</p>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
        {items.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-xs text-muted-foreground">
            {manualDropAllowed ? 'Produkte hier ablegen' : 'Wird nach erfolgreicher Veröffentlichung befüllt'}
          </div>
        ) : items.map((item) => (
          <WorkflowCard
            key={item.artikelnummer}
            item={item}
            onOpen={() => onOpen(item)}
            disabled={moving}
          />
        ))}
      </div>
    </section>
  );
}

function formatHistory(entry: ProductHistoryEntry): string {
  if (entry.event_type === 'workflow_status_changed') {
    return `Status: ${entry.old_value || '–'} → ${entry.new_value || '–'}`;
  }
  if (entry.event_type === 'workflow_assignee_changed') {
    return `Verantwortlich: ${entry.old_value || 'niemand'} → ${entry.new_value || 'niemand'}`;
  }
  if (entry.event_type === 'workflow_comment_added') return 'Kommentar hinzugefügt';
  return entry.detail || entry.event_type.replaceAll('_', ' ');
}

export function WorkflowPage() {
  const [board, setBoard] = useState<WorkflowBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [activeItem, setActiveItem] = useState<WorkflowItem | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkflowProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [commentAuthor, setCommentAuthor] = useState(() => localStorage.getItem('workflow.commentAuthor') || 'Team');
  const [commentBody, setCommentBody] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadBoard = useCallback(async () => {
    try {
      setBoard(await api.getWorkflowBoard());
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Workflow konnte nicht geladen werden', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const openDetail = async (item: WorkflowItem) => {
    setSelectedSku(item.artikelnummer);
    setDetail(null);
    setDetailLoading(true);
    try {
      const result = await api.getWorkflowProduct(item.artikelnummer);
      setDetail(result);
      setAssignee(result.item.assignee || '');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Workflow-Details konnten nicht geladen werden', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!board) return [];
    const query = search.trim().toLowerCase();
    return board.items.filter((item) => {
      const matchesSearch = !query || `${item.artikelnummer} ${item.artikelname} ${item.hersteller || ''} ${item.kategorie || ''}`
        .toLowerCase().includes(query);
      const matchesAssignee = !assigneeFilter
        || (assigneeFilter === '__unassigned__' ? !item.assignee : item.assignee === assigneeFilter);
      return matchesSearch && matchesAssignee;
    });
  }, [assigneeFilter, board, search]);

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as WorkflowItem | undefined;
    setActiveItem(item || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const item = event.active.data.current?.item as WorkflowItem | undefined;
    const status = event.over?.data.current?.status as WorkflowStatus | undefined;
    setActiveItem(null);
    if (!item || !status || item.status === status) return;

    setMoving(true);
    try {
      await api.updateWorkflowProduct(item.artikelnummer, { status });
      toast(`${item.artikelnummer} wurde nach „${board?.columns.find(column => column.id === status)?.label || status}“ verschoben`, 'success');
      await loadBoard();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Status konnte nicht geändert werden', 'error');
      await loadBoard();
    } finally {
      setMoving(false);
    }
  };

  const saveAssignee = async () => {
    if (!selectedSku) return;
    setSavingDetail(true);
    try {
      await api.updateWorkflowProduct(selectedSku, { assignee: assignee.trim() || null });
      const updatedDetail = await api.getWorkflowProduct(selectedSku);
      setDetail(updatedDetail);
      await loadBoard();
      toast('Verantwortlichkeit gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Verantwortlichkeit konnte nicht gespeichert werden', 'error');
    } finally {
      setSavingDetail(false);
    }
  };

  const addComment = async () => {
    if (!selectedSku || !commentBody.trim() || !commentAuthor.trim()) return;
    setSavingDetail(true);
    try {
      localStorage.setItem('workflow.commentAuthor', commentAuthor.trim());
      await api.addWorkflowComment(selectedSku, { author: commentAuthor.trim(), body: commentBody.trim() });
      setCommentBody('');
      setDetail(await api.getWorkflowProduct(selectedSku));
      await loadBoard();
      toast('Kommentar hinzugefügt', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Kommentar konnte nicht gespeichert werden', 'error');
    } finally {
      setSavingDetail(false);
    }
  };

  if (loading || !board) return <LoadingSpinner className="h-full" />;

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.09),transparent_32rem)]">
      <div className="mx-auto w-full max-w-[2200px] space-y-5 p-4 md:p-6 xl:px-8 xl:py-7">
        <WorkspaceHeader
          eyebrow="Produktprozess"
          title="Workflow"
          description="Produkte von der Anlage über Prüfung und Freigabe bis zur Veröffentlichung steuern."
          icon={KanbanSquare}
          stats={[
            { label: 'Produkte', value: board.items.length, icon: Package, tone: 'indigo' },
            { label: 'In Prüfung', value: board.items.filter(item => item.status === 'review').length, icon: ClipboardCheck, tone: 'amber' },
            { label: 'Freigegeben', value: board.items.filter(item => item.status === 'approved').length, icon: CheckCircle2, tone: 'emerald' },
            { label: 'Fehlerhaft', value: board.items.filter(item => item.status === 'error' || item.error_count > 0).length, icon: AlertTriangle, tone: 'amber' },
          ]}
          actions={<Button variant="outline" className="bg-background/70" onClick={() => loadBoard()} disabled={moving}><RefreshCw className="h-4 w-4" />Aktualisieren</Button>}
        />

        <section className="flex flex-col gap-3 rounded-3xl border bg-card/90 p-4 shadow-sm md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="SKU, Produkt, Hersteller oder Kategorie suchen …" className="h-10 rounded-xl pl-10" />
          </div>
          <select
            className="h-10 rounded-xl border bg-background px-3 text-sm"
            value={assigneeFilter}
            onChange={event => setAssigneeFilter(event.target.value)}
          >
            <option value="">Alle Verantwortlichen</option>
            <option value="__unassigned__">Nicht zugewiesen</option>
            {board.assignees.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <p className="shrink-0 text-xs text-muted-foreground">{filteredItems.length} sichtbar</p>
        </section>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveItem(null)}
        >
          <div className="grid auto-cols-[minmax(290px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-3">
            {board.columns.map(column => (
              <WorkflowLane
                key={column.id}
                column={column}
                items={filteredItems.filter(item => item.status === column.id)}
                onOpen={openDetail}
                moving={moving}
              />
            ))}
          </div>
          <DragOverlay>
            {activeItem ? (
              <div className="w-72 rounded-2xl border border-indigo-400 bg-card p-3 shadow-2xl">
                <p className="font-semibold">{activeItem.artikelname}</p>
                <p className="font-mono text-xs text-muted-foreground">{activeItem.artikelnummer}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <Dialog open={selectedSku !== null} onOpenChange={open => { if (!open) { setSelectedSku(null); setDetail(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {detailLoading || !detail ? (
            <LoadingSpinner className="min-h-72" />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 text-lg">{detail.item.artikelname}</DialogTitle>
                <DialogDescription>{detail.item.artikelnummer} · Workflow, Qualität und Zusammenarbeit</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="space-y-3 rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">Verantwortung</h3>
                    <Badge className={statusStyles[detail.item.status].badge}>
                      {board.columns.find(column => column.id === detail.item.status)?.label}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Input value={assignee} onChange={event => setAssignee(event.target.value)} placeholder="Name der verantwortlichen Person" list="workflow-assignees" />
                    <datalist id="workflow-assignees">{board.assignees.map(value => <option key={value} value={value} />)}</datalist>
                    <Button onClick={saveAssignee} disabled={savingDetail}>Speichern</Button>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => navigate(`/stammdaten/${encodeURIComponent(detail.item.artikelnummer)}`)}>
                    <Package className="h-4 w-4" />Produkt öffnen
                  </Button>
                  {detail.item.approval_stale && (
                    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                      Produkt oder Varianten wurden nach der letzten Freigabe geändert. Eine erneute Freigabe ist erforderlich.
                    </p>
                  )}
                </section>

                <section className="space-y-3 rounded-2xl border p-4">
                  <h3 className="font-semibold">Datenqualität</h3>
                  <div className="flex gap-2">
                    <Badge className={detail.item.error_count ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}>
                      {detail.item.error_count} Fehler
                    </Badge>
                    <Badge className="bg-amber-100 text-amber-700">{detail.item.warning_count} Hinweise</Badge>
                  </div>
                  <div className="max-h-32 space-y-1.5 overflow-y-auto">
                    {detail.validation?.issues.length ? detail.validation.issues.map((issue, index) => (
                      <p key={`${issue.field}-${index}`} className={`rounded-lg px-2.5 py-2 text-xs ${issue.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        <span className="font-medium">{issue.field}:</span> {issue.message}
                      </p>
                    )) : <p className="text-sm text-emerald-700">Keine Qualitätsprobleme gefunden.</p>}
                  </div>
                </section>
              </div>

              <section className="space-y-3 rounded-2xl border p-4">
                <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /><h3 className="font-semibold">Kommentare</h3></div>
                <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                  <Input value={commentAuthor} onChange={event => setCommentAuthor(event.target.value)} placeholder="Dein Name" />
                  <Input value={commentBody} onChange={event => setCommentBody(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addComment(); }} placeholder="Kommentar hinzufügen …" />
                  <Button onClick={addComment} disabled={savingDetail || !commentBody.trim()}><Send className="h-4 w-4" />Senden</Button>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {detail.comments.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p> : detail.comments.map(comment => (
                    <div key={comment.id} className="rounded-xl bg-muted/50 p-3">
                      <div className="flex justify-between gap-3 text-xs">
                        <span className="font-semibold">{comment.author}</span>
                        <span className="text-muted-foreground">{comment.created_at}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border p-4">
                <div className="flex items-center gap-2"><History className="h-4 w-4" /><h3 className="font-semibold">Historie</h3></div>
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {detail.history.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Änderungen protokolliert.</p> : detail.history.map(entry => (
                    <div key={entry.id} className="flex gap-3 border-l-2 border-indigo-200 pl-3 text-xs">
                      <span className="w-32 shrink-0 text-muted-foreground">{entry.created_at}</span>
                      <span>{formatHistory(entry)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
