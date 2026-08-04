import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetMeeting, useCreateMeeting, useUpdateMeeting,
  getListMeetingsQueryKey, getGetMeetingQueryKey,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Play, Save } from 'lucide-react';
import { PrepEditor, tomorrowStr } from './shared';
import type { PrepState } from './shared';

export default function MeetingPrepare() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === 'novo';
  const [id, setId] = useState<number | null>(isNew ? null : Number(params.id));
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: meeting, isLoading } = useGetMeeting(id ?? 0, { query: { enabled: id != null } as any });

  const [prep, setPrep] = useState<PrepState>({ date: tomorrowStr(), items: [] });
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && meeting) {
      setPrep({ date: meeting.date, items: meeting.agendaItems.filter(a => !a.pending).map(a => a.text) });
      initializedRef.current = true;
    }
  }, [meeting]);

  const createMutation = useCreateMeeting();
  const updateMutation = useUpdateMeeting();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const buildPayload = (status: 'preparacao' | 'a_decorrer') => ({
    date: prep.date,
    attendees: '',
    agendaItems: prep.items.filter(t => t.trim()).map(t => ({ text: t, pending: false })),
    sections: [],
    notes: null,
    status,
  });

  const invalidateAll = (targetId?: number) => {
    qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
    const effectiveId = targetId ?? id;
    if (effectiveId != null) qc.invalidateQueries({ queryKey: getGetMeetingQueryKey(effectiveId) });
  };

  const handleSave = async () => {
    try {
      if (id != null) {
        await updateMutation.mutateAsync({ id, data: buildPayload('preparacao') });
        toast({ title: 'Reunião atualizada' });
        invalidateAll();
      } else {
        const created = await createMutation.mutateAsync({ data: buildPayload('preparacao') });
        toast({ title: 'Reunião preparada', description: 'Podes ir acrescentando pontos quando quiseres.' });
        invalidateAll(created.id);
        setId(created.id);
        setLocation(`/reunioes/${created.id}/preparar`, { replace: true });
      }
    } catch {
      toast({ title: 'Erro ao guardar', variant: 'destructive' });
    }
  };

  const handleStart = async () => {
    try {
      let targetId = id;
      if (targetId != null) {
        await updateMutation.mutateAsync({ id: targetId, data: buildPayload('a_decorrer') });
      } else {
        const created = await createMutation.mutateAsync({ data: buildPayload('a_decorrer') });
        targetId = created.id;
      }
      invalidateAll(targetId);
      setLocation(`/reunioes/${targetId}/editar`);
    } catch {
      toast({ title: 'Erro ao iniciar reunião', variant: 'destructive' });
    }
  };

  if (!isNew && isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-12">A carregar...</p>;
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setLocation('/reunioes')} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold tracking-tight">
          {id != null ? 'Atualizar preparação' : 'Preparar próxima reunião'}
        </h1>
        <div className="flex-1" />
        <Button variant="outline" disabled={isSaving || !prep.date} onClick={handleSave}>
          <Save className="w-3.5 h-3.5 mr-2" /> {isSaving ? 'A guardar…' : 'Guardar preparação'}
        </Button>
        <Button className="gap-2 bg-green-600 hover:bg-green-700" disabled={isSaving || !prep.date} onClick={handleStart}>
          <Play className="w-3.5 h-3.5" />
          Iniciar reunião
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-8">
        <PrepEditor value={prep} onChange={setPrep} />
      </div>
    </div>
  );
}
