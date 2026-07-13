import { useListDocuments } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DocumentsList() {
  const { data: documents, isLoading } = useListDocuments();

  const renderTable = (type: string) => {
    const filtered = documents?.filter(d => d.type === type) || [];
    
    return (
      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Data</TableHead>
              {type === 'contrato' && <TableHead>Entidade</TableHead>}
              {type === 'contrato' && <TableHead>Validade</TableHead>}
              {type === 'contrato' && <TableHead>Estado</TableHead>}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">A carregar...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Sem documentos.</TableCell></TableRow>
            ) : (
              filtered.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    {doc.title}
                  </TableCell>
                  <TableCell>{doc.date}</TableCell>
                  
                  {type === 'contrato' && <TableCell>{doc.entity || '-'}</TableCell>}
                  {type === 'contrato' && (
                    <TableCell className="text-xs">
                      {doc.contractStart} - {doc.contractEnd}
                    </TableCell>
                  )}
                  {type === 'contrato' && (
                    <TableCell>
                      <Badge variant={doc.contractStatus === 'ativo' ? 'success' : 'destructive'}>
                        {doc.contractStatus === 'ativo' ? 'Ativo' : 'Expirado'}
                      </Badge>
                    </TableCell>
                  )}
                  
                  <TableCell className="text-right space-x-2">
                    {doc.fileUrl && (
                      <Button variant="ghost" size="icon" title="Descarregar">
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm">Ver</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Documentos</h1>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Novo Documento
        </Button>
      </div>

      <Tabs defaultValue="noticia">
        <TabsList className="mb-4">
          <TabsTrigger value="noticia">Notícias</TabsTrigger>
          <TabsTrigger value="contrato">Contratos</TabsTrigger>
          <TabsTrigger value="arquivo">Arquivo</TabsTrigger>
        </TabsList>
        
        <TabsContent value="noticia">{renderTable('noticia')}</TabsContent>
        <TabsContent value="contrato">{renderTable('contrato')}</TabsContent>
        <TabsContent value="arquivo">{renderTable('arquivo')}</TabsContent>
      </Tabs>
    </div>
  );
}
