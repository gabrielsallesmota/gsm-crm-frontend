import { useState } from "react";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { useAttendanceHistory } from "../hooks/useAttendanceHistory";
import { useOperationsClients } from "../hooks/useOperationsClients";
import { useProcedureActions } from "../hooks/useProcedureActions";
import { useProcedures } from "../hooks/useProcedures";
import { useTherapistActions } from "../hooks/useTherapistActions";
import { useTherapists } from "../hooks/useTherapists";
import { useToast } from "../hooks/useToast";
import type {
  AttendancePhase,
  CreateProcedureInput,
  CreateTherapistInput,
  Procedure,
  Shift,
  SpaceType,
  Therapist,
} from "../types/operations";
import styles from "./TerapeutaDaVezGestaoPage.module.css";

const SHIFT_OPTIONS: { value: Shift; label: string }[] = [
  { value: "manha", label: "Manhã (10:00–16:00)" },
  { value: "inter", label: "Interjornada (13:00–19:00)" },
  { value: "tarde", label: "Tarde (16:00–22:00)" },
];

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

type Tab = "terapeutas" | "procedimentos" | "clientes" | "historico";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function TerapeutaDaVezGestaoPage() {
  const [tab, setTab] = useState<Tab>("terapeutas");

  return (
    <div>
      <h1 className={styles.pageTitle}>Terapeuta da Vez</h1>
      <p className={styles.pageSubtitle}>
        Cadastro de terapeutas e procedimentos, clientes e histórico de atendimentos do painel de fila.
      </p>

      <div className={styles.tabs}>
        {(
          [
            ["terapeutas", "Terapeutas"],
            ["procedimentos", "Procedimentos"],
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
      {tab === "clientes" && <ClientsTab />}
      {tab === "historico" && <HistoryTab />}
    </div>
  );
}

// ---- Terapeutas ---------------------------------------------------------------

function TherapistsTab() {
  const { data, loading, error, reload } = useTherapists();
  const actions = useTherapistActions();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTherapistInput>({
    code: "",
    name: "",
    shift: "manha",
    points: 0,
    active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  function startEdit(t: Therapist) {
    setEditingId(t.id);
    setForm({ code: t.code, name: t.name, shift: t.shift, points: t.points, active: t.active });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ code: "", name: "", shift: "manha", points: 0, active: true });
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
        <select
          className={styles.select}
          value={form.shift}
          onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value as Shift }))}
        >
          {SHIFT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          className={styles.inputSmall}
          type="number"
          placeholder="Pontos"
          value={form.points ?? 0}
          onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) }))}
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
                  {t.shiftLabel} · {t.status === "idle" ? "Livre" : t.status === "reception" ? "Na recepção" : "Em terapia"}
                  {!t.active && " · inativo"}
                </span>
              </div>
              <span className={styles.rowStat}>{t.points} pts</span>
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
  durationMinutes: 30,
  points: 15,
  priceLabel: "",
  spaceTypes: ["maca"],
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
      durationMinutes: p.durationMinutes,
      points: p.points,
      priceLabel: p.priceLabel,
      spaceTypes: p.spaceTypes,
      category: p.category,
      active: p.active,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_PROCEDURE_FORM);
  }

  function toggleSpaceType(type: SpaceType) {
    setForm((f) => {
      const has = f.spaceTypes.includes(type);
      return { ...f, spaceTypes: has ? f.spaceTypes.filter((t) => t !== type) : [...f.spaceTypes, type] };
    });
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim() || form.durationMinutes <= 0 || form.spaceTypes.length === 0) return;
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
          placeholder="Minutos"
          value={form.durationMinutes}
          onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
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
        <div className={styles.checkboxGroup}>
          Espaço:
          {SPACE_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value}>
              <input
                type="checkbox"
                checked={form.spaceTypes.includes(opt.value)}
                onChange={() => toggleSpaceType(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={submitting}>
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
