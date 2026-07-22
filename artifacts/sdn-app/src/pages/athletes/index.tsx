import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListAthletes, useCreateAthlete, useUpdateAthlete, useDeleteAthlete,
  getListAthletesQueryKey, createAthlete,
} from '@workspace/api-client-react';
import type { Athlete } from '@workspace/api-client-react';
import { Link } from 'wouter';
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
import { Search, Plus, Download, Upload, CheckCircle, XCircle, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

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
import { ScrollArea } from '@/components/ui/scroll-area';

// ── JSON import schema (lenient — accepts all valid athlete inputs) ──
const importRowSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string().min(1),
  gender: z.enum(['M', 'F']),
  affiliationDate: z.string().min(1),
  status: z.enum(['ativo', 'inativo', 'suspenso']).default('ativo'),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  memberNumber: z.string().nullable().optional(),
  fprNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

type ImportRow = z.infer<typeof importRowSchema>;
type ImportStatus = 'idle' | 'validating' | 'previewing' | 'importing' | 'done';
type RowResult = { index: number; raw: unknown; parsed?: ImportRow; valid: boolean; validationError?: string; importStatus: 'pending' | 'ok' | 'error'; importError?: string };

const IMPORT_EXAMPLE = JSON.stringify([
  { name: "João Silva", birthDate: "2000-05-15", gender: "M", affiliationDate: "2020-01-01", status: "ativo", email: "joao@example.com", memberNumber: "AAC-001", fprNumber: "FPR-001" },
  { name: "Ana Costa", birthDate: "2002-03-22", gender: "F", affiliationDate: "2021-06-01", status: "ativo" }
], null, 2);

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  birthDate: z.string().min(1, 'Data obrigatória'),
  gender: z.enum(['M', 'F']),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  memberNumber: z.string().nullable().optional(),
  fprNumber: z.string().nullable().optional(),
  affiliationDate: z.string().min(1, 'Data de filiação obrigatória'),
  status: z.enum(['ativo', 'inativo', 'suspenso']),
  notes: z.string().nullable().optional(),
});

const defaultValues = { name: '', birthDate: '', gender: 'M' as const, email: '', phone: '', memberNumber: '', fprNumber: '', affiliationDate: '', status: 'ativo' as const, notes: '' };

