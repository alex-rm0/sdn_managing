import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetMeeting, useCreateMeeting, useUpdateMeeting, useListTeamMembers,
  getListMeetingsQueryKey, getGetMeetingQueryKey,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ChevronLeft, CheckCircle, Save } from 'lucide-react';
import {
  EditorState, emptyEditor, meetingToEditor, MeetingEditor,
  sendEditingHeartbeat, stopEditingHeartbeat,
} from './shared';
import { PendingItemsPanel, ActionItemsPanel } from './panels';

const HEARTBEAT_MS = 5000;

export default function MeetingEdit() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === 'novo';
  const [id, setId] = useState<number | null>(isNew ? null : Number(params.id));
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: meeting, isLoading } = useGetMeeting(id ?? 0, { query: { enabled: id != null } as any });
  const { data: teamMembers = [] } = useListTeamMembers();
  const direcaoMembers = useMemo(
    () => teamMembers.filter(m => m.role === 'direcao' && m.active).map(m => m.name),
    [teamMembers]
  );

  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && meeting) {
      setEditor(meetingToEditor(meeting));
      initializedRef.current = true;
    }
  }, [meeting]);

  // Presence heartbeat — lets viewers on the read-only page see who's editing.
  useEffect(() => {
    if (id == null) return;
    sendEditingHeartbeat(id);
    const interval = setInterval(() => sendEditingHeartbeat(id), HEARTBEAT_MS);
    return () => { clearInterval(interval); stopEditingHeartbeat(id); };
  }, [id]);

  const createMutation = useCreateMeeting();
  const updateMutation = useUpdateMeeting();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const buildPayload = (overrideStatus?: string) => ({
    date: editor.date,
    attendees: editor.attendees,
    agendaItems: editor.agendaItems.filter(a => a.text.trim()),
    sections: editor.sections.filter(s => s.title.trim()).map(s => ({ ...s, items: s.items.filter(i => i.trim()) })),
    notes: editor.notes.trim() || null,
    ...(overrideStatus ? { status: overrideStatus } : {}),
  });

  const invalidateAll = (targetId?: number) => {
    qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
    const effectiveId = targetId ?? id;
    if (effectiveId != null) qc.invalidateQueries({ queryKey: getGetMeetingQueryKey(effectiveId) });
  };

  const handleSave = async () => {
    try {
      if (id != null) {
        await updateMutation.mutateAsync({ id, data: buildPayload() });
        toast({ title: 'Ata guardada' });
        invalidateAll();
      } else {
        const created = await createMutation.mutateAsync({ data: buildPayload('finalizada') });
        toast({ title: 'Ata registada' });
        invalidateAll(created.id);
        setId(created.id);
        setLocation(`/reunioes/${created.id}/editar`, { replace: true });
      }
    } catch {
      toast({ title: 'Erro ao guardar', variant: 'destructive' });
    }
  };

  const handleFinalize = async () => {
    if (id == null) return;
    try {
      await updateMutation.mutateAsync({ id, data: buildPayload('finalizada') });
      toast({ title: 'Reunião finalizada!' });
      invalidateAll();
      stopEditingHeartbeat(id);
      setLocation(`/reunioes/${id}`);
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handleRevertToPrep = async () => {
    if (id == null) return;
    try {
      await updateMutation.mutateAsync({ id, data: { status: 'preparacao' } });
      toast({ title: 'Reunião voltou a preparação' });
      invalidateAll();
      stopEditingHeartbeat(id);
      setLocation('/reunioes');
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    if (id != null) stopEditingHeartbeat(id);
    setLocation(id != null ? `/reunioes/${id}` : '/reunioes');
  };

  const isADeDecorrer = meeting?.status === 'a_decorrer';

  if (!isNew && isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-12">A carregar...</p>;
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto">
      <div className="sticky top-16 z-[5] px-5 py-3 -mt-1 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-sm flex items-center gap-3 flex-wrap">
        <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold tracking-tight">
          {isADeDecorrer && <span className="text-green-700 font-normal">Reunião a decorrer — </span>}
          {id != null ? 'Editar ata' : 'Registar ata'}
        </h1>
        <div className="flex-1" />
        {isADeDecorrer && (
          <Button variant="ghost" size="sm" className="text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50" disabled={isSaving} onClick={handleRevertToPrep}>
            <ChevronLeft className="w-3 h-3" /> Voltar a preparação
          </Button>
        )}
        {isADeDecorrer && (
          <Button variant="outline" className="gap-1.5 border-green-400 text-green-700 hover:bg-green-50" disabled={isSaving} onClick={handleFinalize}>
            <CheckCircle className="w-3.5 h-3.5" /> Finalizar reunião
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving || !editor.date}>
          <Save className="w-3.5 h-3.5 mr-2" /> {isSaving ? 'A guardar…' : 'Guardar'}
        </Button>
      </div>

      <div className="space-y-3">
        <PendingItemsPanel meetingId={id ?? undefined} />
        <ActionItemsPanel meetingId={id ?? undefined} direcaoMembers={direcaoMembers} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-8">
        <MeetingEditor value={editor} onChange={setEditor} direcaoMembers={direcaoMembers} />
      </div>
    </div>
  );
}
