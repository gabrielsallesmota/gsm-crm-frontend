import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePlatformAudit } from "../hooks/usePlatform";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { formatDateTime } from "../utils/datetime";
import { pageCount, rangeLabel } from "../utils/pagination";
import { describeAuditAction } from "./provisioning";
import styles from "./Platform.module.css";

const PAGE_SIZE = 50;

const ACTION_GROUPS = [
  { value: "", label: "Todas as ações" },
  { value: "organization.", label: "Organizações" },
  { value: "tenant.", label: "Tenants e módulos" },
  { value: "impersonation.", label: "Sessões de suporte" },
  { value: "member.", label: "Papéis de membros" },
  { value: "user.", label: "Usuários" },
  { value: "api_key.", label: "API Keys" },
  { value: "platform_staff.", label: "Equipe GSM" },
];

/** Trilha global da plataforma (append-only no banco). */
export function PlatformAuditPage() {
  const [params] = useSearchParams();
  const accountId = params.get("account") ?? undefined;
  const [action, setAction] = useState("");
  const [onlySupport, setOnlySupport] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const key = `${action}|${onlySupport}|${dateFrom}|${dateTo}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setPage(1);
  }
  const { data, loading, error, reload } = usePlatformAudit({
    ...(action ? { action } : {}),
    ...(accountId ? { accountId } : {}),
    ...(onlySupport ? { onlyImpersonation: true } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = data ? pageCount(data.total, PAGE_SIZE) : 1;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Auditoria</h1>
          <p className={styles.subtitle}>
            Ações administrativas de toda a plataforma — registro somente de inclusão
            {accountId ? " · filtrado por organização" : ""}
          </p>
        </div>
      </div>
      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Tipo de ação"
        >
          {ACTION_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <label className={styles.muted} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={onlySupport}
            onChange={(e) => setOnlySupport(e.target.checked)}
          />
          Só o que aconteceu em sessões de suporte
        </label>
        <input
          className={styles.select}
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="De"
        />
        <input
          className={styles.select}
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Até"
        />
      </div>

      {error && (
        <EmptyState
          title="Não foi possível carregar a auditoria"
          message={error.message}
          action={{ label: "Tentar de novo", onClick: reload }}
        />
      )}
      {!error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Quem</th>
                <th>Tenant</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody aria-busy={loading}>
              {data?.items.map((log) => (
                <tr key={log.id}>
                  <td className={styles.muted} style={{ whiteSpace: "nowrap" }}>
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td>
                    {describeAuditAction(log.action)}
                    {log.impersonationSessionId && !log.action.startsWith("impersonation.") && (
                      <>
                        {" "}
                        <span className={`${styles.pill} ${styles.pillInternal}`}>via suporte</span>
                      </>
                    )}
                    <div className={styles.muted}>{log.action}</div>
                  </td>
                  <td>
                    {log.actorName ?? (log.actorType === "system" ? "Sistema (CLI)" : "—")}
                    {log.actorEmail && <div className={styles.muted}>{log.actorEmail}</div>}
                    {log.ip && <div className={styles.muted}>IP {log.ip}</div>}
                  </td>
                  <td>{log.tenantName ?? <span className={styles.muted}>—</span>}</td>
                  <td>
                    {log.metadata && Object.keys(log.metadata).length > 0 ? (
                      <span className={styles.code}>{JSON.stringify(log.metadata)}</span>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && !data && <p className={styles.muted} style={{ padding: 16 }}>Carregando…</p>}
          {data && data.items.length === 0 && (
            <p className={styles.muted} style={{ padding: 16 }}>Nenhum registro com esses filtros.</p>
          )}
        </div>
      )}
      {data && data.total > PAGE_SIZE && (
        <div className={styles.pagination}>
          <span>{rangeLabel(page, PAGE_SIZE, data.total)}</span>
          <div className={styles.actions}>
            <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              ← Anterior
            </Button>
            <Button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Próxima →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
