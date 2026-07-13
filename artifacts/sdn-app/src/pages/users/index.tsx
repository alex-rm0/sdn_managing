import { useListUsers } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function UsersList() {
  const { data: users, isLoading } = useListUsers();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Utilizadores</h1>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Novo Utilizador
        </Button>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Categorias Atribuídas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : users?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Nenhum utilizador encontrado.</TableCell></TableRow>
            ) : (
              users?.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{user.role}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.assignedCategories && user.assignedCategories.length > 0 
                      ? user.assignedCategories.join(', ') 
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.active ? 'success' : 'destructive'}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </Badge>
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
