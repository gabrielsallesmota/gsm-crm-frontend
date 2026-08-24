import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLeads } from "../hooks/useLeads";
import { useLeadActions } from "../hooks/useLeadActions";
import { usePipelines } from "../hooks/usePipelines";
import { useAuth } from "../hooks/useAuth";
import { LeadRow } from "../components/leads/LeadRow";
import { LeadDrawer } from "../components/leads/LeadDrawer";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/common/Button";
import { useToast } from "../hooks/useToast";
import { ROUTES } from "../constants/routes";
import styles from "./LeadsPage.module.css";

export function LeadsPage() {
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
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Leads</h1>
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
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSubmitting(true);
    await onSubmit({ name, company, phone, email, value: Number(value) || 0 });
    setSubmitting(false);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Novo lead</h2>
        <input className={styles.input} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={styles.input} placeholder="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input className={styles.input} placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className={styles.input} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={styles.input} placeholder="Valor (R$)" value={value} onChange={(e) => setValue(e.target.value)} />
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
