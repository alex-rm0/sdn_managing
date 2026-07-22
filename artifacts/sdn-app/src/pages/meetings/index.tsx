import { useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListMeetings, useCreateMeeting, useUpdateMeeting, useDeleteMeeting,
  getListMeetingsQueryKey, useListTeamMembers,
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
import {
  Plus, Trash2, GripVertical, FileText, Users, Pencil, X,
  ClipboardList, Clock, Upload, Loader2, Search, ChevronDown, ChevronUp,
} from 'lucide-react';

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

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// ── View: rendered ata (document) ─────────────────────────────────────────────

function MeetingDocument({ meeting, onEdit }: { meeting: MeetingMinutes; onEdit: () => void }) {
  const agenda = meeting.agendaItems.filter(a => !a.pending);
  const pending = meeting.agendaItems.filter(a => a.pending);
  const attendeeList = meeting.attendees.split(',').map(s => s.trim()).filter(Boolean);
  let counter = 1;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Document header */}
      <div className="text-center space-y-2 pb-6">
        <p className="text-xl font-bold tracking-tight">Reunião de dia {formatDatePT(meeting.date)}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Direção da SDN — AAC</p>
        <div className="pt-2">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={onEdit}>
            <Pencil className="w-3 h-3" /> Editar ata
          </Button>
        </div>
      </div>

      <Separator />

      {/* Presentes */}
      {attendeeList.length > 0 && (
        <div className="py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground text-center mb-3">Presentes</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {attendeeList.map(name => (
              <div key={name} className="flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-1">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                  {initials(name)}
                </div>
                <span className="text-sm">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agenda + Pending */}
      {(agenda.length > 0 || pending.length > 0) && (
        <>
          <Separator />
          <div className="py-5 space-y-5">
            {agenda.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground text-center mb-3">Assuntos para abordar</p>
                <ol className="space-y-2">
                  {agenda.map(item => (
                    <li key={counter} className="flex gap-3 items-start">
                      <span className="text-xs text-muted-foreground font-mono w-6 shrink-0 text-right pt-0.5">{counter++}.</span>
                      <span className="text-sm leading-relaxed">{item.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {pending.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-600 text-center mb-3">Assuntos Pendentes</p>
                <ol className="space-y-2">
                  {pending.map(item => (
                    <li key={counter} className="flex gap-3 items-start">
                      <span className="text-xs text-amber-500 font-mono w-6 shrink-0 text-right pt-0.5">{counter++}.</span>
                      <span className="text-sm leading-relaxed text-muted-foreground">{item.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </>
      )}

      {/* Topic sections */}
      {meeting.sections.map(section => (
        <div key={section.title}>
          <Separator />
          <div className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground text-center mb-3">{section.title}</p>
            <ol className="space-y-2">
              {section.items.map(item => (
                <li key={counter} className="flex gap-3 items-start">
                  <span className="text-xs text-muted-foreground font-mono w-6 shrink-0 text-right pt-0.5">{counter++}.</span>
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ))}

      {/* Notes */}
      {meeting.notes && (
        <>
          <Separator />
          <p className="py-4 text-xs text-muted-foreground italic">{meeting.notes}</p>
        </>
      )}
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

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
  return { date: `${yyyy}-${mm}-${dd}`, attendees: '', agendaItems: [{ text: '', pending: false }], sections: [], notes: '' };
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

function MeetingEditor({ value, onChange, direcaoMembers }: {
  value: EditorState;
  onChange: (v: EditorState) => void;
  direcaoMembers: string[];
}) {
  const set = (patch: Partial<EditorState>) => onChange({ ...value, ...patch });

  // Parse selected names from attendees string
  const selected = useMemo(() =>
    new Set(value.attendees.split(',').map(s => s.trim()).filter(Boolean)),
    [value.attendees]
  );

  const toggleMember = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    // Keep direção members in order, then others at end
    const ordered = direcaoMembers.filter(n => next.has(n));
    const others = [...next].filter(n => !direcaoMembers.includes(n));
    set({ attendees: [...ordered, ...others].join(', ') });
  };

  // Others: names not in direcaoMembers
  const otherNames = [...selected].filter(n => !direcaoMembers.includes(n)).join(', ');

  const setAgendaItem = (i: number, patch: Partial<MeetingAgendaItem>) => {
    const items = [...value.agendaItems];
    items[i] = { ...items[i], ...patch };
    set({ agendaItems: items });
  };
  const addAgendaItem = (pending: boolean) => set({ agendaItems: [...value.agendaItems, { text: '', pending }] });
  const removeAgendaItem = (i: number) => set({ agendaItems: value.agendaItems.filter((_, idx) => idx !== i) });

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

  const agendaItems = value.agendaItems.filter(a => !a.pending);
  const pendingItems = value.agendaItems.filter(a => a.pending);

  return (
    <div className="space-y-6">
      {/* Date */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</label>
        <Input type="date" value={value.date} onChange={e => set({ date: e.target.value })} className="w-48" />
      </div>

      {/* Attendees — checkboxes + others */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Presentes
        </label>
        {direcaoMembers.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5 p-3 border rounded-lg bg-muted/20">
            {direcaoMembers.map(name => (
              <label key={name} className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={selected.has(name)}
                  onChange={() => toggleMember(name)}
                  className="rounded border-muted-foreground/30"
                />
                <span className="text-sm">{name}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Ainda não há membros da Direção definidos em <strong>Equipa</strong>.</p>
        )}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Outros presentes (não membros da Direção)</label>
          <Input
            placeholder="Ex: Convidado Externo, Arq. Silva…"
            value={otherNames}
            onChange={e => {
              const newOthers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
              const ordered = direcaoMembers.filter(n => selected.has(n));
              set({ attendees: [...ordered, ...newOthers].join(', ') });
            }}
          />
        </div>
      </div>

      {/* Agenda items */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Assuntos para abordar
        </label>
        <div className="space-y-2 pl-1">
          {value.agendaItems.map((item, i) => !item.pending ? (
            <div key={i} className="flex items-start gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-2 shrink-0" />
              <Input
                placeholder={`Ponto ${agendaItems.indexOf(item) + 1}…`}
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
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-500" /> Assuntos Pendentes
        </label>
        <div className="space-y-2 pl-1">
          {value.agendaItems.map((item, i) => item.pending ? (
            <div key={i} className="flex items-start gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-2 shrink-0" />
              <Input
                placeholder={`Pendente ${pendingItems.indexOf(item) + 1}…`}
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
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Tópicos debatidos
        </label>
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
        <Textarea placeholder="Notas adicionais…" value={value.notes} onChange={e => set({ notes: e.target.value })} rows={3} className="resize-none" />
      </div>
    </div>
  );
}

// ── Highlight search matches ──────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MeetingsList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: meetings = [], isLoading } = useListMeetings();
  const { data: teamMembers = [] } = useListTeamMembers();
  const direcaoMembers = useMemo(() =>
    teamMembers.filter(m => m.role === 'direcao' && m.active).map(m => m.name),
    [teamMembers]
  );

  const createMutation = useCreateMeeting();
  const updateMutation = useUpdateMeeting();
  const deleteMutation = useDeleteMeeting();

  // Search state
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Dialog state
  const [viewMeeting, setViewMeeting] = useState<MeetingMinutes | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MeetingMinutes | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() });

  // Filter meetings
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return meetings.filter(m => {
      if (dateFrom && m.date < dateFrom) return false;
      if (dateTo && m.date > dateTo) return false;
      if (!q) return true;
      const inAttendees = m.attendees.toLowerCase().includes(q);
      const inAgenda = m.agendaItems.some(a => a.text.toLowerCase().includes(q));
      const inSections = m.sections.some(s =>
        s.title.toLowerCase().includes(q) || s.items.some(i => i.toLowerCase().includes(q))
      );
      const inNotes = (m.notes ?? '').toLowerCase().includes(q);
      return inAttendees || inAgenda || inSections || inNotes;
    });
  }, [meetings, search, dateFrom, dateTo]);

  const openCreate = () => { setEditTarget(null); setEditor(emptyEditor()); setEditOpen(true); };
  const openEdit = (m: MeetingMinutes) => { setEditTarget(m); setEditor(meetingToEditor(m)); setViewMeeting(null); setEditOpen(true); };

  const handleSave = async () => {
    const payload = {
      date: editor.date,
      attendees: editor.attendees,
      agendaItems: editor.agendaItems.filter(a => a.text.trim()),
      sections: editor.sections.filter(s => s.title.trim()).map(s => ({ ...s, items: s.items.filter(i => i.trim()) })),
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setIsParsing(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/meetings/parse-file', { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error ?? 'Erro ao processar ficheiro');
      }
      const data = await res.json();
      const today = new Date();
      const fallback = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      setEditTarget(null);
      setEditor({
        date: data.date ?? fallback,
        attendees: data.attendees ?? '',
        agendaItems: Array.isArray(data.agendaItems) && data.agendaItems.length > 0 ? data.agendaItems : [{ text: '', pending: false }],
        sections: Array.isArray(data.sections) ? data.sections : [],
        notes: data.notes ?? '',
      });
      setEditOpen(true);
      toast({ title: 'Ficheiro lido com sucesso', description: 'Revê os dados e guarda.' });
    } catch (err) {
      toast({ title: 'Erro ao ler ficheiro', description: err instanceof Error ? err.message : 'Tenta novamente.', variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const hasFilters = search || dateFrom || dateTo;

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Reuniões de Direção</h1>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" size="sm" disabled={isParsing} onClick={() => fileInputRef.current?.click()}>
              {isParsing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A ler…</> : <><Upload className="w-4 h-4 mr-2" />Importar PDF/Word</>}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Nova ata
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por tema, nome, assunto…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline" size="sm"
              className={showFilters || (dateFrom || dateTo) ? 'border-primary text-primary' : ''}
              onClick={() => setShowFilters(v => !v)}
            >
              {showFilters ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
              Datas
              {(dateFrom || dateTo) && <Badge variant="default" className="ml-1.5 h-4 px-1 text-[10px]">!</Badge>}
            </Button>
          </div>
          {showFilters && (
            <div className="flex gap-2 items-center">
              <label className="text-xs text-muted-foreground shrink-0">De</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
              <label className="text-xs text-muted-foreground shrink-0">até</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  <X className="w-3 h-3 mr-1" /> Limpar
                </Button>
              )}
            </div>
          )}
          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} de {meetings.length} ata{meetings.length !== 1 ? 's' : ''}
              {search && <> com <strong>"{search}"</strong></>}
            </p>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar…</p>
        ) : meetings.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma ata registada</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>Registar a primeira ata</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma ata encontrada para essa pesquisa</p>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}>Limpar filtros</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(m => {
              const agendaCount = m.agendaItems.filter(a => !a.pending).length;
              const pendingCount = m.agendaItems.filter(a => a.pending).length;
              const attendeeList = m.attendees.split(',').map(s => s.trim()).filter(Boolean);

              // Find matching sections for search highlight
              const matchingSections = search
                ? m.sections.filter(s => s.title.toLowerCase().includes(search.toLowerCase()) || s.items.some(i => i.toLowerCase().includes(search.toLowerCase())))
                : [];

              return (
                <Card
                  key={m.id}
                  className="group hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-primary/30"
                  onClick={() => setViewMeeting(m)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-semibold">{formatDateShort(m.date)}</span>
                          <span className="text-xs text-muted-foreground">{formatDatePT(m.date)}</span>
                        </div>

                        {/* Attendees */}
                        {attendeeList.length > 0 && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {search
                                ? <Highlight text={attendeeList.join(', ')} query={search} />
                                : attendeeList.length <= 4
                                  ? attendeeList.join(', ')
                                  : `${attendeeList.slice(0, 4).join(', ')} +${attendeeList.length - 4}`
                              }
                            </span>
                          </p>
                        )}

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {agendaCount > 0 && <Badge variant="secondary" className="text-[11px] font-normal">{agendaCount} assunto{agendaCount !== 1 ? 's' : ''}</Badge>}
                          {pendingCount > 0 && <Badge variant="outline" className="text-[11px] font-normal text-amber-600 border-amber-300">{pendingCount} pendente{pendingCount !== 1 ? 's' : ''}</Badge>}
                          {m.sections.map(s => (
                            <Badge key={s.title} variant="outline" className={`text-[11px] font-normal ${search && (s.title.toLowerCase().includes(search.toLowerCase()) || s.items.some(i => i.toLowerCase().includes(search.toLowerCase()))) ? 'border-primary/40 text-primary bg-primary/5' : ''}`}>
                              {s.title}
                            </Badge>
                          ))}
                        </div>

                        {/* Search preview */}
                        {search && matchingSections.length > 0 && (
                          <div className="space-y-0.5 pt-0.5">
                            {matchingSections.flatMap(s =>
                              s.items
                                .filter(i => i.toLowerCase().includes(search.toLowerCase()))
                                .slice(0, 2)
                                .map((item, ii) => (
                                  <p key={`${s.title}-${ii}`} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-0.5">
                                    <span className="font-medium text-foreground/70">{s.title}:</span>{' '}
                                    <Highlight text={item} query={search} />
                                  </p>
                                ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── View dialog (clean document) ── */}
      <Dialog open={!!viewMeeting} onOpenChange={v => !v && setViewMeeting(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
            <span className="text-sm font-medium text-muted-foreground">
              {viewMeeting ? formatDatePT(viewMeeting.date) : ''}
            </span>
            <div className="flex items-center gap-2">
              {viewMeeting && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => openEdit(viewMeeting)}>
                  <Pencil className="w-3 h-3" /> Editar
                </Button>
              )}
            </div>
          </div>
          {/* Document */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-10 py-8">
              {viewMeeting && <MeetingDocument meeting={viewMeeting} onEdit={() => openEdit(viewMeeting)} />}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={editOpen} onOpenChange={v => !v && setEditOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar ata' : 'Nova ata'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 pr-2">
            <div className="py-1">
              <MeetingEditor value={editor} onChange={setEditor} direcaoMembers={direcaoMembers} />
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
