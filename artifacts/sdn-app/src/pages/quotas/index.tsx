import { useListQuotas } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Search, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function QuotasList() {
  const { data: quotas, isLoading } = useListQuotas();
  const [search, setSearch] = useState('');

  const filtered = quotas?.filter(q => q.athleteName?.toLowerCase().includes(search.toLowerCase()));

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pago': return <Badge variant="success">Pago</Badge>;
      case 'parcial': return <Badge variant="warning">Parcial</Badge>;
      case 'em_atraso': return <Badge variant="destructive">Em Atraso</Badge>;
      default: return <Badge variant="secondary">Pendente</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Quotas</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" /> Planos
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" /> Gerar Quotas
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Procurar atleta..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Atleta</TableHead>
              <TableHead>Época / Período</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Falta</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Nenhuma quota encontrada.</TableCell></TableRow>
            ) : (
              filtered?.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.athleteName}</TableCell>
                  <TableCell>{q.seasonName} {q.period ? `(${q.period})` : ''}</TableCell>
                  <TableCell>{q.amountDue.toFixed(2)} €</TableCell>
                  <TableCell className={q.amountOwed && q.amountOwed > 0 ? "font-medium text-destructive" : ""}>
                    {q.amountOwed?.toFixed(2) || '0.00'} €
                  </TableCell>
                  <TableCell>{q.dueDate || '-'}</TableCell>
                  <TableCell>{getStatusBadge(q.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Registar Pagamento</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
