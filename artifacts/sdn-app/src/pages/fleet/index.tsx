import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListFleet, useCreateFleetItem, useUpdateFleetItem, useDeleteFleetItem, useAddFleetValuation, getListFleetQueryKey } from '@workspace/api-client-react';
import type { FleetItem } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Euro } from 'lucide-react';

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

const defaultFleet = { identifier: '', type: 'barco_remo' as const, subtype: '', brand: '', year: undefined as number | undefined, status: 'ativo' as const, breakdownDescription: '', repairMaterials: '' };

const typeLabels: Record<string, string> = { barco_remo: 'Barco a Remo', barco_motor: 'Barco a Motor', bicicleta: 'Bicicleta', atrelado: 'Atrelado', carrinha: 'Carrinha' };
const statusLabels: Record<string, string> = { ativo: 'Ativo', manutencao: 'Em Manutenção', avariado: 'Avariado', fora_servico: 'Fora de Serviço' };

export default function FleetList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FleetItem | null>(null);
  const [valOpen, setValOpen] = useState(false);
  const [valItemId, setValItemId] = useState<number | null>(null);

  const { data: fleet, isLoading } = useListFleet();
  const form = useForm<z.infer<typeof fleetSchema>>({ resolver: zodResolver(fleetSchema), defaultValues: defaultFleet });
  const valForm = useForm<z.infer<typeof valuationSchema>>({ resolver: zodResolver(valuationSchema), defaultValues: { value: 0, date: new Date().toISOString().split('T')[0], notes: '' } });

  useEffect(() => {
    if (open) form.reset(editing ? { ...editing, subtype: editing.subtype ?? '', brand: editing.brand ?? '', year: editing.year ?? undefined, breakdownDescription: editing.breakdownDescription ?? '', repairMaterials: editing.repairMaterials ?? '' } : defaultFleet);
  }, [open, editing]);
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

  const statusVariant = (s: string) => s === 'ativo' ? 'success' : s === 'manutencao' ? 'warning' : 'destructive';
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Frota / Embarcações</h1>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Registo</Button>
        </div>
        <div className="bg-card rounded-md border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identificador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Marca / Ano</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Valor Atual</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : fleet?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registo encontrado.</TableCell></TableRow>
              ) : fleet?.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.identifier}</TableCell>
                  <TableCell>{typeLabels[item.type] || item.type}{item.subtype ? ` (${item.subtype})` : ''}</TableCell>
                  <TableCell>{item.brand || '-'} {item.year ? `/ ${item.year}` : ''}</TableCell>
                  <TableCell><Badge variant={statusVariant(item.status) as any}>{statusLabels[item.status]}</Badge></TableCell>
                  <TableCell>{item.currentValue ? `${item.currentValue.toLocaleString('pt-PT')} €` : '-'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setValItemId(item.id); setValOpen(true); }}><Euro className="w-3 h-3 mr-1" />Avaliar</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(item); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Eliminar registo?</AlertDialogTitle><AlertDialogDescription>Elimina <strong>{item.identifier}</strong>. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
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

      {/* Fleet item dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Registo' : 'Novo Registo'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="identifier" render={({ field }) => (<FormItem><FormLabel>Identificador *</FormLabel><FormControl><Input placeholder="AAC-001" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{Object.entries(typeLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subtype" render={({ field }) => (<FormItem><FormLabel>Subtipo / Classe</FormLabel><FormControl><Input placeholder="K1" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="brand" render={({ field }) => (<FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="year" render={({ field }) => (<FormItem><FormLabel>Ano</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Estado *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(statusLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="breakdownDescription" render={({ field }) => (<FormItem><FormLabel>Descrição da Avaria</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="repairMaterials" render={({ field }) => (<FormItem><FormLabel>Materiais de Reparação</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'A guardar...' : editing ? 'Guardar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Valuation dialog */}
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
    </>
  );
}
