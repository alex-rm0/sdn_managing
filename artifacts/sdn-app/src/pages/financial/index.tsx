import { useState, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, Search, TrendingUp, TrendingDown, Scale, Check, ChevronsUpDown, Pencil, Trash2, X } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function monthLabel(dateStr: string) {
  const [year, month] = dateStr.split('-');
  return `${MONTHS_PT[+month - 1]} ${year}`;
}

// ── SearchableSelect (same pattern as quotas page) ────────────────────────────

interface SelectOption { value: string; label: string }

function SearchableSelect({ options, value, onChange, placeholder, className = 'w-[190px]' }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void;
  placeholder: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={`${className} justify-between font-normal`}>
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Pesquisar…" />
          <CommandEmpty>Sem resultados.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {options.map(o => (
                <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={`mr-2 h-4 w-4 ${value === o.value ? 'opacity-100' : 'opacity-0'}`} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Schemas ───────────────────────────────────────────────────────────────────

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FinancialPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  // ── Filters ───────────────────────────────────────────────────────────────
  const [seasonId, setSeasonId] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'receita' | 'despesa'>('all');
  const [categorySearch, setCategorySearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [movOpen, setMovOpen] = useState(false);
  const [editingMov, setEditingMov] = useState<FinancialMovement | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<QuotaPlan | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: seasons = [] } = useListSeasons();
  const { data: movements = [], isLoading } = useListFinancialMovements(
    seasonId ? { seasonId: +seasonId } : {}
  );
  const { data: summary } = useGetFinancialSummary(
    seasonId ? { seasonId: +seasonId } : {}
  );
  const { data: plans = [], isLoading: loadingPlans } = useListQuotaPlans(
    seasonId ? { seasonId: +seasonId } : {}
  );

  // Auto-select most recent season
  useEffect(() => {
    if (seasons.length && !seasonId) setSeasonId(String(seasons[0].id));
  }, [seasons]);

  const movForm = useForm<z.infer<typeof movSchema>>({
    resolver: zodResolver(movSchema),
    defaultValues: { type: 'receita', category: '', description: '', amount: 0, date: today, seasonId: null, documentUrl: '' },
  });
  const planForm = useForm<z.infer<typeof planSchema>>({
    resolver: zodResolver(planSchema),
    defaultValues: { seasonId: 0, category: '', amount: 0, periodicity: 'mensal', dueDay: null },
  });

  useEffect(() => {
    if (movOpen) movForm.reset(editingMov
      ? { ...editingMov, seasonId: editingMov.seasonId ?? null, documentUrl: editingMov.documentUrl ?? '' }
      : { type: 'receita', category: '', description: '', amount: 0, date: today, seasonId: seasonId ? +seasonId : null, documentUrl: '' }
    );
  }, [movOpen, editingMov]);

  useEffect(() => {
    if (planOpen) planForm.reset(editingPlan
      ? { ...editingPlan, dueDay: editingPlan.dueDay ?? null }
      : { seasonId: seasonId ? +seasonId : 0, category: '', amount: 0, periodicity: 'mensal', dueDay: null }
    );
  }, [planOpen, editingPlan]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidateMov = () => qc.invalidateQueries({ queryKey: getListFinancialMovementsQueryKey() });
  const invalidatePlans = () => qc.invalidateQueries({ queryKey: getListQuotaPlansQueryKey() });

  const createMovMutation = useCreateFinancialMovement();
  const updateMovMutation = useUpdateFinancialMovement();
  const deleteMovMutation = useDeleteFinancialMovement();
  const createPlanMutation = useCreateQuotaPlan();
  const updatePlanMutation = useUpdateQuotaPlan();
  const deletePlanMutation = useDeleteQuotaPlan();

  const onMovSubmit = (values: z.infer<typeof movSchema>) => {
    const data = { ...values, seasonId: values.seasonId || null, documentUrl: values.documentUrl || null };
    if (editingMov) {
      updateMovMutation.mutate({ id: editingMov.id, data }, {
        onSuccess: () => { invalidateMov(); toast({ title: 'Movimento atualizado' }); setMovOpen(false); },
        onError: () => toast({ title: 'Erro ao guardar', variant: 'destructive' }),
      });
    } else {
      createMovMutation.mutate({ data }, {
        onSuccess: () => { invalidateMov(); toast({ title: 'Movimento criado' }); setMovOpen(false); },
        onError: () => toast({ title: 'Erro ao criar', variant: 'destructive' }),
      });
    }
  };

  const onPlanSubmit = (values: z.infer<typeof planSchema>) => {
    const data = { ...values, dueDay: values.dueDay || null };
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data: { amount: data.amount, periodicity: data.periodicity, dueDay: data.dueDay } }, {
        onSuccess: () => { invalidatePlans(); toast({ title: 'Plano atualizado' }); setPlanOpen(false); },
        onError: () => toast({ title: 'Erro ao guardar', variant: 'destructive' }),
      });
    } else {
      createPlanMutation.mutate({ data }, {
        onSuccess: () => { invalidatePlans(); toast({ title: 'Plano criado' }); setPlanOpen(false); },
        onError: () => toast({ title: 'Erro ao criar', variant: 'destructive' }),
      });
    }
  };

  const handleDeleteMov = (m: FinancialMovement) => {
    deleteMovMutation.mutate({ id: m.id }, {
      onSuccess: () => { invalidateMov(); toast({ title: 'Movimento eliminado' }); },
      onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
    });
  };

  const handleDeletePlan = (p: QuotaPlan) => {
    deletePlanMutation.mutate({ id: p.id }, {
      onSuccess: () => { invalidatePlans(); toast({ title: 'Plano eliminado' }); },
      onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
    });
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return movements.filter(m => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (categorySearch && !m.category.toLowerCase().includes(categorySearch.toLowerCase()) &&
          !m.description.toLowerCase().includes(categorySearch.toLowerCase())) return false;
      if (dateFrom && m.date < dateFrom) return false;
      if (dateTo && m.date > dateTo) return false;
      return true;
    });
  }, [movements, typeFilter, categorySearch, dateFrom, dateTo]);

  // Group by month (YYYY-MM)
  const grouped = useMemo(() => {
    const map = new Map<string, FinancialMovement[]>();
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
    for (const m of sorted) {
      const key = m.date.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()]; // [[YYYY-MM, movements[]], ...]
  }, [filtered]);

  const seasonOptions: SelectOption[] = seasons.map(s => ({ value: String(s.id), label: s.name }));

  const isMovSaving = createMovMutation.isPending || updateMovMutation.isPending;
  const isPlanSaving = createPlanMutation.isPending || updatePlanMutation.isPending;
  const hasFilters = typeFilter !== 'all' || categorySearch || dateFrom || dateTo;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <SearchableSelect
            options={seasonOptions} value={seasonId} onChange={setSeasonId}
            placeholder="Selecionar época" className="w-[180px]"
          />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receitas</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{fmt(summary?.totalRevenue ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Despesas</span>
              </div>
              <p className="text-2xl font-bold text-destructive">{fmt(summary?.totalExpenses ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className={`${(summary?.balance ?? 0) >= 0 ? 'border-primary/30 bg-primary/5' : 'border-red-300 bg-red-50'}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Balanço</span>
              </div>
              <p className={`text-2xl font-bold ${(summary?.balance ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {fmt(summary?.balance ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="movimentos">
          <TabsList>
            <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
            <TabsTrigger value="planos">Planos de Quota</TabsTrigger>
          </TabsList>

          {/* ── Movimentos tab ── */}
          <TabsContent value="movimentos" className="space-y-4 mt-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Type tabs */}
              <div className="flex border-b">
                {(['all','receita','despesa'] as const).map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${
                      typeFilter === t
                        ? 'border-primary text-primary font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}>
                    {t === 'all' ? 'Todos' : t === 'receita' ? 'Receitas' : 'Despesas'}
                    {t !== 'all' && (
                      <span className={`ml-1.5 text-[11px] rounded-full px-1.5 font-medium bg-muted`}>
                        {movements.filter(m => m.type === t).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Category/description search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Categoria ou descrição…" value={categorySearch}
                    onChange={e => setCategorySearch(e.target.value)}
                    className="pl-8 w-[220px] h-8 text-sm" />
                </div>
                {/* Date range toggle */}
                <Button variant="outline" size="sm"
                  className={`h-8 ${(dateFrom || dateTo) ? 'border-primary text-primary' : ''}`}
                  onClick={() => setShowDateFilter(v => !v)}>
                  Datas {(dateFrom || dateTo) && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary" />}
                </Button>
                {hasFilters && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                    onClick={() => { setTypeFilter('all'); setCategorySearch(''); setDateFrom(''); setDateTo(''); }}>
                    <X className="w-3 h-3 mr-1" /> Limpar
                  </Button>
                )}
                <Button size="sm" onClick={() => { setEditingMov(null); setMovOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1.5" /> Novo movimento
                </Button>
              </div>
            </div>

            {/* Date range inputs */}
            {showDateFilter && (
              <div className="flex gap-2 items-center flex-wrap pb-1">
                <label className="text-xs text-muted-foreground">De</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-sm" />
                <label className="text-xs text-muted-foreground">até</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-sm" />
              </div>
            )}

            {/* Movements list */}
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">A carregar…</p>
            ) : !seasonId ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Seleciona uma época para ver os movimentos</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground mb-3">
                  {movements.length === 0 ? 'Ainda não há movimentos para esta época' : 'Nenhum resultado para estes filtros'}
                </p>
                {!hasFilters && (
                  <Button variant="outline" size="sm" onClick={() => { setEditingMov(null); setMovOpen(true); }}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Registar primeiro movimento
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map(([monthKey, items]) => {
                  const totalReceitas = items.filter(m => m.type === 'receita').reduce((s, m) => s + m.amount, 0);
                  const totalDespesas = items.filter(m => m.type === 'despesa').reduce((s, m) => s + m.amount, 0);
                  const balance = totalReceitas - totalDespesas;
                  return (
                    <div key={monthKey}>
                      {/* Month header */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold">{monthLabel(monthKey + '-01')}</span>
                        <div className="flex-1 h-px bg-border" />
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {totalReceitas > 0 && <span className="text-green-600">+{fmt(totalReceitas)}</span>}
                          {totalDespesas > 0 && <span className="text-destructive">-{fmt(totalDespesas)}</span>}
                          <span className={`font-medium ${balance >= 0 ? 'text-foreground' : 'text-destructive'}`}>{fmt(balance)}</span>
                        </div>
                      </div>

                      {/* Month movements */}
                      <div className="border rounded-lg overflow-hidden divide-y">
                        {items.map(m => (
                          <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 group transition-colors">
                            {/* Date */}
                            <span className="text-xs text-muted-foreground w-20 shrink-0 tabular-nums">
                              {m.date.split('-').reverse().join('/')}
                            </span>
                            {/* Type indicator */}
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.type === 'receita' ? 'bg-green-500' : 'bg-red-400'}`} />
                            {/* Category */}
                            <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{m.category}</span>
                            {/* Description */}
                            <span className="flex-1 text-sm truncate">{m.description}</span>
                            {/* Amount */}
                            <span className={`text-sm font-semibold tabular-nums shrink-0 ${m.type === 'receita' ? 'text-green-600' : 'text-destructive'}`}>
                              {m.type === 'receita' ? '+' : '−'}{fmt(m.amount)}
                            </span>
                            {/* Actions */}
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => { setEditingMov(m); setMovOpen(true); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Eliminar movimento?</AlertDialogTitle>
                                    <AlertDialogDescription>Elimina <strong>{m.description}</strong> de {fmt(m.amount)}.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteMov(m)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Planos tab ── */}
          <TabsContent value="planos" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {seasonId ? `${plans.length} plano${plans.length !== 1 ? 's' : ''} para esta época` : 'Seleciona uma época'}
              </p>
              <Button size="sm" onClick={() => { setEditingPlan(null); setPlanOpen(true); }}>
                <Plus className="w-4 h-4 mr-1.5" /> Novo plano
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Época</TableHead>
                    <TableHead>Categoria / Escalão</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Dia vencimento</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPlans ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar…</TableCell></TableRow>
                  ) : plans.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {seasonId ? 'Nenhum plano para esta época.' : 'Seleciona uma época para ver os planos.'}
                    </TableCell></TableRow>
                  ) : plans.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{p.seasonName}</TableCell>
                      <TableCell className="font-medium">{p.category}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{fmt(p.amount)}</TableCell>
                      <TableCell className="capitalize text-sm">{p.periodicity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.dueDay ? `Dia ${p.dueDay}` : '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setEditingPlan(p); setPlanOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar plano?</AlertDialogTitle>
                                <AlertDialogDescription>Elimina o plano <strong>{p.category}</strong>.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeletePlan(p)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Movement dialog ── */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingMov ? 'Editar movimento' : 'Novo movimento'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-1">
            <Form {...movForm}>
              <form id="mov-form" onSubmit={movForm.handleSubmit(onMovSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={movForm.control} name="type" render={({ field }) => (
                    <FormItem><FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="receita">Receita</SelectItem>
                          <SelectItem value="despesa">Despesa</SelectItem>
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={movForm.control} name="category" render={({ field }) => (
                    <FormItem><FormLabel>Categoria *</FormLabel>
                      <FormControl><Input placeholder="Quotas, Subsídios…" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={movForm.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Descrição *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={movForm.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Valor (€) *</FormLabel>
                      <FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={movForm.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Data *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={movForm.control} name="seasonId" render={({ field }) => (
                  <FormItem><FormLabel>Época</FormLabel>
                    <Select onValueChange={v => field.onChange(v ? parseInt(v) : null)} value={field.value ? String(field.value) : ''}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhuma</SelectItem>
                        {seasons.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={movForm.control} name="documentUrl" render={({ field }) => (
                  <FormItem><FormLabel>URL do documento</FormLabel>
                    <FormControl><Input placeholder="https://…" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </form>
            </Form>
          </div>
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setMovOpen(false)}>Cancelar</Button>
            <Button type="submit" form="mov-form" disabled={isMovSaving}>
              {isMovSaving ? 'A guardar…' : editingMov ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Plan dialog ── */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar plano' : 'Novo plano de quota'}</DialogTitle>
          </DialogHeader>
          <Form {...planForm}>
            <form onSubmit={planForm.handleSubmit(onPlanSubmit)} className="space-y-4">
              <FormField control={planForm.control} name="seasonId" render={({ field }) => (
                <FormItem><FormLabel>Época *</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ''} disabled={!!editingPlan}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                    <SelectContent>{seasons.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={planForm.control} name="category" render={({ field }) => (
                <FormItem><FormLabel>Categoria / Escalão *</FormLabel>
                  <FormControl><Input placeholder="Sénior, Sub-14, Juvenis…" {...field} disabled={!!editingPlan} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={planForm.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel>Valor (€) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={planForm.control} name="periodicity" render={({ field }) => (
                  <FormItem><FormLabel>Periodicidade *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={planForm.control} name="dueDay" render={({ field }) => (
                <FormItem><FormLabel>Dia de vencimento (1–31)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={31} {...field} value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPlanOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPlanSaving}>
                  {isPlanSaving ? 'A guardar…' : editingPlan ? 'Guardar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
