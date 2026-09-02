import { useState } from "react";
import { useClients } from "../hooks/useClients";
import { ClientDrawer } from "../components/clients/ClientDrawer";
import { Badge } from "../components/common/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { CLIENT_SOURCE_LABEL, PAYMENT_TYPE_LABEL } from "../types/client";
import { brl } from "../utils/currency";
import styles from "./ClientsPage.module.css";

export function ClientsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, loading, error, reload } = useClients({ search, page: 1, pageSize: 100 });

  const clients = data?.items ?? [];
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Clientes</h1>
          <p className={styles.pageSubtitle}>
            {data ? `${data.total} clientes` : "Carregando…"} — contratos fechados (criados
            automaticamente ao mover um prospect/lead pra "Ganho")
          </p>
        </div>
      </div>

      <input
        className={styles.search}
        placeholder="Buscar por nome da empresa…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <EmptyState title="Não foi possível carregar os clientes" message={error.message} />}

      {!error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Origem</th>
                <th>Pagamento</th>
                <th>Valor total</th>
                <th>Próx. vencimento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className={styles.row} onClick={() => setSelectedId(client.id)}>
                  <td>{client.companyName}</td>
                  <td>
                    <Badge label={CLIENT_SOURCE_LABEL[client.source]} color="#4aa3ff" bg="rgba(74,163,255,.14)" />
                  </td>
                  <td>{client.paymentType ? PAYMENT_TYPE_LABEL[client.paymentType] : "—"}</td>
                  <td>{client.totalValueCents ? `R$ ${brl(client.totalValueCents / 100)}` : "—"}</td>
                  <td>
                    {client.nextDueDate ? fmtDate(client.nextDueDate) : "—"}
                    {client.hasOverdueInstallment && (
                      <span className={styles.overdueBadge}>
                        <Badge label="Atrasado" color="#ff5c5c" bg="rgba(255,92,92,.14)" />
                      </span>
                    )}
                  </td>
                  <td className={styles.chevron}>›</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && clients.length === 0 && (
            <div className={styles.empty}>Nenhum cliente ainda — feche um contrato movendo um prospect/lead pra "Ganho".</div>
          )}
        </div>
      )}

      {selected && (
        <ClientDrawer
          client={selected}
          onClose={() => setSelectedId(null)}
          onSaved={() => reload()}
          onDeleted={() => {
            setSelectedId(null);
            reload();
          }}
          onReload={() => reload()}
        />
      )}
    </div>
  );
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
