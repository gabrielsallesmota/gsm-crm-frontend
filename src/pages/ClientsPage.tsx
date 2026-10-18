import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClients } from "../hooks/useClients";
import { useClientActions } from "../hooks/useClientActions";
import { useClientAccess } from "../hooks/useClientAccess";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { useTeamDirectory } from "../hooks/useTeamDirectory";
import { usePageTitle } from "../hooks/usePageTitle";
import { ClientDrawer } from "../components/clients/ClientDrawer";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { FilterChip } from "../components/common/FilterChip";
import { useToast } from "../hooks/useToast";
import { clientsService } from "../services/ClientsService";
import { ROUTES } from "../constants/routes";
import { CLIENT_SOURCE_LABEL, PAYMENT_TYPE_LABEL, type Client } from "../types/client";
import { brl } from "../utils/currency";
import { formatPhone } from "../utils/phone";
import { addDays, fmtDate, renewalUrgency, toIsoDate } from "../utils/renewal";
import styles from "./ClientsPage.module.css";

type QuickFilter = "all" | "renewing" | "overdue";

const QUICK_LABEL: Record<Exclude<QuickFilter, "all">, string> = {
  renewing: "Renovam em até 30 dias",
  overdue: "Com parcela atrasada",
};

/**
 * Clientes do tenant: quem fechou negócio, os contratos, as parcelas e as renovações. Todos veem;
 * só admin e gestor cadastram e alteram valores. A URL `/clientes/:id` abre a ficha (link
 * compartilhável, usado também pelas tarefas de renovação).
 */
