import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Anchor,
  CalendarDays,
  Trophy,
  Medal,
  Wallet,
  Receipt,
  Sailboat,
  Wrench,
  Dumbbell,
  Clock,
  ShieldAlert,
  FileText,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">A carregar...</div>;
  }

  if (!user) {
    return null; // Should be redirected by Route guards
  }

  const isAdmin = user.role === 'admin';

  const adminLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/atletas', label: 'Atletas', icon: Users },
    { href: '/tripulacoes', label: 'Tripulações', icon: Anchor },
    { href: '/epocas', label: 'Épocas', icon: CalendarDays },
    { href: '/resultados', label: 'Resultados', icon: Medal },
    { href: '/competicoes', label: 'Competições', icon: Trophy },
    { href: '/financeiro', label: 'Financeiro', icon: Wallet },
    { href: '/quotas', label: 'Quotas', icon: Receipt },
    { href: '/embarcacoes', label: 'Embarcações', icon: Sailboat },
    { href: '/equipamento', label: 'Equipamento', icon: Wrench },
    { href: '/treinos', label: 'Treinos', icon: Dumbbell },
    { href: '/horarios', label: 'Horários', icon: Clock },
    { href: '/documentos', label: 'Documentos', icon: FileText },
    { href: '/utilizadores', label: 'Utilizadores', icon: ShieldAlert },
  ];

  const trainerLinks = [
    { href: '/treinos', label: 'Treinos', icon: Dumbbell },
  ];

  const links = isAdmin ? adminLinks : trainerLinks;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shrink-0 fixed inset-y-0 left-0">
        <div className="p-6 border-b border-sidebar-border/50">
          <h1 className="text-xl font-bold tracking-tight">SDN Gestão</h1>
          <p className="text-xs text-sidebar-foreground/60 mt-1 uppercase tracking-wider font-semibold">
            Secção de Desportos Náuticos
          </p>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {links.map((link) => {
              const isActive = location === link.href || (link.href !== '/' && location.startsWith(link.href));
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{user.role}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full justify-start text-sidebar-foreground bg-sidebar-accent/30 border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" 
            onClick={() => logout()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Terminar Sessão
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 min-w-0 p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
