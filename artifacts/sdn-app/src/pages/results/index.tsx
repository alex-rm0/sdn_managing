import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListResults, useCreateResult, useUpdateResult, useDeleteResult, getListResultsQueryKey,
  useListAthletes, useListCrews, useListSeasons, useListRaces, useListCompetitions,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trophy, Medal } from 'lucide-react';

const schema = z.object({
  raceId: z.coerce.number().min(1, 'Prova obrigatória'),
  athleteId: z.coerce.number().nullable().optional(),
  crewId: z.coerce.number().nullable().optional(),
  position: z.coerce.number().min(1).nullable().optional(),
  time: z.string().nullable().optional(),
  points: z.coerce.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const defaultValues = { raceId: 0, athleteId: null as number | null, crewId: null as number | null, position: null as number | null, time: '', points: null as number | null, notes: '' };

const positionBadge = (pos: number | null | undefined) => {
  if (!pos) return '-';
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

  const { data: results, isLoading } = useListResults({ seasonId: seasonFilter ? parseInt(seasonFilter) : undefined, competitionId: compFilter ? parseInt(compFilter) : undefined });
  const { data: athletes } = useListAthletes();
  const { data: crews } = useListCrews();
  const { data: seasons } = useListSeasons();
  const { data: competitions } = useListCompetitions({ seasonId: seasonFilter ? parseInt(seasonFilter) : undefined });
  const { data: races } = useListRaces({ competitionId: compFilter ? parseInt(compFilter) : undefined });

  const victories = results?.filter(r => r.position === 1).length ?? 0;
  const podiums = results?.filter(r => r.position && r.position <= 3).length ?? 0;

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({ raceId: editing.raceId, athleteId: editing.athleteId ?? null, crewId: editing.crewId ?? null, position: editing.position ?? null, time: editing.time ?? '', points: editing.points ?? null, notes: editing.notes ?? '' });
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
    const data = { raceId: values.raceId, athleteId: values.athleteId || null, crewId: values.crewId || null, position: values.position || null, time: values.time || null, points: values.points || null, notes: values.notes || null };
    if (editing) updateMutation.mutate({ id: editing.id, data: { position: data.position, time: data.time, points: data.points, notes: data.notes } });
    else createMutation.mutate({ data });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Resultados</h1>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Registar Resultado</Button>
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
                <TableHead>Competição</TableHead>
                <TableHead>Prova</TableHead>
                <TableHead>Atleta / Tripulação</TableHead>
                <TableHead>Posição</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Pontos</TableHead>
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
                  <TableCell className="font-medium">{result.competitionName || '-'}</TableCell>
                  <TableCell>{result.raceName || '-'}</TableCell>
                  <TableCell>{result.athleteName || result.crewName || '-'}</TableCell>
                  <TableCell>{positionBadge(result.position)}</TableCell>
                  <TableCell className="font-mono text-xs">{result.time || '-'}</TableCell>
                  <TableCell>{result.points ?? '-'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(result); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Eliminar resultado?</AlertDialogTitle><AlertDialogDescription>Elimina o resultado de <strong>{result.athleteName || result.crewName}</strong>.</AlertDialogDescription></AlertDialogHeader>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Resultado' : 'Novo Resultado'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="raceId" render={({ field }) => (
                <FormItem><FormLabel>Prova *</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ''} disabled={!!editing}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar prova" /></SelectTrigger></FormControl>
                    <SelectContent>{races?.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name} {r.competitionName ? `— ${r.competitionName}` : ''}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="athleteId" render={({ field }) => (
                <FormItem><FormLabel>Atleta</FormLabel>
                  <Select onValueChange={v => field.onChange(v ? parseInt(v) : null)} value={field.value ? String(field.value) : ''} disabled={!!editing}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar atleta (opcional)" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {athletes?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="crewId" render={({ field }) => (
                <FormItem><FormLabel>Tripulação</FormLabel>
                  <Select onValueChange={v => field.onChange(v ? parseInt(v) : null)} value={field.value ? String(field.value) : ''} disabled={!!editing}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar tripulação (opcional)" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {crews?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="position" render={({ field }) => (<FormItem><FormLabel>Posição</FormLabel><FormControl><Input type="number" min={1} {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="time" render={({ field }) => (<FormItem><FormLabel>Tempo</FormLabel><FormControl><Input placeholder="3:45.23" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="points" render={({ field }) => (<FormItem><FormLabel>Pontos</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'A guardar...' : editing ? 'Guardar' : 'Registar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
