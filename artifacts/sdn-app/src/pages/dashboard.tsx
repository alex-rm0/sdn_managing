import { Link } from 'wouter';
import { useGetDashboard } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, Anchor, Trophy, Medal, Wallet, Receipt,
  Package, Dumbbell, Clock, FileText, ShieldAlert,
  CalendarDays, BarChart3, ArrowRight, Sailboat,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SectionCard {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: string;
}

const sections: SectionCard[] = [
  {
    href: '/treinos',
    icon: Dumbbell,
    title: 'Treinos',
    description: 'Registo de sessões e presenças',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
  },
  {
    href: '/atletas',
    icon: Users,
    title: 'Atletas',
    description: 'Fichas, categorias e histórico',
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    href: '/tripulacoes',
    icon: Anchor,
    title: 'Tripulações',
    description: 'Composição das equipas por época',
    color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40',
  },
  {
    href: '/competicoes',
    icon: Trophy,
    title: 'Competições',
    description: 'Eventos e provas oficiais',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
  },
  {
    href: '/resultados',
    icon: Medal,
    title: 'Resultados',
    description: 'Classificações e tempos',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40',
  },
  {
    href: '/epocas',
    icon: CalendarDays,
    title: 'Épocas',
    description: 'Gestão das épocas desportivas',
    color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40',
  },
  {
    href: '/financeiro',
    icon: Wallet,
    title: 'Financeiro',
    description: 'Receitas, despesas e balanço',
    color: 'text-green-600 bg-green-50 dark:bg-green-950/40',
  },
  {
    href: '/quotas',
    icon: Receipt,
    title: 'Quotas',
    description: 'Pagamentos e situação dos sócios',
    color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40',
  },
  {
    href: '/inventario',
    icon: Package,
    title: 'Inventário',
    description: 'Embarcações e equipamento',
    color: 'text-slate-600 bg-slate-50 dark:bg-slate-900/40',
  },
  {
    href: '/horarios',
    icon: Clock,
    title: 'Horários',
    description: 'Planeamento semanal de treinos',
    color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40',
  },
  {
    href: '/documentos',
    icon: FileText,
    title: 'Documentos',
    description: 'Contratos, notícias e arquivo',
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40',
  },
  {
    href: '/utilizadores',
    icon: ShieldAlert,
    title: 'Utilizadores',
    description: 'Contas e permissões de acesso',
    color: 'text-gray-600 bg-gray-50 dark:bg-gray-900/40',
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats } = useGetDashboard();

  const today = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{todayFormatted}</p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">
            Olá, {user?.name.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Secção de Desportos Náuticos — AAC</p>
        </div>
        <Link href="/estatisticas">
          <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <BarChart3 className="w-4 h-4" />
            Ver estatísticas
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>

      {/* Quick stats strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Atletas ativos</p>
            <p className="text-2xl font-bold">{stats.activeAthletes}</p>
          </div>
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Tripulações</p>
            <p className="text-2xl font-bold">{stats.totalCrews}</p>
          </div>
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Quotas em atraso</p>
            <p className="text-2xl font-bold text-destructive">{stats.overdueQuotasCount}</p>
          </div>
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Frota disponível</p>
            <p className="text-2xl font-bold">{stats.fleetAvailableCount}</p>
          </div>
        </div>
      )}

      {/* Section grid */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Secções</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} href={section.href}>
                <Card className="group cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 border-border/60 h-full">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', section.color)}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm leading-snug">{section.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{section.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      Aceder <ArrowRight className="w-3 h-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
