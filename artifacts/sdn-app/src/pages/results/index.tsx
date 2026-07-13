import { useListResults, useGetSeasonResultsSummary } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Trophy, Medal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResultsList() {
  const { data: results, isLoading: loadingResults } = useListResults();
  
  // Hardcoding seasonId=1 for demo, in a real app this would be state from a dropdown
  const { data: summary } = useGetSeasonResultsSummary(1, {
    query: {
      enabled: true // Ideally only if a season is selected
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Resultados</h1>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Registar Resultado
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4" /> Vitórias na Época
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.victories || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Medal className="w-4 h-4" /> Pódios na Época
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.podiums || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Competição</TableHead>
              <TableHead>Prova</TableHead>
              <TableHead>Atleta / Tripulação</TableHead>
              <TableHead>Posição</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead>Pontos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingResults ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : results?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Nenhum resultado encontrado.</TableCell></TableRow>
            ) : (
              results?.map(result => (
                <TableRow key={result.id}>
                  <TableCell className="font-medium">{result.competitionName}</TableCell>
                  <TableCell>{result.raceName}</TableCell>
                  <TableCell>{result.athleteName || result.crewName}</TableCell>
                  <TableCell>
                    {result.position ? (
                      <Badge variant={result.position === 1 ? 'warning' : result.position <= 3 ? 'secondary' : 'outline'}>
                        {result.position}º
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{result.time || '-'}</TableCell>
                  <TableCell>{result.points || '-'}</TableCell>
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
