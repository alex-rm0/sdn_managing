import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useGetSearch } from '@workspace/api-client-react';
import type { SearchResultItem, SearchResponse } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Users, Trophy, Medal, FileText, Dumbbell, Loader2 } from 'lucide-react';

const typeIcons: Record<SearchResultItem['type'], React.ComponentType<{ className?: string }>> = {
  athlete: Users,
  competition: Trophy,
  result: Medal,
  document: FileText,
  session: Dumbbell,
};

const typeLabels: Record<SearchResultItem['type'], string> = {
  athlete: 'Atletas',
  competition: 'Competições',
  result: 'Resultados',
  document: 'Documentos',
  session: 'Sessões',
};

interface SearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchPalette({ open, onOpenChange }: SearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [, setLocation] = useLocation();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const trimmed = debounced.trim();
  // `queryKey` is computed automatically by the generated hook when omitted (see
  // getGetSearchQueryOptions) — the generated UseQueryOptions type doesn't reflect
  // that it's optional, same pre-existing quirk as AuthContext.tsx's useGetMe call.
  const { data, isFetching } = useGetSearch<SearchResponse>(
    { q: trimmed },
    { query: { enabled: trimmed.length >= 2 } as any },
  );
  const items = data?.items ?? [];

  const grouped = useMemo(() => {
    const map = new Map<SearchResultItem['type'], SearchResultItem[]>();
    for (const item of items) {
      if (!map.has(item.type)) map.set(item.type, []);
      map.get(item.type)!.push(item);
    }
    return map;
  }, [items]);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    setLocation(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-xl gap-0">
        <DialogTitle className="sr-only">Pesquisa global</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Procurar atletas, resultados, competições, documentos, sessões…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {trimmed.length < 2 ? (
              <CommandEmpty>Escreve pelo menos 2 letras para pesquisar.</CommandEmpty>
            ) : isFetching ? (
              <div className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> A procurar...
              </div>
            ) : items.length === 0 ? (
              <CommandEmpty>Sem resultados para "{trimmed}".</CommandEmpty>
            ) : (
              [...grouped.entries()].map(([type, groupItems]) => {
                const Icon = typeIcons[type];
                return (
                  <CommandGroup key={type} heading={typeLabels[type]}>
                    {groupItems.map(item => (
                      <CommandItem key={item.id} value={item.id} onSelect={() => handleSelect(item.href)}>
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