export function ClientsPage() {
  usePageTitle("Clientes");
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const { canManage } = useClientAccess();
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [ownerId, setOwnerId] = useState("");
  const [creating, setCreating] = useState(false);
  const today = toIsoDate(new Date());
  const { data, loading, error, reload } = useClients({
    search,
    page: 1,
    pageSize: 100,
    ...(quick === "renewing" ? { renewalTo: addDays(today, 30) } : {}),
    ...(quick === "overdue" ? { hasOverdue: true } : {}),
    ...(ownerId ? { ownerId } : {}),
  });
  const { create } = useClientActions();
  const { data: team } = useTeamDirectory();
  const { toast } = useToast();

  const clients = data?.items ?? [];
  // Cliente aberto por link que não está na página atual da lista (filtro/busca/paginação).
  const fetched = useAsyncResource<Client | null>(
    () => (routeId ? clientsService.get(routeId) : Promise.resolve(null)),
    [routeId],
  );
  const selected = routeId
    ? (clients.find((c) => c.id === routeId) ?? fetched.data ?? null)
    : null;
  const filtered = quick !== "all" || ownerId !== "" || search !== "";

  function open(id: string) {
    void navigate(`${ROUTES.clientes}/${id}`);
  }

  function close() {
    void navigate(ROUTES.clientes);
  }

  async function handleCreate(input: {
    companyName: string;
    phone: string;
    email: string;
    city: string;
    niche: string;
    closedAt: string;
    ownerId: string;
  }) {
    const { ownerId: owner, ...rest } = input;
    const created = await create(owner ? { ...rest, ownerId: owner } : rest);
    toast("Cliente criado com sucesso");
    setCreating(false);
    reload();
    open(created.id);
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Clientes</h1>
          <p className={styles.pageSubtitle}>
            {data ? `${data.total} ${data.total === 1 ? "cliente" : "clientes"}` : "Carregando…"} —
            negócios fechados, com contratos, parcelas e a data de renovação de cada um
          </p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Novo cliente
          </Button>
        )}
      </div>

      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Buscar por nome da empresa…"
          aria-label="Buscar cliente"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={styles.quick} role="group" aria-label="Filtros rápidos">
          {(Object.keys(QUICK_LABEL) as Exclude<QuickFilter, "all">[]).map((key) => (
            <button
              key={key}
              type="button"
              className={quick === key ? `${styles.quickBtn} ${styles.quickBtnActive}` : styles.quickBtn}
              aria-pressed={quick === key}
              onClick={() => setQuick(quick === key ? "all" : key)}
            >
              {QUICK_LABEL[key]}
            </button>
          ))}
        </div>
        <select
          className={styles.select}
          aria-label="Filtrar por responsável"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
        >
          <option value="">Todos os responsáveis</option>
          {(team ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      {ownerId && (
        <div className={styles.chips}>
          <FilterChip
            group="Responsável"
            value={team?.find((m) => m.id === ownerId)?.name ?? "—"}
            onRemove={() => setOwnerId("")}
          />
        </div>
      )}

      {error && <EmptyState title="Não foi possível carregar os clientes" message={error.message} />}

      {!error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Origem</th>
                <th>Contratos</th>
                <th>Valor total</th>
                <th>Próx. renovação</th>
                <th>Próx. vencimento</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const urgency = client.nextRenewalDate
                  ? renewalUrgency(client.nextRenewalDate, today)
                  : null;
                return (
                  <tr key={client.id} className={styles.row} onClick={() => open(client.id)}>
                    <td>
                      <button type="button" className={styles.nameBtn} onClick={() => open(client.id)}>
                        {client.companyName}
                      </button>
                    </td>
                    <td>
                      <Badge
                        label={CLIENT_SOURCE_LABEL[client.source]}
                        color="var(--tone-blue-text)"
                        bg="var(--tone-blue-bg)"
                      />
                    </td>
                    <td>
                      {client.contractsCount}
                      {client.paymentType ? ` · ${PAYMENT_TYPE_LABEL[client.paymentType]}` : ""}
                    </td>
                    <td>{client.totalValueCents ? `R$ ${brl(client.totalValueCents / 100)}` : "—"}</td>
                    <td>
                      {client.nextRenewalDate ? fmtDate(client.nextRenewalDate) : "—"}
                      {urgency === "overdue" && (
                        <span className={styles.overdueBadge}>
                          <Badge label="Vencida" color="var(--tone-red-text)" bg="var(--tone-red-bg)" />
                        </span>
                      )}
                      {urgency === "soon" && (
                        <span className={styles.overdueBadge}>
                          <Badge label="Em breve" color="var(--tone-amber-text)" bg="var(--tone-amber-bg)" />
                        </span>
                      )}
                    </td>
                    <td>
                      {client.nextDueDate ? fmtDate(client.nextDueDate) : "—"}
                      {client.hasOverdueInstallment && (
                        <span className={styles.overdueBadge}>
                          <Badge label="Atrasado" color="var(--tone-red-text)" bg="var(--tone-red-bg)" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && clients.length === 0 && (
            <div className={styles.empty}>
              {filtered
                ? "Nenhum cliente com esses filtros."
                : "Nenhum cliente ainda — quando um lead for ganho, o CRM pergunta se deve virar cliente. Você também pode cadastrar direto."}
            </div>
          )}
        </div>
      )}

      {routeId && !selected && !fetched.loading && (
        <EmptyState
          title="Cliente não encontrado"
          message="Ele pode ter sido removido ou o link está incorreto."
        />
      )}

      {selected && (
        <ClientDrawer
          client={selected}
          onClose={close}
          onSaved={() => {
            reload();
            fetched.reload();
          }}
          onDeleted={() => {
            close();
            reload();
          }}
          onReload={() => {
            reload();
            fetched.reload();
          }}
        />
      )}

      {creating && (
        <CreateClientModal
          team={team ?? []}
          onClose={() => setCreating(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}

function CreateClientModal({
  team,
  onClose,
  onSubmit,
}: {
  team: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (form: {
    companyName: string;
    phone: string;
    email: string;
    city: string;
    niche: string;
    closedAt: string;
    ownerId: string;
  }) => Promise<void>;
}) {
  const { toastError } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [niche, setNiche] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [closedAt, setClosedAt] = useState(toIsoDate(new Date()));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!companyName.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ companyName, phone, email, city, niche, closedAt, ownerId });
    } catch (err) {
      // Mesmo racional do `QuickCreateModal` de Leads: sem isso, um erro
      // aqui só aparecia como "Uncaught (in promise)" no console.
      toastError(err, "Não foi possível criar o cliente");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-client-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-client-title" className={styles.modalTitle}>
          Novo cliente
        </h2>
        <p className={styles.modalHint}>
          Para negócio fechado direto, sem passar pelo funil. Depois de criar, você continua na ficha
          para cadastrar o contrato, as parcelas e a data de renovação.
        </p>
        <input
          className={styles.input}
          placeholder="Nome da empresa"
          aria-label="Nome da empresa"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Telefone"
          aria-label="Telefone"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
        />
        <input
          className={styles.input}
          placeholder="E-mail"
          aria-label="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Cidade"
          aria-label="Cidade"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Nicho"
          aria-label="Nicho"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
        />
        <label className={styles.modalLabel}>
          Responsável (recebe as tarefas de renovação)
          <select className={styles.input} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Sem responsável</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.modalLabel}>
          Data de fechamento
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
