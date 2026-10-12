import { useState } from "react";
import { Button } from "../common/Button";
import { SkeletonRows } from "../common/Skeleton";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { connectionsService } from "../../services/ConnectionsService";
import { describeError } from "../../utils/apiErrors";
import { formatDateTime } from "../../utils/datetime";
import styles from "./Connections.module.css";

const STATUS_LABEL: Record<string, string> = {
  running: "Em andamento",
  succeeded: "Concluída",
  partial: "Parcial",
  failed: "Falhou",
};

function summarize(counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k.replaceAll("_", " ")}`);
  return parts.length ? parts.join(", ") : "sem mudanças";
}

/** Histórico das últimas sincronizações da conta (paginado). */
export function SyncHistory({ connectionId }: { connectionId: string }) {
  const [page, setPage] = useState(1);
  const state = useAsyncResource(() => connectionsService.syncRuns(connectionId, page), [
    connectionId,
    page,
  ]);
  const data = state.data;

  if (state.error && !data) {
    return (
      <p className={`${styles.alert} ${styles.alertBad}`} role="alert">
        {describeError(state.error, "Não foi possível carregar o histórico.")}
      </p>
    );
  }
  if (!data) return <SkeletonRows rows={3} label="Carregando histórico" />;
  if (data.items.length === 0) {
    return <p className={styles.muted}>Nenhuma sincronização ainda.</p>;
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div>
      <div className={styles.runsWrap}>
        <table className={styles.runs}>
          <caption className="sr-only">Histórico de sincronizações</caption>
          <thead>
            <tr>
              <th scope="col">Início</th>
              <th scope="col">Origem</th>
              <th scope="col">Resultado</th>
              <th scope="col">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((run) => (
              <tr key={run.id}>
                <td>{formatDateTime(run.startedAt)}</td>
                <td>{run.trigger === "manual" ? "Manual" : "Automática"}</td>
                <td>{STATUS_LABEL[run.status] ?? run.status}</td>
                <td>{run.errorMessage ?? summarize(run.counts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className={styles.actions}>
          <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Anterior
          </Button>
          <Button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Próxima →
          </Button>
        </div>
      )}
    </div>
  );
}
