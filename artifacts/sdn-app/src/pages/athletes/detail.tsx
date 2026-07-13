import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAthlete, useUpdateAthlete, useDeleteAthlete,
  getListAthletesQueryKey, getGetAthleteQueryKey,
  useGetAthleteAttendanceSummary,
} from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Trash2, Trophy } from 'lucide-react';
import { Link } from 'wouter';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  birthDate: z.string().min(1),
  gender: z.enum(['M', 'F']),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  memberNumber: z.string().nullable().optional(),
  fprNumber: z.string().nullable().optional(),
  affiliationDate: z.string().min(1),
  status: z.enum(['ativo', 'inativo', 'suspenso']),
  notes: z.string().nullable().optional(),
});

export default function AthleteDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: athlete, isLoading } = useGetAthlete(id);
  const { data: attendance } = useGetAthleteAttendanceSummary(id);

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: '', birthDate: '', gender: 'M', email: '', phone: '', memberNumber: '', fprNumber: '', affiliationDate: '', status: 'ativo', notes: '' } });

  useEffect(() => {
    if (editOpen && athlete) {
      form.reset({ ...athlete, email: athlete.email ?? '', phone: athlete.phone ?? '', memberNumber: athlete.memberNumber ?? '', fprNumber: athlete.fprNumber ?? '', notes: athlete.notes ?? '' });
    }
  }, [editOpen, athlete]);

  const updateMutation = useUpdateAthlete({ mutation: {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAthletesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAthleteQueryKey(id) });
      toast({ title: 'Atleta atualizado!' });
      setEditOpen(false);
    },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});

  const deleteMutation = useDeleteAthlete({ mutation: {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAthletesQueryKey() });
      toast({ title: 'Atleta eliminado.' });
      setLocation('/atletas');
    },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof schema>) => {
    const data = { ...values, email: values.email || null, phone: values.phone || null, memberNumber: values.memberNumber || null, fprNumber: values.fprNumber || null, notes: values.notes || null };
    updateMutation.mutate({ id, data });
  };

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">A carregar...</div>;
  if (!athlete) return <div className="py-20 text-center text-muted-foreground">Atleta não encontrado.</div>;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild><Link href="/atletas"><ArrowLeft className="w-4 h-4 mr-1" /> Atletas</Link></Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{athlete.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={athlete.status === 'ativo' ? 'success' : athlete.status === 'suspenso' ? 'destructive' : 'secondary'}>{athlete.status}</Badge>
                {athlete.category && <Badge variant="outline">{athlete.category}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Edit className="w-4 h-4 mr-2" /> Editar</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4 mr-2" /> Eliminar</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar atleta?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação elimina permanentemente <strong>{athlete.name}</strong> e não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate({ id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">Informação</TabsTrigger>
            <TabsTrigger value="tripulacoes">Tripulações</TabsTrigger>
            <TabsTrigger value="resultados">Resultados</TabsTrigger>
            <TabsTrigger value="presencas">Presenças</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm text-muted-foreground">Dados Pessoais</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Data Nasc.</span><span>{athlete.birthDate}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Género</span><span>{athlete.gender === 'M' ? 'Masculino' : 'Feminino'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{athlete.email || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Telefone</span><span>{athlete.phone || '-'}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm text-muted-foreground">Dados Desportivos</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nº Sócio</span><span className="font-mono">{athlete.memberNumber || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Nº FPR</span><span className="font-mono">{athlete.fprNumber || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Filiação</span><span>{athlete.affiliationDate}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Categoria</span><span>{athlete.category || '-'}</span></div>
                </CardContent>
              </Card>
              {athlete.notes && (
                <Card className="md:col-span-2">
                  <CardHeader><CardTitle className="text-sm text-muted-foreground">Notas</CardTitle></CardHeader>
                  <CardContent><p className="text-sm">{athlete.notes}</p></CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tripulacoes" className="mt-4">
            {(!athlete.crewHistory || athlete.crewHistory.length === 0) ? (
              <p className="text-center py-8 text-muted-foreground">Sem histórico de tripulações.</p>
            ) : (
              <div className="bg-card rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Tripulação</TableHead><TableHead>Época</TableHead><TableHead>Classe</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {athlete.crewHistory.map(c => (
                      <TableRow key={c.crewId}>
                        <TableCell className="font-medium">{c.crewName}</TableCell>
                        <TableCell>{c.seasonName}</TableCell>
                        <TableCell><Badge variant="outline">{c.boatClass}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="resultados" className="mt-4">
            {(!athlete.resultHistory || athlete.resultHistory.length === 0) ? (
              <p className="text-center py-8 text-muted-foreground">Sem resultados registados.</p>
            ) : (
              <div className="bg-card rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Competição</TableHead><TableHead>Prova</TableHead><TableHead>Posição</TableHead><TableHead>Tempo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {athlete.resultHistory.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{r.competitionName || '-'}</TableCell>
                        <TableCell>{r.raceName || '-'}</TableCell>
                        <TableCell>{r.position ? <Badge variant={r.position === 1 ? 'warning' : r.position <= 3 ? 'secondary' : 'outline'}><Trophy className="w-3 h-3 mr-1" />{r.position}º</Badge> : '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{r.time || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="presencas" className="mt-4">
            {!attendance ? (
              <p className="text-center py-8 text-muted-foreground">Sem dados de presença.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Sessões</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{attendance.totalSessions}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Presenças</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{attendance.present}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Faltas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{attendance.absent}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Taxa Presença</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{(attendance.attendanceRate * 100).toFixed(0)}%</div></CardContent></Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Atleta</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                  <FormItem><FormLabel>Data Nasc. *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
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
                  <FormItem><FormLabel>Data Filiação *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
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
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'A guardar...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
