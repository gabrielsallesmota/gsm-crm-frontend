import { useState } from "react";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { useAttendanceHistory } from "../hooks/useAttendanceHistory";
import { useOperationsClients } from "../hooks/useOperationsClients";
import { useProcedureActions } from "../hooks/useProcedureActions";
import { useProcedures } from "../hooks/useProcedures";
import { useSpaceActions } from "../hooks/useSpaceActions";
import { useSpaces } from "../hooks/useSpaces";
import { useTherapistActions } from "../hooks/useTherapistActions";
import { useTherapists } from "../hooks/useTherapists";
import { useToast } from "../hooks/useToast";
import { operationsApiRepository } from "../repositories/api/OperationsApiRepository";
import { getOperationsPassword, setOperationsPassword } from "../repositories/api/operationsAuth";
import type {
  AttendancePhase,
  CreateProcedureInput,
  CreateSpaceInput,
  CreateTherapistInput,
  Procedure,
  SpaceAdmin,
  SpaceRequirementInput,
  SpaceType,
  Therapist,
} from "../types/operations";
import styles from "./TerapeutaDaVezGestaoPage.module.css";

const SPACE_TYPE_OPTIONS: { value: SpaceType; label: string }[] = [
  { value: "maca", label: "Maca" },
  { value: "cadeira", label: "Cadeira" },
  { value: "poltrona", label: "Poltrona" },
];

const PHASE_LABELS: Record<string, string> = {
  finished: "Finalizado",
  declined: "Recusado",
  reception: "Recepção",
  therapy: "Terapia",
};

type Tab = "terapeutas" | "procedimentos" | "espacos" | "clientes" | "historico";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Página standalone (fora do `ProtectedRoute`/login do CRM, pedido
 * explícito do cliente) — gate por senha simples compartilhada em vez de
 * conta de usuário. Ver `operationsAuth.ts`/`OperationsApiRepository.ts`.
 */
export function TerapeutaDaVezGestaoPage() {
  const [unlocked, setUnlocked] = useState(() => !!getOperationsPassword());

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Terapeuta da Vez</h1>
          <p className={styles.pageSubtitle}>
            Cadastro de terapeutas e procedimentos, clientes e histórico de atendimentos do painel de fila.
          </p>
        </div>
        <button
          type="button"
          className={styles.tab}
          onClick={() => {
            setOperationsPassword(null);
            setUnlocked(false);
          }}
        >
          Trocar senha
        </button>
      </div>

      <GestaoTabs />
    </div>
  );
}

