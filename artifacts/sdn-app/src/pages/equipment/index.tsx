import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment, getListEquipmentQueryKey } from '@workspace/api-client-react';
import type { Equipment } from '@workspace/api-client-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

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

export default function EquipmentList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const { data: equipment, isLoading } = useListEquipment();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) form.reset(editing ? { ...editing, assignedTo: editing.assignedTo ?? '', acquisitionDate: editing.acquisitionDate ?? '', notes: editing.notes ?? '' } : defaultValues);
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

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Equipamento</h1>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Registo</Button>
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
                  <TableCell>{item.totalQuantity} / <span className={item.availableQuantity === 0 ? 'text-destructive font-bold' : ''}>{item.availableQuantity}</span></TableCell>
                  <TableCell><Badge variant={item.status === 'bom' ? 'success' : item.status === 'desgastado' ? 'warning' : 'destructive'}>{item.status.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell>{item.assignedTo || '-'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(item); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Eliminar equipamento?</AlertDialogTitle><AlertDialogDescription>Elimina <strong>{item.name}</strong>. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Categoria *</FormLabel><FormControl><Input placeholder="Vestuário" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Estado *</FormLabel><FormControl><Input placeholder="bom" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
    </>
  );
}
