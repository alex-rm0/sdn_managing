import { Search } from 'lucide-react';
import { isMacPlatform } from '@/lib/utils';

interface HeaderProps {
  crumb: string;
  seasonLabel?: string | null;
  onSearchClick?: () => void;
}

export function Header({ crumb, seasonLabel, onSearchClick }: HeaderProps) {
  const shortcutHint = isMacPlatform() ? '⌘K' : 'Ctrl K';

  return (
    <header className="h-16 shrink-0 sticky top-0 z-10 flex items-center gap-4 px-8 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase text-muted-foreground">
        <span>SDN</span>
        <span className="text-border">/</span>
        <span className="text-foreground font-semibold">{crumb}</span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onSearchClick}
        className="hidden md:flex items-center gap-2 h-[34px] px-3 rounded-lg border border-border bg-card w-[260px] hover:border-muted-foreground/40 transition-colors"
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[13px] text-muted-foreground flex-1 text-left">Procurar…</span>
        <span className="font-mono text-[10px] text-muted-foreground border border-border rounded px-1 whitespace-nowrap">{shortcutHint}</span>
      </button>

      {seasonLabel && (
        <div className="flex items-center gap-2 h-[34px] px-3 rounded-lg bg-brand-cyan-bg border border-brand-cyan-border">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
          <span className="font-mono text-[11px] font-semibold tracking-wide text-brand-cyan-dark uppercase whitespace-nowrap">
            {seasonLabel}
          </span>
        </div>
      )}
    </header>
  );
}
