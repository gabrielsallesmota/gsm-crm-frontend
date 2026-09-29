import { useState } from "react";
import { useSupportSessions } from "../hooks/usePlatform";
import { useToast } from "../hooks/useToast";
import { platformService } from "../services/PlatformService";
import { Button } from "../components/common/Button";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { EmptyState } from "../components/common/EmptyState";
import { formatDateTime } from "../utils/datetime";
import type { ImpersonationSession } from "../types/platform";
import styles from "./Platform.module.css";

/** Sessões de suporte (impersonation): quem, onde, por quê, quando, modo e
 * quem encerrou. Qualquer staff pode encerrar qualquer sessão aberta. */
export function SupportSessionsPage() {
  const [openOnly, setOpenOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useSupportSessions(openOnly, page);
  const { toast, toastError } = useToast();
  const [ending, setEnding] = useState<ImpersonationSession | null>(null);

  async function end(session: ImpersonationSession): Promise<boolean> {
    try {
      await platformService.endImpersonation(session.id);
      toast("Sessão encerrada — o token de suporte parou de funcionar");
      reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível encerrar a sessão.");
      return false;
    }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Sessões de suporte</h1>
          <p className={styles.subtitle}>
            Impersonation auditada: somente leitura por padrão, escrita só com elevação
          </p>
        </div>
        <label className={styles.muted} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => {
              setOpenOnly(e.target.checked);
              setPage(1);
            }}
          />
          Só abertas agora
        </label>
      </div>

      {error && (
        <EmptyState
          title="Não foi possível carregar as sessões"
          message={error.message}
          action={{ label: "Tentar de novo", onClick: reload }}
        />
      )}
      {!error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Cliente</th>
                <th>Motivo</th>
                <th>Início / expiração</th>
                <th>Modo</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody aria-busy={loading}>
              {data?.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.actorName ?? "—"}
                    <div className={styles.muted}>{s.actorEmail}</div>
                    {s.ip && <div className={styles.muted}>IP {s.ip}</div>}
                  </td>
                  <td>{s.tenantName ?? <span className={styles.code}>{s.targetTenantId}</span>}</td>
                  <td style={{ maxWidth: 260 }}>
                    {s.reason}
                    {s.elevationReason && (
                      <div className={styles.muted}>Elevação: {s.elevationReason}</div>
                    )}
                  </td>
                  <td className={styles.muted} style={{ whiteSpace: "nowrap" }}>
                    {formatDateTime(s.startedAt)}
                    <br />
                    até {formatDateTime(s.expiresAt)}
                  </td>
                  <td>
                    <span
                      className={`${styles.pill} ${s.mode === "write" ? styles.pillSuspended : styles.pillNeutral}`}
                    >
                      {s.mode === "write" ? "Escrita" : "Somente leitura"}
                    </span>
                  </td>
                  <td>
                    {s.isOpen ? (
                      <span className={`${styles.pill} ${styles.pillActive}`}>Aberta</span>
                    ) : (
                      <span className={styles.muted}>
                        {s.endedAt ? `Encerrada ${formatDateTime(s.endedAt)}` : "Expirada"}
                      </span>
                    )}
                  </td>
                  <td>
                    {s.isOpen && (
                      <Button variant="danger" onClick={() => setEnding(s)}>
                        Encerrar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && !data && <p className={styles.muted} style={{ padding: 16 }}>Carregando…</p>}
          {data && data.items.length === 0 && (
            <p className={styles.muted} style={{ padding: 16 }}>Nenhuma sessão.</p>
          )}
        </div>
      )}
      {data && data.total > data.items.length && (
        <div className={styles.pagination}>
          <span>
            Página {page} · {data.total} sessões
          </span>
          <div className={styles.actions}>
            <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              ← Anterior
            </Button>
            <Button onClick={() => setPage((p) => p + 1)} disabled={page * 25 >= data.total}>
              Próxima →
            </Button>
          </div>
        </div>
      )}
      {ending && (
        <ConfirmDialog
          title="Encerrar sessão de suporte?"
          message={`A sessão de ${ending.actorName ?? "staff"} em ${ending.tenantName ?? "cliente"} termina na hora. Fica registrado que você encerrou.`}
          confirmLabel="Encerrar"
          onConfirm={() => end(ending)}
          onClose={() => setEnding(null)}
        />
      )}
    </div>
  );
}
