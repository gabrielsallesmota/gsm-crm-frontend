import { useState } from "react";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import { roleLabel } from "../../auth/permissions";
import { useNotificationRecipients } from "../../hooks/useNotifications";
import { describeError } from "../../utils/apiErrors";
import { CHANNEL_STATUS_LABELS, NOT_RECEIVING_LABELS } from "../../utils/notifications";
import styles from "../integrations/Integrations.module.css";

/** Destinatários (admin e gestor). Somente leitura: telefone sempre
 * mascarado e consentimento/telefone são só do próprio usuário. */
export function RecipientsPanel() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useNotificationRecipients(page);

  if (loading && !data) return <SkeletonRows rows={5} label="Carregando destinatários" />;
  if (error) {
    return (
      <EmptyState
        title="Não foi possível carregar os destinatários"
        message={describeError(error, "Tente novamente em instantes.")}
        action={{ label: "Tentar de novo", onClick: reload }}
      />
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        tone="empty"
        title="Nenhum membro ativo"
        message="Quando houver membros ativos na equipe, eles aparecem aqui."
      />
    );
  }
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <section aria-labelledby="recipients-title">
      <h2 id="recipients-title" className="sr-only">
        Destinatários
      </h2>
      <p className={styles.intro}>
        Cada pessoa cadastra o próprio telefone e autoriza o recebimento em Meu perfil → Minhas
        notificações. Aqui você só acompanha a situação.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">Destinatários de notificações</caption>
          <thead>
            <tr>
              <th scope="col">Pessoa</th>
              <th scope="col">Perfil</th>
              <th scope="col">Recebe?</th>
              <th scope="col">Dados</th>
              <th scope="col">Telefone</th>
              <th scope="col">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.userId}>
                <td>{r.name}</td>
                <td>{roleLabel(r.role)}</td>
                <td>
                  <span className={`${styles.pill} ${r.receives ? styles.ok : styles.neutral}`}>
                    {r.receives ? "Sim" : "Não"}
                  </span>
                  {!r.receives && r.notReceivingReason && (
                    <div className={styles.muted}>{NOT_RECEIVING_LABELS[r.notReceivingReason]}</div>
                  )}
                </td>
                <td>{r.scope === "team" ? "Equipe" : "Só os dele(a)"}</td>
                <td className={styles.mono}>{r.phoneMasked ?? "—"}</td>
                <td>
                  <span className={`${styles.pill} ${styles.neutral}`}>
                    {CHANNEL_STATUS_LABELS[r.channelStatus]}
                  </span>
                  <div className={styles.muted}>
                    {r.consent ? "Autorizou" : "Sem autorização"} ·{" "}
                    {r.verified ? "número verificado" : "número não verificado"}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.total > data.pageSize && (
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
