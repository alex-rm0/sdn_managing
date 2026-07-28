import { useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListMeetings, useCreateMeeting, useUpdateMeeting, useDeleteMeeting,
  getListMeetingsQueryKey, useListTeamMembers,
} from '@workspace/api-client-react';
import type { MeetingMinutes, MeetingAgendaItem, MeetingSection, MeetingStatus } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Trash2, GripVertical, FileText, Users, Pencil, X,
  ClipboardList, Clock, Upload, Loader2, Search, ChevronDown, ChevronUp,
  Play, CheckCircle, Calendar, Download, ChevronLeft, AlertTriangle,
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

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Word export ───────────────────────────────────────────────────────────────

function exportToWord(meeting: MeetingMinutes) {
  const attendeeList = meeting.attendees.split(',').map(s => s.trim()).filter(Boolean);
  const agenda = meeting.agendaItems.filter(a => !a.pending);
  const pending = meeting.agendaItems.filter(a => a.pending);
  let counter = 1;

  let body = '';
  body += `<h1 style="text-align:center;font-size:14pt;">Reunião de dia ${formatDatePT(meeting.date)}</h1>`;
  body += `<p style="text-align:center;font-size:10pt;color:#666;margin-top:0;">Direção da SDN — AAC</p>`;
  body += `<hr style="border:none;border-top:1pt solid #999;margin:12pt 0;"/>`;

  if (attendeeList.length > 0) {
    body += `<h2>Presentes</h2><p>${attendeeList.join(', ')}</p>`;
  }
  if (agenda.length > 0) {
    body += `<h2>Assuntos para abordar</h2><ol>`;
    agenda.forEach(item => { body += `<li>${item.text}</li>`; counter++; });
    body += `</ol>`;
  }
  if (pending.length > 0) {
    body += `<h2>Assuntos Pendentes</h2><ol start="${counter}">`;
    pending.forEach(item => { body += `<li>${item.text}</li>`; counter++; });
    body += `</ol>`;
  }
  meeting.sections.forEach(section => {
    body += `<hr style="border:none;border-top:0.5pt solid #ccc;margin:10pt 0;"/>`;
    body += `<h2>${section.title}</h2><ol start="${counter}">`;
    section.items.forEach(item => { body += `<li>${item}</li>`; counter++; });
    body += `</ol>`;
  });
  if (meeting.notes) {
    body += `<p style="font-style:italic;color:#555;margin-top:12pt;font-size:10pt;">${meeting.notes}</p>`;
  }

  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>Ata ${meeting.date}</title>
<style>
  body{font-family:"Times New Roman",serif;font-size:12pt;margin:3cm 2.5cm;line-height:1.6;}
  h1{margin-bottom:4pt;}
  h2{font-size:11pt;text-transform:uppercase;letter-spacing:1px;margin-top:16pt;margin-bottom:6pt;padding-bottom:3pt;border-bottom:0.5pt solid #ccc;}
  p{margin:6pt 0;} ol{margin:4pt 0;padding-left:20pt;} li{margin:3pt 0;}
</style></head>
<body>${body}</body></html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ata-${meeting.date}.doc`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MeetingStatus }) {
  if (status === 'a_decorrer') return (
    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      A decorrer
    </span>
  );
  if (status === 'preparacao') return (
    <Badge variant="outline" className="text-xs font-normal text-amber-700 border-amber-300 bg-amber-50">
      Em preparação
    </Badge>
  );
  return null;
}

// ── Document view ─────────────────────────────────────────────────────────────

function MeetingDocument({ meeting, onEdit }: { meeting: MeetingMinutes; onEdit: () => void }) {
  const attendeeList = meeting.attendees.split(',').map(s => s.trim()).filter(Boolean);
  const agenda = meeting.agendaItems.filter(a => !a.pending);
  const pending = meeting.agendaItems.filter(a => a.pending);
  let counter = 1;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center space-y-1.5 pb-6">
        <p className="text-xl font-bold tracking-tight">Reunião de dia {formatDatePT(meeting.date)}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Direção da SDN — AAC</p>
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={onEdit}>
            <Pencil className="w-3 h-3" /> Editar
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={() => exportToWord(meeting)}>
            <Download className="w-3 h-3" /> Exportar Word
          </Button>
        </div>
      </div>

      <Separator />

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

      {meeting.notes && (
        <>
          <Separator />
          <p className="py-4 text-xs text-muted-foreground italic">{meeting.notes}</p>
        </>
      )}
    </div>
  );
}

// ── Preparation editor ────────────────────────────────────────────────────────

interface PrepState {
  date: string;
  items: string[];
}

function PrepEditor({ value, onChange }: { value: PrepState; onChange: (v: PrepState) => void }) {
  const [newItem, setNewItem] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addItem = () => {
    if (!newItem.trim()) return;
    onChange({ ...value, items: [...value.items, newItem.trim()] });
    setNewItem('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const removeItem = (i: number) =>
    onChange({ ...value, items: value.items.filter((_, idx) => idx !== i) });

  const editItem = (i: number, text: string) => {
    const items = [...value.items];
    items[i] = text;
    onChange({ ...value, items });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Data da reunião
        </label>
        <Input type="date" value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} className="w-48" />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Pontos da ordem do dia
        </label>
        {value.items.length > 0 && (
          <ol className="space-y-1.5">
            {value.items.map((item, i) => (
              <li key={i} className="flex items-center gap-2 group">
                <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 text-right">{i + 1}.</span>
                <Input
                  value={item}
                  onChange={e => editItem(i, e.target.value)}
                  className="flex-1 h-8 text-sm"
                />
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removeItem(i)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ol>
        )}
        <div className="flex gap-2 mt-2">
          <Input
            ref={inputRef}
            placeholder="Adicionar ponto… (Enter para confirmar)"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            className="flex-1 h-8 text-sm"
          />
          <Button variant="outline" size="sm" onClick={addItem} disabled={!newItem.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        {value.items.length === 0 && (
          <p className="text-xs text-muted-foreground italic pl-1">Começa a escrever os pontos que queres abordar na reunião.</p>
        )}
      </div>
    </div>
  );
}

// ── Full editor ───────────────────────────────────────────────────────────────

interface EditorState {
  date: string;
  attendees: string;
  agendaItems: MeetingAgendaItem[];
  sections: MeetingSection[];
  notes: string;
}

function emptyEditor(): EditorState {
  return { date: todayStr(), attendees: '', agendaItems: [{ text: '', pending: false }], sections: [], notes: '' };
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

  const selected = useMemo(() =>
    new Set(value.attendees.split(',').map(s => s.trim()).filter(Boolean)),
    [value.attendees]
  );

  const toggleMember = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    const ordered = direcaoMembers.filter(n => next.has(n));
    const others = [...next].filter(n => !direcaoMembers.includes(n));
    set({ attendees: [...ordered, ...others].join(', ') });
  };

  const otherNames = [...selected].filter(n => !direcaoMembers.includes(n)).join(', ');

  const setAgendaItem = (i: number, patch: Partial<MeetingAgendaItem>) => {
    const items = [...value.agendaItems]; items[i] = { ...items[i], ...patch }; set({ agendaItems: items });
  };
  const addAgendaItem = (pending: boolean) => set({ agendaItems: [...value.agendaItems, { text: '', pending }] });
  const removeAgendaItem = (i: number) => set({ agendaItems: value.agendaItems.filter((_, idx) => idx !== i) });

  const addSection = () => set({ sections: [...value.sections, { title: '', items: [''] }] });
  const removeSection = (i: number) => set({ sections: value.sections.filter((_, idx) => idx !== i) });
  const setSection = (i: number, patch: Partial<MeetingSection>) => {
    const s = [...value.sections]; s[i] = { ...s[i], ...patch }; set({ sections: s });
  };
  const addSectionItem = (si: number) => {
    const s = [...value.sections]; s[si] = { ...s[si], items: [...s[si].items, ''] }; set({ sections: s });
  };
  const setSectionItem = (si: number, ii: number, text: string) => {
    const s = [...value.sections]; const items = [...s[si].items]; items[ii] = text; s[si] = { ...s[si], items }; set({ sections: s });
  };
  const removeSectionItem = (si: number, ii: number) => {
    const s = [...value.sections]; s[si] = { ...s[si], items: s[si].items.filter((_, idx) => idx !== ii) }; set({ sections: s });
  };

  const agendaItems = value.agendaItems.filter(a => !a.pending);
  const pendingItems = value.agendaItems.filter(a => a.pending);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</label>
        <Input type="date" value={value.date} onChange={e => set({ date: e.target.value })} className="w-48" />
      </div>

      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Presentes
        </label>
        {direcaoMembers.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5 p-3 border rounded-lg bg-muted/20">
            {direcaoMembers.map(name => (
              <label key={name} className="flex items-center gap-2 cursor-pointer py-0.5">
                <input type="checkbox" checked={selected.has(name)} onChange={() => toggleMember(name)} className="rounded border-muted-foreground/30" />
                <span className="text-sm">{name}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Define os membros da Direção em <strong>Equipa</strong> para os ver aqui.</p>
        )}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Outros presentes</label>
          <Input
            placeholder="Convidado externo, Arq. Silva…"
            value={otherNames}
            onChange={e => {
              const newOthers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
              const ordered = direcaoMembers.filter(n => selected.has(n));
              set({ attendees: [...ordered, ...newOthers].join(', ') });
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Assuntos para abordar
        </label>
        <div className="space-y-2 pl-1">
          {value.agendaItems.map((item, i) => !item.pending ? (
            <div key={i} className="flex items-start gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-2 shrink-0" />
              <Input placeholder={`Ponto ${agendaItems.indexOf(item) + 1}…`} value={item.text} onChange={e => setAgendaItem(i, { text: e.target.value })} className="flex-1" />
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

      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-500" /> Assuntos Pendentes
        </label>
        <div className="space-y-2 pl-1">
          {value.agendaItems.map((item, i) => item.pending ? (
            <div key={i} className="flex items-start gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-2 shrink-0" />
              <Input placeholder={`Pendente ${pendingItems.indexOf(item) + 1}…`} value={item.text} onChange={e => setAgendaItem(i, { text: e.target.value })} className="flex-1" />
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

      <div className="space-y-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Tópicos debatidos
        </label>
        {value.sections.map((section, si) => (
          <div key={si} className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <Input placeholder="Título do tópico…" value={section.title} onChange={e => setSection(si, { title: e.target.value })} className="flex-1 font-medium" />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeSection(si)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 pl-1">
              {section.items.map((item, ii) => (
                <div key={ii} className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-2 shrink-0" />
                  <Textarea placeholder={`Nota ${ii + 1}…`} value={item} onChange={e => setSectionItem(si, ii, e.target.value)} rows={2} className="flex-1 resize-none text-sm" />
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

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações gerais</label>
        <Textarea placeholder="Notas adicionais…" value={value.notes} onChange={e => set({ notes: e.target.value })} rows={3} className="resize-none" />
      </div>
    </div>
  );
}

// ── Search highlight ──────────────────────────────────────────────────────────

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
  const direcaoMembers = useMemo(
    () => teamMembers.filter(m => m.role === 'direcao' && m.active).map(m => m.name),
    [teamMembers]
  );

  const createMutation = useCreateMeeting();
  const updateMutation = useUpdateMeeting();
  const deleteMutation = useDeleteMeeting();

  // Search
  const [activeTab, setActiveTab] = useState<'todas' | 'a_decorrer' | 'preparacao' | 'finalizada'>('todas');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Preparation dialog
  const [prepOpen, setPrepOpen] = useState(false);
  const [prepTarget, setPrepTarget] = useState<MeetingMinutes | null>(null);
  const [prep, setPrep] = useState<PrepState>({ date: tomorrowStr(), items: [] });

  // Full editor dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MeetingMinutes | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());

  // View dialog
  const [viewMeeting, setViewMeeting] = useState<MeetingMinutes | null>(null);

  // File import
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() });

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return meetings.filter(m => {
      if (dateFrom && m.date < dateFrom) return false;
      if (dateTo && m.date > dateTo) return false;
      if (!q) return true;
      return (
        m.attendees.toLowerCase().includes(q) ||
        m.agendaItems.some(a => a.text.toLowerCase().includes(q)) ||
        m.sections.some(s => s.title.toLowerCase().includes(q) || s.items.some(i => i.toLowerCase().includes(q))) ||
        (m.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [meetings, search, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const base = activeTab === 'todas' ? filtered : filtered.filter(m => m.status === activeTab);
    const aDecorrer = base.filter(m => m.status === 'a_decorrer');
    const preparacao = base.filter(m => m.status === 'preparacao').sort((a, b) => a.date.localeCompare(b.date));
    const finalizadas = base.filter(m => m.status === 'finalizada');
    return [...aDecorrer, ...preparacao, ...finalizadas];
  }, [filtered, activeTab]);

  // ── Prep dialog handlers ──────────────────────────────────────────────────

  const openPrep = (m?: MeetingMinutes) => {
    if (m) {
      setPrepTarget(m);
      setPrep({ date: m.date, items: m.agendaItems.filter(a => !a.pending).map(a => a.text) });
    } else {
      setPrepTarget(null);
      setPrep({ date: tomorrowStr(), items: [] });
    }
    setPrepOpen(true);
  };

  const savePrep = async (status: 'preparacao' | 'a_decorrer' = 'preparacao'): Promise<MeetingMinutes | null> => {
    const agendaItems: MeetingAgendaItem[] = prep.items.filter(t => t.trim()).map(t => ({ text: t, pending: false }));
    const payload = { date: prep.date, attendees: '', agendaItems, sections: [], notes: null, status };
    try {
      if (prepTarget) {
        const updated = await updateMutation.mutateAsync({ id: prepTarget.id, data: payload });
        invalidate();
        return updated as MeetingMinutes;
      } else {
        const created = await createMutation.mutateAsync({ data: payload });
        invalidate();
        return created as MeetingMinutes;
      }
    } catch {
      toast({ title: 'Erro ao guardar', variant: 'destructive' });
      return null;
    }
  };

  const handleSavePrep = async () => {
    await savePrep('preparacao');
    setPrepOpen(false);
    toast({ title: prepTarget ? 'Reunião atualizada' : 'Reunião preparada', description: 'Podes ir acrescentando pontos quando quiseres.' });
  };

  const handleStartMeeting = async () => {
    const saved = await savePrep('a_decorrer');
    if (!saved) return;
    setPrepOpen(false);
    // Open full editor with this meeting
    setEditTarget(saved);
    setEditor(meetingToEditor(saved));
    setEditOpen(true);
  };

  // ── Full editor handlers ──────────────────────────────────────────────────

  const openEdit = (m: MeetingMinutes) => {
    setEditTarget(m);
    setEditor(meetingToEditor(m));
    setViewMeeting(null);
    setEditOpen(true);
  };

  const openNewFinalizada = () => {
    setEditTarget(null);
    setEditor(emptyEditor());
    setEditOpen(true);
  };

  const handleRevertToPrep = async () => {
    if (!editTarget) return;
    try {
      await updateMutation.mutateAsync({ id: editTarget.id, data: { status: 'preparacao' } });
      setEditOpen(false);
      invalidate();
      toast({ title: 'Reunião voltou a preparação', description: 'Podes retomar quando estiveres pronto.' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handleSave = async (overrideStatus?: string) => {
    const payload = {
      date: editor.date,
      attendees: editor.attendees,
      agendaItems: editor.agendaItems.filter(a => a.text.trim()),
      sections: editor.sections.filter(s => s.title.trim()).map(s => ({ ...s, items: s.items.filter(i => i.trim()) })),
      notes: editor.notes.trim() || null,
      ...(overrideStatus ? { status: overrideStatus } : {}),
    };
    try {
      if (editTarget) {
        await updateMutation.mutateAsync({ id: editTarget.id, data: payload });
        toast({ title: overrideStatus === 'finalizada' ? 'Reunião finalizada!' : 'Ata atualizada' });
      } else {
        await createMutation.mutateAsync({ data: { ...payload, status: 'finalizada' } });
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
      toast({ title: 'Eliminado' });
      invalidate();
    } catch {
      toast({ title: 'Erro ao eliminar', variant: 'destructive' });
    }
  };

  // ── File import ───────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setIsParsing(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/meetings/parse-file', { method: 'POST', body: form });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? 'Erro'); }
      const data = await res.json();
      setEditTarget(null);
      setEditor({
        date: data.date ?? todayStr(),
        attendees: data.attendees ?? '',
        agendaItems: Array.isArray(data.agendaItems) && data.agendaItems.length ? data.agendaItems : [{ text: '', pending: false }],
        sections: Array.isArray(data.sections) ? data.sections : [],
        notes: data.notes ?? '',
      });
      setEditOpen(true);
      toast({ title: 'Ficheiro lido', description: 'Revê os dados e guarda.' });
    } catch (err) {
      toast({ title: 'Erro ao ler ficheiro', description: err instanceof Error ? err.message : 'Tenta novamente.', variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isEditingADeDecorrer = editTarget?.status === 'a_decorrer';

  // Pending items across all meetings
  const allPending = useMemo(() =>
    meetings.flatMap(m =>
      m.agendaItems
        .filter(a => a.pending && a.text.trim())
        .map(a => ({ text: a.text, meetingDate: m.date, meetingId: m.id }))
    ),
    [meetings]
  );
  const [pendingPanelOpen, setPendingPanelOpen] = useState(true);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight">Reuniões de Direção</h1>
          <div className="flex gap-2 flex-wrap">
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" size="sm" disabled={isParsing} onClick={() => fileInputRef.current?.click()}>
              {isParsing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A ler…</> : <><Upload className="w-4 h-4 mr-2" />Importar PDF/Word</>}
            </Button>
            <Button variant="outline" size="sm" onClick={() => openPrep()}>
              <Calendar className="w-4 h-4 mr-2" /> Preparar reunião
            </Button>
            <Button size="sm" onClick={openNewFinalizada}>
              <Plus className="w-4 h-4 mr-2" /> Registar ata
            </Button>
          </div>
        </div>

        {/* Tabs */}
        {meetings.length > 0 && (() => {
          const counts = {
            todas: meetings.length,
            a_decorrer: meetings.filter(m => m.status === 'a_decorrer').length,
            preparacao: meetings.filter(m => m.status === 'preparacao').length,
            finalizada: meetings.filter(m => m.status === 'finalizada').length,
          };
          const tabs = [
            { key: 'todas', label: 'Todas' },
            { key: 'a_decorrer', label: 'A decorrer' },
            { key: 'preparacao', label: 'Em preparação' },
            { key: 'finalizada', label: 'Finalizadas' },
          ] as const;
          return (
            <div className="flex gap-1 border-b">
              {tabs.map(tab => {
                const count = counts[tab.key];
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${
                      active
                        ? 'border-primary text-primary font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className={`text-[11px] rounded-full px-1.5 py-0 font-medium ${
                        active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* Pending items panel */}
        {allPending.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
              onClick={() => setPendingPanelOpen(v => !v)}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Assuntos pendentes
                <span className="ml-1 bg-amber-200 text-amber-800 text-xs font-semibold rounded-full px-1.5 py-0">{allPending.length}</span>
              </span>
              {pendingPanelOpen
                ? <ChevronUp className="w-4 h-4 text-amber-600 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-amber-600 shrink-0" />}
            </button>
            {pendingPanelOpen && (
              <div className="divide-y divide-amber-100">
                {allPending.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5 bg-white hover:bg-amber-50/40 transition-colors group">
                    <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <span className="flex-1 text-sm">{item.text}</span>
                    <button
                      className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        const m = meetings.find(x => x.id === item.meetingId);
                        if (m) setViewMeeting(m);
                      }}
                    >
                      {formatDateShort(item.meetingDate)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Pesquisar por tema, nome, assunto…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button
              variant="outline" size="sm"
              className={(dateFrom || dateTo) ? 'border-primary text-primary' : ''}
              onClick={() => setShowFilters(v => !v)}
            >
              {showFilters ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
              Datas
              {(dateFrom || dateTo) && <Badge variant="default" className="ml-1.5 h-4 px-1 text-[10px]">!</Badge>}
            </Button>
          </div>
          {showFilters && (
            <div className="flex gap-2 items-center flex-wrap">
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
          {(search || dateFrom || dateTo) && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} de {meetings.length} resultado{meetings.length !== 1 ? 's' : ''}
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
            <p className="text-sm">Nenhuma ata ou reunião por aqui</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="outline" size="sm" onClick={() => openPrep()}>Preparar próxima reunião</Button>
              <Button size="sm" onClick={openNewFinalizada}>Registar ata</Button>
            </div>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum resultado para essa pesquisa</p>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}>Limpar filtros</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map(m => {
              const agendaCount = m.agendaItems.filter(a => !a.pending).length;
              const pendingCount = m.agendaItems.filter(a => a.pending).length;
              const attendeeList = m.attendees.split(',').map(s => s.trim()).filter(Boolean);
              const matchingSections = search
                ? m.sections.filter(s => s.title.toLowerCase().includes(search.toLowerCase()) || s.items.some(i => i.toLowerCase().includes(search.toLowerCase())))
                : [];

              const borderClass =
                m.status === 'a_decorrer' ? 'border-l-green-500' :
                m.status === 'preparacao' ? 'border-l-amber-400' :
                'border-l-transparent hover:border-l-primary/30';

              const handleCardClick = () => {
                if (m.status === 'preparacao') openPrep(m);
                else if (m.status === 'a_decorrer') openEdit(m);
                else setViewMeeting(m);
              };

              return (
                <Card
                  key={m.id}
                  className={`group hover:shadow-md transition-shadow cursor-pointer border-l-4 ${borderClass}`}
                  onClick={handleCardClick}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-semibold">{formatDateShort(m.date)}</span>
                          <span className="text-xs text-muted-foreground">{formatDatePT(m.date)}</span>
                          <StatusBadge status={m.status as MeetingStatus} />
                        </div>

                        {m.status === 'preparacao' && agendaCount > 0 && (
                          <p className="text-sm text-muted-foreground">{agendaCount} ponto{agendaCount !== 1 ? 's' : ''} na ordem do dia</p>
                        )}

                        {m.status !== 'preparacao' && attendeeList.length > 0 && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {search
                                ? <Highlight text={attendeeList.join(', ')} query={search} />
                                : attendeeList.length <= 4 ? attendeeList.join(', ') : `${attendeeList.slice(0, 4).join(', ')} +${attendeeList.length - 4}`
                              }
                            </span>
                          </p>
                        )}

                        {m.status === 'finalizada' && (
                          <div className="flex flex-wrap gap-1.5">
                            {agendaCount > 0 && <Badge variant="secondary" className="text-[11px] font-normal">{agendaCount} assunto{agendaCount !== 1 ? 's' : ''}</Badge>}
                            {pendingCount > 0 && <Badge variant="outline" className="text-[11px] font-normal text-amber-600 border-amber-300">{pendingCount} pendente{pendingCount !== 1 ? 's' : ''}</Badge>}
                            {m.sections.map(s => (
                              <Badge key={s.title} variant="outline" className={`text-[11px] font-normal ${search && (s.title.toLowerCase().includes(search.toLowerCase()) || s.items.some(i => i.toLowerCase().includes(search.toLowerCase()))) ? 'border-primary/40 text-primary bg-primary/5' : ''}`}>
                                {s.title}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {search && matchingSections.length > 0 && (
                          <div className="space-y-0.5 pt-0.5">
                            {matchingSections.flatMap(s =>
                              s.items.filter(i => i.toLowerCase().includes(search.toLowerCase())).slice(0, 2).map((item, ii) => (
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
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        {m.status === 'preparacao' && (
                          <Button
                            variant="outline" size="sm"
                            className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => openPrep(m)}
                          >
                            <Play className="w-3 h-3" /> Iniciar
                          </Button>
                        )}
                        {m.status === 'a_decorrer' && (
                          <Button
                            variant="outline" size="sm"
                            className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => openEdit(m)}
                          >
                            <Pencil className="w-3 h-3" /> Editar
                          </Button>
                        )}
                        {m.status === 'finalizada' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(m)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar?</AlertDialogTitle>
                              <AlertDialogDescription>Remove permanentemente a reunião de {formatDatePT(m.date)}.</AlertDialogDescription>
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

      {/* ── Preparation dialog ── */}
      <Dialog open={prepOpen} onOpenChange={v => !v && setPrepOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              {prepTarget ? 'Atualizar reunião' : 'Preparar próxima reunião'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2 pr-1">
            <PrepEditor value={prep} onChange={setPrep} />
          </div>
          <DialogFooter className="shrink-0 border-t pt-4 flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPrepOpen(false)} className="mr-auto">Cancelar</Button>
            <Button variant="outline" onClick={handleSavePrep} disabled={isSaving || !prep.date}>
              {isSaving ? 'A guardar…' : 'Guardar preparação'}
            </Button>
            <Button onClick={handleStartMeeting} disabled={isSaving || !prep.date} className="gap-2 bg-green-600 hover:bg-green-700">
              <Play className="w-3.5 h-3.5" />
              {prepTarget?.status === 'a_decorrer' ? 'Continuar reunião' : 'Iniciar reunião'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Full edit dialog ── */}
      <Dialog open={editOpen} onOpenChange={v => !v && setEditOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {isEditingADeDecorrer && <span className="flex items-center gap-1.5 text-green-700 text-sm font-normal"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Reunião a decorrer —</span>}
              {editTarget ? 'Editar ata' : 'Registar ata'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-1 pr-2">
            <MeetingEditor value={editor} onChange={setEditor} direcaoMembers={direcaoMembers} />
          </div>
          <DialogFooter className="shrink-0 border-t pt-4 flex-wrap gap-2">
            <div className="flex gap-2 items-center mr-auto flex-wrap">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              {isEditingADeDecorrer && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  disabled={isSaving}
                  onClick={handleRevertToPrep}
                >
                  <ChevronLeft className="w-3 h-3" /> Voltar a preparação
                </Button>
              )}
            </div>
            {isEditingADeDecorrer && (
              <Button
                variant="outline"
                className="gap-1.5 border-green-400 text-green-700 hover:bg-green-50"
                disabled={isSaving}
                onClick={() => handleSave('finalizada')}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Finalizar reunião
              </Button>
            )}
            <Button onClick={() => handleSave()} disabled={isSaving || !editor.date}>
              {isSaving ? 'A guardar…' : editTarget ? 'Guardar' : 'Registar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View dialog ── */}
      <Dialog open={!!viewMeeting} onOpenChange={v => !v && setViewMeeting(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
            <span className="text-sm font-medium text-muted-foreground">
              {viewMeeting ? formatDatePT(viewMeeting.date) : ''}
            </span>
            {viewMeeting && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => exportToWord(viewMeeting)}>
                <Download className="w-3 h-3" /> Word
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-10 py-8">
            {viewMeeting && <MeetingDocument meeting={viewMeeting} onEdit={() => openEdit(viewMeeting)} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
