import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Clock, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle,
  ListTodo, Plus, X, User,
} from 'lucide-react';
import {
  useListPendingItems, useListActionItems,
  createPendingItem, resolvePendingItem,
  createActionItem, resolveActionItem,
  useInvalidateMeetingItems,
} from './items-api';
import { formatDateShort } from './shared';

function ResolveControl({ onResolve }: { onResolve: (note?: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button
        variant="ghost" size="sm"
        className="h-7 text-xs gap-1 text-green-700 hover:bg-green-50 hover:text-green-800 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
      >
        <CheckCircle2 className="w-3.5 h-3.5" /> Resolver
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
      <Input
        autoFocus
        placeholder="Nota (opcional)…"
        value={note}
        onChange={e => setNote(e.target.value)}
        className="h-7 text-xs w-36"
      />
      <Button
        size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
        disabled={saving}
        onClick={async () => { setSaving(true); await onResolve(note.trim() || undefined); setSaving(false); setOpen(false); }}
      >
        Confirmar
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ── Pending items ──────────────────────────────────────────────────────────

export function PendingItemsPanel({ meetingId }: { meetingId?: number }) {
  const { data: items = [] } = useListPendingItems();
  const invalidate = useInvalidateMeetingItems();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newText.trim() || !meetingId) return;
    setSaving(true);
    try {
      await createPendingItem(meetingId, newText.trim());
      setNewText('');
      setAdding(false);
      invalidate();
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0 && !meetingId) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Assuntos pendentes
          {items.length > 0 && (
            <span className="ml-1 bg-amber-200 text-amber-800 text-xs font-semibold rounded-full px-1.5 py-0">{items.length}</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-amber-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-amber-600 shrink-0" />}
      </button>
      {open && (
        <div className="divide-y divide-amber-100">
          {items.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum assunto pendente de momento.</p>
          )}
          {items.map(item => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-2.5 bg-card hover:bg-amber-50/40 transition-colors group">
              <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
              <span className="flex-1 text-sm">{item.text}</span>
              <ResolveControl onResolve={note => resolvePendingItem(item.id, meetingId, note).then(invalidate)} />
              <button
                className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setLocation(`/reunioes/${item.originMeetingId}`)}
              >
                {formatDateShort(item.createdAt.slice(0, 10))}
              </button>
            </div>
          ))}
          {meetingId != null && (
            adding ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-card">
                <Input
                  autoFocus
                  placeholder="Novo assunto pendente…"
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  className="flex-1 h-8 text-sm"
                />
                <Button size="sm" className="h-8 text-xs" disabled={saving || !newText.trim()} onClick={handleAdd}>Adicionar</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setAdding(false); setNewText(''); }}><X className="w-3.5 h-3.5" /></Button>
              </div>
            ) : (
              <button
                className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-amber-700 hover:bg-amber-50/60 transition-colors"
                onClick={() => setAdding(true)}
              >
                <Plus className="w-3 h-3" /> Adicionar assunto pendente
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Action items (tasks assigned to a Direção member) ───────────────────────

export function ActionItemsPanel({ meetingId, direcaoMembers = [] }: { meetingId?: number; direcaoMembers?: string[] }) {
  const { data: items = [] } = useListActionItems();
  const invalidate = useInvalidateMeetingItems();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newText.trim() || !newAssignee || !meetingId) return;
    setSaving(true);
    try {
      await createActionItem(meetingId, newText.trim(), newAssignee);
      setNewText('');
      setNewAssignee('');
      setAdding(false);
      invalidate();
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0 && !meetingId) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-brand-cyan-bg hover:bg-brand-cyan-bg/70 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-brand-cyan-dark">
          <ListTodo className="w-3.5 h-3.5 shrink-0" />
          Tarefas da Direção
          {items.length > 0 && (
            <span className="ml-1 bg-brand-cyan-border text-brand-cyan-dark text-xs font-semibold rounded-full px-1.5 py-0">{items.length}</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-brand-cyan-dark shrink-0" /> : <ChevronDown className="w-4 h-4 text-brand-cyan-dark shrink-0" />}
      </button>
      {open && (
        <div className="divide-y divide-border">
          {items.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">Nenhuma tarefa por resolver de momento.</p>
          )}
          {items.map(item => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-2.5 bg-card hover:bg-muted/30 transition-colors group">
              <User className="w-3.5 h-3.5 text-brand-cyan-dark mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm">{item.text}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">{item.assignedToName}</span>
              </div>
              <ResolveControl onResolve={note => resolveActionItem(item.id, meetingId, note).then(invalidate)} />
              <button
                className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setLocation(`/reunioes/${item.originMeetingId}`)}
              >
                {formatDateShort(item.createdAt.slice(0, 10))}
              </button>
            </div>
          ))}
          {meetingId != null && (
            adding ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-card flex-wrap">
                <Input
                  autoFocus
                  placeholder="Nova tarefa…"
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  className="flex-1 min-w-[160px] h-8 text-sm"
                />
                <select
                  value={newAssignee}
                  onChange={e => setNewAssignee(e.target.value)}
                  className="h-8 text-sm border border-input rounded-md px-2 bg-background"
                >
                  <option value="">Atribuir a…</option>
                  {direcaoMembers.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <Button size="sm" className="h-8 text-xs" disabled={saving || !newText.trim() || !newAssignee} onClick={handleAdd}>Adicionar</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setAdding(false); setNewText(''); setNewAssignee(''); }}><X className="w-3.5 h-3.5" /></Button>
              </div>
            ) : (
              <button
                className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-brand-cyan-dark hover:bg-brand-cyan-bg/40 transition-colors"
                onClick={() => setAdding(true)}
              >
                <Plus className="w-3 h-3" /> Adicionar tarefa
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
