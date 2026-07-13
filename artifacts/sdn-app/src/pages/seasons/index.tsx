import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListSeasons, useCreateSeason, useUpdateSeason, useDeleteSeason, getListSeasonsQueryKey } from '@workspace/api-client-react';
import type { Season } from '@workspace/api-client-react';
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
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  startDate: z.string().min(1, 'Data de início obrigatória'),
  endDate: z.string().min(1, 'Data de fim obrigatória'),
  active: z.boolean().optional(),
});

const defaultValues = { name: '', startDate: '', endDate: '', active: false };

export default function SeasonsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const { data: seasons, isLoading } = useListSeasons();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) form.reset(editing ? { ...editing } : defaultValues);
  }, [open, editing]);

  const createMutation = useCreateSeason({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSeasonsQueryKey() }); toast({ title: 'Época criada!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar época', variant: 'destructive' }),
  }});
  const updateMutation = useUpdateSeason({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSeasonsQueryKey() }); toast({ title: 'Época atualizada!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMutation = useDeleteSeason({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSeasonsQueryKey() }); toast({ title: 'Época eliminada.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof schema>) => {
    if (editing) updateMutation.mutate({ id: editing.id, data: values });
    else createMutation.mutate({ data: values });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Épocas Desportivas</h1>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Nova Época</Button>
        </div>
        <div className="bg-card rounded-md border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : seasons?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma época registada.</TableCell></TableRow>
              ) : seasons?.map(season => (
                <TableRow key={season.id}>
                  <TableCell className="font-medium">{season.name}</TableCell>
                  <TableCell>{season.startDate}</TableCell>
                  <TableCell>{season.endDate}</TableCell>
                  <TableCell><Badge variant={season.active ? 'success' : 'secondary'}>{season.active ? 'Atual' : 'Fechada'}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(season); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Eliminar época?</AlertDialogTitle><AlertDialogDescription>Elimina a época <strong>{season.name}</strong>. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: season.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Época' : 'Nova Época'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input placeholder="2025/2026" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem><FormLabel>Data de Início *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem><FormLabel>Data de Fim *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="!mt-0">Época atual</FormLabel>
                </FormItem>
              )} />
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
