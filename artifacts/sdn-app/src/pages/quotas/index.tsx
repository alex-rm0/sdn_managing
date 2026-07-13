import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListQuotas, useCreatePayment, useListAthletes, useListSeasons } from '@workspace/api-client-react';
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
import { Search } from 'lucide-react';

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
  date: z.string().min(1, 'Data obrigatória'),
  method: z.enum(['numerario', 'transferencia', 'mbway', 'outro']).nullable().optional(),
  notes: z.string().nullable().optional(),
});

const statusVariant = (s: string) => ({ pago: 'success', parcial: 'warning', em_atraso: 'destructive', pendente: 'secondary' }[s] ?? 'secondary');
const statusLabel = (s: string) => ({ pago: 'Pago', parcial: 'Parcial', em_atraso: 'Em Atraso', pendente: 'Pendente' }[s] ?? s);
const fmt = (n: number) => n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export default function QuotasList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [selectedQuota, setSelectedQuota] = useState<Quota | null>(null);
  const [athleteFilter, setAthleteFilter] = useState<string>('');
  const [seasonFilter, setSeasonFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data: quotas, isLoading } = useListQuotas({ seasonId: seasonFilter ? parseInt(seasonFilter) : undefined, athleteId: athleteFilter ? parseInt(athleteFilter) : undefined });
  const { data: athletes } = useListAthletes();
  const { data: seasons } = useListSeasons();

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, date: new Date().toISOString().split('T')[0], method: null, notes: '' },
  });

  useEffect(() => {
    if (payOpen && selectedQuota) {
      form.reset({ amount: selectedQuota.amountOwed ?? selectedQuota.amountDue - selectedQuota.amountPaid, date: new Date().toISOString().split('T')[0], method: null, notes: '' });
    }
  }, [payOpen, selectedQuota]);

  const paymentMutation = useCreatePayment({ mutation: {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotas'] });
      toast({ title: 'Pagamento registado!' });
      setPayOpen(false);
    },
    onError: () => toast({ title: 'Erro ao registar pagamento', variant: 'destructive' }),
  }});

  const onPaySubmit = (values: z.infer<typeof paymentSchema>) => {
    if (!selectedQuota) return;
    paymentMutation.mutate({ data: { quotaId: selectedQuota.id, amount: values.amount, date: values.date, method: values.method ?? null, notes: values.notes || null } });
  };

  const filtered = quotas?.filter(q => !search || q.athleteName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Quotas</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Procurar atleta..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todas as épocas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as épocas</SelectItem>
              {seasons?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={athleteFilter} onValueChange={setAthleteFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos os atletas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os atletas</SelectItem>
              {athletes?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-md border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atleta</TableHead>
                <TableHead>Época / Período</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Em Falta</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma quota encontrada.</TableCell></TableRow>
              ) : filtered?.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.athleteName}</TableCell>
                  <TableCell>{q.seasonName}{q.period ? ` (${q.period})` : ''}</TableCell>
                  <TableCell className="text-right">{fmt(q.amountDue)}</TableCell>
                  <TableCell className="text-right text-green-600">{fmt(q.amountPaid)}</TableCell>
                  <TableCell className={`text-right font-medium ${(q.amountOwed ?? 0) > 0 ? 'text-destructive' : ''}`}>{fmt(q.amountOwed ?? 0)}</TableCell>
                  <TableCell>{q.dueDate || '-'}</TableCell>
                  <TableCell><Badge variant={statusVariant(q.status) as any}>{statusLabel(q.status)}</Badge></TableCell>
                  <TableCell className="text-right">
                    {q.status !== 'pago' && (
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedQuota(q); setPayOpen(true); }}>Registar Pagamento</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registar Pagamento</DialogTitle>
            {selectedQuota && <p className="text-sm text-muted-foreground">{selectedQuota.athleteName} — {selectedQuota.seasonName}</p>}
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onPaySubmit)} className="space-y-4">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem><FormLabel>Valor pago (€) *</FormLabel><FormControl><Input type="number" step="0.01" min={0.01} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Data *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="method" render={({ field }) => (
                <FormItem><FormLabel>Método de Pagamento</FormLabel>
                  <Select onValueChange={v => field.onChange(v || null)} value={field.value ?? ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar método" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="">Não especificado</SelectItem>
                      <SelectItem value="numerario">Numerário</SelectItem>
                      <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                      <SelectItem value="mbway">MBWay</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={paymentMutation.isPending}>{paymentMutation.isPending ? 'A registar...' : 'Registar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
