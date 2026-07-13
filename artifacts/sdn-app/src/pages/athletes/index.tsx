import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListAthletes, useCreateAthlete, useUpdateAthlete, useDeleteAthlete,
  getListAthletesQueryKey,
} from '@workspace/api-client-react';
import type { Athlete } from '@workspace/api-client-react';
import { Link } from 'wouter';
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
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Download } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  birthDate: z.string().min(1, 'Data obrigatória'),
  gender: z.enum(['M', 'F']),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  memberNumber: z.string().nullable().optional(),
  fprNumber: z.string().nullable().optional(),
  affiliationDate: z.string().min(1, 'Data de filiação obrigatória'),
  status: z.enum(['ativo', 'inativo', 'suspenso']),
  notes: z.string().nullable().optional(),
});

const defaultValues = { name: '', birthDate: '', gender: 'M' as const, email: '', phone: '', memberNumber: '', fprNumber: '', affiliationDate: '', status: 'ativo' as const, notes: '' };

export default function AthletesList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: athletes, isLoading } = useListAthletes();

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({ ...editing, email: editing.email ?? '', phone: editing.phone ?? '', memberNumber: editing.memberNumber ?? '', fprNumber: editing.fprNumber ?? '', notes: editing.notes ?? '' });
      } else {
        form.reset(defaultValues);
      }
    }
  }, [open, editing]);

  const createMutation = useCreateAthlete({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAthletesQueryKey() }); toast({ title: 'Atleta criado com sucesso!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar atleta', variant: 'destructive' }),
  }});

  const updateMutation = useUpdateAthlete({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAthletesQueryKey() }); toast({ title: 'Atleta atualizado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});

  const deleteMutation = useDeleteAthlete({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAthletesQueryKey() }); toast({ title: 'Atleta eliminado.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof schema>) => {
    const data = { ...values, email: values.email || null, phone: values.phone || null, memberNumber: values.memberNumber || null, fprNumber: values.fprNumber || null, notes: values.notes || null };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate({ data });
  };

  const filteredAthletes = useMemo(() => {
    if (!athletes) return [];
    return athletes.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || (a.memberNumber && a.memberNumber.includes(searchTerm)) || (a.fprNumber && a.fprNumber.includes(searchTerm));
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [athletes, searchTerm, statusFilter]);

  const handleExport = () => {
    if (!filteredAthletes.length) return;
    const headers = "ID,Nome,Data Nasc.,Género,Nº Sócio,Nº FPR,Categoria,Estado\n";
    const csv = filteredAthletes.map(a => `${a.id},"${a.name}",${a.birthDate},${a.gender},${a.memberNumber||''},${a.fprNumber||''},${a.category||''},${a.status}`).join("\n");
    const blob = new Blob([headers + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url); link.setAttribute('download', 'atletas.csv');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Atletas</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Exportar</Button>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Atleta</Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Procurar por nome ou número..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
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
              ) : filteredAthletes.map(athlete => (
                <TableRow key={athlete.id}>
                  <TableCell className="font-mono text-xs">{athlete.memberNumber || '-'}</TableCell>
                  <TableCell className="font-medium">{athlete.name}</TableCell>
                  <TableCell>{athlete.category || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{athlete.fprNumber || '-'}</TableCell>
                  <TableCell>{athlete.birthDate}</TableCell>
                  <TableCell>
                    <Badge variant={athlete.status === 'ativo' ? 'success' : athlete.status === 'suspenso' ? 'destructive' : 'secondary'}>{athlete.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" asChild><Link href={`/atletas/${athlete.id}`}>Ver</Link></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(athlete); setOpen(true); }}>Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar atleta?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação elimina permanentemente o atleta <strong>{athlete.name}</strong> e não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: athlete.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Atleta' : 'Novo Atleta'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome completo *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                  <FormItem><FormLabel>Data de Nascimento *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem><FormLabel>Género *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="memberNumber" render={({ field }) => (
                  <FormItem><FormLabel>Nº Sócio</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="fprNumber" render={({ field }) => (
                  <FormItem><FormLabel>Nº FPR</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="affiliationDate" render={({ field }) => (
                  <FormItem><FormLabel>Data de Filiação *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Estado *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="suspenso">Suspenso</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'A guardar...' : editing ? 'Guardar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
