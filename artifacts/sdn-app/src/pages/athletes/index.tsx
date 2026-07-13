import { useState, useMemo } from 'react';
import { useListAthletes } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Download, Upload } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AthletesList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { data: athletes, isLoading } = useListAthletes();

  const filteredAthletes = useMemo(() => {
    if (!athletes) return [];
    return athletes.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (a.memberNumber && a.memberNumber.includes(searchTerm)) ||
                            (a.fprNumber && a.fprNumber.includes(searchTerm));
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [athletes, searchTerm, statusFilter]);

  const handleExport = () => {
    if (!filteredAthletes.length) return;
    const headers = "ID,Nome,Data Nasc.,Género,Nº Sócio,Nº FPR,Categoria,Estado\n";
    const csv = filteredAthletes.map(a => 
      `${a.id},"${a.name}",${a.birthDate},${a.gender},${a.memberNumber||''},${a.fprNumber||''},${a.category||''},${a.status}`
    ).join("\n");
    
    const blob = new Blob([headers + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'atletas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Atletas</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Upload className="w-4 h-4 mr-2" /> Importar
          </Button>
          <Button size="sm" asChild>
            <Link href="/atletas/novo">
              <Plus className="w-4 h-4 mr-2" /> Novo Atleta
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Procurar por nome ou número..." 
            className="pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="suspenso">Suspenso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº Sócio</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>FPR</TableHead>
              <TableHead>Data Nasc.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : filteredAthletes.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum atleta encontrado.</TableCell></TableRow>
            ) : (
              filteredAthletes.map((athlete) => (
                <TableRow key={athlete.id}>
                  <TableCell className="font-mono text-xs">{athlete.memberNumber || '-'}</TableCell>
                  <TableCell className="font-medium">{athlete.name}</TableCell>
                  <TableCell>{athlete.category || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{athlete.fprNumber || '-'}</TableCell>
                  <TableCell>{athlete.birthDate}</TableCell>
                  <TableCell>
                    <Badge variant={athlete.status === 'ativo' ? 'success' : athlete.status === 'suspenso' ? 'destructive' : 'secondary'}>
                      {athlete.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/atletas/${athlete.id}`}>Ver Perfil</Link>
                    </Button>
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
