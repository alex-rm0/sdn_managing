import { useListCompetitions } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function CompetitionsList() {
  const { data: competitions, isLoading } = useListCompetitions();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Competições</h1>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Nova Competição
        </Button>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Data de Início</TableHead>
              <TableHead>Data de Fim</TableHead>
              <TableHead>Organização</TableHead>
              <TableHead>Época</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : competitions?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Nenhuma competição registada.</TableCell></TableRow>
            ) : (
              competitions?.map(comp => (
                <TableRow key={comp.id}>
                  <TableCell className="font-medium">{comp.name}</TableCell>
                  <TableCell>{comp.location || '-'}</TableCell>
                  <TableCell>{comp.startDate}</TableCell>
                  <TableCell>{comp.endDate || '-'}</TableCell>
                  <TableCell>{comp.organizer || '-'}</TableCell>
                  <TableCell>{comp.seasonName}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Gerir Provas</Button>
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
