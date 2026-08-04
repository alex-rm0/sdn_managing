import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListFleet, useCreateFleetItem, useUpdateFleetItem, useDeleteFleetItem,
  useAddFleetValuation, getListFleetQueryKey, createFleetItem,
} from '@workspace/api-client-react';
import type { FleetItem } from '@workspace/api-client-react';
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
import { Plus, Euro, Upload, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, Search } from 'lucide-react';

// ── Category config ───────────────────────────────────────────────────────────
type Category = 'embarcacoes' | 'viaturas';

const BOAT_TYPES = ['barco_remo', 'barco_motor'] as const;
const VEHICLE_TYPES = ['carrinha', 'atrelado', 'bicicleta'] as const;

const typeLabels: Record<string, string> = {
  barco_remo: 'Barco a Remo',
  barco_motor: 'Barco a Motor',
  bicicleta: 'Bicicleta',
  atrelado: 'Atrelado',
  carrinha: 'Carrinha',
};
const statusLabels: Record<string, string> = {
  ativo: 'Ativo',
  manutencao: 'Em Manutenção',
  avariado: 'Avariado',
  fora_servico: 'Fora de Serviço',
};

function categoryTypes(cat: Category) {
  return cat === 'embarcacoes' ? BOAT_TYPES : VEHICLE_TYPES;
}
function filterByCategory(items: FleetItem[], cat: Category) {
  const types = categoryTypes(cat) as readonly string[];
  return items.filter(i => types.includes(i.type));
}

// ── CRUD schema ───────────────────────────────────────────────────────────────
const fleetSchema = z.object({
  identifier: z.string().min(1, 'Identificador obrigatório'),
  type: z.enum(['barco_remo', 'barco_motor', 'bicicleta', 'atrelado', 'carrinha']),
  subtype: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  year: z.coerce.number().nullable().optional(),
  status: z.enum(['ativo', 'manutencao', 'avariado', 'fora_servico']),
  breakdownDescription: z.string().nullable().optional(),
  repairMaterials: z.string().nullable().optional(),
});
const valuationSchema = z.object({
  value: z.coerce.number().min(0, 'Valor obrigatório'),
  date: z.string().min(1, 'Data obrigatória'),
  notes: z.string().nullable().optional(),
});

// ── Import schema ─────────────────────────────────────────────────────────────
const importRowSchema = z.object({
  identificador: z.string().min(1),
  tipo: z.enum(['barco_remo', 'barco_motor', 'bicicleta', 'atrelado', 'carrinha']),
  subtipo: z.string().optional(),
  marca: z.string().optional(),
  ano: z.coerce.number().optional(),
  estado: z.enum(['ativo', 'manutencao', 'avariado', 'fora_servico']).optional().default('ativo'),
  descricao_avaria: z.string().optional(),
  materiais_reparacao: z.string().optional(),
});
type ImportRow = z.infer<typeof importRowSchema>;
type RowResult = { index: number; raw: unknown; parsed?: ImportRow; valid: boolean; validationError?: string; importStatus: 'pending' | 'ok' | 'error'; importError?: string; };
type ImportStatus = 'idle' | 'previewing' | 'importing' | 'done';

const BOAT_FORMAT = JSON.stringify([
  { identificador: "AAC-001", tipo: "barco_remo", subtipo: "1x", marca: "Filippi", ano: 2018, estado: "ativo" },
  { identificador: "AAC-002", tipo: "barco_motor", marca: "Honda", ano: 2010, estado: "manutencao" },
], null, 2);

const VEHICLE_FORMAT = JSON.stringify([
  { identificador: "VH-001", tipo: "carrinha", marca: "Mercedes Sprinter", ano: 2015, estado: "ativo" },
  { identificador: "VH-002", tipo: "atrelado", marca: "Metzler", ano: 2008, estado: "ativo" },
  { identificador: "VH-003", tipo: "bicicleta", marca: "Trek", ano: 2020, estado: "ativo" },
], null, 2);