export default function AthletesList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ── Import dialog state ──
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importRows, setImportRows] = useState<RowResult[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const importCancelRef = useRef(false);

  const { data: athletes, isLoading } = useListAthletes();

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({ ...editing, email: editing.email ?? '', phone: editing.phone ?? '', memberNumber: editing.memberNumber ?? '', fprNumber: editing.fprNumber ?? '', notes: editing.notes ?? '' });
      } else {
        form.reset(defaultValues);
      }
    }
  }, [open, editing]);

  const createMutation = useCreateAthlete({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAthletesQueryKey() }); toast({ title: 'Atleta criado com sucesso!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar atleta', variant: 'destructive' }),
  }});

  const updateMutation = useUpdateAthlete({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAthletesQueryKey() }); toast({ title: 'Atleta atualizado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});

  const deleteMutation = useDeleteAthlete({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAthletesQueryKey() }); toast({ title: 'Atleta eliminado.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof schema>) => {
    const data = { ...values, email: values.email || null, phone: values.phone || null, memberNumber: values.memberNumber || null, fprNumber: values.fprNumber || null, notes: values.notes || null };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate({ data });
  };

  const filteredAthletes = useMemo(() => {
    if (!athletes) return [];
    return athletes.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || (a.memberNumber && a.memberNumber.includes(searchTerm)) || (a.fprNumber && a.fprNumber.includes(searchTerm));
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [athletes, searchTerm, statusFilter]);

  const handleExport = () => {
    if (!filteredAthletes.length) return;
    const headers = "ID,Nome,Data Nasc.,Género,Nº Sócio,Nº FPR,Categoria,Estado\n";
    const csv = filteredAthletes.map(a => `${a.id},"${a.name}",${a.birthDate},${a.gender},${a.memberNumber||''},${a.fprNumber||''},${a.category||''},${a.status}`).join("\n");
    const blob = new Blob([headers + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url); link.setAttribute('download', 'atletas.csv');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // ── Import helpers ──
  const resetImport = () => {
    setImportJson('');
    setImportParseError(null);
    setImportStatus('idle');
    setImportRows([]);
    setImportProgress(0);
    importCancelRef.current = false;
  };

  const handleImportClose = () => {
    if (importStatus === 'importing') return; // block close during import
    importCancelRef.current = true;
    setImportOpen(false);
    if (importStatus === 'done') {
      queryClient.invalidateQueries({ queryKey: getListAthletesQueryKey() });
    }
    setTimeout(resetImport, 300);
  };

  const handleValidate = () => {
    setImportParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson.trim());
    } catch {
      setImportParseError('JSON inválido. Verifique a sintaxe do texto colado.');
      return;
    }
    if (!Array.isArray(parsed)) {
      setImportParseError('O JSON deve ser um array (lista) de atletas. Ex: [ { ... }, { ... } ]');
      return;
    }
    const rows: RowResult[] = parsed.map((item, idx) => {
      const result = importRowSchema.safeParse(item);
      if (result.success) {
        return { index: idx, raw: item, parsed: result.data, valid: true, importStatus: 'pending' };
      } else {
        const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        return { index: idx, raw: item, valid: false, validationError: msg, importStatus: 'pending' };
      }
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
        const data = {
          ...row.parsed!,
          email: row.parsed!.email || null,
          phone: row.parsed!.phone || null,
          memberNumber: row.parsed!.memberNumber || null,
          fprNumber: row.parsed!.fprNumber || null,
          notes: row.parsed!.notes || null,
        };
        await createAthlete({ data });
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
    queryClient.invalidateQueries({ queryKey: getListAthletesQueryKey() });
  };

  const validCount = importRows.filter(r => r.valid).length;
  const invalidCount = importRows.filter(r => !r.valid).length;
  const okCount = importRows.filter(r => r.importStatus === 'ok').length;
  const errCount = importRows.filter(r => r.importStatus === 'error').length;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Atletas</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Exportar</Button>
            <Button variant="outline" size="sm" onClick={() => { resetImport(); setImportOpen(true); }}><Upload className="w-4 h-4 mr-2" /> Importar</Button>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Atleta</Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Procurar por nome ou número..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-md border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Sócio</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>FPR</TableHead>
                <TableHead>Data Nasc.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
              ) : filteredAthletes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum atleta encontrado.</TableCell></TableRow>
              ) : filteredAthletes.map(athlete => (
                <TableRow key={athlete.id}>
                  <TableCell className="font-mono text-xs">{athlete.memberNumber || '-'}</TableCell>
                  <TableCell className="font-medium">{athlete.name}</TableCell>
                  <TableCell>{athlete.category || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{athlete.fprNumber || '-'}</TableCell>
                  <TableCell>{athlete.birthDate}</TableCell>
                  <TableCell>
                    <Badge variant={athlete.status === 'ativo' ? 'success' : athlete.status === 'suspenso' ? 'destructive' : 'secondary'}>{athlete.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" asChild><Link href={`/atletas/${athlete.id}`}>Ver</Link></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(athlete); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar atleta?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação elimina permanentemente o atleta <strong>{athlete.name}</strong> e não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: athlete.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Atleta' : 'Novo Atleta'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome completo *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                  <FormItem><FormLabel>Data de Nascimento *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem><FormLabel>Género *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="memberNumber" render={({ field }) => (
                  <FormItem><FormLabel>Nº Sócio</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="fprNumber" render={({ field }) => (
                  <FormItem><FormLabel>Nº FPR</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="affiliationDate" render={({ field }) => (
                  <FormItem><FormLabel>Data de Filiação *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Estado *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="suspenso">Suspenso</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
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
            <DialogTitle>Importar Atletas via JSON</DialogTitle>
            <DialogDescription>
              Cole um array JSON com os atletas a importar. Campos obrigatórios: <code className="text-xs bg-muted px-1 rounded">name</code>, <code className="text-xs bg-muted px-1 rounded">birthDate</code>, <code className="text-xs bg-muted px-1 rounded">gender</code>, <code className="text-xs bg-muted px-1 rounded">affiliationDate</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">

            {/* ── Phase 1: input ── */}
            {(importStatus === 'idle' || importStatus === 'validating') && (
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
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p><strong>gender</strong>: <code className="bg-muted px-1 rounded">M</code> | <code className="bg-muted px-1 rounded">F</code></p>
                  <p><strong>status</strong>: <code className="bg-muted px-1 rounded">ativo</code> | <code className="bg-muted px-1 rounded">inativo</code> | <code className="bg-muted px-1 rounded">suspenso</code> (omissível, padrão: ativo)</p>
                  <p><strong>birthDate</strong>, <strong>affiliationDate</strong>: formato <code className="bg-muted px-1 rounded">AAAA-MM-DD</code></p>
                </div>
              </div>
            )}

            {/* ── Phase 2 & 3: preview / results table ── */}
            {(importStatus === 'previewing' || importStatus === 'importing' || importStatus === 'done') && (
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                {/* Summary bar */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">{importRows.length} linha(s) encontrada(s)</span>
                  {invalidCount > 0 && (
                    <span className="text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />{invalidCount} inválida(s)</span>
                  )}
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

                <ScrollArea className="flex-1 rounded-md border min-h-0" style={{ maxHeight: 320 }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Nasc.</TableHead>
                        <TableHead>G</TableHead>
                        <TableHead>Filiação</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-8 text-center">✓</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map(row => {
                        const raw = row.raw as Record<string, unknown>;
                        return (
                          <TableRow key={row.index} className={!row.valid ? 'bg-destructive/5' : ''}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{row.index + 1}</TableCell>
                            <TableCell className="max-w-[140px] truncate">
                              {row.valid ? row.parsed!.name : (typeof raw?.name === 'string' ? raw.name : <span className="text-muted-foreground italic">—</span>)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.valid ? row.parsed!.birthDate : (typeof raw?.birthDate === 'string' ? raw.birthDate : '—')}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.valid ? row.parsed!.gender : (typeof raw?.gender === 'string' ? raw.gender : '—')}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.valid ? row.parsed!.affiliationDate : (typeof raw?.affiliationDate === 'string' ? raw.affiliationDate : '—')}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.valid ? (row.parsed!.status ?? 'ativo') : '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              {!row.valid ? (
                                <span title={row.validationError}><XCircle className="w-4 h-4 text-destructive inline" /></span>
                              ) : row.importStatus === 'pending' ? (
                                <span className="w-4 h-4 rounded-full bg-muted inline-block" />
                              ) : row.importStatus === 'ok' ? (
                                <CheckCircle className="w-4 h-4 text-green-600 inline" />
                              ) : row.importStatus === 'error' ? (
                                <span title={row.importError}><XCircle className="w-4 h-4 text-destructive inline" /></span>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Validation errors detail */}
                {importStatus === 'previewing' && invalidCount > 0 && (
                  <div className="text-xs text-destructive space-y-1 max-h-20 overflow-y-auto">
                    {importRows.filter(r => !r.valid).map(r => (
                      <div key={r.index}>
                        <span className="font-medium">Linha {r.index + 1}:</span> {r.validationError}
                      </div>
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
                  Importar {validCount} atleta{validCount !== 1 ? 's' : ''}
                </Button>
              </>
            )}
            {importStatus === 'importing' && (
              <Button variant="outline" disabled>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />A importar…
              </Button>
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
