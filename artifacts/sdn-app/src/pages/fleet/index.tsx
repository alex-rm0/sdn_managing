import { useListFleet } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function FleetList() {
  const { data: fleet, isLoading } = useListFleet();

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'ativo': return <Badge variant="success">Ativo</Badge>;
      case 'manutencao': return <Badge variant="warning">Manutenção</Badge>;
      case 'avariado': return <Badge variant="destructive">Avariado</Badge>;
      case 'fora_servico': return <Badge variant="secondary">Fora de Serviço</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Frota / Embarcações</h1>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Novo Registo
        </Button>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identificador</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Marca/Modelo</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : fleet?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Nenhuma embarcação registada.</TableCell></TableRow>
            ) : (
              fleet?.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.identifier}</TableCell>
                  <TableCell className="capitalize">{item.type.replace('_', ' ')} {item.subtype ? `(${item.subtype})` : ''}</TableCell>
                  <TableCell>{item.brand || '-'}</TableCell>
                  <TableCell>{item.year || '-'}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Editar</Button>
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
