import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrganizations } from "../hooks/usePlatform";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ROUTES } from "../constants/routes";
import { formatDateTime } from "../utils/datetime";
import { pageCount, rangeLabel } from "../utils/pagination";
import type { OrganizationStatus } from "../types/platform";
import styles from "./Platform.module.css";
import { StatusPill } from "./StatusPill";

const PAGE_SIZE = 20;

export function OrganizationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<OrganizationStatus | "">("");
  const [page, setPage] = useState(1);
  const filterKey = `${debounced}|${status}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (filterKey !== lastKey) {
    setLastKey(filterKey);
    setPage(1);
  }
  const { data, loading, error, reload } = useOrganizations({
    search: debounced,
    status,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = data ? pageCount(data.total, PAGE_SIZE) : 1;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Organizações</h1>
          <p className={styles.subtitle}>Clientes da GSM (Account) e seus tenants</p>
        </div>
        <Button variant="primary" onClick={() => navigate(ROUTES.platformOrganizationNew)}>
          + Nova organização
        </Button>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          placeholder="Buscar por nome ou identificador…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar organizações"
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value as OrganizationStatus | "")}
          aria-label="Status"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativas</option>
          <option value="suspended">Suspensas</option>
        </select>
      </div>

      {error && (
        <EmptyState
          title="Não foi possível carregar as organizações"
          message={error.message}
          action={{ label: "Tentar de novo", onClick: reload }}
        />
      )}

      {!error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Organização</th>
                <th>Status</th>
                <th>Plano</th>
                <th>Usuários ativos</th>
                <th>Tenants</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody aria-busy={loading}>
              {data?.items.map((org) => (
                <tr
                  key={org.id}
                  className={styles.rowLink}
                  tabIndex={0}
                  onClick={() => navigate(ROUTES.platformOrganization(org.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(ROUTES.platformOrganization(org.id));
                  }}
                >
                  <td>
                    <div style={{ fontWeight: 600 }}>{org.name}</div>
                    <div className={styles.muted}>{org.slug}</div>
                  </td>
                  <td>
                    <StatusPill status={org.status} internal={org.isPlatformInternal} />
                  </td>
                  <td>{org.planName ?? <span className={styles.muted}>sem plano</span>}</td>
                  <td>{org.activeUsers}</td>
                  <td>{org.tenantsCount}</td>
                  <td className={styles.muted}>{formatDateTime(org.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && !data && <p className={styles.muted} style={{ padding: 16 }}>Carregando…</p>}
          {data && data.items.length === 0 && (
            <p className={styles.muted} style={{ padding: 16 }}>
              Nenhuma organização encontrada.
            </p>
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
