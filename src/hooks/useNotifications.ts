import { useState } from "react";
import { notificationsService } from "../services/NotificationsService";
import type { Page } from "../types/common";
import type {
  Delivery,
  DeliveryFilters,
  MyPreferences,
  NotificationSettings,
  Recipient,
} from "../types/notifications";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Leituras da Central de Notificações (CRM-003B.3). GET nunca grava nada
 * (o backend devolve o padrão aprovado sem persistir). Mutações chamam
 * `notificationsService` direto nos componentes, com salvar explícito. */
export function useNotificationSettings(): AsyncResourceState<NotificationSettings> {
  return useAsyncResource(() => notificationsService.getSettings(), []);
}

export function useMyNotificationPreferences(): AsyncResourceState<MyPreferences> {
  return useAsyncResource(() => notificationsService.getMyPreferences(), []);
}

export function useNotificationRecipients(page: number): AsyncResourceState<Page<Recipient>> {
  return useAsyncResource(() => notificationsService.listRecipients(page), [page]);
}

export function useNotificationDeliveries(
  filters: DeliveryFilters,
  page: number,
): AsyncResourceState<Page<Delivery>> {
  return useAsyncResource(
    () => notificationsService.listDeliveries(filters, page),
    [filters.recipientUserId, filters.kind, filters.status, filters.dateFrom, filters.dateTo, page],
  );
}

/**
 * Dado do servidor + a versão devolvida por um "Salvar" (`setValue`). Quando
 * o servidor entrega dados NOVOS (primeira carga ou "Recarregar"), o
 * override some e `epoch` muda — use como `key` para os formulários
 * remontarem a partir do estado real, sem perder rascunho em salvamentos.
 */
export function useEditableResource<T>(state: AsyncResourceState<T>): {
  value: T | null;
  setValue: (next: T) => void;
  epoch: number;
} {
  const [override, setOverride] = useState<T | null>(null);
  const [seen, setSeen] = useState<T | null>(state.data);
  const [epoch, setEpoch] = useState(0);
  if (state.data !== seen) {
    setSeen(state.data);
    setOverride(null);
    setEpoch((e) => e + 1);
  }
  return { value: override ?? state.data, setValue: setOverride, epoch };
}
