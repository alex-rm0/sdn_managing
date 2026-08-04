import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListSeasons, useCreateSeason, useUpdateSeason, useDeleteSeason, getListSeasonsQueryKey, useListCompetitions } from '@workspace/api-client-react';
import type { Season } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  startDate: z.string().min(1, 'Data de início obrigatória'),
  endDate: z.string().min(1, 'Data de fim obrigatória'),
  active: z.boolean().optional(),
});

const defaultValues = { name: '', startDate: '', endDate: '', active: false };

type FilterTab = 'todas' | 'atual' | 'arquivadas';

export default function SeasonsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('todas');
  const { data: seasons, isLoading } = useListSeasons();
  const { data: competitions = [] } = useListCompetitions();
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

  const competitionsBySeasonId = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of competitions) map.set(c.seasonId, (map.get(c.seasonId) ?? 0) + 1);
    return map;
  }, [competitions]);

  const filteredSeasons = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (seasons ?? [])
      .filter(s => filter === 'todas' || (filter === 'atual' ? s.active : !s.active))
      .filter(s => !q || s.name.toLowerCase().includes(q));
  }, [seasons, search, filter]);

  return (
    <>
      <div className="flex flex-col gap-[22px]">
        <div className="flex items-end gap-5">
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-[10.5px] tracking-widest uppercase text-brand-cyan">Desporto</p>
            <p className="text-sm text-muted-foreground max-w-lg">
              Cada época agrupa atletas, sessões, competições e quotas do respetivo ano letivo.
            </p>
          </div>
          <div className="flex-1" />
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nova Época
          </Button>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-[18px] py-3.5 border-b border-border flex-wrap">
            <div className="relative w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Procurar época…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-[34px]"
              />
            </div>
            <div className="flex gap-1 p-[3px] bg-muted rounded-lg">
              {(['todas', 'atual', 'arquivadas'] as FilterTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={cn(
                    'h-7 px-3 rounded-md font-mono text-[10.5px] font-semibold tracking-wide uppercase transition-colors',
                    filter === tab
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab === 'todas' ? 'Todas' : tab === 'atual' ? 'Atual' : 'Arquivadas'}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <span className="font-mono text-[10.5px] tracking-wide uppercase text-muted-foreground">
              {filteredSeasons.length} {filteredSeasons.length === 1 ? 'época' : 'épocas'}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Competições</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : filteredSeasons.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma época encontrada.</TableCell></TableRow>
              ) : filteredSeasons.map(season => (
                <TableRow key={season.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className={cn('w-[3px] h-6 rounded-sm', season.active ? 'bg-brand-cyan' : 'bg-border')} />
                      <span className="font-semibold">{season.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{season.startDate}</TableCell>
                  <TableCell className="font-mono text-xs">{season.endDate}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {competitionsBySeasonId.get(season.id) ?? 0}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      'font-mono text-[10px] font-semibold tracking-wide uppercase px-2 py-1 rounded-md',
                      season.active ? 'bg-brand-cyan-bg text-brand-cyan-dark' : 'bg-muted text-muted-foreground'
                    )}>
                      {season.active ? 'Atual' : 'Arquivada'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {!season.active && (
                      <Button
                        variant="ghost" size="sm"
                        className="text-brand-cyan-dark hover:text-brand-cyan-dark"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: season.id, data: { active: true } })}
                      >
                        Tornar atual
                      </Button>
                    )}
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