function GestaoTabs() {
  const [tab, setTab] = useState<Tab>("terapeutas");

  return (
    <>
      <div className={styles.tabs}>
        {(
          [
            ["terapeutas", "Terapeutas"],
            ["procedimentos", "Procedimentos"],
            ["espacos", "Espaços"],
            ["clientes", "Clientes"],
            ["historico", "Histórico"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "terapeutas" && <TherapistsTab />}
      {tab === "procedimentos" && <ProceduresTab />}
      {tab === "espacos" && <SpacesTab />}
      {tab === "clientes" && <ClientsTab />}
      {tab === "historico" && <HistoryTab />}
    </>
  );
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit() {
    if (!password.trim()) return;
    setChecking(true);
    setError(null);
    setOperationsPassword(password.trim());
    try {
      // Qualquer chamada simples serve pra validar a senha contra o backend
      // (`require_operations_access`) antes de mostrar a tela de verdade.
      await operationsApiRepository.listTherapists();
      onUnlock();
    } catch {
      setOperationsPassword(null);
      setError("Senha incorreta.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={styles.gateWrap}>
      <div className={styles.gateCard}>
        <h1 className={styles.pageTitle}>Terapeuta da Vez · Gestão</h1>
        <p className={styles.pageSubtitle}>Digite a senha de acesso da gestão (não é a senha do CRM).</p>
        <input
          className={styles.input}
          type="password"
          autoFocus
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSubmit();
          }}
        />
        {error && <div className={styles.gateError}>{error}</div>}
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={checking || !password.trim()}>
          {checking ? "Verificando…" : "Entrar"}
        </Button>
      </div>
    </div>
  );
}

// ---- Terapeutas ---------------------------------------------------------------

function TherapistsTab() {
  const { data, loading, error, reload } = useTherapists();
  const actions = useTherapistActions();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTherapistInput>({ code: "", name: "", active: true });
  const [submitting, setSubmitting] = useState(false);

  function startEdit(t: Therapist) {
    setEditingId(t.id);
    setForm({ code: t.code, name: t.name, active: t.active });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ code: "", name: "", active: true });
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await actions.update(editingId, form);
        toast("Terapeuta atualizado.");
      } else {
        await actions.create(form);
        toast("Terapeuta cadastrado.");
      }
      resetForm();
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o terapeuta.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(t: Therapist) {
    if (!confirm(`Excluir o terapeuta "${t.name}"?`)) return;
    try {
      await actions.delete(t.id);
      toast("Terapeuta excluído.");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível excluir — verifique se não há atendimento em andamento.");
    }
  }

  return (
    <div>
      <p className={styles.rowMeta} style={{ marginBottom: 10 }}>
        Turno e pontuação não são cadastrados aqui — cada terapeuta dá Entrada/Saída e escolhe o
        turno diretamente na tela do painel (<code>/terapeuta-da-vez</code>), porque a escala muda
        dia a dia (folgas etc.). Para consultar o saldo de pontos de um dia específico, use a aba
        Histórico.
      </p>
      <div className={styles.form}>
        <input
          className={styles.inputSmall}
          placeholder="Código"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        <input
          className={styles.input}
          placeholder="Nome"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <label className={styles.checkboxGroup}>
          <input
            type="checkbox"
            checked={form.active ?? true}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Ativo
        </label>
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={submitting}>
          {editingId ? "Salvar" : "Adicionar"}
        </Button>
        {editingId && (
          <Button variant="ghost" onClick={resetForm}>
            Cancelar
          </Button>
        )}
      </div>

      {error && <EmptyState title="Não foi possível carregar os terapeutas" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <div className={styles.list}>
          {data.map((t) => (
            <div key={t.id} className={`${styles.row} ${t.active ? "" : styles.inactive}`}>
              <div className={styles.rowMain}>
                <span className={styles.rowName}>
                  {t.code} · {t.name}
                </span>
                <span className={styles.rowMeta}>
                  {t.present
                    ? `${t.currentShiftLabel} · ${t.status === "idle" ? "Livre" : t.status === "reception" ? "Na recepção" : "Em terapia"}`
                    : "Ausente hoje"}
                  {!t.active && " · inativo"}
                </span>
              </div>
              <span className={styles.rowStat}>
                {t.pointsManhaToday} manhã · {t.pointsNoturnoToday} noturno
              </span>
              <div className={styles.rowActions}>
                <button type="button" className={styles.linkBtn} onClick={() => startEdit(t)}>
                  Editar
                </button>
                <button type="button" className={styles.dangerBtn} onClick={() => void handleDelete(t)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {data.length === 0 && <div className={styles.row}>Nenhum terapeuta cadastrado ainda.</div>}
        </div>
      )}
    </div>
  );
}

// ---- Procedimentos --------------------------------------------------------------

const EMPTY_PROCEDURE_FORM: CreateProcedureInput = {
  code: "",
  name: "",
  points: 15,
  priceLabel: "",
  spaceRequirements: [{ type: "maca", minutes: 30 }],
  category: "",
  active: true,
};

function ProceduresTab() {
  const { data, loading, error, reload } = useProcedures();
  const actions = useProcedureActions();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateProcedureInput>(EMPTY_PROCEDURE_FORM);
  const [submitting, setSubmitting] = useState(false);

  function startEdit(p: Procedure) {
    setEditingId(p.id);
    setForm({
      code: p.code,
      name: p.name,
      points: p.points,
      priceLabel: p.priceLabel,
      spaceRequirements: p.spaceRequirements.map((r) => ({ type: r.type, minutes: r.minutes })),
      category: p.category,
      active: p.active,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_PROCEDURE_FORM);
  }

  function updateRequirement(index: number, patch: Partial<SpaceRequirementInput>) {
    setForm((f) => ({
      ...f,
      spaceRequirements: f.spaceRequirements.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  }

  function addRequirement() {
    setForm((f) => ({ ...f, spaceRequirements: [...f.spaceRequirements, { type: "maca", minutes: 15 }] }));
  }

  function removeRequirement(index: number) {
    setForm((f) => ({ ...f, spaceRequirements: f.spaceRequirements.filter((_, i) => i !== index) }));
  }

  const totalMinutes = form.spaceRequirements.reduce((sum, r) => sum + (r.minutes || 0), 0);
  const requirementsValid =
    form.spaceRequirements.length > 0 && form.spaceRequirements.every((r) => r.minutes > 0);

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim() || !requirementsValid) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await actions.update(editingId, form);
        toast("Procedimento atualizado.");
      } else {
        await actions.create(form);
        toast("Procedimento cadastrado.");
      }
      resetForm();
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o procedimento.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(p: Procedure) {
    if (!confirm(`Excluir o procedimento "${p.name}"?`)) return;
    try {
      await actions.delete(p.id);
      toast("Procedimento excluído.");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível excluir o procedimento.");
    }
  }

  return (
    <div>
      <div className={styles.form}>
        <input
          className={styles.inputSmall}
          placeholder="Código"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        <input
          className={styles.input}
          placeholder="Nome do procedimento"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          className={styles.inputSmall}
          type="number"
          placeholder="Pontuação"
          value={form.points}
          onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) }))}
        />
        <input
          className={styles.input}
          placeholder="Preço (texto livre, ex: R$ 120)"
          value={form.priceLabel}
          onChange={(e) => setForm((f) => ({ ...f, priceLabel: e.target.value }))}
        />
        <input
          className={styles.input}
          placeholder="Categoria (agrupamento no painel)"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        />
      </div>

      <div className={styles.form} style={{ flexDirection: "column", alignItems: "stretch" }}>
        <span className={styles.rowMeta}>
          Espaços usados pelo procedimento, na ordem — um procedimento pode passar por mais de um
          espaço (ex.: 30 min numa maca e depois 15 min numa poltrona).
        </span>
        {form.spaceRequirements.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <select
              className={styles.select}
              value={r.type}
              onChange={(e) => updateRequirement(i, { type: e.target.value as SpaceType })}
            >
              {SPACE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              className={styles.inputSmall}
              type="number"
              placeholder="Minutos"
              value={r.minutes}
              onChange={(e) => updateRequirement(i, { minutes: Number(e.target.value) })}
            />
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => removeRequirement(i)}
              disabled={form.spaceRequirements.length <= 1}
            >
              Remover trecho
            </button>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className={styles.linkBtn} onClick={addRequirement}>
            + adicionar trecho
          </button>
          <span className={styles.rowMeta}>Duração total: {totalMinutes} min</span>
        </div>
      </div>

      <div className={styles.form}>
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={submitting || !requirementsValid}>
          {editingId ? "Salvar" : "Adicionar"}
        </Button>
        {editingId && (
          <Button variant="ghost" onClick={resetForm}>
            Cancelar
          </Button>
        )}
      </div>

      {error && <EmptyState title="Não foi possível carregar os procedimentos" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <div className={styles.list}>
          {data.map((p) => (
            <div key={p.id} className={`${styles.row} ${p.active ? "" : styles.inactive}`}>
              <div className={styles.rowMain}>
                <span className={styles.rowName}>
                  {p.code} · {p.name}
                </span>
                <span className={styles.rowMeta}>
                  {p.durationLabel} · {p.typeLabel} · {p.category}
                  {p.priceLabel && ` · ${p.priceLabel}`}
                  {!p.active && " · inativo"}
                </span>
              </div>
              <span className={styles.rowStat}>+{p.points} pts</span>
              <div className={styles.rowActions}>
                <button type="button" className={styles.linkBtn} onClick={() => startEdit(p)}>
                  Editar
                </button>
                <button type="button" className={styles.dangerBtn} onClick={() => void handleDelete(p)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {data.length === 0 && <div className={styles.row}>Nenhum procedimento cadastrado ainda.</div>}
        </div>
      )}
    </div>
  );
}

// ---- Espaços --------------------------------------------------------------------

const EMPTY_SPACE_FORM: CreateSpaceInput = { code: "", name: "", type: "maca", active: true };

function SpacesTab() {
  const { data, loading, error, reload } = useSpaces();
  const actions = useSpaceActions();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSpaceInput>(EMPTY_SPACE_FORM);
  const [submitting, setSubmitting] = useState(false);

  function startEdit(s: SpaceAdmin) {
    setEditingId(s.id);
    setForm({ code: s.code, name: s.name, type: s.type, active: s.active });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_SPACE_FORM);
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await actions.update(editingId, form);
        toast("Espaço atualizado.");
      } else {
        await actions.create(form);
        toast("Espaço cadastrado.");
      }
      resetForm();
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o espaço.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(s: SpaceAdmin) {
    if (!confirm(`Excluir o espaço "${s.name}"?`)) return;
    try {
      await actions.delete(s.id);
      toast("Espaço excluído.");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível excluir — verifique se não está em uso agora.");
    }
  }

  return (
    <div>
      <div className={styles.form}>
        <input
          className={styles.inputSmall}
          placeholder="Código"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        <input
          className={styles.input}
          placeholder="Nome (ex: Maca 01)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <select
          className={styles.select}
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SpaceType }))}
        >
          {SPACE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label className={styles.checkboxGroup}>
          <input
            type="checkbox"
            checked={form.active ?? true}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Ativo
        </label>
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={submitting}>
          {editingId ? "Salvar" : "Adicionar"}
        </Button>
        {editingId && (
          <Button variant="ghost" onClick={resetForm}>
            Cancelar
          </Button>
        )}
      </div>

      {error && <EmptyState title="Não foi possível carregar os espaços" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <div className={styles.list}>
          {data.map((s) => (
            <div key={s.id} className={`${styles.row} ${s.active ? "" : styles.inactive}`}>
              <div className={styles.rowMain}>
                <span className={styles.rowName}>
                  {s.code} · {s.name}
                </span>
                <span className={styles.rowMeta}>
                  {SPACE_TYPE_OPTIONS.find((o) => o.value === s.type)?.label ?? s.type}
                  {!s.active && " · inativo"}
                </span>
              </div>
              <div className={styles.rowActions}>
                <button type="button" className={styles.linkBtn} onClick={() => startEdit(s)}>
                  Editar
                </button>
                <button type="button" className={styles.dangerBtn} onClick={() => void handleDelete(s)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {data.length === 0 && <div className={styles.row}>Nenhum espaço cadastrado ainda.</div>}
        </div>
      )}
    </div>
  );
}

// ---- Clientes -------------------------------------------------------------------

function ClientsTab() {
  const [search, setSearch] = useState("");
  const { data, loading, error } = useOperationsClients(search);

  return (
    <div>
      <div className={styles.form}>
        <input
          className={styles.input}
          placeholder="Buscar por nome ou telefone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <EmptyState title="Não foi possível carregar os clientes" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <div className={styles.list}>
          {data.map((c) => (
            <div key={c.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowName}>{c.name}</span>
                <span className={styles.rowMeta}>
                  {c.phone} · último atendimento {formatDateTime(c.lastServiceAt)}
                </span>
              </div>
              <span className={styles.rowStat}>{c.totalServices} atend.</span>
            </div>
          ))}
          {data.length === 0 && <div className={styles.row}>Nenhum cliente encontrado.</div>}
        </div>
      )}
    </div>
  );
}

// ---- Histórico ------------------------------------------------------------------

/** Pontos resetam todo dia (derivados do histórico de atendimentos, não um
 * contador salvo) — esta busca consulta o saldo de manhã/noturno de UM
 * terapeuta num dia específico, pedido do usuário pra continuar enxergando
 * dias anteriores mesmo com o reset diário. */
function PointsByDayLookup() {
  const { data: therapists } = useTherapists();
  const [therapistId, setTherapistId] = useState("");
  const [isoDate, setIsoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<{ pointsManha: number; pointsNoturno: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    if (!therapistId || !isoDate) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const points = await operationsApiRepository.getTherapistPoints(therapistId, isoDate);
      setResult({ pointsManha: points.pointsManha, pointsNoturno: points.pointsNoturno });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar os pontos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.filters} style={{ marginBottom: 18, alignItems: "center" }}>
      <select className={styles.select} value={therapistId} onChange={(e) => setTherapistId(e.target.value)}>
        <option value="">Ver saldo de um terapeuta…</option>
        {(therapists ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        className={styles.inputSmall}
        type="date"
        value={isoDate}
        onChange={(e) => setIsoDate(e.target.value)}
      />
      <Button variant="ghost" onClick={() => void lookup()} disabled={loading || !therapistId}>
        {loading ? "Consultando…" : "Consultar"}
      </Button>
      {error && <span className={styles.rowMeta}>{error}</span>}
      {result && (
        <span className={styles.rowStat}>
          {result.pointsManha} manhã · {result.pointsNoturno} noturno
        </span>
      )}
    </div>
  );
}

function HistoryTab() {
  const { data: therapists } = useTherapists();
  const { data: procedures } = useProcedures();
  const [therapistId, setTherapistId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [phase, setPhase] = useState<AttendancePhase | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error } = useAttendanceHistory({
    therapistId: therapistId || undefined,
    procedureId: procedureId || undefined,
    clientSearch: clientSearch || undefined,
    phase: phase || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 20,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PointsByDayLookup />
      <div className={styles.filters}>
        <select
          className={styles.select}
          value={therapistId}
          onChange={(e) => {
            setTherapistId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os terapeutas</option>
          {(therapists ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={procedureId}
          onChange={(e) => {
            setProcedureId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os procedimentos</option>
          {(procedures ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={phase}
          onChange={(e) => {
            setPhase(e.target.value as AttendancePhase | "");
            setPage(1);
          }}
        >
          <option value="">Finalizados e recusados</option>
          <option value="finished">Só finalizados</option>
          <option value="declined">Só recusados</option>
        </select>
        <input
          className={styles.input}
          placeholder="Buscar cliente (nome ou telefone)"
          value={clientSearch}
          onChange={(e) => {
            setClientSearch(e.target.value);
            setPage(1);
          }}
        />
        <input
          className={styles.inputSmall}
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          className={styles.inputSmall}
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <EmptyState title="Não foi possível carregar o histórico" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Terapeuta</th>
                  <th>Procedimento</th>
                  <th>Espaço</th>
                  <th>Status</th>
                  <th>Pontos</th>
                  <th>Chamado em</th>
                  <th>Finalizado em</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.clientName}
                      <br />
                      {a.clientPhone}
                    </td>
                    <td>{a.therapistName}</td>
                    <td>{a.procedureName ?? "—"}</td>
                    <td>{a.spaceNames.join(" + ") || "—"}</td>
                    <td>{PHASE_LABELS[a.phase] ?? a.phase}</td>
                    <td>{a.pointsAwarded != null ? `+${a.pointsAwarded}` : "—"}</td>
                    <td>{formatDateTime(a.calledAt)}</td>
                    <td>{formatDateTime(a.finishedAt)}</td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={8}>Nenhum atendimento encontrado para os filtros selecionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.pager}>
            <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Anterior
            </Button>
            <span>
              Página {data.page} de {totalPages} · {data.total} registro(s)
            </span>
            <Button variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              Próxima
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
