import { useListCrews } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function CrewsList() {
  const { data: crews, isLoading } = useListCrews();
  const [search, setSearch] = useState('');

  const filtered = crews?.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.boatClass.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Tripulações</h1>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Nova Tripulação
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Procurar tripulação ou barco..." 
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
              <TableHead>Nome</TableHead>
              <TableHead>Barco</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Época</TableHead>
              <TableHead>Atletas</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Nenhuma tripulação encontrada.</TableCell></TableRow>
            ) : (
              filtered?.map(crew => (
                <TableRow key={crew.id}>
                  <TableCell className="font-medium">{crew.name}</TableCell>
                  <TableCell><Badge variant="outline">{crew.boatClass}</Badge></TableCell>
                  <TableCell>{crew.category}</TableCell>
                  <TableCell>{crew.seasonName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {crew.athletes?.map(a => a.name).join(', ') || '-'}
                  </TableCell>
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
