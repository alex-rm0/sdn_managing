import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey } from '@workspace/api-client-react';
import type { User } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';

const createSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: z.enum(['admin', 'trainer']),
  assignedCategories: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().optional(),
  role: z.enum(['admin', 'trainer']),
  active: z.boolean().optional(),
  assignedCategories: z.string().optional(),
});

export default function UsersList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const { data: users, isLoading } = useListUsers();

  const createForm = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema), defaultValues: { name: '', email: '', password: '', role: 'trainer', assignedCategories: '' } });
  const editForm = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema), defaultValues: { name: '', email: '', password: '', role: 'trainer', active: true, assignedCategories: '' } });

  useEffect(() => {
    if (open) {
      if (editing) {
        editForm.reset({ name: editing.name, email: editing.email, password: '', role: editing.role, active: editing.active, assignedCategories: editing.assignedCategories?.join(', ') ?? '' });
      } else {
        createForm.reset({ name: '', email: '', password: '', role: 'trainer', assignedCategories: '' });
      }
    }
  }, [open, editing]);

  const createMutation = useCreateUser({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); toast({ title: 'Utilizador criado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar utilizador', variant: 'destructive' }),
  }});
  const updateMutation = useUpdateUser({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); toast({ title: 'Utilizador atualizado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMutation = useDeleteUser({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); toast({ title: 'Utilizador eliminado.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onCreateSubmit = (values: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data: { name: values.name, email: values.email, password: values.password, role: values.role, assignedCategories: values.assignedCategories ? values.assignedCategories.split(',').map(s => s.trim()).filter(Boolean) : [] } });
  };
  const onEditSubmit = (values: z.infer<typeof editSchema>) => {
    updateMutation.mutate({ id: editing!.id, data: { name: values.name, email: values.email, password: values.password || null, role: values.role, active: values.active, assignedCategories: values.assignedCategories ? values.assignedCategories.split(',').map(s => s.trim()).filter(Boolean) : [] } });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Utilizadores</h1>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Utilizador</Button>
        </div>
        <div className="bg-card rounded-md border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Categorias</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
              ) : users?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum utilizador encontrado.</TableCell></TableRow>
              ) : users?.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge variant="outline">{user.role === 'admin' ? 'Administrador' : 'Treinador'}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{user.assignedCategories && user.assignedCategories.length > 0 ? user.assignedCategories.join(', ') : '-'}</TableCell>
                  <TableCell><Badge variant={user.active ? 'success' : 'destructive'}>{user.active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(user); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Eliminar utilizador?</AlertDialogTitle><AlertDialogDescription>Elimina <strong>{user.name}</strong>. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: user.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Utilizador' : 'Novo Utilizador'}</DialogTitle></DialogHeader>
          {!editing ? (
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField control={createForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={createForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={createForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Palavra-passe *</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={createForm.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Função *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="admin">Administrador</SelectItem><SelectItem value="trainer">Treinador</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={createForm.control} name="assignedCategories" render={({ field }) => (<FormItem><FormLabel>Categorias (separadas por vírgula)</FormLabel><FormControl><Input placeholder="Sénior, Sub-23" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'A criar...' : 'Criar'}</Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField control={editForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Nova palavra-passe (deixar vazio para não alterar)</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Função *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="admin">Administrador</SelectItem><SelectItem value="trainer">Treinador</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="active" render={({ field }) => (
                  <FormItem className="flex items-center gap-3"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Utilizador ativo</FormLabel></FormItem>
                )} />
                <FormField control={editForm.control} name="assignedCategories" render={({ field }) => (<FormItem><FormLabel>Categorias (separadas por vírgula)</FormLabel><FormControl><Input placeholder="Sénior, Sub-23" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'A guardar...' : 'Guardar'}</Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
