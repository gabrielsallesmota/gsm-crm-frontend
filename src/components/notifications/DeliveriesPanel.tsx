import { useMemo, useState } from "react";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import form from "../common/Form.module.css";
import { useNotificationDeliveries } from "../../hooks/useNotifications";
import { describeError } from "../../utils/apiErrors";
import {
  DELIVERY_KIND_LABELS,
  DELIVERY_REASON_LABELS,
  DELIVERY_STATUS_LABELS,
  deliveryStageLabel,
  formatInZone,
} from "../../utils/notifications";
import type { DeliveryKind, DeliveryStatus } from "../../types/notifications";
import styles from "../integrations/Integrations.module.css";
import local from "./Notifications.module.css";

const STATUS_OPTIONS: DeliveryStatus[] = [
  "skipped",
  "channel_unavailable",
  "sent",
  "failed",
  "expired",
];
const KIND_OPTIONS: DeliveryKind[] = [
  "daily_digest",
  "weekly_report",
  "monthly_report",
  "new_lead_alert",
  "follow_up_alert",
  "unassigned_lead_alert",
  "stalled_lead_alert",
];

/**
 * Histórico. `skipped` e `channel_unavailable` NUNCA aparecem como envio:
 * são estados finais sem mensagem. `pending` aceita pelo n8n NÃO é envio:
 * só “Enviada”/“Entregue” (confirmação do provedor) contam. Datas no
 * fuso efetivo de quem está vendo.
 */
export function DeliveriesPanel({
  timezone,
  recipientNames,
  showRecipient,
}: {
  timezone: string;
  recipientNames?: Record<string, string>;
  showRecipient: boolean;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DeliveryStatus | "">("");
  const [kind, setKind] = useState<DeliveryKind | "">("");
  const filters = useMemo(
    () => ({ status: status || undefined, kind: kind || undefined }),
    [status, kind],
  );
  const { data, loading, error, reload } = useNotificationDeliveries(filters, page);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  // Há entrega que realmente entrou no fluxo do n8n (pendente/enviada/falha)?
  const channelLive = (data?.items ?? []).some((d) =>
    ["pending", "sent", "failed"].includes(d.status),
  );

  return (
    <section aria-labelledby="deliveries-title">
      <h2 id="deliveries-title" className="sr-only">
        Histórico de notificações
      </h2>
      <p className={`${local.notice} ${local.info}`}>
        {channelLive
          ? "“Aceita” significa só que o pedido chegou ao n8n; a mensagem conta como enviada quando o provedor de WhatsApp confirma."
          : "O canal WhatsApp ainda não está disponível: nenhuma notificação foi enviada. Os registros abaixo mostram o que o sistema teria enviado e por que não saiu."}
      </p>
      <div className={local.toolbarRow}>
        <select
          className={form.select}
          aria-label="Filtrar por situação"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as DeliveryStatus | "");
            setPage(1);
          }}
        >
          <option value="">Todas as situações</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {DELIVERY_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className={form.select}
          aria-label="Filtrar por tipo"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as DeliveryKind | "");
            setPage(1);
          }}
        >
          <option value="">Todos os tipos</option>
          {KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {DELIVERY_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <Button onClick={reload}>Atualizar</Button>
      </div>
      {loading && !data ? (
        <SkeletonRows rows={5} label="Carregando histórico" />
      ) : error ? (
        <EmptyState
          title="Não foi possível carregar o histórico"
          message={describeError(error, "Tente novamente em instantes.")}
          action={{ label: "Tentar de novo", onClick: reload }}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          tone="empty"
          compact
          title="Nenhum registro ainda"
          message="Os registros aparecem aqui conforme os resumos e alertas forem planejados."
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">Histórico de notificações</caption>
            <thead>
              <tr>
                <th scope="col">Quando</th>
                {showRecipient && <th scope="col">Destinatário</th>}
                <th scope="col">Tipo</th>
                <th scope="col">Situação</th>
                <th scope="col">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((d) => (
                <tr key={d.id}>
                  <td>{formatInZone(d.scheduledFor, timezone)}</td>
                  {showRecipient && (
                    <td>{recipientNames?.[d.recipientUserId] ?? "Outro membro"}</td>
                  )}
                  <td>
                    {DELIVERY_KIND_LABELS[d.kind]}
                    {d.itemCount != null && (
                      <div className={styles.muted}>{d.itemCount} lead(s)</div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.pill} ${d.status === "sent" ? styles.ok : d.status === "failed" ? styles.bad : styles.neutral}`}
                    >
                      {deliveryStageLabel(d)}
                    </span>
                  </td>
                  <td>
                    {d.statusReason
                      ? (DELIVERY_REASON_LABELS[d.statusReason] ?? d.statusReason)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > data.pageSize && (
        <div className={styles.pager}>
          <Button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
            Anterior
          </Button>
          <span>
            Página {page} de {totalPages}
          </span>
          <Button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}
