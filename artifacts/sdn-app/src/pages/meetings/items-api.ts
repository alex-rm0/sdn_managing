import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface PendingItem {
  id: number;
  text: string;
  originMeetingId: number;
  status: 'pendente' | 'resolvido';
  resolvedNote?: string | null;
  resolvedAt?: string | null;
  resolvedInMeetingId?: number | null;
  createdAt: string;
}

export interface ActionItem {
  id: number;
  text: string;
  assignedToName: string;
  originMeetingId: number;
  status: 'pendente' | 'resolvido';
  resolvedNote?: string | null;
  resolvedAt?: string | null;
  resolvedInMeetingId?: number | null;
  createdAt: string;
}

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Erro ${res.status}`);
  }
  return res.json();
}

// ── Pending items ──────────────────────────────────────────────────────────

export const pendingItemsQueryKey = ['/api/pending-items'] as const;

export function useListPendingItems() {
  return useQuery({
    queryKey: pendingItemsQueryKey,
    queryFn: () => jsonFetch<PendingItem[]>('/api/pending-items'),
  });
}

export function createPendingItem(meetingId: number, text: string) {
  return jsonFetch<PendingItem>(`/api/meetings/${meetingId}/pending-items`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function resolvePendingItem(id: number, meetingId?: number, resolvedNote?: string) {
  return jsonFetch<PendingItem>(`/api/pending-items/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolvedInMeetingId: meetingId ?? null, resolvedNote }),
  });
}

// ── Action items ───────────────────────────────────────────────────────────

export const actionItemsQueryKey = ['/api/action-items'] as const;

export function useListActionItems() {
  return useQuery({
    queryKey: actionItemsQueryKey,
    queryFn: () => jsonFetch<ActionItem[]>('/api/action-items'),
  });
}

export function createActionItem(meetingId: number, text: string, assignedToName: string) {
  return jsonFetch<ActionItem>(`/api/meetings/${meetingId}/action-items`, {
    method: 'POST',
    body: JSON.stringify({ text, assignedToName }),
  });
}

export function resolveActionItem(id: number, meetingId?: number, resolvedNote?: string) {
  return jsonFetch<ActionItem>(`/api/action-items/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolvedInMeetingId: meetingId ?? null, resolvedNote }),
  });
}

// ── Items scoped to one meeting (for rendering inside the ata itself) ───────

export function useMeetingItems(meetingId?: number) {
  return useQuery({
    queryKey: ['/api/meetings', meetingId, 'items'],
    queryFn: () => jsonFetch<{ pending: PendingItem[]; actions: ActionItem[] }>(`/api/meetings/${meetingId}/items`),
    enabled: meetingId != null,
  });
}

export function useInvalidateMeetingItems() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: pendingItemsQueryKey });
    qc.invalidateQueries({ queryKey: actionItemsQueryKey });
    qc.invalidateQueries({
      predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === '/api/meetings' && q.queryKey[q.queryKey.length - 1] === 'items',
    });
  };
}
