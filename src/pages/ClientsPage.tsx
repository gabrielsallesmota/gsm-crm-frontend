import { useState } from "react";
import { useClients } from "../hooks/useClients";
import { useClientActions } from "../hooks/useClientActions";
import { ClientDrawer } from "../components/clients/ClientDrawer";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { useToast } from "../hooks/useToast";
import { CLIENT_SOURCE_LABEL, PAYMENT_TYPE_LABEL, type Client } from "../types/client";
import { brl } from "../utils/currency";
import { formatPhone } from "../utils/phone";
import styles from "./ClientsPage.module.css";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ClientsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Cliente recém-criado manualmente — a lista só o traz depois do próximo
  // fetch (`reload`), mas o drawer precisa abrir JÁ (pra continuar direto
  // pro contrato/pagamento). Some sozinho assim que `clients` já contiver
  // esse id (fetch mais novo tem prioridade — ver `selected` abaixo).
  const [pendingClient, setPendingClient] = useState<Client | null>(null);
  const { data, loading, error, reload } = useClients({ search, page: 1, pageSize: 100 });
  const { create } = useClientActions();
  const { toast } = useToast();

  const clients = data?.items ?? [];
  const selected =
    clients.find((c) => c.id === selectedId) ??
    (pendingClient?.id === selectedId ? pendingClient : null);

  async function handleCreate(input: {
    companyName: string;
    phone: string;
    email: string;
    city: string;
    niche: string;
    closedAt: string;
  }) {
    const created = await create(input);
    toast("Cliente criado com sucesso");
    setPendingClient(created);
    setSelectedId(created.id);
    setCreating(false);
    reload();
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Clientes</h1>
          <p className={styles.pageSubtitle}>
            {data ? `${data.total} clientes` : "Carregando…"} — contrato fechado, seja
            automaticamente (prospect/lead que chegou em "Ganho") ou cadastrado direto aqui
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Novo cliente
        </Button>
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
            <div className={styles.empty}>Nenhum cliente ainda — feche um contrato movendo um prospect/lead pra "Ganho", ou cadastre direto em "+ Novo cliente".</div>
          )}
        </div>
      )}

      {selected && (
        <ClientDrawer
          client={selected}
          onClose={() => {
            setSelectedId(null);
            setPendingClient(null);
          }}
          onSaved={() => reload()}
          onDeleted={() => {
            setSelectedId(null);
            setPendingClient(null);
            reload();
          }}
          onReload={() => reload()}
        />
      )}

      {creating && (
        <CreateClientModal onClose={() => setCreating(false)} onSubmit={handleCreate} />
      )}
    </div>
  );
}

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function CreateClientModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (form: {
    companyName: string;
    phone: string;
    email: string;
    city: string;
    niche: string;
    closedAt: string;
  }) => Promise<void>;
}) {
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [niche, setNiche] = useState("");
  const [closedAt, setClosedAt] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!companyName.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ companyName, phone, email, city, niche, closedAt });
    } catch (err) {
      // Mesmo racional do `QuickCreateModal` de Leads: sem isso, um erro
      // aqui só aparecia como "Uncaught (in promise)" no console.
      toast(err instanceof Error ? err.message : "Não foi possível criar o cliente");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Novo cliente</h2>
        <p className={styles.modalHint}>
          Pra contrato fechado direto, sem passar por Prospecção/Leads. Depois de criar, você
          continua aqui mesmo pra anexar o contrato e definir o pagamento.
        </p>
        <input
          className={styles.input}
          placeholder="Nome da empresa"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Telefone"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
        />
        <input
          className={styles.input}
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Cidade"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Nicho"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
        />
        <label className={styles.modalLabel}>
          Data de fechamento do contrato
          <input
            className={styles.input}
            type="date"
            value={closedAt}
            onChange={(e) => setClosedAt(e.target.value)}
          />
        </label>
        <div className={styles.modalActions}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || !companyName.trim()}
          >
            {submitting ? "Criando…" : "Criar cliente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
