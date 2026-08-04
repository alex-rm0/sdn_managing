import { useState, useRef, useMemo } from 'react';
import type { MeetingMinutes, MeetingAgendaItem, MeetingSection, MeetingStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Trash2, GripVertical, FileText, Users, Pencil, X,
  ClipboardList, Clock, Download, Calendar, ArrowRightCircle,
  CheckCircle2, ListTodo, User,
} from 'lucide-react';
import type { PendingItem, ActionItem } from './items-api';

// ── Date/text helpers ─────────────────────────────────────────────────────────

export const PT_MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

export function formatDatePT(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${day} de ${PT_MONTHS[month - 1]} de ${year}`;
}

export function formatDateShort(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
}

export function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Word export ───────────────────────────────────────────────────────────────

export function exportToWord(meeting: MeetingMinutes, meetingItems?: { pending: PendingItem[]; actions: ActionItem[] }) {
  const attendeeList = meeting.attendees.split(',').map(s => s.trim()).filter(Boolean);
  const agenda = meeting.agendaItems.filter(a => !a.pending);
  let counter = 1;

  const pendingRaised = meetingItems?.pending.filter(p => p.originMeetingId === meeting.id) ?? [];
  const pendingResolvedElsewhere = meetingItems?.pending.filter(p => p.resolvedInMeetingId === meeting.id && p.originMeetingId !== meeting.id) ?? [];
  const actionsRaised = meetingItems?.actions.filter(a => a.originMeetingId === meeting.id) ?? [];
  const actionsResolvedElsewhere = meetingItems?.actions.filter(a => a.resolvedInMeetingId === meeting.id && a.originMeetingId !== meeting.id) ?? [];

  let body = '';
  body += `<h1 style="text-align:center;font-size:14pt;">Reunião de dia ${formatDatePT(meeting.date)}</h1>`;
  body += `<p style="text-align:center;font-size:10pt;color:#666;margin-top:0;">Direção da SDN — AAC</p>`;
  body += `<hr style="border:none;border-top:1pt solid #999;margin:12pt 0;"/>`;

  if (attendeeList.length > 0) {
    body += `<h2>Presentes</h2><p>${attendeeList.join(', ')}</p>`;
  }
  if (pendingRaised.length > 0 || pendingResolvedElsewhere.length > 0) {
    body += `<h2>Assuntos Pendentes</h2><ul>`;
    pendingRaised.forEach(p => {
      body += `<li>${p.text}${p.status === 'resolvido' ? ` — <i>resolvido${p.resolvedNote ? `: ${p.resolvedNote}` : ''}</i>` : ''}</li>`;
    });
    pendingResolvedElsewhere.forEach(p => {
      body += `<li><i>Resolvido nesta reunião</i> — ${p.text}${p.resolvedNote ? `: ${p.resolvedNote}` : ''}</li>`;
    });
    body += `</ul>`;
  }
  if (actionsRaised.length > 0 || actionsResolvedElsewhere.length > 0) {
    body += `<h2>Tarefas da Direção</h2><ul>`;
    actionsRaised.forEach(a => {
      body += `<li>${a.text} (${a.assignedToName})${a.status === 'resolvido' ? ` — <i>resolvido${a.resolvedNote ? `: ${a.resolvedNote}` : ''}</i>` : ''}</li>`;
    });
    actionsResolvedElsewhere.forEach(a => {
      body += `<li><i>Resolvido nesta reunião</i> — ${a.text} (${a.assignedToName})${a.resolvedNote ? `: ${a.resolvedNote}` : ''}</li>`;
    });
    body += `</ul>`;
  }
  if (agenda.length > 0) {
    body += `<h2>Assuntos para abordar</h2><ol>`;
    agenda.forEach(item => { body += `<li>${item.text}</li>`; counter++; });
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

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ata-${meeting.date}.doc`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Status badge ──────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: MeetingStatus }) {
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

export function MeetingDocument({ meeting, onEdit, meetingItems }: {
  meeting: MeetingMinutes;
  onEdit?: () => void;
  meetingItems?: { pending: PendingItem[]; actions: ActionItem[] };
}) {
  const attendeeList = meeting.attendees.split(',').map(s => s.trim()).filter(Boolean);
  const agenda = meeting.agendaItems.filter(a => !a.pending);
  let counter = 1;

  const pendingRaised = meetingItems?.pending.filter(p => p.originMeetingId === meeting.id) ?? [];
  const pendingResolvedElsewhere = meetingItems?.pending.filter(p => p.resolvedInMeetingId === meeting.id && p.originMeetingId !== meeting.id) ?? [];
  const actionsRaised = meetingItems?.actions.filter(a => a.originMeetingId === meeting.id) ?? [];
  const actionsResolvedElsewhere = meetingItems?.actions.filter(a => a.resolvedInMeetingId === meeting.id && a.originMeetingId !== meeting.id) ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center space-y-1.5 pb-6">
        <p className="text-xl font-bold tracking-tight">Reunião de dia {formatDatePT(meeting.date)}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Direção da SDN — AAC</p>
        <div className="flex justify-center gap-2 pt-2">
          {onEdit && (
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={onEdit}>
              <Pencil className="w-3 h-3" /> Editar
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={() => exportToWord(meeting, meetingItems)}>
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

      {(pendingRaised.length > 0 || pendingResolvedElsewhere.length > 0) && (
        <>
          <Separator />
          <div className="py-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-800 text-center mb-1 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Assuntos Pendentes
              </p>
              {pendingRaised.map(p => (
                <div key={p.id} className="flex items-start gap-2 text-sm">
                  <span className={p.status === 'resolvido' ? 'line-through text-muted-foreground flex-1' : 'flex-1'}>{p.text}</span>
                  {p.status === 'resolvido' && (
                    <span className="flex items-center gap-1 text-xs text-green-700 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {p.resolvedNote || 'Resolvido'}
                    </span>
                  )}
                </div>
              ))}
              {pendingResolvedElsewhere.map(p => (
                <div key={`resolved-${p.id}`} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-700 mt-0.5 shrink-0" />
                  <span className="flex-1"><span className="text-xs text-muted-foreground">Resolvido nesta reunião —</span> {p.text}{p.resolvedNote && <span className="text-muted-foreground">: {p.resolvedNote}</span>}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {(actionsRaised.length > 0 || actionsResolvedElsewhere.length > 0) && (
        <>
          <Separator />
          <div className="py-5">
            <div className="bg-brand-cyan-bg border border-brand-cyan-border rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-cyan-dark text-center mb-1 flex items-center justify-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5" /> Tarefas da Direção
              </p>
              {actionsRaised.map(a => (
                <div key={a.id} className="flex items-start gap-2 text-sm">
                  <User className="w-3.5 h-3.5 text-brand-cyan-dark mt-0.5 shrink-0" />
                  <span className={a.status === 'resolvido' ? 'line-through text-muted-foreground flex-1' : 'flex-1'}>
                    {a.text} <span className="text-xs text-muted-foreground">({a.assignedToName})</span>
                  </span>
                  {a.status === 'resolvido' && (
                    <span className="flex items-center gap-1 text-xs text-green-700 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {a.resolvedNote || 'Resolvido'}
                    </span>
                  )}
                </div>
              ))}
              {actionsResolvedElsewhere.map(a => (
                <div key={`resolved-${a.id}`} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-700 mt-0.5 shrink-0" />
                  <span className="flex-1"><span className="text-xs text-muted-foreground">Resolvido nesta reunião —</span> {a.text} <span className="text-xs text-muted-foreground">({a.assignedToName})</span>{a.resolvedNote && <span className="text-muted-foreground">: {a.resolvedNote}</span>}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {agenda.length > 0 && (
        <>
          <Separator />
          <div className="py-5 space-y-5">
            {agenda.length > 0 && (
              <div className="bg-brand-cyan-bg border border-brand-cyan-border rounded-xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-cyan-dark text-center mb-3">Assuntos para abordar</p>
                <ol className="space-y-2">
                  {agenda.map(item => (
                    <li key={counter} className="flex gap-3 items-start">
                      <span className="text-xs text-brand-cyan-dark font-mono w-6 shrink-0 text-right pt-0.5">{counter++}.</span>
                      <span className="text-sm leading-relaxed">{item.text}</span>
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

export interface PrepState {
  date: string;
  items: string[];
}

export function PrepEditor({ value, onChange }: { value: PrepState; onChange: (v: PrepState) => void }) {
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

export interface EditorState {
  date: string;
  attendees: string;
  agendaItems: MeetingAgendaItem[];
  sections: MeetingSection[];
  notes: string;
}

export function emptyEditor(): EditorState {
  return { date: todayStr(), attendees: '', agendaItems: [{ text: '', pending: false }], sections: [], notes: '' };
}

export function meetingToEditor(m: MeetingMinutes): EditorState {
  return {
    date: m.date,
    attendees: m.attendees,
    agendaItems: m.agendaItems.length > 0 ? m.agendaItems : [{ text: '', pending: false }],
    sections: m.sections,
    notes: m.notes ?? '',
  };
}

export function MeetingEditor({ value, onChange, direcaoMembers }: {
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
  const addSectionFromTopic = (title: string) => set({ sections: [...value.sections, { title, items: [''] }] });
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

      <div className="space-y-3 bg-brand-cyan-bg border border-brand-cyan-border rounded-xl p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-brand-cyan-dark flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Assuntos para abordar
        </label>
        <div className="space-y-2 pl-1">
          {value.agendaItems.map((item, i) => !item.pending ? (
            <div key={i} className="flex items-start gap-2 group/item">
              <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-2 shrink-0" />
              <Input placeholder={`Ponto ${agendaItems.indexOf(item) + 1}…`} value={item.text} onChange={e => setAgendaItem(i, { text: e.target.value })} className="flex-1 bg-card" />
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:text-brand-cyan-dark"
                title="Criar tópico debatido a partir deste assunto"
                onClick={() => item.text.trim() && addSectionFromTopic(item.text.trim())}
              >
                <ArrowRightCircle className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeAgendaItem(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : null)}
          <Button variant="outline" size="sm" className="ml-6 text-xs bg-card" onClick={() => addAgendaItem(false)}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar ponto
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

export function Highlight({ text, query }: { text: string; query: string }) {
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

// ── Presence heartbeat (who's editing) ────────────────────────────────────────

export async function sendEditingHeartbeat(meetingId: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/meetings/${meetingId}/presence`, { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.editingBy ?? null;
  } catch {
    return null;
  }
}

export function stopEditingHeartbeat(meetingId: number): void {
  fetch(`/api/meetings/${meetingId}/presence`, { method: 'DELETE' }).catch(() => {});
}
