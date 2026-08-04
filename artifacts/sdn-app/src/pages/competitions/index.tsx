import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListCompetitions, useCreateCompetition, useUpdateCompetition, useDeleteCompetition, getListCompetitionsQueryKey, createCompetition,
  useListRaces, useCreateRace, useUpdateRace, useDeleteRace, createRace,
  useListSeasons,
} from '@workspace/api-client-react';
import type { Competition, Race } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, ChevronDown, ChevronRight, Upload, Loader2, Search, CheckCircle, XCircle } from 'lucide-react';

// ── JSON format hint ──────────────────────────────────────────────────────────
function JsonFormatHint({ example }: { example: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Ver formato JSON
      </button>
      {open && <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">{example}</pre>}
    </div>
  );
}

// ── Import schema ─────────────────────────────────────────────────────────────
const importRaceRowSchema = z.object({
  name: z.string().min(1),
  modality: z.string().optional(),
  distance: z.string().optional(),
  category: z.string().optional(),
});
const importCompRowSchema = z.object({
  name: z.string().min(1),
  seasonId: z.coerce.number().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  location: z.string().optional(),
  organizer: z.string().optional(),
  races: z.array(importRaceRowSchema).optional().default([]),
});
type ImportCompRow = z.infer<typeof importCompRowSchema>;
type ImportStatus = 'idle' | 'previewing' | 'importing' | 'done';
type RowResult = {
  index: number; raw: unknown; parsed?: ImportCompRow; valid: boolean;
  validationError?: string; importStatus: 'pending' | 'ok' | 'error'; importError?: string;
};

const IMPORT_EXAMPLE = JSON.stringify([
  {
    name: "Campeonato Nacional de Velocidade",
    seasonId: 1,
    startDate: "2026-07-03",
    endDate: "2026-07-05",
    location: "Montemor-o-Velho",
    organizer: "FPR",
    races: [],
  },
], null, 2);

const compSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  seasonId: z.coerce.number().min(1, 'Época obrigatória'),
  startDate: z.string().min(1, 'Data obrigatória'),
  endDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  organizer: z.string().nullable().optional(),
});

const raceSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  modality: z.string().nullable().optional(),
  distance: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
});

// ── Date display ──────────────────────────────────────────────────────────────
// Portuguese dd/mm/aaaa; single-day competitions show one date, multi-day show
// a compact range (collapsing month/year when they're shared by both ends).
function formatCompetitionDates(startDate: string, endDate?: string | null): string {
  const [sy, sm, sd] = startDate.split('-');
  if (!endDate || endDate === startDate) return `${sd}/${sm}/${sy}`;
  const [ey, em, ed] = endDate.split('-');
  if (sy === ey && sm === em) return `${sd}–${ed}/${sm}/${sy}`;
  if (sy === ey) return `${sd}/${sm} – ${ed}/${em}/${sy}`;
  return `${sd}/${sm}/${sy} – ${ed}/${em}/${ey}`;
}

