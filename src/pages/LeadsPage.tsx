import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLeads } from "../hooks/useLeads";
import { useLeadActions } from "../hooks/useLeadActions";
import { usePipelines } from "../hooks/usePipelines";
import { useProspects } from "../hooks/useProspects";
import { useProspectStages } from "../hooks/useProspectStages";
import { useMessageTemplates } from "../hooks/useMessageTemplates";
import { useProspectLossReasons } from "../hooks/useProspectLossReasons";
import { useAuth } from "../hooks/useAuth";
import { LeadRow } from "../components/leads/LeadRow";
import { LeadDrawer } from "../components/leads/LeadDrawer";
import { ProspectDrawer } from "../components/prospects/ProspectDrawer";
import { Badge } from "../components/common/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/common/Button";
import { CurrencyInput } from "../components/common/CurrencyInput";
import { useToast } from "../hooks/useToast";
import { ROUTES } from "../constants/routes";
import { formatPhone } from "../utils/phone";
import styles from "./LeadsPage.module.css";

type SourceFilter = "todos" | "ativo" | "passivo";

const PASSIVO_BADGE = { label: "Passivo", color: "#4aa3ff", bg: "rgba(74,163,255,.14)" };
const ATIVO_BADGE = { label: "Ativo", color: "#a78bfa", bg: "rgba(167,139,250,.16)" };

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
  const isSuperAdmin = user?.isPlatformStaff ?? false;
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

      {showAtivo && <ProspectsTable />}
    </div>
  );
}

function LeadsTable({ taggedPassivo }: { taggedPassivo: boolean }) {
  const [search, setSearch] = useState("");
  const { data, loading, error, reload } = useLeads({ search, page: 1, pageSize: 100 });
  const { create } = useLeadActions();
  const { data: pipelines } = usePipelines();
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);

  const leads = data?.items ?? [];
  const selected = leads.find((l) => l.id === id) ?? null;
  // Tenant sem nenhum pipeline ainda (só acontece antes do primeiro
  // pipeline ser criado em Configurações) — sem isso, `handleCreate` não
  // tem pra onde mandar o lead (backend exige `pipeline_id`).
  const defaultPipeline = pipelines?.find((p) => p.isDefault) ?? pipelines?.[0];

  async function handleCreate(form: { name: string; company: string; phone: string; email: string; value: number }) {
    if (!defaultPipeline || !user) return;
    try {
      await create({
        name: form.name,
        company: form.company,
        phone: form.phone,
        email: form.email,
        value: form.value,
        origin: "manual",
        // Quem cria o lead vira o dono por padrão — o "novo lead" é um form
        // rápido, sem seletor de responsável; reatribuir depois é feito no
        // drawer de edição do lead.
        ownerId: user.id,
        pipelineId: defaultPipeline.id,
      });
      toast("Lead criado com sucesso");
      setCreating(false);
      reload();
    } catch (err) {
      // Sem isso, um erro aqui (ex.: pipeline sem estágio) só aparecia como
      // "Uncaught (in promise)" no console — a pessoa via o modal travado em
      // "Salvando…" pra sempre, sem entender por quê.
      toast(err instanceof Error ? err.message : "Não foi possível criar o lead");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            {taggedPassivo && <Badge {...PASSIVO_BADGE} />} Leads
          </h1>
          <p className={styles.pageSubtitle}>{data ? `${data.total} leads` : "Carregando…"}</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setCreating(true)}
          disabled={!defaultPipeline}
          title={defaultPipeline ? undefined : "Crie um pipeline em Configurações antes de cadastrar um lead"}
        >
          + Novo lead
        </Button>
      </div>

      <input
        className={styles.search}
        placeholder="Buscar por nome, empresa ou e-mail…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <EmptyState title="Não foi possível carregar os leads" message={error.message} />}

      {!error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Estágio</th>
                <th>Origem</th>
                <th>Valor</th>
                <th>Prob.</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} onClick={() => navigate(ROUTES.leadDetail(lead.id))} />
              ))}
            </tbody>
          </table>
          {!loading && leads.length === 0 && <div className={styles.empty}>Nenhum lead encontrado.</div>}
        </div>
      )}

      {selected && (
        <LeadDrawer lead={selected} onClose={() => navigate(ROUTES.leads)} onSaved={() => reload()} />
      )}

      {creating && (
        <QuickCreateModal onClose={() => setCreating(false)} onSubmit={handleCreate} />
      )}
    </div>
  );
}

/** Espelha `LeadsTable` acima só que pra Prospecção (carteira comercial
 * ativa da própria GSM) — mesma dado que já aparece no board de
 * `PipelinePage.tsx`, só que como lista/tabela (pedido explícito: "aba lead
 * deve aparecer tanto os prospecção quando contatos passivos"). Só
 * renderizada pra platform staff (ver filtro em `LeadsPage`). */
function ProspectsTable() {
  const [search, setSearch] = useState("");
  const { data: stages } = useProspectStages();
  const { data: templates } = useMessageTemplates();
  const { data: lossReasons } = useProspectLossReasons();
  const { data, loading, error, reload } = useProspects({ search, page: 1, pageSize: 100 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const prospects = data?.items ?? [];
  const selected = prospects.find((p) => p.id === selectedId) ?? null;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            <Badge {...ATIVO_BADGE} /> Prospecção
          </h1>
          <p className={styles.pageSubtitle}>{data ? `${data.total} prospects` : "Carregando…"}</p>
        </div>
      </div>

      <input
        className={styles.search}
        placeholder="Buscar por empresa, cidade ou nicho…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <EmptyState title="Não foi possível carregar a prospecção" message={error.message} />}

      {!error && (
        <div className={styles.tableWrap}>
          <table className={styles.prospectTable}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Estágio</th>
                <th>Nicho</th>
                <th>Cidade</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((prospect) => {
                const stage = stages?.find((s) => s.id === prospect.stageId);
                return (
                  <tr
                    key={prospect.id}
                    className={styles.prospectRow}
                    onClick={() => setSelectedId(prospect.id)}
                  >
                    <td>{prospect.companyName}</td>
                    <td>
                      {stage && <Badge label={stage.name} color={stage.color} bg={`${stage.color}22`} />}
                    </td>
                    <td>{prospect.niche || "—"}</td>
                    <td>{prospect.city || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && prospects.length === 0 && (
            <div className={styles.empty}>Nenhum prospect encontrado.</div>
          )}
        </div>
      )}

      {selected && stages && (
        <ProspectDrawer
          prospect={selected}
          stages={stages}
          templates={templates ?? []}
          lossReasons={lossReasons ?? []}
          onClose={() => setSelectedId(null)}
          onSaved={() => reload()}
          onDeleted={() => {
            setSelectedId(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function QuickCreateModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (form: { name: string; company: string; phone: string; email: string; value: number }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [value, setValue] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name, company, phone, email, value });
    } finally {
      // `finally` (não só o caminho feliz): se `onSubmit` lançar (ver
      // `handleCreate`, que já mostra o toast do erro), o botão ainda
      // assim volta a ficar clicável em vez de travado em "Salvando…".
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Novo lead</h2>
        <input className={styles.input} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={styles.input} placeholder="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input
          className={styles.input}
          placeholder="Telefone"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
        />
        <input className={styles.input} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <CurrencyInput className={styles.input} value={value} onChange={setValue} />
        <div className={styles.modalActions}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={submitting || !name.trim()}>
            {submitting ? "Salvando…" : "Criar lead"}
          </Button>
        </div>
      </div>
    </div>
  );
}
