import { useGetAthlete } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Mail, Phone, Calendar, Hash } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AthleteDetail() {
  const params = useParams<{ id: string }>();
  const isNew = !params.id || params.id === 'novo';
  const athleteId = parseInt(params.id || '0');

  const { data: athlete, isLoading } = useGetAthlete(athleteId, {
    query: {
      enabled: !isNew && !isNaN(athleteId),
    }
  });

  if (isNew) {
    return <div>TODO: Form to create athlete</div>;
  }

  if (isLoading || !athlete) {
    return <div>A carregar...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/atletas"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{athlete.name}</h1>
          <Badge variant={athlete.status === 'ativo' ? 'success' : athlete.status === 'suspenso' ? 'destructive' : 'secondary'} className="ml-2 uppercase">
            {athlete.status}
          </Badge>
        </div>
        <Button>
          <Edit className="w-4 h-4 mr-2" /> Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Nº Sócio AAC</p>
                <p className="font-medium">{athlete.memberNumber || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Nº FPR</p>
                <p className="font-medium">{athlete.fprNumber || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Data Nascimento</p>
                <p className="font-medium">{athlete.birthDate} ({athlete.gender})</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{athlete.email || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium">{athlete.phone || 'N/A'}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-border mt-4">
              <p className="text-xs text-muted-foreground">Categoria Atual</p>
              <p className="font-bold text-lg">{athlete.category}</p>
              {athlete.categoryOverride && (
                <Badge variant="warning" className="mt-1">Forçada manualmente</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Histórico e Finanças</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="crews" className="w-full">
              <TabsList className="w-full justify-start rounded-none border-b border-border h-auto p-0 bg-transparent">
                <TabsTrigger value="crews" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3">Tripulações</TabsTrigger>
                <TabsTrigger value="results" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3">Resultados</TabsTrigger>
                <TabsTrigger value="quotas" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3">Quotas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="crews" className="p-4 m-0">
                {/* Note: In a real app we'd use athlete.crewHistory from AthleteDetail if the API includes it, or fetch separately */}
                <p className="text-sm text-muted-foreground text-center py-8">Em desenvolvimento...</p>
              </TabsContent>

              <TabsContent value="results" className="p-4 m-0">
                <p className="text-sm text-muted-foreground text-center py-8">Em desenvolvimento...</p>
              </TabsContent>

              <TabsContent value="quotas" className="p-4 m-0">
                <p className="text-sm text-muted-foreground text-center py-8">Em desenvolvimento...</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
