import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListResults, useCreateResult, useUpdateResult, useDeleteResult, getListResultsQueryKey,
  useListSeasons, useListCompetitions, useListRaces, createResult,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trophy, Medal, Upload, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

// ── CRUD form schema ──────────────────────────────────────────────────────────
const schema = z.object({
  raceId: z.coerce.number().min(1, 'Prova obrigatória'),
  athleteNames: z.string().nullable().optional(),
  boatClass: z.string().nullable().optional(),
  escalao: z.string().nullable().optional(),
  position: z.coerce.number().min(1).nullable().optional(),
  time: z.string().nullable().optional(),
  points: z.coerce.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const defaultValues = {
  raceId: 0,
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
    atletas: ["João Silva", "Pedro Costa"],
    classe: "2x",
    escalao: "Júnior",
    epoca: "2024/2025",
    competicao: "Campeonato Nacional",
    prova: "2000m Final",
    posicao: 1,
    tempo: "6:45.32",
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

  const victories = results?.filter(r => r.position === 1).length ?? 0;
  const podiums = results?.filter(r => r.position && r.position <= 3).length ?? 0;

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({
          raceId: editing.raceId,
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

  const onSubmit = (values: z.infer<typeof schema>) => {
    const data = {
      raceId: values.raceId,
      athleteNames: values.athleteNames || null,
      boatClass: values.boatClass || null,
      escalao: values.escalao || null,
      position: values.position || null,
      time: values.time || null,
      points: values.points || null,
      notes: values.notes || null,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate({ data });
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
        // Try to find raceId from name if not provided
        let raceId = p.raceId;
        if (!raceId && p.prova && races) {
          const match = races.find(r =>
            r.name.toLowerCase().includes(p.prova!.toLowerCase()) ||
            p.prova!.toLowerCase().includes(r.name.toLowerCase())
          );
          raceId = match?.id;
        }
        if (!raceId) throw new Error('raceId não encontrado (forneça o campo raceId ou nome de prova correspondente)');
        await createResult({
          data: {
            raceId,
            athleteNames: athleteNamesStr,
            boatClass: p.classe ?? null,
            escalao: p.escalao ?? null,
            position: p.posicao ?? null,
            time: p.tempo ?? null,
            points: p.pontos ?? null,
            notes: p.notas ?? null,
          }
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
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Resultados</h1>
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
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Trophy className="w-4 h-4" /> Vitórias</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{victories}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Medal className="w-4 h-4" /> Pódios</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{podiums}</div></CardContent></Card>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Select value={seasonFilter} onValueChange={v => { setSeasonFilter(v); setCompFilter(''); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todas as épocas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as épocas</SelectItem>
              {seasons?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={compFilter} onValueChange={setCompFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todas as competições" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as competições</SelectItem>
              {competitions?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-md border shadow-sm">
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
              ) : results?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum resultado encontrado.</TableCell></TableRow>
              ) : results?.map(result => (
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Resultado' : 'Novo Resultado'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="raceId" render={({ field }) => (
                <FormItem><FormLabel>Prova *</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ''} disabled={!!editing}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar prova" /></SelectTrigger></FormControl>
                    <SelectContent>{races?.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}{r.competitionName ? ` — ${r.competitionName}` : ''}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
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
              Cole um array JSON com os resultados. Campos obrigatórios: <code className="text-xs bg-muted px-1 rounded">atletas</code>, <code className="text-xs bg-muted px-1 rounded">classe</code>, <code className="text-xs bg-muted px-1 rounded">escalao</code>, <code className="text-xs bg-muted px-1 rounded">raceId</code> (ou nome de prova em <code className="text-xs bg-muted px-1 rounded">prova</code> para correspondência automática).
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
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>atletas</strong>: string ou array de strings — <code className="bg-muted px-1 rounded">"João Silva"</code> ou <code className="bg-muted px-1 rounded">["João", "Pedro"]</code></p>
                  <p><strong>classe</strong>: classe do barco (ex: <code className="bg-muted px-1 rounded">2x</code>, <code className="bg-muted px-1 rounded">4+</code>)</p>
                  <p><strong>raceId</strong>: ID da prova (ver em Competições), ou use <strong>prova</strong> para correspondência por nome</p>
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
