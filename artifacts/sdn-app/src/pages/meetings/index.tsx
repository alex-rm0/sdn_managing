import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListMeetings, useCreateMeeting, useUpdateMeeting, useDeleteMeeting,
  getListMeetingsQueryKey,
} from '@workspace/api-client-react';
import type { MeetingMinutes, MeetingAgendaItem, MeetingSection } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, GripVertical, FileText, Users, ChevronRight, Pencil, X, ClipboardList, Clock } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PT_MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function formatDatePT(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${day} de ${PT_MONTHS[month - 1]} de ${year}`;
}

function formatDateShort(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
}

// ── View: rendered ata ────────────────────────────────────────────────────────

function MeetingView({ meeting }: { meeting: MeetingMinutes }) {
  const agenda = meeting.agendaItems.filter(a => !a.pending);
  const pending = meeting.agendaItems.filter(a => a.pending);
  let counter = 1;

  return (
    <div className="font-serif text-sm leading-relaxed space-y-6 py-2">
      {/* Header */}
      <div className="text-center space-y-1">
        <p className="text-base font-semibold">Reunião de dia {formatDatePT(meeting.date)}</p>
        <p className="text-xs text-muted-foreground tracking-widest">— 2{meeting.date.slice(1,4)} —</p>
        <p className="text-sm font-medium mt-2">Reunião: Direção da SDN</p>
      </div>

      <Separator />

      {/* Attendees */}
      {meeting.attendees && (
        <div>
          <p className="text-center font-medium text-xs uppercase tracking-wider text-muted-foreground mb-2">Presentes</p>
          <p className="text-center">{meeting.attendees}</p>
        </div>
      )}

      {/* Agenda */}
      {agenda.length > 0 && (
        <div>
          <p className="text-center font-medium text-xs uppercase tracking-wider text-muted-foreground mb-3">Assuntos para abordar</p>
          <ol className="space-y-1.5 pl-2">
            {agenda.map(item => (
              <li key={counter} className="flex gap-2">
                <span className="text-muted-foreground font-mono w-5 shrink-0 text-right">{counter++}.</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <p className="text-center font-medium text-xs uppercase tracking-wider text-muted-foreground mb-3">Assuntos Pendentes</p>
          <ol className="space-y-1.5 pl-2">
            {pending.map(item => (
              <li key={counter} className="flex gap-2">
                <span className="text-muted-foreground font-mono w-5 shrink-0 text-right">{counter++}.</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Topic sections */}
      {meeting.sections.map(section => (
        <div key={section.title}>
          <Separator className="my-4" />
          <p className="text-center font-medium text-xs uppercase tracking-wider text-muted-foreground mb-3">{section.title}</p>
          <ol className="space-y-1.5 pl-2">
            {section.items.map(item => (
              <li key={counter} className="flex gap-2">
                <span className="text-muted-foreground font-mono w-5 shrink-0 text-right">{counter++}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {/* Notes */}
      {meeting.notes && (
        <div>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground italic">{meeting.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Editor types ──────────────────────────────────────────────────────────────

interface EditorState {
  date: string;
  attendees: string;
  agendaItems: MeetingAgendaItem[];
  sections: MeetingSection[];
  notes: string;
}

function emptyEditor(): EditorState {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return {
    date: `${yyyy}-${mm}-${dd}`,
    attendees: '',
    agendaItems: [
      { text: '', pending: false },
    ],
    sections: [],
    notes: '',
  };
}

function meetingToEditor(m: MeetingMinutes): EditorState {
  return {
    date: m.date,
    attendees: m.attendees,
    agendaItems: m.agendaItems.length > 0 ? m.agendaItems : [{ text: '', pending: false }],
    sections: m.sections,
    notes: m.notes ?? '',
  };
}

// ── Editor component ──────────────────────────────────────────────────────────

function MeetingEditor({ value, onChange }: { value: EditorState; onChange: (v: EditorState) => void }) {
  const set = (patch: Partial<EditorState>) => onChange({ ...value, ...patch });

  // agenda items
  const setAgendaItem = (i: number, patch: Partial<MeetingAgendaItem>) => {
    const items = [...value.agendaItems];
    items[i] = { ...items[i], ...patch };
    set({ agendaItems: items });
  };
  const addAgendaItem = (pending: boolean) => set({ agendaItems: [...value.agendaItems, { text: '', pending }] });
  const removeAgendaItem = (i: number) => set({ agendaItems: value.agendaItems.filter((_, idx) => idx !== i) });

  // sections
  const addSection = () => set({ sections: [...value.sections, { title: '', items: [''] }] });
  const removeSection = (i: number) => set({ sections: value.sections.filter((_, idx) => idx !== i) });
  const setSection = (i: number, patch: Partial<MeetingSection>) => {
    const sections = [...value.sections];
    sections[i] = { ...sections[i], ...patch };
    set({ sections });
  };
  const addSectionItem = (si: number) => {
    const sections = [...value.sections];
    sections[si] = { ...sections[si], items: [...sections[si].items, ''] };
    set({ sections });
  };
  const setSectionItem = (si: number, ii: number, text: string) => {
    const sections = [...value.sections];
    const items = [...sections[si].items];
    items[ii] = text;
    sections[si] = { ...sections[si], items };
    set({ sections });
  };
  const removeSectionItem = (si: number, ii: number) => {
    const sections = [...value.sections];
    sections[si] = { ...sections[si], items: sections[si].items.filter((_, idx) => idx !== ii) };
    set({ sections });
  };

  const agenda = value.agendaItems.filter(a => !a.pending);
  const pending = value.agendaItems.filter(a => a.pending);

  return (
    <div className="space-y-6">
      {/* Date & Attendees */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</label>
          <Input type="date" value={value.date} onChange={e => set({ date: e.target.value })} />
        </div>
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Presentes</label>
          <Textarea
            placeholder="Artur Ribeiro, Francisca Duarte, …"
            value={value.attendees}
            onChange={e => set({ attendees: e.target.value })}
            rows={2}
            className="resize-none"
          />
        </div>
      </div>

      {/* Agenda items */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assuntos para abordar</span>
        </div>
        <div className="space-y-2 pl-1">
          {value.agendaItems.map((item, i) => !item.pending ? (
            <div key={i} className="flex items-start gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-2 shrink-0" />
              <Input
                placeholder={`Ponto ${agenda.indexOf(item) + 1}…`}
                value={item.text}
                onChange={e => setAgendaItem(i, { text: e.target.value })}
                className="flex-1"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeAgendaItem(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : null)}
          <Button variant="outline" size="sm" className="ml-6 text-xs" onClick={() => addAgendaItem(false)}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar ponto
          </Button>
        </div>
      </div>

      {/* Pending items */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assuntos Pendentes</span>
        </div>
        <div className="space-y-2 pl-1">
          {value.agendaItems.map((item, i) => item.pending ? (
            <div key={i} className="flex items-start gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-2 shrink-0" />
              <Input
                placeholder={`Pendente ${pending.indexOf(item) + 1}…`}
                value={item.text}
                onChange={e => setAgendaItem(i, { text: e.target.value })}
                className="flex-1"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeAgendaItem(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : null)}
          <Button variant="outline" size="sm" className="ml-6 text-xs" onClick={() => addAgendaItem(true)}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar pendente
          </Button>
        </div>
      </div>

      {/* Topic sections */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tópicos debatidos</span>
        </div>
        {value.sections.map((section, si) => (
          <div key={si} className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Título do tópico (ex: Sanfil, COP, Febrada…)"
                value={section.title}
                onChange={e => setSection(si, { title: e.target.value })}
                className="flex-1 font-medium"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeSection(si)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 pl-1">
              {section.items.map((item, ii) => (
                <div key={ii} className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-2 shrink-0" />
                  <Textarea
                    placeholder={`Nota ${ii + 1}…`}
                    value={item}
                    onChange={e => setSectionItem(si, ii, e.target.value)}
                    rows={2}
                    className="flex-1 resize-none text-sm"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive mt-0.5" onClick={() => removeSectionItem(si, ii)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="text-xs" onClick={() => addSectionItem(si)}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar nota
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="text-xs" onClick={addSection}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar tópico
        </Button>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações gerais</label>
        <Textarea
          placeholder="Notas adicionais…"
          value={value.notes}
          onChange={e => set({ notes: e.target.value })}
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MeetingsList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: meetings = [], isLoading } = useListMeetings();

  const createMutation = useCreateMeeting();
  const updateMutation = useUpdateMeeting();
  const deleteMutation = useDeleteMeeting();

  const [viewMeeting, setViewMeeting] = useState<MeetingMinutes | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MeetingMinutes | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());

  const invalidate = () => qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() });

  const openCreate = () => {
    setEditTarget(null);
    setEditor(emptyEditor());
    setEditOpen(true);
  };

  const openEdit = (m: MeetingMinutes) => {
    setEditTarget(m);
    setEditor(meetingToEditor(m));
    setEditOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      date: editor.date,
      attendees: editor.attendees,
      agendaItems: editor.agendaItems.filter(a => a.text.trim()),
      sections: editor.sections
        .filter(s => s.title.trim())
        .map(s => ({ ...s, items: s.items.filter(i => i.trim()) })),
      notes: editor.notes.trim() || null,
    };

    try {
      if (editTarget) {
        await updateMutation.mutateAsync({ id: editTarget.id, data: payload });
        toast({ title: 'Ata atualizada' });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: 'Ata registada' });
      }
      setEditOpen(false);
      invalidate();
    } catch {
      toast({ title: 'Erro ao guardar', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: 'Ata eliminada' });
      invalidate();
    } catch {
      toast({ title: 'Erro ao eliminar', variant: 'destructive' });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Reuniões de Direção</h1>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Nova ata
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar…</p>
        ) : meetings.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma ata registada</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>Registar a primeira ata</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map(m => {
              const agendaCount = m.agendaItems.filter(a => !a.pending).length;
              const pendingCount = m.agendaItems.filter(a => a.pending).length;
              const attendeeList = m.attendees.split(',').map(s => s.trim()).filter(Boolean);
              return (
                <Card key={m.id} className="group hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewMeeting(m)}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-base">Reunião de {formatDateShort(m.date)}</span>
                          <Badge variant="outline" className="text-xs font-normal">
                            {formatDatePT(m.date)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                          {attendeeList.length > 0 && (
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" />
                              {attendeeList.length === 1 ? attendeeList[0] : `${attendeeList.slice(0, 3).join(', ')}${attendeeList.length > 3 ? ` +${attendeeList.length - 3}` : ''}`}
                            </span>
                          )}
                          {agendaCount > 0 && (
                            <span className="flex items-center gap-1.5">
                              <ClipboardList className="w-3.5 h-3.5" />
                              {agendaCount} assunto{agendaCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {m.sections.length > 0 && (
                            <span className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              {m.sections.length} tópico{m.sections.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar ata?</AlertDialogTitle>
                              <AlertDialogDescription>Remove permanentemente a ata de {formatDatePT(m.date)}.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(m.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── View dialog ── */}
      <Dialog open={!!viewMeeting} onOpenChange={v => !v && setViewMeeting(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              <span>Ata — {viewMeeting ? formatDatePT(viewMeeting.date) : ''}</span>
              {viewMeeting && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setViewMeeting(null); openEdit(viewMeeting); }}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 pr-2">
            {viewMeeting && <MeetingView meeting={viewMeeting} />}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit dialog ── */}
      <Dialog open={editOpen} onOpenChange={v => { if (!v) setEditOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar ata' : 'Nova ata'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 pr-2">
            <div className="py-1">
              <MeetingEditor value={editor} onChange={setEditor} />
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving || !editor.date}>
              {isSaving ? 'A guardar…' : editTarget ? 'Guardar' : 'Registar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
