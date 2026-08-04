import { useState, useEffect, useMemo, Fragment } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListQuotas, useCreatePayment, useListSeasons, useListQuotaPlans, useGenerateQuotas,
} from '@workspace/api-client-react';
import type { Quota } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, ChevronLeft, ChevronRight, Search, Zap, Loader2 } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Cores consistentes por escalão (cicla se houver mais de 6)
const ESCALAO_COLORS = [
  { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700'   },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700' },
  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700'  },
  { bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-700',badge: 'bg-emerald-100 text-emerald-700'},
  { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-700',   badge: 'bg-rose-100 text-rose-700'   },
  { bg: 'bg-cyan-50',   border: 'border-cyan-200',   text: 'text-cyan-700',   badge: 'bg-cyan-100 text-cyan-700'   },
];

function escalaoColor(index: number) {
  return ESCALAO_COLORS[index % ESCALAO_COLORS.length];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const periodStr = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

function parsePeriod(p: string): { year: number; month: number } | null {
  const m = p.match(/^(\d{4})-(\d{2})$/);
  return m ? { year: +m[1], month: +m[2] } : null;
}

const STATUS_LABEL: Record<string, string> = { pago: 'Pago', parcial: 'Parcial', em_atraso: 'Em atraso', pendente: 'Pendente' };
const STATUS_VARIANT: Record<string, string> = { pago: 'success', parcial: 'warning', em_atraso: 'destructive', pendente: 'secondary' };

// ── SearchableSelect ──────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string }

function SearchableSelect({ options, value, onChange, placeholder, className = 'w-[200px]' }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void;
  placeholder: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className={`${className} justify-between font-normal`}>
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
                <CommandItem key={o.value} value={o.label}
                  onSelect={() => { onChange(o.value); setOpen(false); }}>
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

const paySchema = z.object({
  amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
  date: z.string().min(1, 'Data obrigatória'),
  method: z.enum(['numerario', 'transferencia', 'mbway', 'outro']).nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── Matrix cell ───────────────────────────────────────────────────────────────

function MatrixCell({ quota, onClick }: { quota: Quota | undefined; onClick: () => void }) {
  if (!quota) return <td className="border px-2 py-1.5 text-center text-muted-foreground/25 text-xs select-none">—</td>;
  const colors: Record<string, string> = {
    pago:      'bg-green-100 text-green-700 hover:bg-green-200',
    parcial:   'bg-amber-100 text-amber-700 hover:bg-amber-200',
    em_atraso: 'bg-red-100 text-red-700 hover:bg-red-200',
    pendente:  'bg-muted text-muted-foreground hover:bg-muted/80',
  };
  return (
    <td className={`border px-1 py-1.5 text-center cursor-pointer transition-colors ${colors[quota.status] ?? 'bg-muted'}`}
      onClick={onClick} title={`${STATUS_LABEL[quota.status]} — ${fmt(quota.amountOwed ?? 0)} em falta`}>
      <span className="text-[10px] font-medium leading-none">
        {quota.status === 'pago' ? '✓' : quota.status === 'em_atraso' ? '!' : quota.status === 'parcial' ? '½' : '·'}
      </span>
    </td>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuotasList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [seasonId, setSeasonId] = useState('');
  const [viewMode, setViewMode] = useState<'month' | 'overview'>('month');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pago' | 'parcial' | 'em_atraso' | 'pendente'>('all');
  const [search, setSearch] = useState('');

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [payOpen, setPayOpen] = useState(false);
  const [selectedQuota, setSelectedQuota] = useState<Quota | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genPlanId, setGenPlanId] = useState('');

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: seasons = [] } = useListSeasons();
  const { data: quotaPlans = [] } = useListQuotaPlans();
  const { data: quotas = [], isLoading } = useListQuotas(
    seasonId ? { seasonId: +seasonId } : {}
  );
  const invalidate = () => qc.invalidateQueries({ queryKey: ['/api/quotas'] });

  useEffect(() => {
    if (seasons.length && !seasonId) setSeasonId(String(seasons[0].id));
  }, [seasons]);

  const generateMutation = useGenerateQuotas();
  const paymentMutation = useCreatePayment();

  const payForm = useForm<z.infer<typeof paySchema>>({
    resolver: zodResolver(paySchema),
    defaultValues: { amount: 0, date: today.toISOString().split('T')[0], method: null, notes: '' },
  });

  useEffect(() => {
    if (payOpen && selectedQuota) {
      payForm.reset({
        amount: selectedQuota.amountOwed ?? selectedQuota.amountDue - selectedQuota.amountPaid,
        date: today.toISOString().split('T')[0],
        method: null,
        notes: '',
      });
    }
  }, [payOpen, selectedQuota]);

  // ── Period ────────────────────────────────────────────────────────────────
  const currentPeriod = periodStr(year, month);
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // ── Escalões (sorted list of unique categories in this season) ────────────
  const escalaoList = useMemo(() => {
    const seen = new Set<string>();
    quotas.forEach(q => { if (q.category) seen.add(q.category); });
    return [...seen].sort((a, b) => a.localeCompare(b, 'pt'));
  }, [quotas]);

  // Index map so each escalão always gets the same colour
  const escalaoIndex = useMemo(() => {
    const m = new Map<string, number>();
    escalaoList.forEach((e, i) => m.set(e, i));
    return m;
  }, [escalaoList]);

  // ── Month view: quotas for this period, grouped by escalão ───────────────
  const monthQuotas = useMemo(() =>
    quotas.filter(q => q.period === currentPeriod),
    [quotas, currentPeriod]
  );

  const filteredMonthQuotas = useMemo(() =>
    monthQuotas.filter(q => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (search && !q.athleteName?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [monthQuotas, statusFilter, search]
  );

  // Grouped: [ [escalão, quotas[]], ... ] — "Sem escalão" last
  const groupedMonth = useMemo(() => {
    const map = new Map<string, Quota[]>();
    filteredMonthQuotas.forEach(q => {
      const key = q.category ?? 'Sem escalão';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    });
    // Sort: known escalões first (by escalaoList order), then "Sem escalão"
    const entries = [...map.entries()];
    entries.sort(([a], [b]) => {
      const ai = escalaoList.indexOf(a);
      const bi = escalaoList.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'pt');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return entries;
  }, [filteredMonthQuotas, escalaoList]);

  const monthSummary = useMemo(() => ({
    pago: monthQuotas.filter(q => q.status === 'pago').length,
    parcial: monthQuotas.filter(q => q.status === 'parcial').length,
    em_atraso: monthQuotas.filter(q => q.status === 'em_atraso').length,
    pendente: monthQuotas.filter(q => q.status === 'pendente').length,
    total: monthQuotas.length,
  }), [monthQuotas]);

  // ── Matrix: athletes grouped by escalão ──────────────────────────────────
  const matrixGrouped = useMemo(() => {
    // athlete id → {name, category}
    const seen = new Map<number, { name: string; category: string }>();
    quotas.forEach(q => {
      if (q.athleteId && q.athleteName && !seen.has(q.athleteId))
        seen.set(q.athleteId, { name: q.athleteName, category: q.category ?? 'Sem escalão' });
    });
    const byEscalao = new Map<string, { id: number; name: string }[]>();
    seen.forEach(({ name, category }, id) => {
      if (!byEscalao.has(category)) byEscalao.set(category, []);
      byEscalao.get(category)!.push({ id, name });
    });
    // Sort athletes within each group
    byEscalao.forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name, 'pt')));
    // Sort groups: known escalões first
    const entries = [...byEscalao.entries()];
    entries.sort(([a], [b]) => {
      const ai = escalaoList.indexOf(a);
      const bi = escalaoList.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'pt');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return entries;
  }, [quotas, escalaoList]);

  const matrixLookup = useMemo(() => {
    const map = new Map<string, Quota>();
    quotas.forEach(q => { if (q.period) map.set(`${q.athleteId}:${q.period}`, q); });
    return map;
  }, [quotas]);

  // ── Other derived ─────────────────────────────────────────────────────────
  const seasonOptions: SelectOption[] = seasons.map(s => ({ value: String(s.id), label: s.name }));
  const seasonPlans = useMemo(() =>
    quotaPlans.filter(p => !seasonId || p.seasonId === +seasonId),
    [quotaPlans, seasonId]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openPay = (q: Quota) => { setSelectedQuota(q); setPayOpen(true); };

  const onPaySubmit = (values: z.infer<typeof paySchema>) => {
    if (!selectedQuota) return;
    paymentMutation.mutate(
      { data: { quotaId: selectedQuota.id, amount: values.amount, date: values.date, method: values.method ?? null, notes: values.notes || null } },
      { onSuccess: () => { invalidate(); toast({ title: 'Pagamento registado' }); setPayOpen(false); },
        onError: () => toast({ title: 'Erro ao registar pagamento', variant: 'destructive' }) }
    );
  };

  const handleGenerate = () => {
    if (!seasonId || !genPlanId) return;
    generateMutation.mutate(
      { data: { seasonId: +seasonId, quotaPlanId: +genPlanId, period: currentPeriod } },
      {
        onSuccess: (data: any) => {
          invalidate();
          toast({ title: `${data.length ?? 0} quotas geradas`, description: `${MONTHS_PT[month - 1]} ${year}` });
          setGenOpen(false);
        },
        onError: () => toast({ title: 'Erro ao gerar quotas', variant: 'destructive' }),
      }
    );
  };

  const filterTabs = [
    { key: 'all',      label: 'Todas',      count: monthSummary.total },
    { key: 'em_atraso',label: 'Em atraso',  count: monthSummary.em_atraso },
    { key: 'parcial',  label: 'Parcial',    count: monthSummary.parcial },
    { key: 'pendente', label: 'Pendentes',  count: monthSummary.pendente },
    { key: 'pago',     label: 'Pagas',      count: monthSummary.pago },
  ] as const;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-5">

        {/* ── Top bar: title + epoch + view toggle ── */}
        <div className="flex items-center justify-end gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <SearchableSelect options={seasonOptions} value={seasonId}
              onChange={v => setSeasonId(v)} placeholder="Selecionar época" className="w-[180px]" />
            <div className="flex rounded-md border overflow-hidden">
              <button onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                Por mês
              </button>
              <button onClick={() => setViewMode('overview')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${viewMode === 'overview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                Visão geral
              </button>
            </div>
          </div>
        </div>

        {/* ── Escalões: pill tabs sempre visíveis (quando há dados) ── */}
        {escalaoList.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Escalão</span>
            {escalaoList.map((e, i) => {
              const c = escalaoColor(i);
              return (
                <span key={e} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${c.bg} ${c.border} ${c.text}`}>
                  <span className={`w-2 h-2 rounded-full ${c.badge.split(' ')[0].replace('bg-', 'bg-').replace('100', '400')}`} />
                  {e}
                  <span className="text-xs opacity-60 font-normal">
                    ({quotas.filter(q => q.category === e && q.period === currentPeriod).length})
                  </span>
                </span>
              );
            })}
          </div>
        )}

        {/* ── Month navigation + Gerar ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 border rounded-md overflow-hidden">
            <button className="px-2 py-1.5 hover:bg-muted transition-colors" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-1.5 text-sm font-medium min-w-[140px] text-center">
              {MONTHS_PT[month - 1]} {year}
            </span>
            <button className="px-2 py-1.5 hover:bg-muted transition-colors" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {seasonId && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setGenOpen(true)}>
              <Zap className="w-3.5 h-3.5" /> Gerar quotas
            </Button>
          )}
        </div>

        {/* ════════════════ MONTH VIEW ════════════════ */}
        {viewMode === 'month' && (
          <div className="space-y-4">

            {/* Summary strip */}
            {monthSummary.total > 0 && (
              <div className="flex flex-wrap gap-4 text-sm">
                {monthSummary.pago > 0 && <span className="flex items-center gap-1.5 text-green-700"><span className="w-2 h-2 rounded-full bg-green-500" />{monthSummary.pago} pago{monthSummary.pago !== 1 ? 's' : ''}</span>}
                {monthSummary.parcial > 0 && <span className="flex items-center gap-1.5 text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-400" />{monthSummary.parcial} parcial</span>}
                {monthSummary.em_atraso > 0 && <span className="flex items-center gap-1.5 text-red-700"><span className="w-2 h-2 rounded-full bg-red-500" />{monthSummary.em_atraso} em atraso</span>}
                {monthSummary.pendente > 0 && <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-muted-foreground/40" />{monthSummary.pendente} pendente{monthSummary.pendente !== 1 ? 's' : ''}</span>}
              </div>
            )}

            {/* Status filter tabs + search */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-0 border-b">
                {filterTabs.map(tab => (
                  <button key={tab.key} onClick={() => setStatusFilter(tab.key as any)}
                    className={`px-3 py-2 text-sm border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
                      statusFilter === tab.key
                        ? 'border-primary text-primary font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}>
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`text-[11px] rounded-full px-1.5 font-medium ${statusFilter === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Pesquisar atleta…" value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-8 w-[200px] h-8 text-sm" />
              </div>
            </div>

            {/* Table grouped by escalão */}
            {isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : !seasonId ? (
              <p className="text-center py-10 text-sm text-muted-foreground">Seleciona uma época para ver as quotas</p>
            ) : filteredMonthQuotas.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground mb-3">
                  {monthQuotas.length === 0
                    ? `Ainda não há quotas geradas para ${MONTHS_PT[month - 1]} ${year}`
                    : 'Nenhuma quota corresponde ao filtro'}
                </p>
                {monthQuotas.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => setGenOpen(true)}>
                    <Zap className="w-3.5 h-3.5 mr-1.5" /> Gerar quotas do mês
                  </Button>
                )}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atleta</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Em falta</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedMonth.map(([escalao, rows]) => {
                      const idx = escalaoIndex.get(escalao) ?? 99;
                      const c = escalaoColor(idx);
                      const groupOwed = rows.reduce((s, q) => s + (q.amountOwed ?? 0), 0);
                      return (
                        <Fragment key={escalao}>
                          {/* Escalão section header */}
                          <TableRow className={`${c.bg} hover:${c.bg}`}>
                            <TableCell colSpan={7} className={`py-2 px-4 ${c.text} font-semibold text-sm border-l-4 ${c.border}`}>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.badge.split(' ')[0].replace('bg-', 'bg-').replace('100','400')}`} />
                                  {escalao}
                                  <span className="font-normal opacity-70 text-xs">{rows.length} atleta{rows.length !== 1 ? 's' : ''}</span>
                                </span>
                                {groupOwed > 0 && (
                                  <span className="text-xs font-normal opacity-80">{fmt(groupOwed)} em falta</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Athlete rows */}
                          {rows.map(q => (
                            <TableRow key={`q-${q.id}`} className={q.status === 'pago' ? 'opacity-60' : ''}>
                              <TableCell className="font-medium pl-8">{q.athleteName}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(q.amountDue)}</TableCell>
                              <TableCell className="text-right tabular-nums text-green-600">{fmt(q.amountPaid)}</TableCell>
                              <TableCell className={`text-right tabular-nums font-medium ${(q.amountOwed ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {fmt(q.amountOwed ?? 0)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{q.dueDate || '—'}</TableCell>
                              <TableCell>
                                <Badge variant={STATUS_VARIANT[q.status] as any}>{STATUS_LABEL[q.status]}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {q.status !== 'pago' && (
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openPay(q)}>
                                    Registar pagamento
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ OVERVIEW / MATRIX ════════════════ */}
        {viewMode === 'overview' && (
          <div className="space-y-3">
            {!seasonId ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Seleciona uma época para ver a grelha</p>
            ) : isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : matrixGrouped.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground mb-3">Sem quotas geradas para esta época</p>
                <Button variant="outline" size="sm" onClick={() => setGenOpen(true)}>
                  <Zap className="w-3.5 h-3.5 mr-1.5" /> Gerar quotas do mês
                </Button>
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-200" />Pago</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" />Parcial</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-200" />Em atraso</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-muted border" />Pendente</span>
                  <span className="italic ml-2">Clica numa célula para registar pagamento</span>
                </div>

                <div className="overflow-x-auto border rounded-lg">
                  <table className="text-sm w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="border px-3 py-2 text-left font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 min-w-[180px]">Atleta</th>
                        {MONTHS_SHORT.map((m, i) => (
                          <th key={i} className={`border px-2 py-2 text-center text-xs font-medium min-w-[36px] ${
                            i + 1 === month && year === today.getFullYear() ? 'text-primary bg-primary/5' : 'text-muted-foreground'
                          }`}>{m}</th>
                        ))}
                        <th className="border px-2 py-2 text-right text-xs font-medium text-muted-foreground min-w-[90px]">Em falta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixGrouped.map(([escalao, athletes]) => {
                        const idx = escalaoIndex.get(escalao) ?? 99;
                        const c = escalaoColor(idx);
                        return (
                          <Fragment key={escalao}>
                            {/* Escalão group header row */}
                            <tr className={c.bg}>
                              <td colSpan={15}
                                className={`border-y border-l-4 ${c.border} px-4 py-2 font-semibold text-sm ${c.text}`}>
                                <span className="flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-full ${c.badge.split(' ')[0].replace('bg-','bg-').replace('100','400')}`} />
                                  {escalao}
                                  <span className="font-normal text-xs opacity-60">{athletes.length} atleta{athletes.length !== 1 ? 's' : ''}</span>
                                </span>
                              </td>
                            </tr>

                            {/* Athlete rows */}
                            {athletes.map(athlete => {
                              const totalOwed = Array.from({ length: 12 }, (_, i) => {
                                const q = matrixLookup.get(`${athlete.id}:${periodStr(year, i + 1)}`);
                                return q?.amountOwed ?? 0;
                              }).reduce((a, b) => a + b, 0);

                              return (
                                <tr key={athlete.id} className="hover:bg-muted/20">
                                  <td className={`border px-3 py-1.5 font-medium sticky left-0 bg-background z-10 pl-8`}>
                                    {athlete.name}
                                  </td>
                                  {Array.from({ length: 12 }, (_, i) => {
                                    const p = periodStr(year, i + 1);
                                    const q = matrixLookup.get(`${athlete.id}:${p}`);
                                    return <MatrixCell key={i} quota={q} onClick={() => q && q.status !== 'pago' && openPay(q)} />;
                                  })}
                                  <td className={`border px-2 py-1.5 text-right text-xs tabular-nums ${totalOwed > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                    {totalOwed > 0 ? fmt(totalOwed) : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Generate quotas dialog ── */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Gerar quotas — {MONTHS_PT[month - 1]} {year}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Cria uma quota para <strong>todos os atletas ativos</strong> com o valor do plano selecionado.
              Atletas que já tenham quota para este mês são ignorados.
            </p>
            {seasonPlans.length === 0 ? (
              <p className="text-sm text-destructive">Não há planos de quotas para esta época. Cria um primeiro na página Financeiro.</p>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plano de quotas</label>
                <Select value={genPlanId} onValueChange={setGenPlanId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar plano…" /></SelectTrigger>
                  <SelectContent>
                    {seasonPlans.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.category} — {fmt(p.amount)} ({p.periodicity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={!genPlanId || generateMutation.isPending}>
              {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A gerar…</> : 'Gerar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Payment dialog ── */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registar pagamento</DialogTitle>
            {selectedQuota && (
              <div className="text-sm text-muted-foreground space-y-0.5 pt-1">
                <p className="font-medium text-foreground">{selectedQuota.athleteName}</p>
                {selectedQuota.category && (
                  <p className="text-xs">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${escalaoColor(escalaoIndex.get(selectedQuota.category) ?? 0).badge}`}>
                      {selectedQuota.category}
                    </span>
                  </p>
                )}
                <p>{selectedQuota.seasonName}{selectedQuota.period ? ` · ${MONTHS_PT[(parsePeriod(selectedQuota.period)?.month ?? 1) - 1]} ${parsePeriod(selectedQuota.period)?.year ?? ''}` : ''}</p>
                <p>Em falta: <strong className="text-destructive">{fmt(selectedQuota.amountOwed ?? 0)}</strong></p>
              </div>
            )}
          </DialogHeader>
          <Form {...payForm}>
            <form onSubmit={payForm.handleSubmit(onPaySubmit)} className="space-y-4 pt-1">
              <FormField control={payForm.control} name="amount" render={({ field }) => (
                <FormItem><FormLabel>Valor pago (€) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min={0.01} {...field} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={payForm.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Data *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={payForm.control} name="method" render={({ field }) => (
                <FormItem><FormLabel>Método</FormLabel>
                  <Select onValueChange={v => field.onChange(v || null)} value={field.value ?? ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Não especificado" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="">Não especificado</SelectItem>
                      <SelectItem value="numerario">Numerário</SelectItem>
                      <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                      <SelectItem value="mbway">MBWay</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={payForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notas</FormLabel>
                  <FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={paymentMutation.isPending}>
                  {paymentMutation.isPending ? 'A registar…' : 'Registar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
