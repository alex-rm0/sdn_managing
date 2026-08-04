import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListCrews, useCreateCrew, useUpdateCrew, useDeleteCrew, getListCrewsQueryKey, useListSeasons, useListAthletes } from '@workspace/api-client-react';
import type { Crew } from '@workspace/api-client-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Plus } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  boatClass: z.enum(['1x', '2x', '2-', '4x', '4-', '4+', '8+']),
  category: z.string().min(1, 'Categoria obrigatória'),
  seasonId: z.coerce.number().min(1, 'Época obrigatória'),
  athleteIds: z.array(z.number()).optional(),
});

const defaultValues = { name: '', boatClass: '1x' as const, category: '', seasonId: 0, athleteIds: [] as number[] };

export default function CrewsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Crew | null>(null);
  const [search, setSearch] = useState('');

  const { data: crews, isLoading } = useListCrews();
  const { data: seasons } = useListSeasons();
  const { data: athletes } = useListAthletes();

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) form.reset(editing ? { name: editing.name, boatClass: editing.boatClass, category: editing.category, seasonId: editing.seasonId, athleteIds: editing.athleteIds ?? [] } : defaultValues);
  }, [open, editing]);

  const createMutation = useCreateCrew({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCrewsQueryKey() }); toast({ title: 'Tripulação criada!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar tripulação', variant: 'destructive' }),
  }});
  const updateMutation = useUpdateCrew({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCrewsQueryKey() }); toast({ title: 'Tripulação atualizada!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMutation = useDeleteCrew({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCrewsQueryKey() }); toast({ title: 'Tripulação eliminada.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof schema>) => {
    if (editing) updateMutation.mutate({ id: editing.id, data: values });
    else createMutation.mutate({ data: values });
  };

  const filtered = crews?.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.boatClass.includes(search));
  const isPending = createMutation.isPending || updateMutation.isPending;
  const athleteIds = form.watch('athleteIds') ?? [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-end items-center">
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Nova Tripulação</Button>
        </div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-[18px] py-3.5 border-b border-border flex-wrap">
            <div className="relative w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Procurar tripulação..." className="pl-9 h-[34px]" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex-1" />
            <span className="font-mono text-[10.5px] tracking-wide uppercase text-muted-foreground whitespace-nowrap">
              {filtered?.length ?? 0} tripulações
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Barco</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Época</TableHead>
                <TableHead>Atletas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma tripulação encontrada.</TableCell></TableRow>
              ) : filtered?.map(crew => (
                <TableRow key={crew.id}>
                  <TableCell className="font-medium">{crew.name}</TableCell>
                  <TableCell><Badge variant="outline">{crew.boatClass}</Badge></TableCell>
                  <TableCell>{crew.category}</TableCell>
                  <TableCell>{crew.seasonName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{crew.athletes?.map(a => a.name).join(', ') || '-'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(crew); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Eliminar tripulação?</AlertDialogTitle><AlertDialogDescription>Elimina <strong>{crew.name}</strong>. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: crew.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
          <DialogHeader><DialogTitle>{editing ? 'Editar Tripulação' : 'Nova Tripulação'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="boatClass" render={({ field }) => (
                  <FormItem><FormLabel>Classe de Barco *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{['1x','2x','2-','4x','4-','4+','8+'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Categoria *</FormLabel><FormControl><Input placeholder="Sénior" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="seasonId" render={({ field }) => (
                <FormItem><FormLabel>Época *</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar época" /></SelectTrigger></FormControl>
                    <SelectContent>{seasons?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="athleteIds" render={() => (
                <FormItem>
                  <FormLabel>Atletas</FormLabel>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {athletes?.map(athlete => (
                      <div key={athlete.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={athleteIds.includes(athlete.id)}
                          onCheckedChange={checked => {
                            const current = form.getValues('athleteIds') ?? [];
                            form.setValue('athleteIds', checked ? [...current, athlete.id] : current.filter(id => id !== athlete.id));
                          }}
                        />
                        <span className="text-sm">{athlete.name} <span className="text-muted-foreground text-xs">({athlete.category || '-'})</span></span>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
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
