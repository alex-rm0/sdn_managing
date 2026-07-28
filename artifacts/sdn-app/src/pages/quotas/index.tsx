import { useState, useEffect, useMemo } from 'react';
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

function SearchableSelect({
  options, value, onChange, placeholder, className = 'w-[200px]',
}: {
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
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
  if (!quota) return <td className="border px-2 py-1.5 text-center text-muted-foreground/30 text-xs">—</td>;
  const colors: Record<string, string> = {
    pago: 'bg-green-100 text-green-700 hover:bg-green-200',
    parcial: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    em_atraso: 'bg-red-100 text-red-700 hover:bg-red-200',
    pendente: 'bg-muted text-muted-foreground hover:bg-muted/80',
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
  const [escalaoFilter, setEscalaoFilter] = useState('');
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

  // Auto-select the most recent season on first load
  useEffect(() => {
    if (seasons.length && !seasonId) {
      setSeasonId(String(seasons[0].id));
    }
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

  // ── Derived data ──────────────────────────────────────────────────────────

  // ── Escalão options (unique categories for current season) ───────────────
  const escalaoOptions: SelectOption[] = useMemo(() => {
    const seen = new Set<string>();
    quotas.forEach(q => { if (q.category) seen.add(q.category); });
    return [...seen].sort((a, b) => a.localeCompare(b, 'pt')).map(c => ({ value: c, label: c }));
  }, [quotas]);

  const monthQuotas = useMemo(() =>
    quotas.filter(q => {
      if (q.period !== currentPeriod) return false;
      if (escalaoFilter && q.category !== escalaoFilter) return false;
      return true;
    }),
    [quotas, currentPeriod, escalaoFilter]
  );

  const filteredMonthQuotas = useMemo(() => {
    return monthQuotas.filter(q => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (search && !q.athleteName?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [monthQuotas, statusFilter, search]);

  const monthSummary = useMemo(() => ({
    pago: monthQuotas.filter(q => q.status === 'pago').length,
    parcial: monthQuotas.filter(q => q.status === 'parcial').length,
    em_atraso: monthQuotas.filter(q => q.status === 'em_atraso').length,
    pendente: monthQuotas.filter(q => q.status === 'pendente').length,
    total: monthQuotas.length,
  }), [monthQuotas]);

  // Matrix data: unique athletes filtered by escalão
  const matrixAthletes = useMemo(() => {
    const seen = new Map<number, string>();
    quotas.forEach(q => {
      if (q.athleteId && q.athleteName) {
        if (!escalaoFilter || q.category === escalaoFilter) seen.set(q.athleteId, q.athleteName);
      }
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  }, [quotas, escalaoFilter]);

  const matrixLookup = useMemo(() => {
    const map = new Map<string, Quota>();
    quotas.forEach(q => {
      if (q.period) map.set(`${q.athleteId}:${q.period}`, q);
    });
    return map;
  }, [quotas]);

  // ── Season options for combobox ───────────────────────────────────────────
  const seasonOptions: SelectOption[] = seasons.map(s => ({ value: String(s.id), label: s.name }));

  // ── Plans for current season ──────────────────────────────────────────────
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

  const handleGenerate = async () => {
    if (!seasonId || !genPlanId) return;
    const plan = seasonPlans.find(p => String(p.id) === genPlanId);
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

  // ── Status filter tabs ────────────────────────────────────────────────────
  const filterTabs = [
    { key: 'all', label: 'Todas', count: monthSummary.total },
    { key: 'em_atraso', label: 'Em atraso', count: monthSummary.em_atraso, color: 'text-red-600' },
    { key: 'parcial', label: 'Parcial', count: monthSummary.parcial, color: 'text-amber-600' },
    { key: 'pendente', label: 'Pendentes', count: monthSummary.pendente, color: 'text-muted-foreground' },
    { key: 'pago', label: 'Pagas', count: monthSummary.pago, color: 'text-green-600' },
  ] as const;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight">Quotas</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Epoch selector */}
            <SearchableSelect
              options={seasonOptions}
              value={seasonId}
              onChange={v => { setSeasonId(v); setEscalaoFilter(''); }}
              placeholder="Selecionar época"
              className="w-[180px]"
            />
            {/* Escalão filter */}
            {escalaoOptions.length > 0 && (
              <Select value={escalaoFilter} onValueChange={setEscalaoFilter}>
                <SelectTrigger className={`w-[150px] h-9 text-sm ${escalaoFilter ? 'border-primary text-primary' : ''}`}>
                  <SelectValue placeholder="Todos os escalões" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os escalões</SelectItem>
                  {escalaoOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* View mode toggle */}
            <div className="flex rounded-md border overflow-hidden">
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                onClick={() => setViewMode('month')}
              >Por mês</button>
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${viewMode === 'overview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                onClick={() => setViewMode('overview')}
              >Visão geral</button>
            </div>
          </div>
        </div>

        {/* Month navigation (shared between modes) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border rounded-md overflow-hidden">
            <button className="px-2 py-1.5 hover:bg-muted transition-colors" onClick={prevMonth} aria-label="Mês anterior">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-1.5 text-sm font-medium min-w-[140px] text-center">
              {MONTHS_PT[month - 1]} {year}
            </span>
            <button className="px-2 py-1.5 hover:bg-muted transition-colors" onClick={nextMonth} aria-label="Mês seguinte">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {seasonId && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setGenOpen(true)}>
              <Zap className="w-3.5 h-3.5" />
              Gerar quotas
            </Button>
          )}
        </div>

        {/* ── Month view ── */}
        {viewMode === 'month' && (
          <div className="space-y-4">
            {/* Summary strip */}
            {monthSummary.total > 0 && (
              <div className="flex flex-wrap gap-4 text-sm px-1">
                {monthSummary.pago > 0 && <span className="flex items-center gap-1.5 text-green-700"><span className="w-2 h-2 rounded-full bg-green-500" />{monthSummary.pago} pago{monthSummary.pago !== 1 ? 's' : ''}</span>}
                {monthSummary.parcial > 0 && <span className="flex items-center gap-1.5 text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-400" />{monthSummary.parcial} parcial</span>}
                {monthSummary.em_atraso > 0 && <span className="flex items-center gap-1.5 text-red-700"><span className="w-2 h-2 rounded-full bg-red-500" />{monthSummary.em_atraso} em atraso</span>}
                {monthSummary.pendente > 0 && <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-muted-foreground/40" />{monthSummary.pendente} pendente{monthSummary.pendente !== 1 ? 's' : ''}</span>}
              </div>
            )}

            {/* Status tabs + search */}
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
                      <span className={`text-[11px] rounded-full px-1.5 font-medium ${
                        statusFilter === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted'
                      } ${'color' in tab ? tab.color : ''}`}>
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

            {/* Table */}
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
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : !seasonId ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">Seleciona uma época para ver as quotas</TableCell></TableRow>
                  ) : filteredMonthQuotas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
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
                      </TableCell>
                    </TableRow>
                  ) : filteredMonthQuotas.map(q => (
                    <TableRow key={q.id} className={q.status === 'pago' ? 'opacity-70' : ''}>
                      <TableCell className="font-medium">{q.athleteName}</TableCell>
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
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── Overview (matrix) ── */}
        {viewMode === 'overview' && (
          <div className="space-y-3">
            {!seasonId ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Seleciona uma época para ver a grelha</p>
            ) : isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : matrixAthletes.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground mb-3">Sem quotas geradas para esta época</p>
                <Button variant="outline" size="sm" onClick={() => setGenOpen(true)}>
                  <Zap className="w-3.5 h-3.5 mr-1.5" /> Gerar quotas do mês
                </Button>
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex gap-4 text-xs text-muted-foreground px-1 flex-wrap">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-200" />Pago</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" />Parcial</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-200" />Em atraso</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-muted border" />Pendente</span>
                  <span className="flex items-center gap-1 ml-2 italic">Clica numa célula para registar pagamento</span>
                </div>

                <div className="overflow-x-auto border rounded-lg">
                  <table className="text-sm w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="border px-3 py-2 text-left font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 min-w-[160px]">Atleta</th>
                        {MONTHS_SHORT.map((m, i) => (
                          <th key={i} className={`border px-2 py-2 text-center text-xs font-medium min-w-[36px] ${
                            i + 1 === month && year === today.getFullYear()
                              ? 'text-primary bg-primary/5'
                              : 'text-muted-foreground'
                          }`}>{m}</th>
                        ))}
                        <th className="border px-2 py-2 text-right text-xs font-medium text-muted-foreground min-w-[80px]">Total em falta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixAthletes.map(athlete => {
                        const totalOwed = Array.from({length: 12}, (_, i) => {
                          const q = matrixLookup.get(`${athlete.id}:${periodStr(year, i + 1)}`);
                          return q?.amountOwed ?? 0;
                        }).reduce((a, b) => a + b, 0);

                        return (
                          <tr key={athlete.id} className="hover:bg-muted/20">
                            <td className="border px-3 py-1.5 font-medium sticky left-0 bg-background z-10">{athlete.name}</td>
                            {Array.from({length: 12}, (_, i) => {
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
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar plano…" />
                  </SelectTrigger>
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
              {generateMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A gerar…</>
                : 'Gerar'}
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
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">{selectedQuota.athleteName}</p>
                <p>{selectedQuota.seasonName}{selectedQuota.period ? ` · ${MONTHS_PT[parsePeriod(selectedQuota.period)?.month! - 1] ?? selectedQuota.period} ${parsePeriod(selectedQuota.period)?.year ?? ''}` : ''}</p>
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