// ── JsonFormatHint ────────────────────────────────────────────────────────────
function JsonFormatHint({ example, label = 'Ver formato JSON' }: { example: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {label}
      </button>
      {open && (
        <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">{example}</pre>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
interface FleetListProps { category: Category; }

export default function FleetList({ category }: FleetListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FleetItem | null>(null);
  const [valOpen, setValOpen] = useState(false);
  const [valItemId, setValItemId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importRows, setImportRows] = useState<RowResult[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const importCancelRef = useRef(false);

  const { data: allFleet, isLoading } = useListFleet();
  const fleet = allFleet ? filterByCategory(allFleet, category) : undefined;
  const filteredFleet = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return (fleet ?? []).filter(item => {
      const matchesSearch = !q || item.identifier.toLowerCase().includes(q) || (item.brand?.toLowerCase().includes(q)) || (item.subtype?.toLowerCase().includes(q));
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [fleet, searchTerm, typeFilter, statusFilter]);

  const defaultFleet = { identifier: '', type: categoryTypes(category)[0] as z.infer<typeof fleetSchema>['type'], subtype: '', brand: '', year: undefined as number | undefined, status: 'ativo' as const, breakdownDescription: '', repairMaterials: '' };

  const form = useForm<z.infer<typeof fleetSchema>>({ resolver: zodResolver(fleetSchema), defaultValues: defaultFleet });
  const valForm = useForm<z.infer<typeof valuationSchema>>({ resolver: zodResolver(valuationSchema), defaultValues: { value: 0, date: new Date().toISOString().split('T')[0], notes: '' } });

  useEffect(() => {
    if (open) form.reset(editing
      ? { ...editing, subtype: editing.subtype ?? '', brand: editing.brand ?? '', year: editing.year ?? undefined, breakdownDescription: editing.breakdownDescription ?? '', repairMaterials: editing.repairMaterials ?? '' }
      : defaultFleet);
  }, [open, editing, category]);
  useEffect(() => { if (valOpen) valForm.reset({ value: 0, date: new Date().toISOString().split('T')[0], notes: '' }); }, [valOpen]);

  const createMutation = useCreateFleetItem({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFleetQueryKey() }); toast({ title: 'Registo criado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar', variant: 'destructive' }),
  }});
  const updateMutation = useUpdateFleetItem({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFleetQueryKey() }); toast({ title: 'Registo atualizado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMutation = useDeleteFleetItem({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFleetQueryKey() }); toast({ title: 'Registo eliminado.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});
  const valMutation = useAddFleetValuation({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFleetQueryKey() }); toast({ title: 'Avaliação registada!' }); setValOpen(false); },
    onError: () => toast({ title: 'Erro ao registar avaliação', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof fleetSchema>) => {
    const data = { ...values, subtype: values.subtype || null, brand: values.brand || null, year: values.year || null, breakdownDescription: values.breakdownDescription || null, repairMaterials: values.repairMaterials || null };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate({ data });
  };
  const onValSubmit = (values: z.infer<typeof valuationSchema>) => {
    if (!valItemId) return;
    valMutation.mutate({ id: valItemId, data: { ...values, notes: values.notes || null } });
  };

  // ── Import helpers ──
  const resetImport = () => { setImportJson(''); setImportParseError(null); setImportStatus('idle'); setImportRows([]); setImportProgress(0); importCancelRef.current = false; };
  const handleImportClose = () => {
    if (importStatus === 'importing') return;
    importCancelRef.current = true;
    setImportOpen(false);
    if (importStatus === 'done') queryClient.invalidateQueries({ queryKey: getListFleetQueryKey() });
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
        await createFleetItem({ identifier: p.identificador, type: p.tipo, subtype: p.subtipo ?? null, brand: p.marca ?? null, year: p.ano ?? null, status: p.estado ?? 'ativo', breakdownDescription: p.descricao_avaria ?? null, repairMaterials: p.materiais_reparacao ?? null });
        updated[idx] = { ...updated[idx], importStatus: 'ok' };
      } catch (err) {
        updated[idx] = { ...updated[idx], importStatus: 'error', importError: err instanceof Error ? err.message : 'Erro' };
      }
      done++; setImportProgress(done); setImportRows([...updated]);
    }
    setImportStatus('done');
    queryClient.invalidateQueries({ queryKey: getListFleetQueryKey() });
  };

  const validCount = importRows.filter(r => r.valid).length;
  const invalidCount = importRows.filter(r => !r.valid).length;
  const okCount = importRows.filter(r => r.importStatus === 'ok').length;
  const errCount = importRows.filter(r => r.importStatus === 'error').length;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const availableTypes = categoryTypes(category);
  const importFormat = category === 'embarcacoes' ? BOAT_FORMAT : VEHICLE_FORMAT;

  const isBoat = category === 'embarcacoes';

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

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-[18px] py-3.5 border-b border-border flex-wrap">
            <div className="relative w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Procurar por identificador, marca ou classe..." className="pl-9 h-[34px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] h-[34px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {availableTypes.map(t => <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-[34px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {Object.entries(statusLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <span className="font-mono text-[10.5px] tracking-wide uppercase text-muted-foreground whitespace-nowrap">
              {filteredFleet.length} {filteredFleet.length === 1 ? 'registo' : 'registos'}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identificador</TableHead>
                <TableHead>Tipo</TableHead>
                {isBoat && <TableHead>Classe</TableHead>}
                <TableHead>Marca / Ano</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Valor Atual</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isBoat ? 7 : 6} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : filteredFleet.length === 0 ? (
                <TableRow><TableCell colSpan={isBoat ? 7 : 6} className="text-center py-8 text-muted-foreground">Nenhum registo encontrado.</TableCell></TableRow>
              ) : filteredFleet.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.identifier}</TableCell>
                  <TableCell>{typeLabels[item.type] || item.type}</TableCell>
                  {isBoat && <TableCell>{item.subtype || '—'}</TableCell>}
                  <TableCell>{item.brand || '—'}{item.year ? ` / ${item.year}` : ''}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'ativo' ? 'success' : item.status === 'manutencao' ? 'warning' : 'destructive' as any}>
                      {statusLabels[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.currentValue ? `${item.currentValue.toLocaleString('pt-PT')} €` : '—'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setValItemId(item.id); setValOpen(true); }}>
                      <Euro className="w-3 h-3 mr-1" />Avaliar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(item); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar registo?</AlertDialogTitle>
                          <AlertDialogDescription>Elimina <strong>{item.identifier}</strong>. Esta ação não pode ser desfeita.</AlertDialogDescription>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Registo' : 'Novo Registo'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="identifier" render={({ field }) => (
                <FormItem><FormLabel>Identificador *</FormLabel><FormControl><Input placeholder="AAC-001" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {availableTypes.map(v => <SelectItem key={v} value={v}>{typeLabels[v]}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                {isBoat && (
                  <FormField control={form.control} name="subtype" render={({ field }) => (
                    <FormItem><FormLabel>Classe</FormLabel><FormControl><Input placeholder="1x, 2x, 4+..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="brand" render={({ field }) => (
                  <FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="year" render={({ field }) => (
                  <FormItem><FormLabel>Ano</FormLabel><FormControl><Input type="number" min={1900} max={2099} {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Estado *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(statusLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="breakdownDescription" render={({ field }) => (
                <FormItem><FormLabel>Descrição da Avaria</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="repairMaterials" render={({ field }) => (
                <FormItem><FormLabel>Materiais de Reparação</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'A guardar...' : editing ? 'Guardar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Valuation dialog ── */}
      <Dialog open={valOpen} onOpenChange={setValOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registar Avaliação</DialogTitle></DialogHeader>
          <Form {...valForm}>
            <form onSubmit={valForm.handleSubmit(onValSubmit)} className="space-y-4">
              <FormField control={valForm.control} name="value" render={({ field }) => (<FormItem><FormLabel>Valor (€) *</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={valForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Data *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={valForm.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setValOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={valMutation.isPending}>{valMutation.isPending ? 'A guardar...' : 'Registar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Import dialog ── */}
      <Dialog open={importOpen} onOpenChange={handleImportClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar {isBoat ? 'Embarcações' : 'Viaturas'} via JSON</DialogTitle>
            <DialogDescription>Cole um array JSON com os registos a importar.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
            {importStatus === 'idle' && (
              <div className="flex flex-col gap-3 flex-1">
                <Textarea
                  className="flex-1 font-mono text-xs resize-none min-h-[200px]"
                  placeholder={importFormat}
                  value={importJson}
                  onChange={e => { setImportJson(e.target.value); setImportParseError(null); }}
                />
                {importParseError && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{importParseError}</p>
                )}
                <JsonFormatHint example={importFormat} />
                {isBoat ? (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p><strong>tipo</strong>: <code className="bg-muted px-1 rounded">barco_remo</code> | <code className="bg-muted px-1 rounded">barco_motor</code></p>
                    <p><strong>estado</strong>: <code className="bg-muted px-1 rounded">ativo</code> | <code className="bg-muted px-1 rounded">manutencao</code> | <code className="bg-muted px-1 rounded">avariado</code> | <code className="bg-muted px-1 rounded">fora_servico</code></p>
                    <p><strong>subtipo</strong>: classe do barco (ex: <code className="bg-muted px-1 rounded">1x</code>, <code className="bg-muted px-1 rounded">2x</code>, <code className="bg-muted px-1 rounded">4+</code>, <code className="bg-muted px-1 rounded">8+</code>)</p>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p><strong>tipo</strong>: <code className="bg-muted px-1 rounded">carrinha</code> | <code className="bg-muted px-1 rounded">atrelado</code> | <code className="bg-muted px-1 rounded">bicicleta</code></p>
                    <p><strong>estado</strong>: <code className="bg-muted px-1 rounded">ativo</code> | <code className="bg-muted px-1 rounded">manutencao</code> | <code className="bg-muted px-1 rounded">avariado</code> | <code className="bg-muted px-1 rounded">fora_servico</code></p>
                  </div>
                )}
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
                        <TableHead>Identificador</TableHead>
                        <TableHead>Tipo</TableHead>
                        {isBoat && <TableHead>Classe</TableHead>}
                        <TableHead>Marca / Ano</TableHead>
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
                            <TableCell className="text-sm font-medium">{row.valid ? row.parsed!.identificador : String(raw?.identificador ?? '—')}</TableCell>
                            <TableCell className="text-xs">{row.valid ? (typeLabels[row.parsed!.tipo] ?? row.parsed!.tipo) : String(raw?.tipo ?? '—')}</TableCell>
                            {isBoat && <TableCell className="text-xs">{row.valid ? (row.parsed!.subtipo ?? '—') : String(raw?.subtipo ?? '—')}</TableCell>}
                            <TableCell className="text-xs">{row.valid ? `${row.parsed!.marca ?? '—'}${row.parsed!.ano ? ` / ${row.parsed!.ano}` : ''}` : '—'}</TableCell>
                            <TableCell className="text-xs">{row.valid ? statusLabels[row.parsed!.estado ?? 'ativo'] : '—'}</TableCell>
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
            {importStatus === 'previewing' && (<><Button variant="outline" onClick={() => setImportStatus('idle')}>← Voltar</Button><Button onClick={handleImport} disabled={validCount === 0}>Importar {validCount} registo{validCount !== 1 ? 's' : ''}</Button></>)}
            {importStatus === 'importing' && (<Button variant="outline" disabled><Loader2 className="w-4 h-4 mr-2 animate-spin" />A importar…</Button>)}
            {importStatus === 'done' && (<><Button variant="outline" onClick={() => { setImportStatus('idle'); setImportJson(''); setImportRows([]); setImportProgress(0); }}>Nova Importação</Button><Button onClick={handleImportClose}>Fechar</Button></>)}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
