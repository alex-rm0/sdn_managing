import { Link } from 'wouter';
import { useGetDashboard } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, Trophy, Medal, Wallet, Receipt,
  Package, Dumbbell, Clock, FileText, ShieldAlert,
  CalendarDays, ArrowRight, AlertTriangle, CalendarClock, Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionCard {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  stat?: string;
  statTone?: 'default' | 'danger';
}

const trainingTypeLabels: Record<string, string> = {
  agua: 'Água',
  ginasio: 'Ginásio',
  ergometro: 'Ergómetro',
  prova: 'Prova',
  estagio: 'Estágio',
  outro: 'Outro',
};

const alertStyles: Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string; border: string; iconBg: string; linkColor: string }> = {
  danger: { icon: AlertTriangle, bg: 'bg-brand-danger-bg', border: 'border-brand-danger-border', iconBg: 'bg-brand-danger', linkColor: 'text-brand-danger-dark' },
  info: { icon: CalendarClock, bg: 'bg-brand-cyan-bg', border: 'border-brand-cyan-border', iconBg: 'bg-brand-cyan', linkColor: 'text-brand-cyan-dark' },
  neutral: { icon: Wrench, bg: 'bg-muted/60', border: 'border-border', iconBg: 'bg-muted-foreground', linkColor: 'text-muted-foreground' },
};

