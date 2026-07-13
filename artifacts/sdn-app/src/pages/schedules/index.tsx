import { useListTrainingSchedules } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function SchedulesList() {
  const { data: schedules, isLoading } = useListTrainingSchedules();

  const getDaysString = (days: number[]) => {
    const daysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days.map(d => daysMap[d]).join(', ');
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Horários de Treino</h1>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Novo Horário
        </Button>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo / Categoria</TableHead>
              <TableHead>Dias da Semana</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Treinadores (IDs)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : schedules?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Nenhum horário registado.</TableCell></TableRow>
            ) : (
              schedules?.map(sched => (
                <TableRow key={sched.id}>
                  <TableCell className="font-medium">{sched.groupCategory}</TableCell>
                  <TableCell>{getDaysString(sched.daysOfWeek)}</TableCell>
                  <TableCell className="font-mono text-xs">{sched.startTime} - {sched.endTime}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{sched.trainingType}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{sched.trainerIds?.join(', ') || '-'}</TableCell>
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
