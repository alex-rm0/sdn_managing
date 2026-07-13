import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument, getListDocumentsQueryKey } from '@workspace/api-client-react';
import type { Document } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, Download } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  type: z.enum(['noticia', 'contrato', 'arquivo']),
  date: z.string().min(1, 'Data obrigatória'),
  category: z.string().nullable().optional(),
  entity: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
  contractStart: z.string().nullable().optional(),
  contractEnd: z.string().nullable().optional(),
  contractStatus: z.enum(['ativo', 'expirado']).nullable().optional(),
  notes: z.string().nullable().optional(),
});

const defaultValues = { title: '', type: 'arquivo' as const, date: new Date().toISOString().split('T')[0], category: '', entity: '', content: '', fileUrl: '', contractStart: '', contractEnd: '', contractStatus: null as 'ativo' | 'expirado' | null, notes: '' };

export default function DocumentsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);
  const [activeTab, setActiveTab] = useState('arquivo');

  const { data: documents, isLoading } = useListDocuments();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues });
  const watchType = form.watch('type');

  useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({ ...editing, category: editing.category ?? '', entity: editing.entity ?? '', content: editing.content ?? '', fileUrl: editing.fileUrl ?? '', contractStart: editing.contractStart ?? '', contractEnd: editing.contractEnd ?? '', contractStatus: editing.contractStatus ?? null, notes: editing.notes ?? '' });
      } else {
        form.reset({ ...defaultValues, type: activeTab as any });
      }
    }
  }, [open, editing]);

  const createMutation = useCreateDocument({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }); toast({ title: 'Documento criado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao criar documento', variant: 'destructive' }),
  }});
  const updateMutation = useUpdateDocument({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }); toast({ title: 'Documento atualizado!' }); setOpen(false); },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  }});
  const deleteMutation = useDeleteDocument({ mutation: {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }); toast({ title: 'Documento eliminado.' }); },
    onError: () => toast({ title: 'Erro ao eliminar', variant: 'destructive' }),
  }});

  const onSubmit = (values: z.infer<typeof schema>) => {
    const data = { ...values, category: values.category || null, entity: values.entity || null, content: values.content || null, fileUrl: values.fileUrl || null, contractStart: values.contractStart || null, contractEnd: values.contractEnd || null, contractStatus: values.contractStatus ?? null, notes: values.notes || null };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate({ data });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const renderTable = (type: string) => {
    const filtered = documents?.filter(d => d.type === type) || [];
    const isContract = type === 'contrato';
    return (
      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Data</TableHead>
              {isContract && <TableHead>Entidade</TableHead>}
              {isContract && <TableHead>Validade</TableHead>}
              {isContract && <TableHead>Estado</TableHead>}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={isContract ? 6 : 3} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={isContract ? 6 : 3} className="text-center py-8 text-muted-foreground">Sem documentos.</TableCell></TableRow>
            ) : filtered.map(doc => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />{doc.title}</TableCell>
                <TableCell>{doc.date}</TableCell>
                {isContract && <TableCell>{doc.entity || '-'}</TableCell>}
                {isContract && <TableCell className="text-xs">{doc.contractStart} → {doc.contractEnd || '∞'}</TableCell>}
                {isContract && <TableCell>{doc.contractStatus ? <Badge variant={doc.contractStatus === 'ativo' ? 'success' : 'destructive'}>{doc.contractStatus === 'ativo' ? 'Ativo' : 'Expirado'}</Badge> : '-'}</TableCell>}
                <TableCell className="text-right space-x-1">
                  {doc.fileUrl && <Button variant="ghost" size="icon" asChild title="Abrir ficheiro"><a href={doc.fileUrl} target="_blank" rel="noreferrer"><Download className="w-4 h-4" /></a></Button>}
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(doc); setOpen(true); }}>Editar</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Eliminar</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Eliminar documento?</AlertDialogTitle><AlertDialogDescription>Elimina <strong>{doc.title}</strong>. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate({ id: doc.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Documentos</h1>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Documento</Button>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="arquivo">Arquivo</TabsTrigger>
            <TabsTrigger value="contrato">Contratos</TabsTrigger>
            <TabsTrigger value="noticia">Notícias</TabsTrigger>
          </TabsList>
          <TabsContent value="arquivo" className="mt-4">{renderTable('arquivo')}</TabsContent>
          <TabsContent value="contrato" className="mt-4">{renderTable('contrato')}</TabsContent>
          <TabsContent value="noticia" className="mt-4">{renderTable('noticia')}</TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Documento' : 'Novo Documento'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Título *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="arquivo">Arquivo</SelectItem><SelectItem value="contrato">Contrato</SelectItem><SelectItem value="noticia">Notícia</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel>Data *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Categoria</FormLabel><FormControl><Input placeholder="Regulamento" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="entity" render={({ field }) => (<FormItem><FormLabel>Entidade / Parceiro</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              {watchType === 'contrato' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="contractStart" render={({ field }) => (<FormItem><FormLabel>Início do Contrato</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="contractEnd" render={({ field }) => (<FormItem><FormLabel>Fim do Contrato</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={form.control} name="contractStatus" render={({ field }) => (
                    <FormItem><FormLabel>Estado do Contrato</FormLabel>
                      <Select onValueChange={v => field.onChange(v || null)} value={field.value ?? ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="expirado">Expirado</SelectItem></SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                </>
              )}
              <FormField control={form.control} name="fileUrl" render={({ field }) => (<FormItem><FormLabel>URL do Ficheiro</FormLabel><FormControl><Input placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="content" render={({ field }) => (<FormItem><FormLabel>Conteúdo / Descrição</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
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