// Sub-component to show races for a competition
function CompetitionRaces({ competitionId, competitionName }: { competitionId: number; competitionName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [raceOpen, setRaceOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);

  const { data: races, isLoading } = useListRaces({ competitionId });
  const form = useForm<z.infer<typeof raceSchema>>({ resolver: zodResolver(raceSchema), defaultValues: { name: '', modality: '', distance: '', category: '' } });

  useEffect(() => {
    if (raceOpen) form.reset(editingRace ? { name: editingRace.name, modality: editingRace.modality ?? '', distance: editingRace.distance ?? '', category: editingRace.category ?? '' } : { name: '', modality: '', distance: '', category: '' });
  }, [raceOpen, editingRace]);

  const createRaceMutation = useCreateRace({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/races'] }); toast({ title: 'Prova criada!' }); setRaceOpen(false); },
    onError: () => toast({ title: 'Erro ao criar prova', variant: 'destructive' }),
  }});
  const updateRaceMutation = useUpdateRace({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/races'] }); toast({ title: 'Prova atualizada!' }); setRaceOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteRaceMutation = useDeleteRace({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/races'] }); toast({ title: 'Prova eliminada.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof raceSchema>) => {
    const data = { name: values.name, competitionId, modality: values.modality || null, distance: values.distance || null, category: values.category || null };
    if (editingRace) updateRaceMutation.mutate({ id: editingRace.id, data: { name: data.name, modality: data.modality, distance: data.distance, category: data.category } });
    else createRaceMutation.mutate({ data });
  };

  return (
    <div className="pl-4 pr-2 pb-3 border-t bg-muted/30">
      <div className="flex justify-between items-center py-2">
        <span className="text-sm font-medium text-muted-foreground">Provas de {competitionName}</span>
        <Button size="sm" variant="outline" onClick={() => { setEditingRace(null); setRaceOpen(true); }}><Plus className="w-3 h-3 mr-1" /> Nova Prova</Button>
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">A carregar...</p> : races?.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Sem provas registadas.</p>
      ) : (
        <div className="space-y-1">
          {races?.map(race => (
            <div key={race.id} className="flex items-center justify-between text-sm bg-card rounded px-3 py-1.5 border">
              <div>
                <span className="font-medium">{race.name}</span>
                {race.modality && <span className="ml-2 text-muted-foreground text-xs">{race.modality}</span>}
                {race.distance && <Badge variant="outline" className="ml-2 text-xs">{race.distance}</Badge>}
                {race.category && <span className="ml-2 text-muted-foreground text-xs">{race.category}</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditingRace(race); setRaceOpen(true); }}>Editar</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Eliminar prova?</AlertDialogTitle><AlertDialogDescription>Elimina <strong>{race.name}</strong>.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteRaceMutation.mutate({ id: race.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={raceOpen} onOpenChange={setRaceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingRace ? 'Editar Prova' : 'Nova Prova'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome *</FormLabel><FormControl><Input placeholder="1x 1000m Sénior M" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="modality" render={({ field }) => (<FormItem><FormLabel>Modalidade</FormLabel><FormControl><Input placeholder="Remo Indoor" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="distance" render={({ field }) => (<FormItem><FormLabel>Distância</FormLabel><FormControl><Input placeholder="1000m" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Categoria</FormLabel><FormControl><Input placeholder="Sénior M" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRaceOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createRaceMutation.isPending || updateRaceMutation.isPending}>{(createRaceMutation.isPending || updateRaceMutation.isPending) ? 'A guardar...' : editingRace ? 'Guardar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CompetitionsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Competition | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importRows, setImportRows] = useState<RowResult[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const importCancelRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('all');

  const { data: competitions, isLoading } = useListCompetitions();
  const { data: seasons } = useListSeasons();

  const filteredCompetitions = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return (competitions ?? []).filter(c => {
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.location?.toLowerCase().includes(q)) || (c.organizer?.toLowerCase().includes(q));
      const matchesSeason = seasonFilter === 'all' || String(c.seasonId) === seasonFilter;
      return matchesSearch && matchesSeason;
    });
  }, [competitions, searchTerm, seasonFilter]);

  const form = useForm<z.infer<typeof compSchema>>({ resolver: zodResolver(compSchema), defaultValues: { name: '', seasonId: 0, startDate: '', endDate: '', location: '', organizer: '' } });

  useEffect(() => {
    if (open) form.reset(editing ? { ...editing, endDate: editing.endDate ?? '', location: editing.location ?? '', organizer: editing.organizer ?? '' } : { name: '', seasonId: 0, startDate: '', endDate: '', location: '', organizer: '' });
  }, [open, editing]);

  const createMutation = useCreateCompetition({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCompetitionsQueryKey() }); toast({ title: 'Competição criada!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar competição', variant: 'destructive' }),
  }});
  const updateMutation = useUpdateCompetition({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCompetitionsQueryKey() }); toast({ title: 'Competição atualizada!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMutation = useDeleteCompetition({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCompetitionsQueryKey() }); toast({ title: 'Competição eliminada.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof compSchema>) => {
    const data = { ...values, endDate: values.endDate || null, location: values.location || null, organizer: values.organizer || null };
    if (editing) updateMutation.mutate({ id: editing.id, data: { name: data.name, location: data.location, startDate: data.startDate, endDate: data.endDate, organizer: data.organizer } });
    else createMutation.mutate({ data });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Import helpers ──
  const resetImport = () => { setImportJson(''); setImportParseError(null); setImportStatus('idle'); setImportRows([]); setImportProgress(0); importCancelRef.current = false; };
  const handleImportClose = () => {
    if (importStatus === 'importing') return;
    importCancelRef.current = true;
    setImportOpen(false);
    if (importStatus === 'done') {
      queryClient.invalidateQueries({ queryKey: getListCompetitionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ['/api/races'] });
    }
    setTimeout(resetImport, 300);
  };
  const handleValidate = () => {
    setImportParseError(null);
    let parsed: unknown;
    try { parsed = JSON.parse(importJson.trim()); } catch { setImportParseError('JSON inválido. Verifique a sintaxe.'); return; }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const rows: RowResult[] = arr.map((item, idx) => {
      const r = importCompRowSchema.safeParse(item);
      if (r.success) return { index: idx, raw: item, parsed: r.data, valid: true, importStatus: 'pending' };
      return { index: idx, raw: item, valid: false, validationError: r.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '), importStatus: 'pending' };
    });
    setImportRows(rows); setImportStatus('previewing');
  };
  const handleImport = async () => {
    const validRows = importRows.filter(r => r.valid && r.parsed);
    if (!validRows.length) return;
    importCancelRef.current = false;
    setImportStatus('importing'); setImportProgress(0);
    const updated = [...importRows];
    let done = 0;
    for (const row of validRows) {
      if (importCancelRef.current) break;
      const idx = updated.findIndex(r => r.index === row.index);
      try {
        const p = row.parsed!;
        const newComp = await createCompetition({
          name: p.name, seasonId: p.seasonId, startDate: p.startDate,
          endDate: p.endDate ?? null, location: p.location ?? null, organizer: p.organizer ?? null,
        });
        for (const race of p.races ?? []) {
          await createRace({ name: race.name, competitionId: newComp.id, modality: race.modality ?? null, distance: race.distance ?? null, category: race.category ?? null });
        }
        updated[idx] = { ...updated[idx], importStatus: 'ok' };
      } catch (err) {
        updated[idx] = { ...updated[idx], importStatus: 'error', importError: err instanceof Error ? err.message : 'Erro' };
      }
      done++; setImportProgress(done); setImportRows([...updated]);
    }
    setImportStatus('done');
    queryClient.invalidateQueries({ queryKey: getListCompetitionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ['/api/races'] });
  };

  const validCount = importRows.filter(r => r.valid).length;
  const invalidCount = importRows.filter(r => !r.valid).length;
  const okCount = importRows.filter(r => r.importStatus === 'ok').length;
  const errCount = importRows.filter(r => r.importStatus === 'error').length;

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-end items-center gap-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { resetImport(); setImportOpen(true); }}>
              <Upload className="w-4 h-4 mr-2" /> Importar JSON
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Nova Competição
            </Button>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-[18px] py-3.5 border-b border-border flex-wrap">
            <div className="relative w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Procurar por nome, local ou organizador..." className="pl-9 h-[34px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={seasonFilter} onValueChange={setSeasonFilter}>
              <SelectTrigger className="w-[160px] h-[34px]"><SelectValue placeholder="Época" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as épocas</SelectItem>
                {seasons?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <span className="font-mono text-[10.5px] tracking-wide uppercase text-muted-foreground whitespace-nowrap">
              {filteredCompetitions.length} {filteredCompetitions.length === 1 ? 'competição' : 'competições'}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Datas</TableHead>
                <TableHead>Época</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : filteredCompetitions.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma competição registada.</TableCell></TableRow>
              ) : filteredCompetitions.map(comp => (
                <>
                  <TableRow key={comp.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => setExpanded(expanded === comp.id ? null : comp.id)}>
                      {expanded === comp.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-medium" onClick={() => setExpanded(expanded === comp.id ? null : comp.id)}>{comp.name}</TableCell>
                    <TableCell>{comp.location || '-'}</TableCell>
                    <TableCell className="text-sm">{formatCompetitionDates(comp.startDate, comp.endDate)}</TableCell>
                    <TableCell>{comp.seasonName}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(comp); setOpen(true); }}>Editar</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Eliminar competição?</AlertDialogTitle><AlertDialogDescription>Elimina <strong>{comp.name}</strong> e todas as suas provas.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: comp.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                  {expanded === comp.id && (
                    <TableRow key={`races-${comp.id}`}>
                      <TableCell colSpan={6} className="p-0">
                        <CompetitionRaces competitionId={comp.id} competitionName={comp.name} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Competição' : 'Nova Competição'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="seasonId" render={({ field }) => (
                <FormItem><FormLabel>Época *</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ''} disabled={!!editing}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar época" /></SelectTrigger></FormControl>
                    <SelectContent>{seasons?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Data Início *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem><FormLabel>Data Fim</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Local</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="organizer" render={({ field }) => (<FormItem><FormLabel>Organizador</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'A guardar...' : editing ? 'Guardar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Import JSON dialog ── */}
      <Dialog open={importOpen} onOpenChange={handleImportClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar Competições via JSON</DialogTitle>
            <DialogDescription>Cole um array JSON com as competições a importar.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
            {importStatus === 'idle' && (
              <div className="flex flex-col gap-3 flex-1">
                <Textarea
                  className="flex-1 font-mono text-xs resize-none min-h-[220px]"
                  placeholder={IMPORT_EXAMPLE}
                  value={importJson}
                  onChange={e => { setImportJson(e.target.value); setImportParseError(null); }}
                />
                {importParseError && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{importParseError}</p>
                )}
                <JsonFormatHint example={IMPORT_EXAMPLE} />
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p><strong>seasonId</strong>: ID numérico da época (vê o ID de cada uma na página Épocas)</p>
                  <p><strong>startDate</strong>/<strong>endDate</strong>: formato <code className="bg-muted px-1 rounded">AAAA-MM-DD</code></p>
                  <p><strong>races</strong>: opcional — a maioria dos calendários não tem provas definidas à partida; deixa <code className="bg-muted px-1 rounded">[]</code> e adiciona-as mais tarde ao registar resultados</p>
                </div>
              </div>
            )}

            {(importStatus === 'previewing' || importStatus === 'importing' || importStatus === 'done') && (
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">{importRows.length} linha(s)</span>
                  {invalidCount > 0 && <span className="text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />{invalidCount} inválida(s)</span>}
                  <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{validCount} válida(s)</span>
                  {importStatus === 'importing' && <span className="ml-auto flex items-center gap-1 text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />A importar {importProgress}/{validCount}…</span>}
                  {importStatus === 'done' && <span className="ml-auto font-medium">{okCount > 0 && <span className="text-green-600">{okCount} importada(s) </span>}{errCount > 0 && <span className="text-destructive">{errCount} com erro</span>}</span>}
                </div>
                <ScrollArea className="flex-1 rounded-md border min-h-0" style={{ maxHeight: 320 }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead>Datas</TableHead>
                        <TableHead>Época</TableHead>
                        <TableHead>Provas</TableHead>
                        <TableHead className="w-8 text-center">✓</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map(row => {
                        const raw = row.raw as Record<string, unknown>;
                        return (
                          <TableRow key={row.index} className={!row.valid ? 'bg-destructive/5' : ''}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{row.index + 1}</TableCell>
                            <TableCell className="text-sm font-medium">{row.valid ? row.parsed!.name : String(raw?.name ?? '—')}</TableCell>
                            <TableCell className="text-xs">{row.valid ? (row.parsed!.location ?? '—') : '—'}</TableCell>
                            <TableCell className="text-xs">{row.valid ? formatCompetitionDates(row.parsed!.startDate, row.parsed!.endDate) : String(raw?.startDate ?? '—')}</TableCell>
                            <TableCell className="text-xs">{row.valid ? (seasons?.find(s => s.id === row.parsed!.seasonId)?.name ?? `#${row.parsed!.seasonId}`) : '—'}</TableCell>
                            <TableCell className="text-xs">{row.valid ? (row.parsed!.races?.length ?? 0) : '—'}</TableCell>
                            <TableCell className="text-center">
                              {!row.valid ? <span title={row.validationError}><XCircle className="w-4 h-4 text-destructive inline" /></span>
                                : row.importStatus === 'pending' ? <span className="w-4 h-4 rounded-full bg-muted inline-block" />
                                : row.importStatus === 'ok' ? <CheckCircle className="w-4 h-4 text-green-600 inline" />
                                : <span title={row.importError}><XCircle className="w-4 h-4 text-destructive inline" /></span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {importStatus === 'previewing' && invalidCount > 0 && (
                  <div className="text-xs text-destructive space-y-1 max-h-16 overflow-y-auto">
                    {importRows.filter(r => !r.valid).map(r => <div key={r.index}><span className="font-medium">Linha {r.index + 1}:</span> {r.validationError}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 shrink-0">
            {importStatus === 'idle' && (<><Button variant="outline" onClick={handleImportClose}>Cancelar</Button><Button onClick={handleValidate} disabled={!importJson.trim()}>Validar JSON</Button></>)}
            {importStatus === 'previewing' && (<><Button variant="outline" onClick={() => setImportStatus('idle')}>← Voltar</Button><Button onClick={handleImport} disabled={validCount === 0}>Importar {validCount} competição{validCount !== 1 ? 'ões' : ''}</Button></>)}
            {importStatus === 'importing' && (<Button variant="outline" disabled><Loader2 className="w-4 h-4 mr-2 animate-spin" />A importar…</Button>)}
            {importStatus === 'done' && (<><Button variant="outline" onClick={() => { setImportStatus('idle'); setImportJson(''); setImportRows([]); setImportProgress(0); }}>Nova Importação</Button><Button onClick={handleImportClose}>Fechar</Button></>)}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
