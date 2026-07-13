import { useListSeasons } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function SeasonsList() {
  const { data: seasons, isLoading } = useListSeasons();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Épocas Desportivas</h1>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Nova Época
        </Button>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : seasons?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Nenhuma época registada.</TableCell></TableRow>
            ) : (
              seasons?.map(season => (
                <TableRow key={season.id}>
                  <TableCell className="font-medium">{season.name}</TableCell>
                  <TableCell>{season.startDate}</TableCell>
                  <TableCell>{season.endDate}</TableCell>
                  <TableCell>
                    <Badge variant={season.active ? 'success' : 'secondary'}>
                      {season.active ? 'Atual' : 'Fechada'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Configurar</Button>
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
