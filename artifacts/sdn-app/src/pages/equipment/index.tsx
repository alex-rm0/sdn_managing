import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment,
  getListEquipmentQueryKey, createEquipment,
} from '@workspace/api-client-react';
import type { Equipment } from '@workspace/api-client-react';
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Upload, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  category: z.string().min(1, 'Categoria obrigatória'),
  totalQuantity: z.coerce.number().min(0),
  availableQuantity: z.coerce.number().min(0),
  status: z.string().min(1, 'Estado obrigatório'),
  assignedTo: z.string().nullable().optional(),
  acquisitionDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const defaultValues = { name: '', category: '', totalQuantity: 1, availableQuantity: 1, status: 'bom', assignedTo: '', acquisitionDate: '', notes: '' };

// ── Import schema ─────────────────────────────────────────────────────────────
const importRowSchema = z.object({
  nome: z.string().min(1),
  categoria: z.string().min(1),
  quantidade_total: z.coerce.number().min(0).optional().default(1),
  quantidade_disponivel: z.coerce.number().min(0).optional().default(1),
  estado: z.string().optional().default('bom'),
  atribuido_a: z.string().optional(),
  data_aquisicao: z.string().optional(),
  notas: z.string().optional(),
});
type ImportRow = z.infer<typeof importRowSchema>;
type RowResult = { index: number; raw: unknown; parsed?: ImportRow; valid: boolean; validationError?: string; importStatus: 'pending' | 'ok' | 'error'; importError?: string; };
type ImportStatus = 'idle' | 'previewing' | 'importing' | 'done';

const IMPORT_FORMAT = JSON.stringify([
  { nome: "Remo de competição", categoria: "Remos", quantidade_total: 8, quantidade_disponivel: 6, estado: "bom", atribuido_a: "Equipa Sénior" },
  { nome: "Colete salva-vidas", categoria: "Segurança", quantidade_total: 20, quantidade_disponivel: 18, estado: "bom" },
  { nome: "Ergómetro Concept2", categoria: "Máquinas", quantidade_total: 4, quantidade_disponivel: 3, estado: "desgastado", notas: "Um com correia partida" },
], null, 2);

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

