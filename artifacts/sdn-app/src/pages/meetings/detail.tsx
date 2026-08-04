import { useMemo } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { useGetMeeting, useListTeamMembers } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Pencil } from 'lucide-react';
import { StatusBadge, MeetingDocument, formatDatePT } from './shared';
import { PendingItemsPanel, ActionItemsPanel } from './panels';
import { useMeetingItems } from './items-api';

export default function MeetingDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const id = Number(params.id);

  const { data: meeting, isLoading } = useGetMeeting(id, {
    query: { refetchInterval: 4000 } as any,
  });
  const { data: teamMembers = [] } = useListTeamMembers();
  const direcaoMembers = useMemo(
    () => teamMembers.filter(m => m.role === 'direcao' && m.active).map(m => m.name),
    [teamMembers]
  );
  const { data: meetingItems } = useMeetingItems(meeting?.id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/reunioes" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        {meeting && (
          <>
            <span className="text-sm text-muted-foreground">{formatDatePT(meeting.date)}</span>
            <StatusBadge status={meeting.status} />
            {meeting.editingBy && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-brand-cyan-dark bg-brand-cyan-bg border border-brand-cyan-border rounded-full px-2.5 py-1">
                <Pencil className="w-3 h-3" /> {meeting.editingBy} está a editar
              </span>
            )}
          </>
        )}
        <div className="flex-1" />
        {meeting && (
          <Button size="sm" onClick={() => setLocation(`/reunioes/${meeting.id}/editar`)}>
            <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
          </Button>
        )}
      </div>

      {meeting && (
        <div className="space-y-3">
          <PendingItemsPanel meetingId={meeting.id} />
          <ActionItemsPanel meetingId={meeting.id} direcaoMembers={direcaoMembers} />
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl px-10 py-10">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-12">A carregar...</p>
        ) : meeting ? (
          <MeetingDocument meeting={meeting} meetingItems={meetingItems} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Ata não encontrada.</p>
        )}
      </div>
    </div>
  );
}
