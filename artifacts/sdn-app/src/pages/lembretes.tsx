import { Link } from 'wouter';
import { useGetReminders } from '@workspace/api-client-react';
import type { ReminderItem } from '@workspace/api-client-react';
import {
  Receipt, CalendarClock, Wrench, FileText, Trophy, AlertTriangle, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const categoryIcons: Record<ReminderItem['category'], React.ComponentType<{ className?: string }>> = {
  quota: Receipt,
  meeting: CalendarClock,
  fleet: Wrench,
  contract: FileText,
  competition: Trophy,
};

const categoryLabels: Record<ReminderItem['category'], string> = {
  quota: 'Quotas',
  meeting: 'Reuniões',
  fleet: 'Frota / Equipamento',
  contract: 'Contratos',
  competition: 'Competições',
};

const severityStyles: Record<ReminderItem['severity'], { iconBg: string; border: string; bg: string }> = {
  danger: { iconBg: 'bg-brand-danger', border: 'border-brand-danger-border', bg: 'bg-brand-danger-bg' },
  info: { iconBg: 'bg-brand-cyan', border: 'border-brand-cyan-border', bg: 'bg-brand-cyan-bg' },
  neutral: { iconBg: 'bg-muted-foreground', border: 'border-border', bg: 'bg-muted/40' },
};

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Lembretes() {
  const { data, isLoading } = useGetReminders();
  const items = data?.items ?? [];

  const grouped = items.reduce<Record<string, ReminderItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const order: ReminderItem['category'][] = ['quota', 'meeting', 'fleet', 'contract', 'competition'];
  const dangerCount = items.filter(i => i.severity === 'danger').length;

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex items-end gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[10.5px] tracking-widest uppercase text-brand-cyan">Gestão</p>
          <p className="text-sm text-muted-foreground max-w-lg">
            Tudo o que precisa de atenção — quotas em atraso, reuniões pendentes, manutenção de frota, contratos a expirar e competições a aproximarem-se.
          </p>
        </div>
        <div className="flex-1" />
        {dangerCount > 0 && (
          <div className="flex items-center gap-2 h-[34px] px-3 rounded-lg bg-brand-danger-bg border border-brand-danger-border">
            <AlertTriangle className="w-3.5 h-3.5 text-brand-danger" />
            <span className="font-mono text-[11px] font-semibold text-brand-danger-dark uppercase">
              {dangerCount} {dangerCount === 1 ? 'urgente' : 'urgentes'}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">A carregar lembretes...</p>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-16 flex flex-col items-center gap-3">
          <Bell className="w-8 h-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Sem lembretes de momento. Está tudo em dia.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {order.filter(cat => grouped[cat]?.length).map(cat => {
            const CategoryIcon = categoryIcons[cat];
            return (
              <div key={cat} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <CategoryIcon className="w-4 h-4 text-brand-cyan-dark" />
                  <h2 className="text-[15px] font-bold tracking-tight">{categoryLabels[cat]}</h2>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {grouped[cat].length}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {grouped[cat].map(item => {
                    const style = severityStyles[item.severity];
                    return (
                      <div key={item.id} className={cn('flex items-start gap-3 p-3 rounded-xl border', style.bg, style.border)}>
                        <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', style.iconBg)} />
                        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                          <p className="text-[13.5px] font-semibold leading-tight">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          )}
                          {item.date && (
                            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">{formatDate(item.date)}</p>
                          )}
                        </div>
                        <Link href={item.href} className="text-xs font-medium text-brand-cyan-dark hover:text-foreground transition-colors whitespace-nowrap">
                          Ver →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
