import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListCompetitions, useCreateCompetition, useUpdateCompetition, useDeleteCompetition, getListCompetitionsQueryKey,
  useListRaces, useCreateRace, useUpdateRace, useDeleteRace,
  useListSeasons,
} from '@workspace/api-client-react';
import type { Competition, Race } from '@workspace/api-client-react';
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
import { Plus, ChevronDown, ChevronRight, Upload, Loader2 } from 'lucide-react';

interface ImportRace {
  name: string;
  modality?: string;
  distance?: string;
  category?: string;
}
interface ImportComp {
  name: string;
  seasonId: number;
  startDate: string;
  endDate?: string;
  location?: string;
  organizer?: string;
  races?: ImportRace[];
}

const compSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  seasonId: z.coerce.number().min(1, 'Época obrigatória'),
  startDate: z.string().min(1, 'Data obrigatória'),
  endDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  organizer: z.string().nullable().optional(),
});

const raceSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  modality: z.string().nullable().optional(),
  distance: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
});

// Sub-component to show races for a competition
function CompetitionRaces({ competitionId, competitionName }: { competitionId: number; competitionName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [raceOpen, setRaceOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);

  const { data: races, isLoading } = useListRaces({ competitionId });
  const form = useForm<z.infer<typeof raceSchema>>({ resolver: zodResolver(raceSchema), defaultValues: { name: '', modality: '', distance: '', category: '' } });

  useEffect(() => {
    if (raceOpen) form.reset(editingRace ? { name: editingRace.name, modality: editingRace.modality ?? '', distance: editingRace.distance ?? '', category: editingRace.category ?? '' } : { name: '', modality: '', distance: '', category: '' });
  }, [raceOpen, editingRace]);

  const createRaceMutation = useCreateRace({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/races'] }); toast({ title: 'Prova criada!' }); setRaceOpen(false); },
    onError: () => toast({ title: 'Erro ao criar prova', variant: 'destructive' }),
  }});
  const updateRaceMutation = useUpdateRace({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/races'] }); toast({ title: 'Prova atualizada!' }); setRaceOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteRaceMutation = useDeleteRace({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/races'] }); toast({ title: 'Prova eliminada.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof raceSchema>) => {
    const data = { name: values.name, competitionId, modality: values.modality || null, distance: values.distance || null, category: values.category || null };
    if (editingRace) updateRaceMutation.mutate({ id: editingRace.id, data: { name: data.name, modality: data.modality, distance: data.distance, category: data.category } });
    else createRaceMutation.mutate({ data });
  };

  return (
    <div className="pl-4 pr-2 pb-3 border-t bg-muted/30">
      <div className="flex justify-between items-center py-2">
        <span className="text-sm font-medium text-muted-foreground">Provas de {competitionName}</span>
        <Button size="sm" variant="outline" onClick={() => { setEditingRace(null); setRaceOpen(true); }}><Plus className="w-3 h-3 mr-1" /> Nova Prova</Button>
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">A carregar...</p> : races?.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Sem provas registadas.</p>
      ) : (
        <div className="space-y-1">
          {races?.map(race => (
            <div key={race.id} className="flex items-center justify-between text-sm bg-card rounded px-3 py-1.5 border">
              <div>
                <span className="font-medium">{race.name}</span>
                {race.modality && <span className="ml-2 text-muted-foreground text-xs">{race.modality}</span>}
                {race.distance && <Badge variant="outline" className="ml-2 text-xs">{race.distance}</Badge>}
                {race.category && <span className="ml-2 text-muted-foreground text-xs">{race.category}</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditingRace(race); setRaceOpen(true); }}>Editar</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Eliminar prova?</AlertDialogTitle><AlertDialogDescription>Elimina <strong>{race.name}</strong>.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteRaceMutation.mutate({ id: race.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={raceOpen} onOpenChange={setRaceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingRace ? 'Editar Prova' : 'Nova Prova'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome *</FormLabel><FormControl><Input placeholder="K1 1000m Sénior M" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="modality" render={({ field }) => (<FormItem><FormLabel>Modalidade</FormLabel><FormControl><Input placeholder="Canoagem" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="distance" render={({ field }) => (<FormItem><FormLabel>Distância</FormLabel><FormControl><Input placeholder="1000m" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Categoria</FormLabel><FormControl><Input placeholder="Sénior M" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRaceOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createRaceMutation.isPending || updateRaceMutation.isPending}>{(createRaceMutation.isPending || updateRaceMutation.isPending) ? 'A guardar...' : editingRace ? 'Guardar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CompetitionsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Competition | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [importPreview, setImportPreview] = useState<ImportComp[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const { data: competitions, isLoading } = useListCompetitions();
  const { data: seasons } = useListSeasons();

  const form = useForm<z.infer<typeof compSchema>>({ resolver: zodResolver(compSchema), defaultValues: { name: '', seasonId: 0, startDate: '', endDate: '', location: '', organizer: '' } });

  useEffect(() => {
    if (open) form.reset(editing ? { ...editing, endDate: editing.endDate ?? '', location: editing.location ?? '', organizer: editing.organizer ?? '' } : { name: '', seasonId: 0, startDate: '', endDate: '', location: '', organizer: '' });
  }, [open, editing]);

  const createMutation = useCreateCompetition({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCompetitionsQueryKey() }); toast({ title: 'Competição criada!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar competição', variant: 'destructive' }),
  }});
  const updateMutation = useUpdateCompetition({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCompetitionsQueryKey() }); toast({ title: 'Competição atualizada!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMutation = useDeleteCompetition({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCompetitionsQueryKey() }); toast({ title: 'Competição eliminada.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof compSchema>) => {
    const data = { ...values, endDate: values.endDate || null, location: values.location || null, organizer: values.organizer || null };
    if (editing) updateMutation.mutate({ id: editing.id, data: { name: data.name, location: data.location, startDate: data.startDate, endDate: data.endDate, organizer: data.organizer } });
    else createMutation.mutate({ data });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (jsonInputRef.current) jsonInputRef.current.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const arr: ImportComp[] = Array.isArray(data) ? data : [data];
        if (!arr.length || !arr[0].name) throw new Error('Formato inválido');
        setImportPreview(arr);
      } catch {
        toast({ title: 'JSON inválido', description: 'O ficheiro não tem o formato esperado.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setIsImporting(true);
    let created = 0;
    try {
      for (const comp of importPreview) {
        const { races, ...compData } = comp;
        const newComp = await createMutation.mutateAsync({ data: {
          name: compData.name,
          seasonId: compData.seasonId,
          startDate: compData.startDate,
          endDate: compData.endDate ?? null,
          location: compData.location ?? null,
          organizer: compData.organizer ?? null,
        }});
        if (races?.length) {
          for (const race of races) {
            await createRaceMutation.mutateAsync({ data: {
              name: race.name,
              competitionId: (newComp as any).id,
              modality: race.modality ?? null,
              distance: race.distance ?? null,
              category: race.category ?? null,
            }});
          }
        }
        created++;
      }
      queryClient.invalidateQueries({ queryKey: getListCompetitionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ['/api/races'] });
      toast({ title: `${created} competição${created !== 1 ? 'ões' : ''} importada${created !== 1 ? 's' : ''}` });
      setImportPreview(null);
    } catch {
      toast({ title: 'Erro durante importação', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Competições</h1>
          <div className="flex gap-2">
            <input ref={jsonInputRef} type="file" accept=".json" className="hidden" onChange={handleJsonFile} />
            <Button variant="outline" size="sm" onClick={() => jsonInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Importar JSON
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Nova Competição
            </Button>
          </div>
        </div>
        <div className="bg-card rounded-md border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Datas</TableHead>
                <TableHead>Época</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : competitions?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma competição registada.</TableCell></TableRow>
              ) : competitions?.map(comp => (
                <>
                  <TableRow key={comp.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => setExpanded(expanded === comp.id ? null : comp.id)}>
                      {expanded === comp.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-medium" onClick={() => setExpanded(expanded === comp.id ? null : comp.id)}>{comp.name}</TableCell>
                    <TableCell>{comp.location || '-'}</TableCell>
                    <TableCell className="text-sm">{comp.startDate}{comp.endDate ? ` → ${comp.endDate}` : ''}</TableCell>
                    <TableCell>{comp.seasonName}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(comp); setOpen(true); }}>Editar</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Eliminar competição?</AlertDialogTitle><AlertDialogDescription>Elimina <strong>{comp.name}</strong> e todas as suas provas.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: comp.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                  {expanded === comp.id && (
                    <TableRow key={`races-${comp.id}`}>
                      <TableCell colSpan={6} className="p-0">
                        <CompetitionRaces competitionId={comp.id} competitionName={comp.name} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Competição' : 'Nova Competição'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="seasonId" render={({ field }) => (
                <FormItem><FormLabel>Época *</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ''} disabled={!!editing}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar época" /></SelectTrigger></FormControl>
                    <SelectContent>{seasons?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Data Início *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem><FormLabel>Data Fim</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Local</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="organizer" render={({ field }) => (<FormItem><FormLabel>Organizador</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'A guardar...' : editing ? 'Guardar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── JSON import preview dialog ── */}
      <Dialog open={!!importPreview} onOpenChange={v => !v && setImportPreview(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Confirmar importação</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-1 pr-1">
            {importPreview?.map((comp, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-1.5">
                <p className="font-medium text-sm">{comp.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{comp.startDate}{comp.endDate ? ` → ${comp.endDate}` : ''}</span>
                  {comp.location && <span>{comp.location}</span>}
                  {comp.organizer && <span>{comp.organizer}</span>}
                  <span>Época #{comp.seasonId}</span>
                </div>
                {comp.races && comp.races.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-3 border-l-2 border-muted">
                    {comp.races.map((r, j) => (
                      <li key={j} className="text-xs text-muted-foreground">
                        {r.name}
                        {r.modality && <span className="ml-1 opacity-60">· {r.modality}</span>}
                        {r.distance && <span className="ml-1 opacity-60">· {r.distance}</span>}
                        {r.category && <span className="ml-1 opacity-60">· {r.category}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setImportPreview(null)}>Cancelar</Button>
            <Button onClick={handleImportConfirm} disabled={isImporting}>
              {isImporting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A importar…</>
                : `Importar ${importPreview?.length ?? 0} competição${(importPreview?.length ?? 0) !== 1 ? 'ões' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
