import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListResults, useCreateResult, useUpdateResult, useDeleteResult, getListResultsQueryKey,
  useListSeasons, useListCompetitions, useListRaces, createResult, createRace,
} from '@workspace/api-client-react';
import type { Result } from '@workspace/api-client-react';
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
import { Plus, Trophy, Medal, Upload, CheckCircle, XCircle, Loader2, AlertCircle, ChevronDown, ChevronUp, Search } from 'lucide-react';

// ── JSON format hint ──────────────────────────────────────────────────────────
function JsonFormatHint({ example }: { example: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Ver formato JSON
      </button>
      {open && <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">{example}</pre>}
    </div>
  );
}

// ── CRUD form schema ──────────────────────────────────────────────────────────
// Results are entered against a competition + a free-text race name — the race
// itself is looked up (or created on the spot) rather than picked from a
// pre-populated list, since real competition calendars never define races
// ahead of time; they only exist as rows in a results sheet.
const schema = z.object({
  competitionId: z.coerce.number().min(1, 'Competição obrigatória'),
  raceName: z.string().min(1, 'Nome da prova obrigatório'),
  athleteNames: z.string().nullable().optional(),
  boatClass: z.string().nullable().optional(),
  escalao: z.string().nullable().optional(),
  position: z.coerce.number().min(1).nullable().optional(),
  time: z.string().nullable().optional(),
  points: z.coerce.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const defaultValues = {
  competitionId: 0,
  raceName: '',
  athleteNames: '',
  boatClass: '',
  escalao: '',
  position: null as number | null,
  time: '',
  points: null as number | null,
  notes: '',
};

// ── JSON import schema ────────────────────────────────────────────────────────
const importRowSchema = z.object({
  competicao: z.string().optional(),
  prova: z.string().optional(),
  atletas: z.union([z.string(), z.array(z.string())]),
  classe: z.string().min(1),
  escalao: z.string().min(1),
  epoca: z.string().optional(),
  posicao: z.coerce.number().optional(),
  tempo: z.string().optional(),
  pontos: z.coerce.number().optional(),
  notas: z.string().optional(),
  raceId: z.coerce.number().optional(),
});

type ImportRow = z.infer<typeof importRowSchema>;
type ImportStatus = 'idle' | 'previewing' | 'importing' | 'done';
type RowResult = {
  index: number;
  raw: unknown;
  parsed?: ImportRow;
  valid: boolean;
  validationError?: string;
  importStatus: 'pending' | 'ok' | 'error';
  importError?: string;
};

const IMPORT_EXAMPLE = JSON.stringify([
  {
    atletas: ["Alexandre Magalhães", "André Fonseca Ramos"],
    classe: "2x",
    escalao: "Sénior",
    competicao: "Campeonato Nacional de Velocidade",
    prova: "2x Seniores Masculinos 2000m",
    posicao: 5,
    tempo: "6:49.715",
  },
  {
    atletas: "Ana Ferreira",
    classe: "1x",
    escalao: "Sénior",
    posicao: 3,
    tempo: "7:12.10",
    raceId: 5,
  },
], null, 2);

// ── Badge helper ──────────────────────────────────────────────────────────────
const positionBadge = (pos: number | null | undefined) => {
  if (!pos) return <span className="text-muted-foreground">—</span>;
  if (pos === 1) return <Badge variant="warning">🥇 1º</Badge>;
  if (pos === 2) return <Badge variant="secondary">🥈 2º</Badge>;
  if (pos === 3) return <Badge variant="secondary">🥉 3º</Badge>;
  return <Badge variant="outline">{pos}º</Badge>;
};

export default function ResultsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Result | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<string>('');
  const [compFilter, setCompFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // ── Import state ──
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importRows, setImportRows] = useState<RowResult[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const importCancelRef = useRef(false);

  const { data: results, isLoading } = useListResults({
    seasonId: seasonFilter ? parseInt(seasonFilter) : undefined,
    competitionId: compFilter ? parseInt(compFilter) : undefined,
  });
  const { data: seasons } = useListSeasons();
  const { data: competitions } = useListCompetitions({ seasonId: seasonFilter ? parseInt(seasonFilter) : undefined });
  const { data: races } = useListRaces({ competitionId: compFilter ? parseInt(compFilter) : undefined });
  // Unfiltered — used to resolve/create races during JSON import, independent
  // of whatever season/competition filter is currently applied to the list.
  const { data: allCompetitions } = useListCompetitions();
  const { data: allRaces } = useListRaces();

  const victories = results?.filter(r => r.position === 1).length ?? 0;
  const podiums = results?.filter(r => r.position && r.position <= 3).length ?? 0;

  const filteredResults = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return results ?? [];
    return (results ?? []).filter(r =>
      r.athleteNames?.toLowerCase().includes(q) ||
      r.raceName?.toLowerCase().includes(q) ||
      r.competitionName?.toLowerCase().includes(q) ||
      r.boatClass?.toLowerCase().includes(q) ||
      r.escalao?.toLowerCase().includes(q)
    );
  }, [results, searchTerm]);

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });
  const formCompetitionId = form.watch('competitionId');
  const { data: formRaces } = useListRaces({ competitionId: formCompetitionId || undefined });
  const [resolvingRace, setResolvingRace] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        // Editing never changes which race a result belongs to (the update
        // endpoint doesn't accept raceId) — these two values are just dummy
        // placeholders to satisfy the schema; the fields render as read-only.
        form.reset({
          competitionId: 1,
          raceName: editing.raceName || 'x',
          athleteNames: editing.athleteNames ?? '',
          boatClass: editing.boatClass ?? '',
          escalao: editing.escalao ?? '',
          position: editing.position ?? null,
          time: editing.time ?? '',
          points: editing.points ?? null,
          notes: editing.notes ?? '',
        });
      } else {
        form.reset(defaultValues);
      }
    }
  }, [open, editing]);

  const createMutation = useCreateResult({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() }); toast({ title: 'Resultado registado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar resultado', variant: 'destructive' }),
  }});
  const updateMutation = useUpdateResult({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() }); toast({ title: 'Resultado atualizado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMutation = useDeleteResult({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() }); toast({ title: 'Resultado eliminado.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = async (values: z.infer<typeof schema>) => {
    const resultFields = {
      athleteNames: values.athleteNames || null,
      boatClass: values.boatClass || null,
      escalao: values.escalao || null,
      position: values.position || null,
      time: values.time || null,
      points: values.points || null,
      notes: values.notes || null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: resultFields });
      return;
    }
    setResolvingRace(true);
    try {
      const raceNameTrimmed = values.raceName.trim();
      const existing = formRaces?.find(r => r.name.trim().toLowerCase() === raceNameTrimmed.toLowerCase());
      const raceId = existing?.id ?? (await createRace({
        name: raceNameTrimmed, competitionId: values.competitionId,
        modality: null, distance: null, category: null,
      })).id;
      createMutation.mutate({ data: { raceId, ...resultFields } });
    } catch {
      toast({ title: 'Erro ao preparar a prova', variant: 'destructive' });
    } finally {
      setResolvingRace(false);
    }
  };

  // ── Import helpers ────────────────────────────────────────────────────────
  const resetImport = () => {
    setImportJson('');
    setImportParseError(null);
    setImportStatus('idle');
    setImportRows([]);
    setImportProgress(0);
    importCancelRef.current = false;
  };

  const handleImportClose = () => {
    if (importStatus === 'importing') return;
    importCancelRef.current = true;
    setImportOpen(false);
    if (importStatus === 'done') queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() });
    setTimeout(resetImport, 300);
  };

  const handleValidate = () => {
    setImportParseError(null);
    let parsed: unknown;
    try { parsed = JSON.parse(importJson.trim()); } catch {
      setImportParseError('JSON inválido. Verifique a sintaxe.'); return;
    }
    if (!Array.isArray(parsed)) {
      setImportParseError('O JSON deve ser um array. Ex: [ { ... }, { ... } ]'); return;
    }
    const rows: RowResult[] = parsed.map((item, idx) => {
      const result = importRowSchema.safeParse(item);
      if (result.success) {
        return { index: idx, raw: item, parsed: result.data, valid: true, importStatus: 'pending' };
      }
      const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { index: idx, raw: item, valid: false, validationError: msg, importStatus: 'pending' };
    });
    setImportRows(rows);
    setImportStatus('previewing');
  };

  const handleImport = async () => {
    const validRows = importRows.filter(r => r.valid && r.parsed);
    if (!validRows.length) return;
    importCancelRef.current = false;
    setImportStatus('importing');
    setImportProgress(0);
    const updated = [...importRows];
    let done = 0;
    for (const row of validRows) {
      if (importCancelRef.current) break;
      const idx = updated.findIndex(r => r.index === row.index);
      try {
        const p = row.parsed!;
        const athleteNamesStr = Array.isArray(p.atletas)
          ? p.atletas.join(', ')
          : p.atletas ?? null;
        // Resolve raceId: explicit id wins; otherwise match (or create) a race
        // by name, scoped to the competition when one is given. Competition
        // calendars never come with races pre-defined, so creating on the fly
        // here is the norm, not a fallback.
        let raceId = p.raceId;
        if (!raceId) {
          if (!p.prova) throw new Error('Indique "raceId" ou "prova" (nome da prova).');
          let competitionId: number | undefined;
          if (p.competicao) {
            const compMatch = allCompetitions?.find(c =>
              c.name.toLowerCase().includes(p.competicao!.toLowerCase()) ||
              p.competicao!.toLowerCase().includes(c.name.toLowerCase())
            );
            if (!compMatch) throw new Error(`Competição "${p.competicao}" não encontrada.`);
            competitionId = compMatch.id;
          }
          const pool = competitionId ? (allRaces ?? []).filter(r => r.competitionId === competitionId) : (allRaces ?? []);
          const raceMatch = pool.find(r => r.name.trim().toLowerCase() === p.prova!.trim().toLowerCase());
          if (raceMatch) {
            raceId = raceMatch.id;
          } else if (competitionId) {
            const newRace = await createRace({ name: p.prova.trim(), competitionId, modality: null, distance: null, category: null });
            raceId = newRace.id;
          } else {
            throw new Error(`Prova "${p.prova}" não encontrada — indique também "competicao" para a criar.`);
          }
        }
        await createResult({
          raceId,
          athleteNames: athleteNamesStr,
          boatClass: p.classe ?? null,
          escalao: p.escalao ?? null,
          position: p.posicao ?? null,
          time: p.tempo ?? null,
          points: p.pontos ?? null,
          notes: p.notas ?? null,
        });
        updated[idx] = { ...updated[idx], importStatus: 'ok' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        updated[idx] = { ...updated[idx], importStatus: 'error', importError: msg };
      }
      done++;
      setImportProgress(done);
      setImportRows([...updated]);
    }
    setImportStatus('done');
    queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() });
  };

  const validCount = importRows.filter(r => r.valid).length;
  const invalidCount = importRows.filter(r => !r.valid).length;
  const okCount = importRows.filter(r => r.importStatus === 'ok').length;
  const errCount = importRows.filter(r => r.importStatus === 'error').length;
  const isPending = createMutation.isPending || updateMutation.isPending || resolvingRace;

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-end items-center">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { resetImport(); setImportOpen(true); }}>
              <Upload className="w-4 h-4 mr-2" /> Importar JSON
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Registar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-[18px] flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Vitórias</span>
              <Trophy className="w-[15px] h-[15px] text-border" />
            </div>
            <span className="text-[32px] font-bold tracking-tight leading-none">{victories}</span>
          </div>
          <div className="bg-card border border-border rounded-2xl p-[18px] flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Pódios</span>
              <Medal className="w-[15px] h-[15px] text-border" />
            </div>
            <span className="text-[32px] font-bold tracking-tight leading-none">{podiums}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-[18px] py-3.5 border-b border-border flex-wrap">
            <div className="relative w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Procurar por atleta, prova, classe ou escalão..." className="pl-9 h-[34px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={seasonFilter} onValueChange={v => { setSeasonFilter(v); setCompFilter(''); }}>
              <SelectTrigger className="w-[160px] h-[34px]"><SelectValue placeholder="Todas as épocas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as épocas</SelectItem>
                {seasons?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={compFilter} onValueChange={setCompFilter}>
              <SelectTrigger className="w-[200px] h-[34px]"><SelectValue placeholder="Todas as competições" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as competições</SelectItem>
                {competitions?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <span className="font-mono text-[10.5px] tracking-wide uppercase text-muted-foreground whitespace-nowrap">
              {filteredResults.length} {filteredResults.length === 1 ? 'resultado' : 'resultados'}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competição / Prova</TableHead>
                <TableHead>Atletas</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Escalão</TableHead>
                <TableHead>Posição</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : filteredResults.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum resultado encontrado.</TableCell></TableRow>
              ) : filteredResults.map(result => (
                <TableRow key={result.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{result.competitionName || '—'}</div>
                    <div className="text-xs text-muted-foreground">{result.raceName || '—'}</div>
                  </TableCell>
                  <TableCell className="max-w-[200px] text-sm truncate" title={result.athleteNames ?? undefined}>{result.athleteNames || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{result.boatClass || '—'}</Badge></TableCell>
                  <TableCell className="text-sm">{result.escalao || '—'}</TableCell>
                  <TableCell>{positionBadge(result.position)}</TableCell>
                  <TableCell className="font-mono text-xs">{result.time || '—'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(result); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar resultado?</AlertDialogTitle>
                          <AlertDialogDescription>Remove permanentemente este resultado.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: result.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Create / Edit dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Resultado' : 'Novo Resultado'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {editing ? (
                <FormItem>
                  <FormLabel>Competição / Prova</FormLabel>
                  <Input disabled value={`${editing.competitionName ?? '—'} — ${editing.raceName ?? '—'}`} />
                </FormItem>
              ) : (
                <>
                  <FormField control={form.control} name="competitionId" render={({ field }) => (
                    <FormItem><FormLabel>Competição *</FormLabel>
                      <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ''}>
                        <FormControl>
                          <SelectTrigger className="[&>span]:truncate [&>span]:block">
                            <SelectValue placeholder="Selecionar competição" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {competitions?.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="raceName" render={({ field }) => (
                    <FormItem><FormLabel>Nome da prova *</FormLabel>
                      <FormControl><Input placeholder="2x Sub19 Masculinos 2000m" {...field} /></FormControl>
                      {!!formCompetitionId && !!formRaces?.length && (
                        <p className="text-xs text-muted-foreground">
                          Já registadas nesta competição: {formRaces.map(r => r.name).join(', ')}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                </>
              )}
              <FormField control={form.control} name="athleteNames" render={({ field }) => (
                <FormItem><FormLabel>Atletas</FormLabel><FormControl><Input placeholder="João Silva, Ana Costa" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="boatClass" render={({ field }) => (
                  <FormItem><FormLabel>Classe</FormLabel><FormControl><Input placeholder="2x, 1x, 4+…" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="escalao" render={({ field }) => (
                  <FormItem><FormLabel>Escalão</FormLabel><FormControl><Input placeholder="Júnior, Sénior…" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem><FormLabel>Posição</FormLabel><FormControl><Input type="number" min={1} {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="time" render={({ field }) => (
                  <FormItem><FormLabel>Tempo</FormLabel><FormControl><Input placeholder="6:45.32" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="points" render={({ field }) => (
                  <FormItem><FormLabel>Pontos</FormLabel><FormControl><Input type="number" step="0.1" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'A guardar...' : editing ? 'Guardar' : 'Registar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Import JSON dialog ── */}
      <Dialog open={importOpen} onOpenChange={handleImportClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar Resultados via JSON</DialogTitle>
            <DialogDescription>
              Cole um array JSON com os resultados. Campos obrigatórios: <code className="text-xs bg-muted px-1 rounded">atletas</code>, <code className="text-xs bg-muted px-1 rounded">classe</code>, <code className="text-xs bg-muted px-1 rounded">escalao</code>, e <code className="text-xs bg-muted px-1 rounded">competicao</code> + <code className="text-xs bg-muted px-1 rounded">prova</code> (a prova é criada automaticamente se ainda não existir).
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">

            {/* Phase 1: input */}
            {(importStatus === 'idle') && (
              <div className="flex flex-col gap-3 flex-1">
                <Textarea
                  className="flex-1 font-mono text-xs resize-none min-h-[220px]"
                  placeholder={IMPORT_EXAMPLE}
                  value={importJson}
                  onChange={e => { setImportJson(e.target.value); setImportParseError(null); }}
                />
                {importParseError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{importParseError}</span>
                  </div>
                )}
                <JsonFormatHint example={IMPORT_EXAMPLE} />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>atletas</strong>: string ou array — <code className="bg-muted px-1 rounded">"João Silva"</code> ou <code className="bg-muted px-1 rounded">["João", "Pedro"]</code></p>
                  <p><strong>classe</strong>: classe do barco (ex: <code className="bg-muted px-1 rounded">1x</code>, <code className="bg-muted px-1 rounded">2x</code>, <code className="bg-muted px-1 rounded">4+</code>, <code className="bg-muted px-1 rounded">8+</code>)</p>
                  <p><strong>competicao</strong> + <strong>prova</strong>: nome da competição e da prova — se a prova ainda não existir nessa competição, é criada automaticamente</p>
                  <p><strong>raceId</strong>: alternativa direta ao par competicao/prova, se já souberes o ID da prova</p>
                </div>
              </div>
            )}

            {/* Phase 2 & 3: preview / results */}
            {(importStatus === 'previewing' || importStatus === 'importing' || importStatus === 'done') && (
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">{importRows.length} linha(s)</span>
                  {invalidCount > 0 && <span className="text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />{invalidCount} inválida(s)</span>}
                  <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{validCount} válida(s)</span>
                  {importStatus === 'importing' && (
                    <span className="ml-auto text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />A importar {importProgress}/{validCount}…
                    </span>
                  )}
                  {importStatus === 'done' && (
                    <span className="ml-auto font-medium">
                      {okCount > 0 && <span className="text-green-600">{okCount} importado(s) </span>}
                      {errCount > 0 && <span className="text-destructive">{errCount} com erro</span>}
                    </span>
                  )}
                </div>

                <ScrollArea className="flex-1 rounded-md border min-h-0" style={{ maxHeight: 300 }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Atletas</TableHead>
                        <TableHead>Classe</TableHead>
                        <TableHead>Escalão</TableHead>
                        <TableHead>Pos.</TableHead>
                        <TableHead>Tempo</TableHead>
                        <TableHead className="w-8 text-center">✓</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map(row => {
                        const raw = row.raw as Record<string, unknown>;
                        const atletasDisplay = row.valid
                          ? (Array.isArray(row.parsed!.atletas) ? row.parsed!.atletas.join(', ') : String(row.parsed!.atletas ?? ''))
                          : (Array.isArray(raw?.atletas) ? (raw.atletas as string[]).join(', ') : String(raw?.atletas ?? '—'));
                        return (
                          <TableRow key={row.index} className={!row.valid ? 'bg-destructive/5' : ''}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{row.index + 1}</TableCell>
                            <TableCell className="max-w-[150px] truncate text-sm">{atletasDisplay}</TableCell>
                            <TableCell className="text-xs">{row.valid ? row.parsed!.classe : (String(raw?.classe ?? '—'))}</TableCell>
                            <TableCell className="text-xs">{row.valid ? row.parsed!.escalao : (String(raw?.escalao ?? '—'))}</TableCell>
                            <TableCell className="text-xs">{row.valid ? (row.parsed!.posicao ?? '—') : '—'}</TableCell>
                            <TableCell className="text-xs font-mono">{row.valid ? (row.parsed!.tempo ?? '—') : '—'}</TableCell>
                            <TableCell className="text-center">
                              {!row.valid ? (
                                <span title={row.validationError}><XCircle className="w-4 h-4 text-destructive inline" /></span>
                              ) : row.importStatus === 'pending' ? (
                                <span className="w-4 h-4 rounded-full bg-muted inline-block" />
                              ) : row.importStatus === 'ok' ? (
                                <CheckCircle className="w-4 h-4 text-green-600 inline" />
                              ) : (
                                <span title={row.importError}><XCircle className="w-4 h-4 text-destructive inline" /></span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {importStatus === 'previewing' && invalidCount > 0 && (
                  <div className="text-xs text-destructive space-y-1 max-h-16 overflow-y-auto">
                    {importRows.filter(r => !r.valid).map(r => (
                      <div key={r.index}><span className="font-medium">Linha {r.index + 1}:</span> {r.validationError}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 shrink-0">
            {importStatus === 'idle' && (
              <>
                <Button variant="outline" onClick={handleImportClose}>Cancelar</Button>
                <Button onClick={handleValidate} disabled={!importJson.trim()}>Validar JSON</Button>
              </>
            )}
            {importStatus === 'previewing' && (
              <>
                <Button variant="outline" onClick={() => setImportStatus('idle')}>← Voltar</Button>
                <Button onClick={handleImport} disabled={validCount === 0}>
                  Importar {validCount} resultado{validCount !== 1 ? 's' : ''}
                </Button>
              </>
            )}
            {importStatus === 'importing' && (
              <Button variant="outline" disabled><Loader2 className="w-4 h-4 mr-2 animate-spin" />A importar…</Button>
            )}
            {importStatus === 'done' && (
              <>
                <Button variant="outline" onClick={() => { setImportStatus('idle'); setImportJson(''); setImportRows([]); setImportProgress(0); }}>
                  Nova Importação
                </Button>
                <Button onClick={handleImportClose}>Fechar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