export default function EquipmentList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importRows, setImportRows] = useState<RowResult[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const importCancelRef = useRef(false);

  const { data: equipment, isLoading } = useListEquipment();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) form.reset(editing
      ? { ...editing, assignedTo: editing.assignedTo ?? '', acquisitionDate: editing.acquisitionDate ?? '', notes: editing.notes ?? '' }
      : defaultValues);
  }, [open, editing]);

  const createMutation = useCreateEquipment({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey() }); toast({ title: 'Equipamento criado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar', variant: 'destructive' }),
  }});
  const updateMutation = useUpdateEquipment({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey() }); toast({ title: 'Equipamento atualizado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMutation = useDeleteEquipment({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey() }); toast({ title: 'Equipamento eliminado.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof schema>) => {
    const data = { ...values, assignedTo: values.assignedTo || null, acquisitionDate: values.acquisitionDate || null, notes: values.notes || null };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate({ data });
  };

  // ── Import helpers ──
  const resetImport = () => { setImportJson(''); setImportParseError(null); setImportStatus('idle'); setImportRows([]); setImportProgress(0); importCancelRef.current = false; };
  const handleImportClose = () => {
    if (importStatus === 'importing') return;
    importCancelRef.current = true;
    setImportOpen(false);
    if (importStatus === 'done') queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey() });
    setTimeout(resetImport, 300);
  };
  const handleValidate = () => {
    setImportParseError(null);
    let parsed: unknown;
    try { parsed = JSON.parse(importJson.trim()); } catch { setImportParseError('JSON inválido. Verifique a sintaxe.'); return; }
    if (!Array.isArray(parsed)) { setImportParseError('O JSON deve ser um array: [ { ... }, ... ]'); return; }
    const rows: RowResult[] = parsed.map((item, idx) => {
      const r = importRowSchema.safeParse(item);
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
        await createEquipment({ name: p.nome, category: p.categoria, totalQuantity: p.quantidade_total ?? 1, availableQuantity: p.quantidade_disponivel ?? 1, status: p.estado ?? 'bom', assignedTo: p.atribuido_a ?? null, acquisitionDate: p.data_aquisicao ?? null, notes: p.notas ?? null });
        updated[idx] = { ...updated[idx], importStatus: 'ok' };
      } catch (err) {
        updated[idx] = { ...updated[idx], importStatus: 'error', importError: err instanceof Error ? err.message : 'Erro' };
      }
      done++; setImportProgress(done); setImportRows([...updated]);
    }
    setImportStatus('done');
    queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey() });
  };

  const validCount = importRows.filter(r => r.valid).length;
  const invalidCount = importRows.filter(r => !r.valid).length;
  const okCount = importRows.filter(r => r.importStatus === 'ok').length;
  const errCount = importRows.filter(r => r.importStatus === 'error').length;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => { resetImport(); setImportOpen(true); }}>
            <Upload className="w-4 h-4 mr-2" /> Importar JSON
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Novo Registo
          </Button>
        </div>

        <div className="bg-card rounded-md border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Qtd. Total / Disponível</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Atribuído a</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : equipment?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum equipamento registado.</TableCell></TableRow>
              ) : equipment?.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    {item.totalQuantity} / <span className={item.availableQuantity === 0 ? 'text-destructive font-bold' : ''}>{item.availableQuantity}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'bom' ? 'success' : item.status === 'desgastado' ? 'warning' : 'destructive' as any}>
                      {item.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.assignedTo || '—'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(item); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar equipamento?</AlertDialogTitle>
                          <AlertDialogDescription>Elimina <strong>{item.name}</strong>. Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: item.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
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

      {/* ── CRUD dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Categoria *</FormLabel><FormControl><Input placeholder="Remos, Vestuário…" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Estado *</FormLabel><FormControl><Input placeholder="bom, desgastado…" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="totalQuantity" render={({ field }) => (<FormItem><FormLabel>Qtd. Total *</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="availableQuantity" render={({ field }) => (<FormItem><FormLabel>Qtd. Disponível *</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="assignedTo" render={({ field }) => (<FormItem><FormLabel>Atribuído a</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="acquisitionDate" render={({ field }) => (<FormItem><FormLabel>Data de Aquisição</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'A guardar...' : editing ? 'Guardar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Import dialog ── */}
      <Dialog open={importOpen} onOpenChange={handleImportClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar Equipamento via JSON</DialogTitle>
            <DialogDescription>Cole um array JSON com os itens a importar.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
            {importStatus === 'idle' && (
              <div className="flex flex-col gap-3 flex-1">
                <Textarea
                  className="flex-1 font-mono text-xs resize-none min-h-[200px]"
                  placeholder={IMPORT_FORMAT}
                  value={importJson}
                  onChange={e => { setImportJson(e.target.value); setImportParseError(null); }}
                />
                {importParseError && <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{importParseError}</p>}
                <JsonFormatHint example={IMPORT_FORMAT} />
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p><strong>nome</strong>, <strong>categoria</strong>: obrigatórios</p>
                  <p><strong>estado</strong>: texto livre (ex: <code className="bg-muted px-1 rounded">bom</code>, <code className="bg-muted px-1 rounded">desgastado</code>, <code className="bg-muted px-1 rounded">danificado</code>)</p>
                  <p><strong>data_aquisicao</strong>: formato <code className="bg-muted px-1 rounded">AAAA-MM-DD</code></p>
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
                  {importStatus === 'done' && <span className="ml-auto font-medium">{okCount > 0 && <span className="text-green-600">{okCount} importado(s) </span>}{errCount > 0 && <span className="text-destructive">{errCount} com erro</span>}</span>}
                </div>
                <ScrollArea className="flex-1 rounded-md border min-h-0" style={{ maxHeight: 280 }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Qtd</TableHead>
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
                            <TableCell className="text-sm font-medium">{row.valid ? row.parsed!.nome : String(raw?.nome ?? '—')}</TableCell>
                            <TableCell className="text-xs">{row.valid ? row.parsed!.categoria : String(raw?.categoria ?? '—')}</TableCell>
                            <TableCell className="text-xs">{row.valid ? `${row.parsed!.quantidade_total ?? 1} / ${row.parsed!.quantidade_disponivel ?? 1}` : '—'}</TableCell>
                            <TableCell className="text-xs">{row.valid ? (row.parsed!.estado ?? 'bom') : '—'}</TableCell>
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
            {importStatus === 'previewing' && (<><Button variant="outline" onClick={() => setImportStatus('idle')}>← Voltar</Button><Button onClick={handleImport} disabled={validCount === 0}>Importar {validCount} item{validCount !== 1 ? 'ns' : ''}</Button></>)}
            {importStatus === 'importing' && (<Button variant="outline" disabled><Loader2 className="w-4 h-4 mr-2 animate-spin" />A importar…</Button>)}
            {importStatus === 'done' && (<><Button variant="outline" onClick={() => { setImportStatus('idle'); setImportJson(''); setImportRows([]); setImportProgress(0); }}>Nova Importação</Button><Button onClick={handleImportClose}>Fechar</Button></>)}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