function sessionStatus(date: string, startTime: string, endTime: string): 'a_decorrer' | 'terminada' | 'agendada' {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  if (date !== todayStr) return 'agendada';
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) return 'a_decorrer';
  if (nowMinutes > endMinutes) return 'terminada';
  return 'agendada';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats } = useGetDashboard();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 20 ? 'Boa tarde' : 'Boa noite';
  const today = now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1);

  const sections: SectionCard[] = [
    {
      href: '/atletas', icon: Users, title: 'Atletas',
      description: 'Fichas, categorias e histórico',
      stat: stats ? `${stats.activeAthletes} ativos` : undefined,
    },
    {
      href: '/treinos', icon: Dumbbell, title: 'Treinos',
      description: 'Registo de sessões e presenças',
      stat: stats ? `${stats.upcomingSessions.length} hoje` : undefined,
    },
    {
      href: '/competicoes', icon: Trophy, title: 'Competições',
      description: 'Eventos e provas oficiais',
    },
    {
      href: '/resultados', icon: Medal, title: 'Resultados',
      description: 'Classificações e tempos',
      stat: stats ? `${stats.totalResults} registados` : undefined,
    },
    {
      href: '/epocas', icon: CalendarDays, title: 'Épocas',
      description: 'Gestão das épocas desportivas',
    },
    {
      href: '/financeiro', icon: Wallet, title: 'Financeiro',
      description: 'Receitas, despesas e balanço',
    },
    {
      href: '/quotas', icon: Receipt, title: 'Quotas',
      description: 'Pagamentos e situação dos sócios',
      stat: stats && stats.overdueQuotasCount ? `${stats.overdueQuotasCount} em atraso` : undefined,
      statTone: 'danger',
    },
    {
      href: '/inventario', icon: Package, title: 'Inventário',
      description: 'Embarcações e equipamento',
      stat: stats?.fleetTotalCount !== undefined ? `${stats.fleetTotalCount} itens` : undefined,
    },
    {
      href: '/horarios', icon: Clock, title: 'Horários',
      description: 'Planeamento semanal de treinos',
    },
    {
      href: '/documentos', icon: FileText, title: 'Documentos',
      description: 'Contratos, notícias e arquivo',
    },
    {
      href: '/utilizadores', icon: ShieldAlert, title: 'Utilizadores',
      description: 'Contas e permissões de acesso',
    },
  ];

  return (
    <div className="flex flex-col gap-[22px]">
      {/* Header */}
      <div className="flex items-end gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[10.5px] tracking-widest uppercase text-brand-cyan">{todayFormatted}</p>
          <h1 className="text-[28px] font-bold tracking-tight leading-none">
            {greeting}, {user?.name.split(' ')[0]}
          </h1>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2.5">
          <Link
            href="/estatisticas"
            className="h-[38px] px-4 rounded-lg border border-border bg-card text-sm font-semibold flex items-center gap-2 hover:border-muted-foreground/40 hover:bg-muted/40 transition-colors"
          >
            Relatório semanal
          </Link>
          <Link
            href="/treinos"
            className="h-[38px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 hover:brightness-110 transition-all"
          >
            <span className="text-base leading-none">+</span> Nova sessão
          </Link>
        </div>
      </div>

      {/* Next competition hero */}
      {stats?.nextCompetition && (() => {
        const comp = stats.nextCompetition;
        const daysUntil = Math.max(0, Math.ceil((new Date(comp.startDate).getTime() - now.getTime()) / 86_400_000));
        const dateRange = comp.endDate && comp.endDate !== comp.startDate
          ? `${new Date(comp.startDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}–${new Date(comp.endDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}`
          : new Date(comp.startDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
        return (
          <div className="relative overflow-hidden bg-primary text-primary-foreground rounded-2xl px-9 py-8 flex items-center gap-10">
            <span className="absolute inset-y-0 left-0 w-[5px] bg-brand-cyan" />
            <div className="flex flex-col gap-3 min-w-0">
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-brand-cyan-light">Próxima competição</p>
              <p className="text-[34px] font-bold tracking-tight leading-tight">{comp.name}</p>
              <div className="flex items-center gap-3.5 text-sm text-white/66">
                {comp.location && <span>{comp.location}</span>}
                {comp.location && <span className="w-1 h-1 rounded-full bg-white/30" />}
                <span>{dateRange}</span>
              </div>
            </div>
            <div className="flex-1" />
            <div className="flex items-stretch gap-6 shrink-0">
              <div className="flex flex-col gap-1 items-start">
                <span className="text-[54px] font-bold text-brand-cyan leading-none tracking-tight">{daysUntil}</span>
                <span className="font-mono text-[9.5px] tracking-widest uppercase text-white/55">Dias</span>
              </div>
              {stats.nextCompetitionRacesCount !== undefined && stats.nextCompetitionRacesCount > 0 && (
                <>
                  <span className="w-px bg-white/14" />
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-[54px] font-bold leading-none tracking-tight">{stats.nextCompetitionRacesCount}</span>
                    <span className="font-mono text-[9.5px] tracking-widest uppercase text-white/55">Provas</span>
                  </div>
                </>
              )}
              <Link
                href="/competicoes"
                className="self-center h-[42px] px-5 rounded-[10px] bg-brand-cyan text-[#04303A] text-[13.5px] font-bold flex items-center hover:brightness-110 transition-all whitespace-nowrap"
              >
                Ver competição
              </Link>
            </div>
          </div>
        );
      })()}

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-2xl p-[18px] flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Atletas ativos</span>
              <Users className="w-[15px] h-[15px] text-border" />
            </div>
            <span className="text-[38px] font-bold tracking-tight leading-none">{stats.activeAthletes}</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-[18px] flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Resultados</span>
              <Medal className="w-[15px] h-[15px] text-border" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[38px] font-bold tracking-tight leading-none">{stats.totalResults}</span>
              <span className="text-[13px] text-muted-foreground">registados</span>
            </div>
            <div className="font-mono text-[10.5px] text-muted-foreground tracking-wide">
              {stats.totalPodiums ?? 0} pódios · {stats.totalVictories ?? 0} vitórias
            </div>
          </div>

          <div
            className={cn(
              'rounded-2xl p-[18px] flex flex-col gap-3 border',
              (stats.overdueQuotasCount ?? 0) > 0
                ? 'bg-card border-border border-l-[5px] border-l-brand-danger shadow-[0_4px_16px_-4px_rgba(217,58,22,0.25)]'
                : 'bg-card border-border'
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn(
                'font-mono text-[10px] tracking-wider uppercase font-semibold',
                (stats.overdueQuotasCount ?? 0) > 0 ? 'text-brand-danger' : 'text-muted-foreground'
              )}>
                Quotas em atraso
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn(
                'text-[38px] font-bold tracking-tight leading-none',
                (stats.overdueQuotasCount ?? 0) > 0 && 'text-brand-danger'
              )}>
                {stats.overdueQuotasCount ?? 0}
              </span>
              <span className="text-[13px] text-brand-text-soft">
                atletas · {(stats.overdueQuotasAmount ?? 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
              </span>
            </div>
            {(stats.overdueQuotasCount ?? 0) > 0 && (
              <Link
                href="/quotas"
                className="h-8 rounded-lg bg-brand-danger text-white text-[12.5px] font-semibold flex items-center justify-center hover:brightness-110 transition-all"
              >
                Ver quotas em atraso
              </Link>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-[18px] flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Frota disponível</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[38px] font-bold tracking-tight leading-none">{stats.fleetAvailableCount ?? 0}</span>
              {stats.fleetTotalCount !== undefined && (
                <span className="text-[17px] font-semibold text-muted-foreground">/ {stats.fleetTotalCount}</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <span
                  className="block h-full bg-brand-cyan rounded-full"
                  style={{
                    width: stats.fleetTotalCount
                      ? `${Math.round(((stats.fleetAvailableCount ?? 0) / stats.fleetTotalCount) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
              <div className="font-mono text-[10.5px] text-muted-foreground">
                {stats.fleetInMaintenanceCount ?? 0} em manutenção
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Today's sessions + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4 items-stretch">
        <div className="bg-card border border-border rounded-2xl px-[22px] py-5 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-bold tracking-tight">Sessões de hoje</h2>
            <div className="flex-1" />
            <Link href="/horarios" className="font-mono text-[10.5px] tracking-wider uppercase font-semibold hover:text-brand-cyan-dark transition-colors">
              Horário completo
            </Link>
          </div>

          {stats && stats.upcomingSessions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.upcomingSessions.map((session) => {
                const status = sessionStatus(session.date, session.startTime, session.endTime);
                const isNow = status === 'a_decorrer';
                return (
                  <div
                    key={session.id}
                    className={cn(
                      'border rounded-xl p-4 flex flex-col gap-2',
                      isNow ? 'border-brand-cyan-border bg-brand-cyan-bg border-t-[3px] border-t-brand-cyan' : 'border-border border-t-[3px] border-t-muted'
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2.5">
                      <span className="font-mono text-xl font-semibold tracking-tight">{session.startTime}</span>
                      <span className={cn(
                        'font-mono text-[9.5px] font-semibold tracking-wider px-2 py-1 rounded-md uppercase whitespace-nowrap',
                        isNow ? 'bg-brand-cyan text-[#04303A]' : 'bg-muted text-muted-foreground'
                      )}>
                        {isNow ? 'A decorrer' : status === 'terminada' ? 'Terminada' : 'Agendada'}
                      </span>
                    </div>
                    <div className="text-[14.5px] font-semibold leading-snug">
                      {trainingTypeLabels[session.trainingType] ?? session.trainingType} · {session.groupCategory}
                    </div>
                    <div className="font-mono text-[10px] tracking-wide uppercase text-brand-text-soft">
                      {session.attendanceCount ?? 0} atletas
                    </div>
                    {session.trainerName && (
                      <div className="text-xs text-brand-text-soft">{session.trainerName}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem sessões agendadas para hoje.</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl px-[22px] py-5 flex flex-col gap-4.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-bold tracking-tight">Atenção</h2>
            {stats && stats.alerts && stats.alerts.length > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-brand-danger-soft-bg text-brand-danger">
                {stats.alerts.length}
              </span>
            )}
            <div className="flex-1" />
            <Link href="/lembretes" className="font-mono text-[10.5px] tracking-wider uppercase font-semibold hover:text-brand-cyan-dark transition-colors">
              Ver tudo
            </Link>
          </div>

          {stats && stats.alerts && stats.alerts.length > 0 ? (
            <div className="flex flex-col gap-3.5">
              {stats.alerts.map((alert, i) => {
                const style = alertStyles[alert.severity] ?? alertStyles.neutral;
                const AlertIcon = style.icon;
                return (
                  <div key={i} className={cn('flex items-start gap-3 p-3 rounded-xl border', style.bg, style.border)}>
                    <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', style.iconBg)}>
                      <AlertIcon className="w-3.5 h-3.5 text-white" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[13.5px] font-semibold leading-tight">{alert.title}</p>
                      <Link href={alert.href} className={cn('text-xs hover:text-foreground transition-colors', style.linkColor)}>
                        {alert.linkLabel} →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center flex-1">Sem alertas de momento.</p>
          )}
        </div>
      </div>

      {/* Section grid */}
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-bold tracking-tight">Áreas de gestão</h2>
          <span className="flex-1 h-px bg-border" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group bg-card border border-border rounded-2xl p-[18px] flex flex-col gap-3 transition-all duration-150 hover:shadow-[0_10px_26px_-6px_rgba(11,30,61,0.18)] hover:-translate-y-0.5 hover:border-brand-cyan-border"
              >
                <div className="w-[34px] h-[34px] rounded-[10px] bg-brand-cyan-bg flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-brand-cyan-dark" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm leading-snug">{section.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{section.description}</p>
                </div>
                {section.stat ? (
                  <span className={cn(
                    'font-mono text-[10.5px] tracking-wide uppercase',
                    section.statTone === 'danger' ? 'text-brand-danger' : 'text-muted-foreground'
                  )}>
                    {section.stat}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    Aceder <ArrowRight className="w-3 h-3" />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
