import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Home,
  BarChart3,
  Users,
  CalendarDays,
  Trophy,
  Medal,
  Wallet,
  Receipt,
  Package,
  Dumbbell,
  Clock,
  ShieldAlert,
  FileText,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const adminGroups: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { href: '/',            label: 'Início',       icon: Home },
      { href: '/estatisticas',label: 'Estatísticas', icon: BarChart3 },
    ],
  },
  {
    label: 'Treinos',
    items: [
      { href: '/treinos',  label: 'Sessões',   icon: Dumbbell },
      { href: '/horarios', label: 'Horários',  icon: Clock },
    ],
  },
  {
    label: 'Desporto',
    items: [
      { href: '/atletas',     label: 'Atletas',     icon: Users },
      { href: '/competicoes', label: 'Competições', icon: Trophy },
      { href: '/resultados',  label: 'Resultados',  icon: Medal },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/epocas',      label: 'Épocas',      icon: CalendarDays },
      { href: '/financeiro',  label: 'Financeiro',  icon: Wallet },
      { href: '/quotas',      label: 'Quotas',      icon: Receipt },
    ],
  },
  {
    label: 'Inventário',
    items: [
      { href: '/inventario', label: 'Material', icon: Package },
    ],
  },
  {
    label: 'Administração',
    items: [
      { href: '/documentos',   label: 'Documentos',   icon: FileText },
      { href: '/utilizadores', label: 'Utilizadores', icon: ShieldAlert },
    ],
  },
];

const trainerGroups: NavGroup[] = [
  {
    label: 'Treinos',
    items: [
      { href: '/treinos', label: 'Sessões', icon: Dumbbell },
    ],
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">A carregar...</div>;
  }
  if (!user) return null;

  const groups = user.role === 'admin' ? adminGroups : trainerGroups;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shrink-0 fixed inset-y-0 left-0">
        {/* Logo / brand */}
        <div className="p-5 border-b border-sidebar-border/50 flex items-center gap-3">
          <img src="/logo-sdn.png" alt="SDN" className="w-8 h-8 object-contain opacity-90" />
          <div>
            <p className="text-sm font-bold leading-none">SDN</p>
            <p className="text-[10px] text-sidebar-foreground/50 mt-0.5 uppercase tracking-wider">AAC</p>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.label} className="mb-1">
              <p className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </p>
              <ul className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const isActive =
                    location === item.href ||
                    (item.href !== '/' && location.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-sidebar-border/50">
          <div className="flex items-center gap-2.5 mb-3 px-2">
            <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{user.name}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate capitalize">{user.role === 'admin' ? 'Administrador' : 'Treinador'}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-sidebar-foreground bg-sidebar-accent/20 border-sidebar-border/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-xs"
            onClick={() => logout()}
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Terminar Sessão
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-60 min-w-0 p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
