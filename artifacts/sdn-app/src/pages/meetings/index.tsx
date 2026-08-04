import { useState, useRef, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListMeetings, useDeleteMeeting,
  getListMeetingsQueryKey, useListTeamMembers, createMeeting,
} from '@workspace/api-client-react';
import type { MeetingStatus } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, Users, Pencil, X, Eye,
  Upload, Loader2, Search, ChevronDown, ChevronUp,
  Play, Calendar, FileText,
} from 'lucide-react';
import {
  formatDatePT, formatDateShort, todayStr,
  StatusBadge, Highlight,
} from './shared';
import { PendingItemsPanel, ActionItemsPanel } from './panels';

export default function MeetingsList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: meetings = [], isLoading } = useListMeetings();
  const { data: teamMembers = [] } = useListTeamMembers();
  const direcaoMembers = useMemo(
    () => teamMembers.filter(m => m.role === 'direcao' && m.active).map(m => m.name),
    [teamMembers]
  );

  const deleteMutation = useDeleteMeeting();

  // Search
  const [activeTab, setActiveTab] = useState<'todas' | 'a_decorrer' | 'preparacao' | 'finalizada'>('todas');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: 'Eliminado' });
      invalidate();
    } catch {
      toast({ title: 'Erro ao eliminar', variant: 'destructive' });
    }
  };

  // ── File import (AI parse) ────────────────────────────────────────────────

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
      const created = await createMeeting({
        date: data.date ?? todayStr(),
        attendees: data.attendees ?? '',
        agendaItems: Array.isArray(data.agendaItems) && data.agendaItems.length ? data.agendaItems : [{ text: '', pending: false }],
        sections: Array.isArray(data.sections) ? data.sections : [],
        notes: data.notes ?? null,
        status: 'finalizada',
      });
      invalidate();
      toast({ title: 'Ficheiro lido', description: 'Revê os dados e guarda.' });
      setLocation(`/reunioes/${created.id}/editar`);
    } catch (err) {
      toast({ title: 'Erro ao ler ficheiro', description: err instanceof Error ? err.message : 'Tenta novamente.', variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex justify-end items-center gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" size="sm" disabled={isParsing} onClick={() => fileInputRef.current?.click()}>
              {isParsing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A ler…</> : <><Upload className="w-4 h-4 mr-2" />Importar PDF/Word</>}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation('/reunioes/novo/preparar')}>
              <Calendar className="w-4 h-4 mr-2" /> Preparar reunião
            </Button>
            <Button size="sm" onClick={() => setLocation('/reunioes/novo/editar')}>
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

        {/* Pending items + tasks panels (transversal to all meetings) */}
        <div className="space-y-3">
          <PendingItemsPanel />
          <ActionItemsPanel direcaoMembers={direcaoMembers} />
        </div>

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
              <Button variant="outline" size="sm" onClick={() => setLocation('/reunioes/novo/preparar')}>Preparar próxima reunião</Button>
              <Button size="sm" onClick={() => setLocation('/reunioes/novo/editar')}>Registar ata</Button>
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
                if (m.status === 'preparacao') setLocation(`/reunioes/${m.id}/preparar`);
                else setLocation(`/reunioes/${m.id}`);
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
                          {m.editingBy && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-brand-cyan-dark bg-brand-cyan-bg border border-brand-cyan-border rounded-full px-2 py-0.5">
                              <Pencil className="w-3 h-3" /> {m.editingBy} a editar
                            </span>
                          )}
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
                            onClick={() => setLocation(`/reunioes/${m.id}/preparar`)}
                          >
                            <Play className="w-3 h-3" /> Preparar
                          </Button>
                        )}
                        {m.status === 'a_decorrer' && (
                          <>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setLocation(`/reunioes/${m.id}`)}
                            >
                              <Eye className="w-3 h-3" /> Ver
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                              onClick={() => setLocation(`/reunioes/${m.id}/editar`)}
                            >
                              <Pencil className="w-3 h-3" /> Editar
                            </Button>
                          </>
                        )}
                        {m.status === 'finalizada' && (
                          <>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setLocation(`/reunioes/${m.id}`)}
                            >
                              <Eye className="w-3 h-3" /> Ver
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setLocation(`/reunioes/${m.id}/editar`)} title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </>
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
    </>
  );
}
