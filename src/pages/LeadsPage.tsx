import { lazy, Suspense, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLeads } from "../hooks/useLeads";
import { useLead } from "../hooks/useLead";
import { useLeadActions } from "../hooks/useLeadActions";
import { usePipelines } from "../hooks/usePipelines";
import { useTeamDirectory } from "../hooks/useTeamDirectory";
import { useTags } from "../hooks/useTags";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useAuth } from "../hooks/useAuth";
import { can } from "../auth/permissions";
import { LeadRow } from "../components/leads/LeadRow";
import { LeadDrawer } from "../components/leads/LeadDrawer";
import { Badge } from "../components/common/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/common/Button";
import { CurrencyInput } from "../components/common/CurrencyInput";
import { Modal } from "../components/common/Modal";
import { PeriodFilter } from "../components/common/PeriodFilter";
import { useToast } from "../hooks/useToast";
import { ROUTES } from "../constants/routes";
import { ORIGIN, ORIGIN_KEYS } from "../constants/origins";
import { formatPhone } from "../utils/phone";
import { pageCount, rangeLabel } from "../utils/pagination";
import { EMPTY_PERIOD, type Period } from "../utils/periods";
import type { LeadListFilter } from "../types/lead";
import type { Pipeline } from "../types/pipeline";
import type { DirectoryMember } from "../types/user";
import styles from "./LeadsPage.module.css";
import formStyles from "../components/common/Form.module.css";

const PAGE_SIZE = 25;

// Prospecção é carteira INTERNA da GSM (só platform staff) — chunk próprio,
// nunca baixado por usuário de tenant. O backend recusa /prospects para
// quem não é staff; isto só reduz superfície.
const ProspectsTable = lazy(() =>
  import("../components/prospects/ProspectsTable").then((m) => ({ default: m.ProspectsTable })),
);

type SourceFilter = "todos" | "ativo" | "passivo";

