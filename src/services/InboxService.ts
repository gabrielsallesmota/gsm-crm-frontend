import { apiRequest } from "../repositories/api/ApiClient";
import { isDemoMode } from "./factory";
import type { InboxItem, InboxPage } from "../types/inbox";

interface InboxItemDto {
  id: string;
  kind: InboxItem["kind"];
  title: string;
  body: string;
  link: string | null;
  created_at: string;
  read: boolean;
}

const BASE = "/api/v1/inbox";

function toItem(dto: InboxItemDto): InboxItem {
  return {
    id: dto.id,
    kind: dto.kind,
    title: dto.title,
    body: dto.body,
    link: dto.link,
    createdAt: dto.created_at,
    read: dto.read,
  };
}

/** Caixa de avisos do usuário (tarefa/compromisso atrelado a ele). Em modo
 * demonstração não há backend: a caixa é sempre vazia. */
export const inboxService = {
  async list(limit = 30): Promise<InboxPage> {
    if (isDemoMode) return { items: [], unread: 0 };
    const dto = await apiRequest<{ items: InboxItemDto[]; unread: number }>(`${BASE}?limit=${limit}`);
    return { items: dto.items.map(toItem), unread: dto.unread };
  },

  async markRead(id: string): Promise<void> {
    if (isDemoMode) return;
    await apiRequest<void>(`${BASE}/${id}/read`, { method: "POST" });
  },

  async markAllRead(): Promise<void> {
    if (isDemoMode) return;
    await apiRequest<{ marked: number }>(`${BASE}/read-all`, { method: "POST" });
  },
};
