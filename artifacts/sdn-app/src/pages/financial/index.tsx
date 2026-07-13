import { useListFinancialMovements, useGetFinancialSummary } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FinancialList() {
  const { data: movements, isLoading } = useListFinancialMovements();
  const { data: summary } = useGetFinancialSummary();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" /> Novo Movimento
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Receitas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">+{summary.totalRevenue.toFixed(2)} €</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">-{summary.totalExpenses.toFixed(2)} €</div>
            </CardContent>
          </Card>
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm opacity-80">Balanço</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.balance.toFixed(2)} €</div>
            </CardContent>
          </Card>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : movements?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Sem movimentos registados.</TableCell></TableRow>
            ) : (
              movements?.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{m.date}</TableCell>
                  <TableCell>
                    <Badge variant={m.type === 'receita' ? 'success' : 'destructive'} className="uppercase text-[10px]">
                      {m.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.category}</TableCell>
                  <TableCell>{m.description}</TableCell>
                  <TableCell className={`text-right font-medium ${m.type === 'receita' ? 'text-success' : 'text-destructive'}`}>
                    {m.type === 'receita' ? '+' : '-'}{m.amount.toFixed(2)} €
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