const PASSIVO_BADGE = { label: "Passivo", color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" };

const SOURCE_FILTER_LABEL: Record<SourceFilter, string> = {
  todos: "Todos",
  ativo: "Ativo (prospecção)",
  passivo: "Passivo (leads)",
};

export function LeadsPage() {
  // Ver PipelinePage.tsx — mesma dualidade Ativo/Passivo, só que na tela de
  // lista/tabela em vez do quadro kanban. `isPlatformStaff` vem de
  // `GET /auth/me`.
  const { user } = useAuth();
  const isSuperAdmin = can(user, "platform.internal");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("todos");
  const showPassivo = !isSuperAdmin || sourceFilter !== "ativo";
  const showAtivo = isSuperAdmin && sourceFilter !== "passivo";

  return (
    <div>
      {isSuperAdmin && (
        <div className={styles.sourceFilter}>
          {(["todos", "ativo", "passivo"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={
                sourceFilter === option
                  ? `${styles.sourceFilterBtn} ${styles.sourceFilterBtnActive}`
                  : styles.sourceFilterBtn
              }
              onClick={() => setSourceFilter(option)}
            >
              {SOURCE_FILTER_LABEL[option]}
            </button>
          ))}
        </div>
      )}

      {showPassivo && <LeadsTable taggedPassivo={isSuperAdmin} />}

      {showPassivo && showAtivo && <div className={styles.sourceDivider} />}

      {showAtivo && (
        <Suspense fallback={null}>
          <ProspectsTable />
        </Suspense>
      )}
    </div>
  );
}

function LeadsTable({ taggedPassivo }: { taggedPassivo: boolean }) {
  const { user } = useAuth();
  const canFilterByOwner = can(user, "leads.viewAll");
  const { data: pipelines } = usePipelines();
  const { data: team } = useTeamDirectory();
  const { data: tags } = useTags();
  const { create } = useLeadActions();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, toastError } = useToast();
  const [creating, setCreating] = useState(false);

  // Filtros (Etapa 1): tudo vai para o BACKEND — a lista não carrega mais
  // "os 100 primeiros" e filtra no cliente.
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [origin, setOrigin] = useState("");
  const [tagId, setTagId] = useState("");
  const [period, setPeriod] = useState<Period>(EMPTY_PERIOD);
  const [page, setPage] = useState(1);

  const filter: LeadListFilter = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(pipelineId ? { pipelineId } : {}),
    ...(stageId ? { stageId } : {}),
    ...(ownerFilter === "__none__"
      ? { unassigned: true }
      : ownerFilter
        ? { ownerId: ownerFilter }
        : {}),
    ...(origin ? { origin } : {}),
    ...(tagId ? { tagId } : {}),
    ...period,
  };
  const filterKey = JSON.stringify(filter);
  // Filtro mudou → volta para a página 1 (senão "página 7" de um filtro
  // que só tem 1 página mostraria vazio).
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }
  const { data, loading, error, reload } = useLeads({ ...filter, page, pageSize: PAGE_SIZE });
  const { data: routeLead, reload: reloadRouteLead } = useLead(id);

  const allStages = new Map(
    (pipelines ?? []).flatMap((p) => p.stages.map((s) => [s.id, s] as const)),
  );
  const ownerNames = new Map((team ?? []).map((m) => [m.id, m.name]));
  const filterPipeline = pipelines?.find((p) => p.id === pipelineId);
  const defaultPipeline = pipelines?.find((p) => p.isDefault) ?? pipelines?.[0];
  const leads = data?.items ?? [];
  const selected = id ? (leads.find((l) => l.id === id) ?? routeLead ?? null) : null;
  const totalPages = data ? pageCount(data.total, PAGE_SIZE) : 1;
  const hasFilters = filterKey !== JSON.stringify({});

  function clearFilters() {
    setSearch("");
    setPipelineId("");
    setStageId("");
    setOwnerFilter("");
    setOrigin("");
    setTagId("");
    setPeriod(EMPTY_PERIOD);
  }

  async function handleCreate(form: QuickCreateForm) {
    if (!user) return;
    try {
      const lead = await create({
        name: form.name,
        company: form.company,
        phone: form.phone,
        email: form.email,
        value: form.value,
        origin: form.origin,
        ownerId: form.ownerId || user.id,
        pipelineId: form.pipelineId,
        ...(form.stageId ? { stageId: form.stageId } : {}),
      });
      toast("Lead criado com sucesso");
      setCreating(false);
      reload();
      navigate(ROUTES.leadDetail(lead.id));
    } catch (err) {
      toastError(err, "Não foi possível criar o lead");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            {taggedPassivo && <Badge {...PASSIVO_BADGE} />} Leads
          </h1>
          <p className={styles.pageSubtitle}>
            {data
              ? `${data.total} lead${data.total === 1 ? "" : "s"}${hasFilters ? " (filtrados)" : ""}`
              : "Carregando…"}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setCreating(true)}
          disabled={!defaultPipeline}
          title={
            defaultPipeline
              ? undefined
              : "Crie um pipeline em Configurações antes de cadastrar um lead"
          }
        >
          + Novo lead
        </Button>
      </div>

      <input
        className={styles.search}
        placeholder="Buscar por nome, empresa, telefone ou e-mail…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Buscar leads"
      />

      <div className={styles.filters}>
        <select
          className={styles.filter}
          value={pipelineId}
          onChange={(e) => {
            setPipelineId(e.target.value);
            setStageId("");
          }}
          aria-label="Pipeline"
        >
          <option value="">Todos os pipelines</option>
          {pipelines?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={styles.filter}
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          disabled={!filterPipeline}
          aria-label="Etapa"
          title={filterPipeline ? undefined : "Escolha um pipeline para filtrar por etapa"}
        >
          <option value="">Todas as etapas</option>
          {filterPipeline?.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {canFilterByOwner && (
          <select
            className={styles.filter}
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Responsável"
          >
            <option value="">Todos os responsáveis</option>
            <option value="__none__">Sem responsável</option>
            {team?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <select
          className={styles.filter}
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          aria-label="Origem"
        >
          <option value="">Todas as origens</option>
          {ORIGIN_KEYS.map((k) => (
            <option key={k} value={k}>
              {ORIGIN[k].label}
            </option>
          ))}
        </select>
        {tags && tags.length > 0 && (
          <select
            className={styles.filter}
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
            aria-label="Tag"
          >
            <option value="">Todas as tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        )}
        {hasFilters && <Button onClick={clearFilters}>Limpar filtros</Button>}
      </div>
      <PeriodFilter value={period} onChange={setPeriod} />

      {error && <EmptyState title="Não foi possível carregar os leads" message={error.message} />}

      {!error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Etapa</th>
                <th>Responsável</th>
                <th>Origem</th>
                <th>Valor</th>
                <th>Prob.</th>
              </tr>
            </thead>
            <tbody aria-busy={loading}>
              {leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  stage={allStages.get(lead.stageId)}
                  ownerName={lead.ownerId ? (ownerNames.get(lead.ownerId) ?? null) : null}
                  onClick={() => navigate(ROUTES.leadDetail(lead.id))}
                />
              ))}
            </tbody>
          </table>
          {loading && leads.length === 0 && <div className={styles.empty}>Carregando…</div>}
          {!loading && leads.length === 0 && (
            <div className={styles.empty}>
              {hasFilters ? "Nenhum lead com esses filtros." : "Nenhum lead cadastrado ainda."}
            </div>
          )}
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className={styles.pagination}>
          <span>{rangeLabel(page, PAGE_SIZE, data.total)}</span>
          <div className={styles.paginationBtns}>
            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              ← Anterior
            </Button>
            <span>
              Página {page} de {totalPages}
            </span>
            <Button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Próxima →
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <LeadDrawer
          key={selected.id}
          lead={selected}
          onClose={() => navigate(ROUTES.leads)}
          onSaved={() => {
            reload();
            reloadRouteLead();
          }}
          onDeleted={() => {
            reload();
            navigate(ROUTES.leads);
          }}
        />
      )}

      {creating && pipelines && defaultPipeline && (
        <QuickCreateModal
          pipelines={pipelines}
          defaultPipelineId={filterPipeline?.id ?? defaultPipeline.id}
          canAssign={can(user, "leads.assign")}
          team={team ?? []}
          currentUserId={user?.id ?? ""}
          onClose={() => setCreating(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}

interface QuickCreateForm {
  name: string;
  company: string;
  phone: string;
  email: string;
  value: number;
  origin: string;
  ownerId: string;
  pipelineId: string;
  stageId: string;
}

function QuickCreateModal({
  pipelines,
  defaultPipelineId,
  canAssign,
  team,
  currentUserId,
  onClose,
  onSubmit,
}: {
  pipelines: Pipeline[];
  defaultPipelineId: string;
  canAssign: boolean;
  team: DirectoryMember[];
  currentUserId: string;
  onClose: () => void;
  onSubmit: (form: QuickCreateForm) => Promise<void>;
}) {
  const [form, setForm] = useState<QuickCreateForm>({
    name: "",
    company: "",
    phone: "",
    email: "",
    value: 0,
    origin: "manual",
    ownerId: currentUserId,
    pipelineId: defaultPipelineId,
    stageId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const pipeline = pipelines.find((p) => p.id === form.pipelineId);
  const set = (patch: Partial<QuickCreateForm>) => setForm((f) => ({ ...f, ...patch }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ ...form, name: form.name.trim() });
    } finally {
      // `finally` (não só o caminho feliz): se `onSubmit` lançar (ver
      // `handleCreate`, que já mostra o toast do erro), o botão volta a
      // ficar clicável em vez de travado em "Salvando…".
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Novo lead" onClose={onClose}>
      <form className={formStyles.form} onSubmit={(e) => void handleSubmit(e)}>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Nome *</span>
          <input
            className={formStyles.input}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            autoFocus
          />
        </label>
        <div className={formStyles.row}>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Empresa</span>
            <input
              className={formStyles.input}
              value={form.company}
              onChange={(e) => set({ company: e.target.value })}
            />
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Telefone</span>
            <input
              className={formStyles.input}
              value={form.phone}
              onChange={(e) => set({ phone: formatPhone(e.target.value) })}
            />
          </label>
        </div>
        <div className={formStyles.row}>
          <label className={formStyles.field}>
            <span className={formStyles.label}>E-mail</span>
            <input
              className={formStyles.input}
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Valor</span>
            <CurrencyInput
              className={formStyles.input}
              value={form.value}
              onChange={(value) => set({ value })}
            />
          </label>
        </div>
        <div className={formStyles.row}>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Pipeline</span>
            <select
              className={formStyles.select}
              value={form.pipelineId}
              onChange={(e) => set({ pipelineId: e.target.value, stageId: "" })}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Etapa inicial</span>
            <select
              className={formStyles.select}
              value={form.stageId}
              onChange={(e) => set({ stageId: e.target.value })}
            >
              <option value="">Primeira etapa em andamento</option>
              {pipeline?.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={formStyles.row}>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Origem</span>
            <select
              className={formStyles.select}
              value={form.origin}
              onChange={(e) => set({ origin: e.target.value })}
            >
              {ORIGIN_KEYS.map((k) => (
                <option key={k} value={k}>
                  {ORIGIN[k].label}
                </option>
              ))}
            </select>
          </label>
          {canAssign && (
            <label className={formStyles.field}>
              <span className={formStyles.label}>Responsável</span>
              <select
                className={formStyles.select}
                value={form.ownerId}
                onChange={(e) => set({ ownerId: e.target.value })}
              >
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === currentUserId ? `${m.name} (eu)` : m.name}
                  </option>
                ))}
                {team.length === 0 && <option value={currentUserId}>Eu</option>}
              </select>
            </label>
          )}
        </div>
        <div className={formStyles.actions}>
          <Button type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || !form.name.trim()}>
            {submitting ? "Salvando…" : "Criar lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
