import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListFinancialMovements, useCreateFinancialMovement, useUpdateFinancialMovement, useDeleteFinancialMovement, getListFinancialMovementsQueryKey,
  useGetFinancialSummary, useListSeasons,
  useListQuotaPlans, useCreateQuotaPlan, useUpdateQuotaPlan, useDeleteQuotaPlan, getListQuotaPlansQueryKey,
} from '@workspace/api-client-react';
import type { FinancialMovement, QuotaPlan } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Download } from 'lucide-react';

const movSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  category: z.string().min(1, 'Categoria obrigatória'),
  description: z.string().min(1, 'Descrição obrigatória'),
  amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
  date: z.string().min(1, 'Data obrigatória'),
  seasonId: z.coerce.number().nullable().optional(),
  documentUrl: z.string().nullable().optional(),
});

const planSchema = z.object({
  seasonId: z.coerce.number().min(1, 'Época obrigatória'),
  category: z.string().min(1, 'Categoria obrigatória'),
  amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
  periodicity: z.enum(['anual', 'mensal', 'trimestral']),
  dueDay: z.coerce.number().min(1).max(31).nullable().optional(),
});

const fmt = (n: number) => n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export default function FinancialList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [movOpen, setMovOpen] = useState(false);
  const [editingMov, setEditingMov] = useState<FinancialMovement | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<QuotaPlan | null>(null);

  const { data: movements, isLoading } = useListFinancialMovements();
  const { data: summary } = useGetFinancialSummary();
  const { data: seasons } = useListSeasons();
  const { data: plans, isLoading: loadingPlans } = useListQuotaPlans();

  const movForm = useForm<z.infer<typeof movSchema>>({ resolver: zodResolver(movSchema), defaultValues: { type: 'receita', category: '', description: '', amount: 0, date: new Date().toISOString().split('T')[0], seasonId: null, documentUrl: '' } });
  const planForm = useForm<z.infer<typeof planSchema>>({ resolver: zodResolver(planSchema), defaultValues: { seasonId: 0, category: '', amount: 0, periodicity: 'mensal', dueDay: null } });

  useEffect(() => {
    if (movOpen) movForm.reset(editingMov ? { ...editingMov, seasonId: editingMov.seasonId ?? null, documentUrl: editingMov.documentUrl ?? '' } : { type: 'receita', category: '', description: '', amount: 0, date: new Date().toISOString().split('T')[0], seasonId: null, documentUrl: '' });
  }, [movOpen, editingMov]);
  useEffect(() => {
    if (planOpen) planForm.reset(editingPlan ? { ...editingPlan, dueDay: editingPlan.dueDay ?? null } : { seasonId: 0, category: '', amount: 0, periodicity: 'mensal', dueDay: null });
  }, [planOpen, editingPlan]);

  const createMovMutation = useCreateFinancialMovement({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFinancialMovementsQueryKey() }); toast({ title: 'Movimento criado!' }); setMovOpen(false); },
    onError: () => toast({ title: 'Erro ao criar', variant: 'destructive' }),
  }});
  const updateMovMutation = useUpdateFinancialMovement({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFinancialMovementsQueryKey() }); toast({ title: 'Movimento atualizado!' }); setMovOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMovMutation = useDeleteFinancialMovement({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFinancialMovementsQueryKey() }); toast({ title: 'Movimento eliminado.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});
  const createPlanMutation = useCreateQuotaPlan({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotaPlansQueryKey() }); toast({ title: 'Plano criado!' }); setPlanOpen(false); },
    onError: () => toast({ title: 'Erro ao criar plano', variant: 'destructive' }),
  }});
  const updatePlanMutation = useUpdateQuotaPlan({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotaPlansQueryKey() }); toast({ title: 'Plano atualizado!' }); setPlanOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deletePlanMutation = useDeleteQuotaPlan({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotaPlansQueryKey() }); toast({ title: 'Plano eliminado.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onMovSubmit = (values: z.infer<typeof movSchema>) => {
    const data = { ...values, seasonId: values.seasonId || null, documentUrl: values.documentUrl || null };
    if (editingMov) updateMovMutation.mutate({ id: editingMov.id, data });
    else createMovMutation.mutate({ data });
  };
  const onPlanSubmit = (values: z.infer<typeof planSchema>) => {
    const data = { ...values, dueDay: values.dueDay || null };
    if (editingPlan) updatePlanMutation.mutate({ id: editingPlan.id, data: { amount: data.amount, periodicity: data.periodicity, dueDay: data.dueDay } });
    else createPlanMutation.mutate({ data });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        </div>

        <Tabs defaultValue="movimentos">
          <TabsList><TabsTrigger value="movimentos">Movimentos</TabsTrigger><TabsTrigger value="planos">Planos de Quota</TabsTrigger></TabsList>

          <TabsContent value="movimentos" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <div />
              <Button size="sm" onClick={() => { setEditingMov(null); setMovOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Movimento</Button>
            </div>
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Receitas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{fmt(summary.totalRevenue)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Despesas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{fmt(summary.totalExpenses)}</div></CardContent></Card>
                <Card className="bg-primary text-primary-foreground"><CardHeader className="pb-2"><CardTitle className="text-sm opacity-80">Balanço</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(summary.balance)}</div></CardContent></Card>
              </div>
            )}
            <div className="bg-card rounded-md border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
                  ) : movements?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem movimentos registados.</TableCell></TableRow>
                  ) : movements?.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>{m.date}</TableCell>
                      <TableCell><Badge variant={m.type === 'receita' ? 'success' : 'destructive'} className="uppercase text-[10px]">{m.type}</Badge></TableCell>
                      <TableCell>{m.category}</TableCell>
                      <TableCell>{m.description}</TableCell>
                      <TableCell className={`text-right font-medium ${m.type === 'receita' ? 'text-green-600' : 'text-destructive'}`}>{m.type === 'receita' ? '+' : '-'}{fmt(m.amount)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingMov(m); setMovOpen(true); }}>Editar</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Eliminar movimento?</AlertDialogTitle><AlertDialogDescription>Elimina <strong>{m.description}</strong>.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMovMutation.mutate({ id: m.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="planos" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <div />
              <Button size="sm" onClick={() => { setEditingPlan(null); setPlanOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Plano</Button>
            </div>
            <div className="bg-card rounded-md border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Época</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Dia Vencimento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPlans ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
                  ) : plans?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum plano definido.</TableCell></TableRow>
                  ) : plans?.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.seasonName}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell className="font-medium">{fmt(p.amount)}</TableCell>
                      <TableCell className="capitalize">{p.periodicity}</TableCell>
                      <TableCell>{p.dueDay ? `Dia ${p.dueDay}` : '-'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingPlan(p); setPlanOpen(true); }}>Editar</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Eliminar plano?</AlertDialogTitle><AlertDialogDescription>Elimina o plano de quota de <strong>{p.category}</strong>.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deletePlanMutation.mutate({ id: p.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Movement dialog */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingMov ? 'Editar Movimento' : 'Novo Movimento'}</DialogTitle></DialogHeader>
          <Form {...movForm}>
            <form onSubmit={movForm.handleSubmit(onMovSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={movForm.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={movForm.control} name="category" render={({ field }) => (<FormItem><FormLabel>Categoria *</FormLabel><FormControl><Input placeholder="Quotas" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={movForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrição *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={movForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Valor (€) *</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={movForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Data *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={movForm.control} name="seasonId" render={({ field }) => (
                <FormItem><FormLabel>Época</FormLabel>
                  <Select onValueChange={v => field.onChange(v ? parseInt(v) : null)} value={field.value ? String(field.value) : ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="">Nenhuma</SelectItem>{seasons?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={movForm.control} name="documentUrl" render={({ field }) => (<FormItem><FormLabel>URL do Documento</FormLabel><FormControl><Input placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMovOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMovMutation.isPending || updateMovMutation.isPending}>{(createMovMutation.isPending || updateMovMutation.isPending) ? 'A guardar...' : editingMov ? 'Guardar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Plan dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano de Quota'}</DialogTitle></DialogHeader>
          <Form {...planForm}>
            <form onSubmit={planForm.handleSubmit(onPlanSubmit)} className="space-y-4">
              <FormField control={planForm.control} name="seasonId" render={({ field }) => (
                <FormItem><FormLabel>Época *</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ''} disabled={!!editingPlan}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                    <SelectContent>{seasons?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={planForm.control} name="category" render={({ field }) => (<FormItem><FormLabel>Categoria *</FormLabel><FormControl><Input placeholder="Sénior" {...field} disabled={!!editingPlan} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={planForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Valor (€) *</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={planForm.control} name="periodicity" render={({ field }) => (
                  <FormItem><FormLabel>Periodicidade *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="trimestral">Trimestral</SelectItem><SelectItem value="anual">Anual</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={planForm.control} name="dueDay" render={({ field }) => (<FormItem><FormLabel>Dia de Vencimento (1-31)</FormLabel><FormControl><Input type="number" min={1} max={31} {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPlanOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createPlanMutation.isPending || updatePlanMutation.isPending}>{(createPlanMutation.isPending || updatePlanMutation.isPending) ? 'A guardar...' : editingPlan ? 'Guardar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
