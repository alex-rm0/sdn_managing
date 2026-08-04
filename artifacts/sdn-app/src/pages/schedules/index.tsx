import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListTrainingSchedules, useCreateTrainingSchedule, useUpdateTrainingSchedule, useDeleteTrainingSchedule, getListTrainingSchedulesQueryKey, useListSeasons, useListUsers } from '@workspace/api-client-react';
import type { TrainingSchedule } from '@workspace/api-client-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

const DAYS = [{ value: 1, label: 'Segunda' }, { value: 2, label: 'Terça' }, { value: 3, label: 'Quarta' }, { value: 4, label: 'Quinta' }, { value: 5, label: 'Sexta' }, { value: 6, label: 'Sábado' }, { value: 0, label: 'Domingo' }];
const TYPE_LABELS: Record<string, string> = { agua: 'Água', ginasio: 'Ginásio', ergometro: 'Ergómetro', outro: 'Outro' };

const schema = z.object({
  seasonId: z.coerce.number().min(1, 'Época obrigatória'),
  groupCategory: z.string().min(1, 'Categoria obrigatória'),
  daysOfWeek: z.array(z.number()).min(1, 'Selecionar pelo menos um dia'),
  startTime: z.string().min(1, 'Hora de início obrigatória'),
  endTime: z.string().min(1, 'Hora de fim obrigatória'),
  trainingType: z.enum(['agua', 'ginasio', 'ergometro', 'outro']),
  trainerIds: z.array(z.number()).optional(),
  notes: z.string().nullable().optional(),
});

const defaultValues = { seasonId: 0, groupCategory: '', daysOfWeek: [] as number[], startTime: '07:00', endTime: '09:00', trainingType: 'agua' as const, trainerIds: [] as number[], notes: '' };

export default function SchedulesList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingSchedule | null>(null);
  const { data: schedules, isLoading } = useListTrainingSchedules();
  const { data: seasons } = useListSeasons();
  const { data: users } = useListUsers();
  const trainers = users?.filter(u => u.role === 'trainer') ?? [];

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });
  const daysOfWeek = form.watch('daysOfWeek') ?? [];
  const trainerIds = form.watch('trainerIds') ?? [];

  useEffect(() => {
    if (open) form.reset(editing ? { ...editing, notes: editing.notes ?? '', trainerIds: editing.trainerIds ?? [] } : defaultValues);
  }, [open, editing]);

  const createMutation = useCreateTrainingSchedule({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTrainingSchedulesQueryKey() }); toast({ title: 'Horário criado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar horário', variant: 'destructive' }),
  }});
  const updateMutation = useUpdateTrainingSchedule({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTrainingSchedulesQueryKey() }); toast({ title: 'Horário atualizado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMutation = useDeleteTrainingSchedule({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTrainingSchedulesQueryKey() }); toast({ title: 'Horário eliminado.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof schema>) => {
    const data = { ...values, notes: values.notes || null };
    if (editing) updateMutation.mutate({ id: editing.id, data: { daysOfWeek: data.daysOfWeek, startTime: data.startTime, endTime: data.endTime, trainingType: data.trainingType, trainerIds: data.trainerIds, notes: data.notes } });
    else createMutation.mutate({ data });
  };

  const getDaysString = (days: number[]) => DAYS.filter(d => days.includes(d.value)).map(d => d.label.slice(0, 3)).join(', ');
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-end items-center">
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Horário</Button>
        </div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo / Categoria</TableHead>
                <TableHead>Dias da Semana</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Treinadores</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : schedules?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum horário registado.</TableCell></TableRow>
              ) : schedules?.map(sched => (
                <TableRow key={sched.id}>
                  <TableCell className="font-medium">{sched.groupCategory}</TableCell>
                  <TableCell className="text-sm">{getDaysString(sched.daysOfWeek)}</TableCell>
                  <TableCell className="font-mono text-xs">{sched.startTime} – {sched.endTime}</TableCell>
                  <TableCell><Badge variant="outline">{TYPE_LABELS[sched.trainingType] || sched.trainingType}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{sched.trainerIds?.length ? sched.trainerIds.map(id => users?.find(u => u.id === id)?.name ?? `#${id}`).join(', ') : '-'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(sched); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Eliminar horário?</AlertDialogTitle><AlertDialogDescription>Elimina o horário de <strong>{sched.groupCategory}</strong>. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: sched.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Horário' : 'Novo Horário'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="seasonId" render={({ field }) => (
                  <FormItem><FormLabel>Época *</FormLabel>
                    <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ''} disabled={!!editing}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                      <SelectContent>{seasons?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="groupCategory" render={({ field }) => (<FormItem><FormLabel>Categoria *</FormLabel><FormControl><Input placeholder="Sénior" {...field} disabled={!!editing} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="daysOfWeek" render={() => (
                <FormItem>
                  <FormLabel>Dias da Semana *</FormLabel>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {DAYS.map(day => (
                      <div key={day.value} className="flex items-center gap-1.5">
                        <Checkbox checked={daysOfWeek.includes(day.value)} onCheckedChange={checked => {
                          const cur = form.getValues('daysOfWeek');
                          form.setValue('daysOfWeek', checked ? [...cur, day.value] : cur.filter(d => d !== day.value));
                        }} />
                        <span className="text-sm">{day.label}</span>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="startTime" render={({ field }) => (<FormItem><FormLabel>Início *</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="endTime" render={({ field }) => (<FormItem><FormLabel>Fim *</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="trainingType" render={({ field }) => (
                  <FormItem><FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              {trainers.length > 0 && (
                <FormField control={form.control} name="trainerIds" render={() => (
                  <FormItem>
                    <FormLabel>Treinadores</FormLabel>
                    <div className="border rounded-md p-3 space-y-2">
                      {trainers.map(t => (
                        <div key={t.id} className="flex items-center gap-2">
                          <Checkbox checked={trainerIds.includes(t.id)} onCheckedChange={checked => {
                            const cur = form.getValues('trainerIds') ?? [];
                            form.setValue('trainerIds', checked ? [...cur, t.id] : cur.filter(id => id !== t.id));
                          }} />
                          <span className="text-sm">{t.name}</span>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
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
