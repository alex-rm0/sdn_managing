import { useState } from 'react';
import { useListCompetitions } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Copy, RotateCw, Newspaper } from 'lucide-react';

interface Draft {
  headline: string;
  body: string;
}

export default function NoticiaIA() {
  const { toast } = useToast();
  const { data: competitions = [], isLoading: loadingCompetitions } = useListCompetitions();
  const [competitionId, setCompetitionId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const handleGenerate = async () => {
    if (!competitionId) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/competitions/${competitionId}/noticia`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Erro ao gerar notícia');
      }
      const data = await res.json();
      setDraft({ headline: data.headline ?? '', body: data.body ?? '' });
    } catch (err) {
      toast({
        title: 'Erro ao gerar notícia',
        description: err instanceof Error ? err.message : 'Tenta novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(`${draft.headline}\n\n${draft.body}`);
    toast({ title: 'Copiado para a área de transferência' });
  };

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex items-end gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[10.5px] tracking-widest uppercase text-brand-cyan">Comunicação</p>
          <p className="text-sm text-muted-foreground max-w-lg">
            Gera um rascunho de notícia a partir dos resultados de uma competição, com IA. O texto é sempre editável antes de usares — nada é publicado ou guardado automaticamente.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Competição</label>
            <Select value={competitionId} onValueChange={setCompetitionId} disabled={loadingCompetitions}>
              <SelectTrigger><SelectValue placeholder="Selecionar competição" /></SelectTrigger>
              <SelectContent>
                {competitions.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={!competitionId || isGenerating} className="gap-2">
            {isGenerating ? <RotateCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? 'A gerar…' : draft ? 'Gerar novamente' : 'Gerar notícia'}
          </Button>
        </div>

        {!draft && !isGenerating && (
          <div className="text-center py-12 text-muted-foreground">
            <Newspaper className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Escolhe uma competição com resultados registados e gera um rascunho.</p>
          </div>
        )}

        {draft && (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rascunho</label>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={handleCopy}>
                <Copy className="w-3 h-3" /> Copiar
              </Button>
            </div>
            <Input
              value={draft.headline}
              onChange={e => setDraft({ ...draft, headline: e.target.value })}
              className="text-lg font-bold h-auto py-2.5"
              placeholder="Título"
            />
            <Textarea
              value={draft.body}
              onChange={e => setDraft({ ...draft, body: e.target.value })}
              rows={14}
              className="text-sm leading-relaxed resize-y"
              placeholder="Corpo da notícia"
            />
          </div>
        )}
      </div>
    </div>
  );
}
