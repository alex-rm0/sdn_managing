import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListTeamMembers, useCreateTeamMember, useUpdateTeamMember, useDeleteTeamMember,
  getListTeamMembersQueryKey,
} from '@workspace/api-client-react';
import type { TeamMember, TeamMemberRole } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, UserCheck, UserX, Users } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<TeamMemberRole, string> = {
  direcao: 'Direção',
  treinador: 'Treinadores',
  funcionario: 'Funcionários',
};

const TABS: { value: TeamMemberRole; label: string }[] = [
  { value: 'direcao',    label: 'Direção' },
  { value: 'treinador',  label: 'Treinadores' },
  { value: 'funcionario',label: 'Funcionários' },
];

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  role: TeamMemberRole;
  position: string;
  portfolio: string;
  notes: string;
  active: boolean;
}

function emptyForm(role: TeamMemberRole = 'direcao'): FormState {
  return { name: '', role, position: '', portfolio: '', notes: '', active: true };
}

function memberToForm(m: TeamMember): FormState {
  return {
    name: m.name,
    role: m.role,
    position: m.position ?? '',
    portfolio: m.portfolio ?? '',
    notes: m.notes ?? '',
    active: m.active,
  };
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({
  member,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  member: TeamMember;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className={`group transition-all ${!member.active ? 'opacity-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
            member.role === 'direcao' ? 'bg-blue-100 text-blue-700' :
            member.role === 'treinador' ? 'bg-green-100 text-green-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {initials(member.name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{member.name}</span>
              {!member.active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>}
            </div>
            {member.position && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {member.role === 'treinador' ? `Escalão: ${member.position}` : member.position}
              </p>
            )}
            {member.portfolio && (
              <p className="text-xs text-primary/70 mt-0.5">
                {member.role === 'treinador' ? `Modalidade: ${member.portfolio}` : `Pelouro: ${member.portfolio}`}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Editar">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`h-7 w-7 ${member.active ? 'text-muted-foreground hover:text-amber-600' : 'text-muted-foreground hover:text-green-600'}`}
              onClick={onToggleActive}
              title={member.active ? 'Desativar' : 'Reativar'}
            >
              {member.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Eliminar">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar {member.name}?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EquipaPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useListTeamMembers();

  const createMutation = useCreateTeamMember();
  const updateMutation = useUpdateTeamMember();
  const deleteMutation = useDeleteTeamMember();

  const [activeTab, setActiveTab] = useState<TeamMemberRole>('direcao');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm(activeTab));
    setDialogOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditTarget(m);
    setForm(memberToForm(m));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    const payload = {
      name: form.name.trim(),
      role: form.role,
      position: form.position.trim() || null,
      portfolio: form.portfolio.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    };
    try {
      if (editTarget) {
        await updateMutation.mutateAsync({ id: editTarget.id, data: payload });
        toast({ title: 'Membro atualizado' });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: 'Membro adicionado' });
      }
      setDialogOpen(false);
      invalidate();
    } catch {
      toast({ title: 'Erro ao guardar', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (m: TeamMember) => {
    await updateMutation.mutateAsync({ id: m.id, data: { active: !m.active } });
    invalidate();
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync({ id });
    toast({ title: 'Membro eliminado' });
    invalidate();
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-end items-center">
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TeamMemberRole)}>
          <TabsList>
            {TABS.map(t => {
              const count = members.filter(m => m.role === t.value).length;
              return (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  {count > 0 && <span className="ml-1.5 text-xs opacity-60">({count})</span>}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {TABS.map(tab => {
            const group = members.filter(m => m.role === tab.value);
            const active = group.filter(m => m.active);
            const inactive = group.filter(m => !m.active);
            return (
              <TabsContent key={tab.value} value={tab.value} className="mt-4">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">A carregar…</p>
                ) : group.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhum membro em {tab.label}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>Adicionar</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Active members */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {active.map(m => (
                        <MemberCard
                          key={m.id} member={m}
                          onEdit={() => openEdit(m)}
                          onToggleActive={() => handleToggleActive(m)}
                          onDelete={() => handleDelete(m.id)}
                        />
                      ))}
                    </div>
                    {/* Inactive members */}
                    {inactive.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-4">Inativos</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {inactive.map(m => (
                            <MemberCard
                              key={m.id} member={m}
                              onEdit={() => openEdit(m)}
                              onToggleActive={() => handleToggleActive(m)}
                              onDelete={() => handleDelete(m.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar membro' : 'Novo membro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome *</label>
              <Input placeholder="Nome completo" value={form.name} onChange={e => set({ name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grupo</label>
              <Select value={form.role} onValueChange={v => set({ role: v as TeamMemberRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direcao">Direção</SelectItem>
                  <SelectItem value="treinador">Treinador</SelectItem>
                  <SelectItem value="funcionario">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === 'treinador' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Escalão</label>
                  <Input placeholder="Sub-12, Juniores, Seniores…" value={form.position} onChange={e => set({ position: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modalidade</label>
                  <Input placeholder="Remo Olímpico, Remo Indoor, Remo de Mar…" value={form.portfolio} onChange={e => set({ portfolio: e.target.value })} />
                </div>
              </div>
            ) : form.role === 'direcao' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cargo</label>
                  <Input placeholder="Presidente, Secretário…" value={form.position} onChange={e => set({ position: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pelouro</label>
                  <Input placeholder="Desporto, Financeiro…" value={form.portfolio} onChange={e => set({ portfolio: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cargo</label>
                <Input placeholder="Responsável de secretaria, Monitor…" value={form.position} onChange={e => set({ position: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notas</label>
              <Textarea placeholder="Observações…" value={form.notes} onChange={e => set({ notes: e.target.value })} rows={2} className="resize-none" />
            </div>
            {editTarget && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => set({ active: e.target.checked })} className="rounded" />
                <span className="text-sm">Ativo</span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving || !form.name.trim()}>
              {isSaving ? 'A guardar…' : editTarget ? 'Guardar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
