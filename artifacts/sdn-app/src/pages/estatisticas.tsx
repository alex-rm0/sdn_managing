import { useGetDashboard } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Users, Wallet, Receipt, Sailboat, Dumbbell } from 'lucide-react';

export default function Estatisticas() {
  const { data: stats, isLoading } = useGetDashboard();

  if (isLoading || !stats) {
    return <div className="py-20 text-center text-muted-foreground">A carregar estatísticas...</div>;
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-[18px] flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Atletas ativos</span>
            <Users className="w-[15px] h-[15px] text-border" />
          </div>
          <span className="text-[32px] font-bold tracking-tight leading-none">{stats.activeAthletes}</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-[18px] flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Balanço mensal</span>
            <Wallet className="w-[15px] h-[15px] text-border" />
          </div>
          <span className={`text-[32px] font-bold tracking-tight leading-none ${stats.monthlyBalance >= 0 ? 'text-brand-success' : 'text-destructive'}`}>
            {stats.monthlyBalance.toFixed(2)} €
          </span>
          <p className="font-mono text-[10.5px] text-muted-foreground">
            +{(stats.monthlyRevenue ?? 0).toFixed(2)} € / −{(stats.monthlyExpenses ?? 0).toFixed(2)} €
          </p>
        </div>

        <div className={`bg-card border border-border rounded-2xl p-[18px] flex flex-col gap-3.5 ${(stats.overdueQuotasCount ?? 0) > 0 ? 'border-l-[5px] border-l-brand-danger' : ''}`}>
          <div className="flex items-center justify-between">
            <span className={`font-mono text-[10px] tracking-wider uppercase ${(stats.overdueQuotasCount ?? 0) > 0 ? 'text-brand-danger font-semibold' : 'text-muted-foreground'}`}>Quotas em atraso</span>
            <Receipt className="w-[15px] h-[15px] text-border" />
          </div>
          <span className={`text-[32px] font-bold tracking-tight leading-none ${(stats.overdueQuotasCount ?? 0) > 0 ? 'text-brand-danger' : ''}`}>
            {stats.overdueQuotasCount ?? 0}
          </span>
          <p className="font-mono text-[10.5px] text-muted-foreground">
            {(stats.overdueQuotasAmount ?? 0).toFixed(2)} € em dívida
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-[18px] flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Frota disponível</span>
            <Sailboat className="w-[15px] h-[15px] text-border" />
          </div>
          <span className="text-[32px] font-bold tracking-tight leading-none">{stats.fleetAvailableCount}</span>
          <p className="font-mono text-[10.5px] text-muted-foreground">
            {stats.fleetInMaintenanceCount} em manutenção
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-[15px] font-bold tracking-tight flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-brand-cyan-dark" /> Próximos treinos
          </h2>
          {stats.upcomingSessions?.length ? (
            <div className="flex flex-col divide-y divide-border">
              {stats.upcomingSessions.map(session => (
                <div key={session.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">{session.groupCategory}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.date} · {session.startTime} – {session.endTime}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">{session.trainingType}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Não há treinos agendados brevemente.</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-[15px] font-bold tracking-tight">Últimos resultados</h2>
          {stats.recentResults?.length ? (
            <div className="flex flex-col divide-y divide-border">
              {stats.recentResults.map(result => (
                <div key={result.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">{result.athleteNames ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{result.boatClass} {result.escalao && `· ${result.escalao}`}</p>
                  </div>
                  <div className="text-right">
                    {result.position && <div className="font-bold text-sm">{result.position}º lugar</div>}
                    {result.time && <div className="text-xs text-muted-foreground font-mono">{result.time}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem resultados recentes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
