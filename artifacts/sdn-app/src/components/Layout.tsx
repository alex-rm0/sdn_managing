import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useListSeasons } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import {
  Home,
  BarChart3,
  Users,
  CalendarDays,
  Trophy,
  Medal,
  Sparkles,
  Wallet,
  Receipt,
  Package,
  Dumbbell,
  Clock,
  ShieldAlert,
  FileText,
  LogOut,
  BookOpen,
  UserSquare2,
  Bell,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { SearchPalette } from '@/components/SearchPalette';

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
      { href: '/lembretes',   label: 'Lembretes',    icon: Bell },
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
      { href: '/noticia-ia',  label: 'Notícia IA',  icon: Sparkles },
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
      { href: '/equipa',       label: 'Equipa',       icon: UserSquare2 },
      { href: '/reunioes',     label: 'Reuniões',     icon: BookOpen },
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
  const { data: seasons = [] } = useListSeasons();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isShortcut) {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">A carregar...</div>;
  }
  if (!user) return null;

  const groups = user.role === 'admin' ? adminGroups : trainerGroups;
  const activeSeason = seasons.find(s => s.active);

  const currentItem = groups.flatMap(g => g.items).find(item =>
    location === item.href || (item.href !== '/' && location.startsWith(item.href))
  );
  const crumb = currentItem?.label ?? 'Início';

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-[268px] bg-sidebar text-sidebar-foreground flex flex-col shrink-0 fixed inset-y-0 left-0">
        {/* Logo / brand */}
        <div className="px-5 py-[22px] pb-[18px] flex items-center gap-3 border-b border-white/8">
          <div className="w-[42px] h-[42px] rounded-xl bg-white flex items-center justify-center shrink-0 p-1 shadow-lg">
            <img src="/logo-sdn.png" alt="SDN" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-lg font-bold leading-none tracking-tight">SDN</p>
            <p className="font-mono text-[9.5px] tracking-widest uppercase text-white/50 leading-tight">Desportos Náuticos · AAC</p>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 py-5 px-3 overflow-y-auto flex flex-col gap-[26px]">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p className="font-mono text-[9.5px] font-semibold tracking-widest uppercase text-white/50 px-3 pb-2">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== '/' && location.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative flex items-center gap-[11px] px-3 py-[9px] rounded-lg text-[13.5px] font-medium transition-colors',
                      isActive
                        ? 'bg-brand-cyan/16 text-white'
                        : 'text-white/62 hover:bg-white/6 hover:text-white'
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-[9px] bottom-[9px] w-[3px] rounded-r-[3px] bg-brand-cyan" />
                    )}
                    <Icon className="w-[15px] h-[15px] shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-3.5 border-t border-white/8 flex items-center gap-[11px]">
          <div className="w-[34px] h-[34px] rounded-[10px] bg-white/10 flex items-center justify-center font-mono text-xs font-semibold text-brand-cyan-light shrink-0">
            {user.name.split(' ').map((p: string) => p.charAt(0)).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold truncate">{user.name}</p>
            <p className="font-mono text-[9.5px] tracking-wide uppercase text-white/42 truncate">
              {user.role === 'admin' ? 'Direção · Admin' : 'Treinador'}
            </p>
          </div>
          <button
            onClick={() => logout()}
            className="text-white/45 hover:text-white transition-colors shrink-0"
            title="Terminar sessão"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-[268px] min-w-0 flex flex-col">
        <Header
          crumb={crumb}
          seasonLabel={activeSeason ? `Época ${activeSeason.name}` : null}
          onSearchClick={() => setSearchOpen(true)}
        />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
