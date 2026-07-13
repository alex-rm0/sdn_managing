import { useGetDashboard } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Anchor, Wallet, Receipt, Sailboat, Dumbbell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboard();

  if (isLoading || !stats) {
    return <div>A carregar dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atletas Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeAthletes}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tripulações</CardTitle>
            <Anchor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCrews}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balanço Mensal</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.monthlyBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
              {stats.monthlyBalance.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              +{stats.monthlyRevenue.toFixed(2)} € / -{stats.monthlyExpenses.toFixed(2)} €
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quotas em Atraso</CardTitle>
            <Receipt className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdueQuotasCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: {stats.overdueQuotasAmount.toFixed(2)} €
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frota Disponível</CardTitle>
            <Sailboat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.fleetAvailableCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.fleetInMaintenanceCount} em manutenção
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Dumbbell className="h-5 w-5" /> Próximos Treinos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcomingSessions?.length ? (
              <div className="space-y-4">
                {stats.upcomingSessions.map(session => (
                  <div key={session.id} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                    <div>
                      <p className="font-medium text-sm">{session.groupCategory}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.date} • {session.startTime} - {session.endTime}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">{session.trainingType}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Não há treinos agendados brevemente.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimos Resultados</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentResults?.length ? (
              <div className="space-y-4">
                {stats.recentResults.map(result => (
                  <div key={result.id} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                    <div>
                      <p className="font-medium text-sm">{result.athleteName || result.crewName}</p>
                      <p className="text-xs text-muted-foreground">{result.competitionName} - {result.raceName}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{result.position}º lugar</div>
                      {result.time && <div className="text-xs text-muted-foreground">{result.time}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem resultados recentes registados.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
