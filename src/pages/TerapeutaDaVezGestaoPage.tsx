import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { Modal } from "../components/common/Modal";
import { ToastHost } from "../components/common/ToastHost";
import { ProcedureImportModal } from "../components/operations/ProcedureImportModal";
import { TherapistImportModal } from "../components/operations/TherapistImportModal";
import { useAsyncResource } from "../hooks/useAsyncResource";
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
  AttendanceRecord,
  BusinessHoursEntry,
  CreateProcedureInput,
  CreateSpaceInput,
  CreateTherapistInput,
  Procedure,
  ScheduleEntry,
  Shift,
  ShiftHoursEntry,
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

type Tab =
  | "terapeutas"
  | "escala"
  | "horario"
  | "procedimentos"
  | "espacos"
  | "clientes"
  | "historico";

const SHIFT_OPTIONS: { value: Shift; label: string }[] = [
  { value: "manha", label: "Manhã (10h–16h)" },
  { value: "inter", label: "Interturno (14h–20h)" },
  { value: "noturno", label: "Noturno (16h–22h)" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Dia-a-dia num intervalo, filtrado por dia da semana — o "de/para de data"
// da escala: "seg a sex" vira um intervalo com sáb/dom desmarcados, em vez
// de cadastrar cada dia útil um por um. Usa campos locais (não
// toISOString) pra não arriscar cair no dia errado perto da virada de fuso.
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function datesInRange(fromIso: string, toIso: string, allowedWeekdays: Set<number>): string[] {
  const result: string[] = [];
  const cursor = new Date(`${fromIso}T00:00:00`);
  const end = new Date(`${toIso}T00:00:00`);
  while (cursor <= end) {
    if (allowedWeekdays.has(cursor.getDay())) result.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

// getDay(): 0=domingo...6=sábado — reordenado começando na segunda só pra
// exibição, mais natural pra escala de trabalho.
const WEEKDAY_TOGGLE_OPTIONS: { js: number; label: string }[] = [
  { js: 1, label: "Seg" },
  { js: 2, label: "Ter" },
  { js: 3, label: "Qua" },
  { js: 4, label: "Qui" },
  { js: 5, label: "Sex" },
  { js: 6, label: "Sáb" },
  { js: 0, label: "Dom" },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Máscara de moeda: cada dígito digitado entra como centavo, sempre
 * formatado como "R$ 1.234,56" — nunca deixa o campo sair do padrão (não
 * dá pra digitar texto livre nem apagar só o "R$"). Extrai os dígitos do
 * valor JÁ editado pelo campo (inclui backspace) e reformata do zero, então
 * apagar o último caractere remove o último dígito do valor, não da máscara. */
function formatPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number(digits);
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
            Cadastro de terapeutas, escala, procedimentos, clientes e histórico de atendimentos do
            painel de fila.
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
      {/* `ToastHost` normalmente é montado só dentro de `AppLayout` — esta
          página fica FORA do `ProtectedRoute`/`AppLayout` de propósito (senha
          própria, não login do CRM), então sem isto aqui todo `toast(...)`
          desta tela (criar/editar/excluir/salvar em qualquer aba) atualizava
          o estado normalmente mas nunca aparecia na tela — o pedido que
          motivou este ajuste. */}
      <ToastHost />
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
            ["escala", "Escala"],
            ["horario", "Horário"],
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
      {tab === "escala" && <ScheduleTab />}
      {tab === "horario" && <BusinessHoursTab />}
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

function TherapistFormFields({
  form,
  setForm,
}: {
  form: CreateTherapistInput;
  setForm: (updater: (f: CreateTherapistInput) => CreateTherapistInput) => void;
}) {
  return (
    <>
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
    </>
  );
}

const EMPTY_THERAPIST_FORM: CreateTherapistInput = { code: "", name: "", active: true };

function TherapistsTab() {
  const { data, loading, error, reload } = useTherapists();
  const actions = useTherapistActions();
  const { toast } = useToast();
  const [form, setForm] = useState<CreateTherapistInput>(EMPTY_THERAPIST_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Therapist | null>(null);
  const [editForm, setEditForm] = useState<CreateTherapistInput>(EMPTY_THERAPIST_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);

  function startEdit(t: Therapist) {
    setEditing(t);
    setEditForm({ code: t.code, name: t.name, active: t.active });
  }

  async function handleAdd() {
    if (!form.code.trim() || !form.name.trim()) return;
    setSubmitting(true);
    try {
      await actions.create(form);
      toast("Terapeuta cadastrado.");
      setForm(EMPTY_THERAPIST_FORM);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o terapeuta.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing || !editForm.code.trim() || !editForm.name.trim()) return;
    setEditSubmitting(true);
    try {
      await actions.update(editing.id, editForm);
      toast("Terapeuta atualizado.");
      setEditing(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o terapeuta.");
    } finally {
      setEditSubmitting(false);
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
        Turno e pontuação não são cadastrados aqui — o turno de cada dia é definido na aba{" "}
        <b>Escala</b>, e o terapeuta aperta "Iniciar turno" no painel (<code>/terapeuta-da-vez</code>)
        quando chega. Não existe mais Entrada/Saída livre nem botão de Saída (terapeutas são PJ) — a
        presença termina sozinha quando a janela do turno passa. Para consultar o saldo de pontos de
        um dia específico, use a aba Histórico.
      </p>
      <div className={styles.form}>
        <TherapistFormFields form={form} setForm={setForm} />
        <Button variant="primary" onClick={() => void handleAdd()} disabled={submitting}>
          Adicionar
        </Button>
        <Button variant="ghost" onClick={() => setImportOpen(true)}>
          Importar CSV
        </Button>
      </div>

      {importOpen && (
        <TherapistImportModal
          onClose={() => setImportOpen(false)}
          onImported={reload}
        />
      )}

      {editing && (
        <Modal title={`Editar terapeuta`} onClose={() => setEditing(null)}>
          <div className={styles.form} style={{ margin: 0 }}>
            <TherapistFormFields form={editForm} setForm={setEditForm} />
          </div>
          <div className={styles.rowActions} style={{ marginTop: 16, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void handleSaveEdit()} disabled={editSubmitting}>
              Salvar
            </Button>
          </div>
        </Modal>
      )}

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

// ---- Escala -----------------------------------------------------------------------
// Substitui Entrada/Saída livre (questão trabalhista: terapeutas são PJ) —
// quem trabalha quando é cadastrado aqui, dia por dia (nunca um padrão
// semanal fixo: "amanhã manhã e interturno, depois de amanhã só à noite").

function ScheduleTab() {
  const { data: therapists } = useTherapists();
  const { toast } = useToast();

  const [rangeFrom, setRangeFrom] = useState(() => todayIso());
  const [rangeTo, setRangeTo] = useState(() => addDaysIso(todayIso(), 13));
  const [filterTherapistId, setFilterTherapistId] = useState("");

  const { data, loading, error, reload } = useAsyncResource(
    () => operationsApiRepository.listSchedule(rangeFrom, rangeTo, filterTherapistId || undefined),
    [rangeFrom, rangeTo, filterTherapistId],
  );

  const [formTherapistId, setFormTherapistId] = useState("");
  const [formDate, setFormDate] = useState(() => todayIso());
  const [formShifts, setFormShifts] = useState<Shift[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // "De/para" de data — repetir o mesmo cadastro por vários dias em vez de
  // um por um (ex.: "segunda a sexta" = intervalo com sáb/dom desmarcados).
  const [repeatMode, setRepeatMode] = useState(false);
  const [formDateTo, setFormDateTo] = useState(() => todayIso());
  const [repeatWeekdays, setRepeatWeekdays] = useState<Set<number>>(
    () => new Set(WEEKDAY_TOGGLE_OPTIONS.map((o) => o.js)),
  );

  function toggleFormShift(shift: Shift) {
    setFormShifts((prev) =>
      prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift],
    );
  }

  function toggleRepeatWeekday(js: number) {
    setRepeatWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(js)) next.delete(js);
      else next.add(js);
      return next;
    });
  }

  const targetDates = repeatMode
    ? datesInRange(formDate, formDateTo, repeatWeekdays)
    : [formDate];

  async function handleAdd() {
    if (!formTherapistId || !formDate || formShifts.length === 0) return;
    if (repeatMode && targetDates.length === 0) return;
    setSubmitting(true);
    let created = 0;
    let failed = 0;
    try {
      for (const day of targetDates) {
        for (const shift of formShifts) {
          try {
            await operationsApiRepository.createScheduleEntry({
              therapistId: formTherapistId,
              date: day,
              shift,
            });
            created++;
          } catch {
            // provavelmente já escalado nesse dia/turno — não aborta o
            // resto do lote por causa de uma data que já existia.
            failed++;
          }
        }
      }
      toast(
        failed > 0
          ? `${created} escala(s) cadastrada(s), ${failed} já existiam ou falharam.`
          : `${created} escala(s) cadastrada(s).`,
      );
      setFormShifts([]);
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entryId: string) {
    try {
      await operationsApiRepository.deleteScheduleEntry(entryId);
      toast("Escala removida.");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível remover a escala.");
    }
  }

  const grouped = useMemo(() => {
    const byDate = new Map<string, ScheduleEntry[]>();
    for (const entry of data ?? []) {
      const list = byDate.get(entry.date) ?? [];
      list.push(entry);
      byDate.set(entry.date, list);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  return (
    <div>
      <p className={styles.rowMeta} style={{ marginBottom: 10 }}>
        Cadastre quem trabalha e em qual turno — não é um padrão fixo semanal, cada dia fica
        registrado à parte (ex.: amanhã manhã e interturno, depois de amanhã só à noite), então dá
        pra ter exceção quando quiser. Pra repetir o mesmo cadastro em vários dias de uma vez (ex.:
        segunda a sexta), marque "Repetir por vários dias" e desmarque os dias da semana que não
        entram. O painel só oferece "Iniciar turno" pros turnos escalados aqui que já estiverem na
        janela de horário.
      </p>

      <div className={styles.form}>
        <select
          className={styles.select}
          value={formTherapistId}
          onChange={(e) => setFormTherapistId(e.target.value)}
        >
          <option value="">Terapeuta…</option>
          {(therapists ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          className={styles.inputSmall}
          type="date"
          value={formDate}
          onChange={(e) => setFormDate(e.target.value)}
        />
        <label className={styles.checkboxGroup}>
          <input
            type="checkbox"
            checked={repeatMode}
            onChange={(e) => setRepeatMode(e.target.checked)}
          />
          Repetir por vários dias
        </label>
        {repeatMode && (
          <>
            <span className={styles.rowMeta}>até</span>
            <input
              className={styles.inputSmall}
              type="date"
              value={formDateTo}
              onChange={(e) => setFormDateTo(e.target.value)}
            />
          </>
        )}
        <div className={styles.checkboxGroup}>
          {SHIFT_OPTIONS.map((opt) => (
            <label key={opt.value}>
              <input
                type="checkbox"
                checked={formShifts.includes(opt.value)}
                onChange={() => toggleFormShift(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {repeatMode && (
        <div className={styles.form}>
          <span className={styles.rowMeta}>Repetir só nos dias:</span>
          <div className={styles.checkboxGroup}>
            {WEEKDAY_TOGGLE_OPTIONS.map((opt) => (
              <label key={opt.js}>
                <input
                  type="checkbox"
                  checked={repeatWeekdays.has(opt.js)}
                  onChange={() => toggleRepeatWeekday(opt.js)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <span className={styles.rowMeta}>
            {targetDates.length} dia(s) × {formShifts.length || 0} turno(s) selecionado(s)
          </span>
        </div>
      )}

      <div className={styles.form}>
        <Button
          variant="primary"
          onClick={() => void handleAdd()}
          disabled={
            submitting || !formTherapistId || !formDate || formShifts.length === 0 || targetDates.length === 0
          }
        >
          Adicionar
        </Button>
      </div>

      <div className={styles.filters}>
        <select
          className={styles.select}
          value={filterTherapistId}
          onChange={(e) => setFilterTherapistId(e.target.value)}
        >
          <option value="">Todos os terapeutas</option>
          {(therapists ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          className={styles.inputSmall}
          type="date"
          value={rangeFrom}
          onChange={(e) => setRangeFrom(e.target.value)}
        />
        <input
          className={styles.inputSmall}
          type="date"
          value={rangeTo}
          onChange={(e) => setRangeTo(e.target.value)}
        />
      </div>

      {error && <EmptyState title="Não foi possível carregar a escala" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <div className={styles.list}>
          {grouped.map(([date, entries]) => (
            <div key={date} className={styles.row} style={{ alignItems: "flex-start" }}>
              <div className={styles.rowMain}>
                <span className={styles.rowName}>
                  {new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {entries.map((entry) => (
                    <span key={entry.id} className={styles.phaseBadge} style={{ display: "inline-flex", gap: 6, alignItems: "center", background: "var(--card-bg-alt)" }}>
                      {entry.therapistName} · {entry.shiftLabel}
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        style={{ padding: 0 }}
                        onClick={() => void handleDelete(entry.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className={styles.row}>Nenhuma escala cadastrada nesse período.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Horário de funcionamento ------------------------------------------------------
// Regra de negócio própria, separada dos turnos: mesmo dentro da janela de
// um turno, a loja pode estar fechada (dia inteiro ou fora de um
// intervalo). Edita a semana inteira de uma vez (7 linhas fixas).

function minutesToTime(m: number | null): string {
  if (m == null) return "";
  const h = Math.floor(m / 60)
    .toString()
    .padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${h}:${mm}`;
}

function timeToMinutes(t: string): number | null {
  if (!t) return null;
  const parts = t.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

function BusinessHoursTab() {
  const { data, loading, error, reload } = useAsyncResource(
    () => operationsApiRepository.getBusinessHours(),
    [],
  );
  const { toast } = useToast();
  const [days, setDays] = useState<BusinessHoursEntry[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (data) setDays(data);
  }, [data]);

  function updateDay(weekday: number, patch: Partial<BusinessHoursEntry>) {
    setDays((prev) =>
      prev ? prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)) : prev,
    );
  }

  async function handleSave() {
    if (!days) return;
    setSubmitting(true);
    try {
      const updated = await operationsApiRepository.updateBusinessHours(days);
      setDays(updated);
      toast("Horário de funcionamento salvo.");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o horário.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className={styles.rowMeta} style={{ marginBottom: 10 }}>
        Dias e horários em que a loja está aberta — independente dos turnos, se estiver marcado
        como fechado (ou fora do intervalo) aqui, o painel mostra "loja fechada" e ninguém consegue
        iniciar turno.
      </p>

      {error && <EmptyState title="Não foi possível carregar o horário" message={error.message} />}
      {loading && !days && <div className={styles.loading}>Carregando…</div>}

      {days && (
        <>
          <div className={styles.list}>
            {days.map((d) => (
              <div key={d.weekday} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowName}>{d.weekdayLabel}</span>
                </div>
                <label className={styles.checkboxGroup}>
                  <input
                    type="checkbox"
                    checked={d.closed}
                    onChange={(e) => updateDay(d.weekday, { closed: e.target.checked })}
                  />
                  Fechado
                </label>
                {!d.closed && (
                  <>
                    <input
                      className={styles.inputSmall}
                      type="time"
                      value={minutesToTime(d.opensAt)}
                      onChange={(e) => updateDay(d.weekday, { opensAt: timeToMinutes(e.target.value) })}
                    />
                    <span className={styles.rowMeta}>até</span>
                    <input
                      className={styles.inputSmall}
                      type="time"
                      value={minutesToTime(d.closesAt)}
                      onChange={(e) => updateDay(d.weekday, { closesAt: timeToMinutes(e.target.value) })}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <div className={styles.form}>
            <Button variant="primary" onClick={() => void handleSave()} disabled={submitting}>
              Salvar horário
            </Button>
          </div>
        </>
      )}

      <ShiftHoursSection />
    </div>
  );
}

// Horário de cada TURNO por dia da semana — diferente do horário de
// funcionamento acima: isto é a janela do turno em si (Manhã/Interturno/
// Noturno), que também pode variar por dia ("domingo pode ser que manhã,
// interjornada e tarde sejam diferentes"). 21 linhas (7 dias × 3 turnos),
// editadas juntas.

const SHIFT_ORDER: Shift[] = ["manha", "inter", "noturno"];

function ShiftHoursSection() {
  const { data, loading, error, reload } = useAsyncResource(
    () => operationsApiRepository.getShiftHours(),
    [],
  );
  const { toast } = useToast();
  const [entries, setEntries] = useState<ShiftHoursEntry[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (data) setEntries(data);
  }, [data]);

  function updateEntry(weekday: number, shift: Shift, patch: Partial<ShiftHoursEntry>) {
    setEntries((prev) =>
      prev
        ? prev.map((e) => (e.weekday === weekday && e.shift === shift ? { ...e, ...patch } : e))
        : prev,
    );
  }

  async function handleSave() {
    if (!entries) return;
    setSubmitting(true);
    try {
      const updated = await operationsApiRepository.updateShiftHours(entries);
      setEntries(updated);
      toast("Horário dos turnos salvo.");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o horário dos turnos.");
    } finally {
      setSubmitting(false);
    }
  }

  const byWeekday = useMemo(() => {
    const map = new Map<number, ShiftHoursEntry[]>();
    for (const e of entries ?? []) {
      const list = map.get(e.weekday) ?? [];
      list.push(e);
      map.set(e.weekday, list);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [entries]);

  return (
    <div style={{ marginTop: 24 }}>
      <p className={styles.rowMeta} style={{ marginBottom: 10 }}>
        Janela de cada turno (Manhã/Interturno/Noturno) por dia da semana — pode ser diferente em
        cada dia (ex.: domingo com manhã e interturno mais curtos). É o que o painel usa pra saber
        quando oferecer "Iniciar turno" e pra separar a pontuação entre manhã e noturno.
      </p>

      {error && (
        <EmptyState title="Não foi possível carregar o horário dos turnos" message={error.message} />
      )}
      {loading && !entries && <div className={styles.loading}>Carregando…</div>}

      {entries && (
        <>
          <div className={styles.list}>
            {byWeekday.map(([weekday, dayEntries]) => (
              <div key={weekday} className={styles.row} style={{ alignItems: "flex-start" }}>
                <div className={styles.rowMain}>
                  <span className={styles.rowName}>{dayEntries[0]?.weekdayLabel}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 6 }}>
                    {SHIFT_ORDER.map((shift) => {
                      const entry = dayEntries.find((e) => e.shift === shift);
                      if (!entry) return null;
                      return (
                        <div
                          key={shift}
                          style={{ display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <span className={styles.rowMeta}>{entry.shiftLabel}</span>
                          <input
                            className={styles.inputSmall}
                            type="time"
                            value={minutesToTime(entry.opensAt)}
                            onChange={(e) =>
                              updateEntry(weekday, shift, {
                                opensAt: timeToMinutes(e.target.value) ?? entry.opensAt,
                              })
                            }
                          />
                          <span className={styles.rowMeta}>até</span>
                          <input
                            className={styles.inputSmall}
                            type="time"
                            value={minutesToTime(entry.closesAt)}
                            onChange={(e) =>
                              updateEntry(weekday, shift, {
                                closesAt: timeToMinutes(e.target.value) ?? entry.closesAt,
                              })
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.form}>
            <Button variant="primary" onClick={() => void handleSave()} disabled={submitting}>
              Salvar horário dos turnos
            </Button>
          </div>
        </>
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

function ProcedureFormFields({
  form,
  setForm,
}: {
  form: CreateProcedureInput;
  setForm: (updater: (f: CreateProcedureInput) => CreateProcedureInput) => void;
}) {
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

  return (
    <>
      <div className={styles.form} style={{ margin: 0, marginBottom: 12 }}>
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
          placeholder="R$ 0,00"
          inputMode="numeric"
          value={form.priceLabel}
          onChange={(e) => setForm((f) => ({ ...f, priceLabel: formatPriceInput(e.target.value) }))}
        />
        <input
          className={styles.input}
          placeholder="Categoria (agrupamento no painel)"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        />
      </div>

      <div className={styles.form} style={{ flexDirection: "column", alignItems: "stretch", margin: 0 }}>
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
    </>
  );
}

function ProceduresTab() {
  const { data, loading, error, reload } = useProcedures();
  const actions = useProcedureActions();
  const { toast } = useToast();
  const [form, setForm] = useState<CreateProcedureInput>(EMPTY_PROCEDURE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Procedure | null>(null);
  const [editForm, setEditForm] = useState<CreateProcedureInput>(EMPTY_PROCEDURE_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);

  function startEdit(p: Procedure) {
    setEditing(p);
    setEditForm({
      code: p.code,
      name: p.name,
      points: p.points,
      priceLabel: p.priceLabel,
      spaceRequirements: p.spaceRequirements.map((r) => ({ type: r.type, minutes: r.minutes })),
      category: p.category,
      active: p.active,
    });
  }

  const requirementsValid =
    form.spaceRequirements.length > 0 && form.spaceRequirements.every((r) => r.minutes > 0);
  const editRequirementsValid =
    editForm.spaceRequirements.length > 0 && editForm.spaceRequirements.every((r) => r.minutes > 0);

  async function handleAdd() {
    if (!form.code.trim() || !form.name.trim() || !requirementsValid) return;
    setSubmitting(true);
    try {
      await actions.create(form);
      toast("Procedimento cadastrado.");
      setForm(EMPTY_PROCEDURE_FORM);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o procedimento.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing || !editForm.code.trim() || !editForm.name.trim() || !editRequirementsValid) return;
    setEditSubmitting(true);
    try {
      await actions.update(editing.id, editForm);
      toast("Procedimento atualizado.");
      setEditing(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o procedimento.");
    } finally {
      setEditSubmitting(false);
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
      <ProcedureFormFields form={form} setForm={setForm} />

      <div className={styles.form}>
        <Button variant="primary" onClick={() => void handleAdd()} disabled={submitting || !requirementsValid}>
          Adicionar
        </Button>
        <Button variant="ghost" onClick={() => setImportOpen(true)}>
          Importar CSV
        </Button>
      </div>

      {importOpen && (
        <ProcedureImportModal
          onClose={() => setImportOpen(false)}
          onImported={reload}
        />
      )}

      {editing && (
        <Modal title="Editar procedimento" onClose={() => setEditing(null)}>
          <ProcedureFormFields form={editForm} setForm={setEditForm} />
          <div className={styles.rowActions} style={{ marginTop: 16, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSaveEdit()}
              disabled={editSubmitting || !editRequirementsValid}
            >
              Salvar
            </Button>
          </div>
        </Modal>
      )}

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

function SpaceFormFields({
  form,
  setForm,
}: {
  form: CreateSpaceInput;
  setForm: (updater: (f: CreateSpaceInput) => CreateSpaceInput) => void;
}) {
  return (
    <>
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
    </>
  );
}

function SpacesTab() {
  const { data, loading, error, reload } = useSpaces();
  const actions = useSpaceActions();
  const { toast } = useToast();
  const [form, setForm] = useState<CreateSpaceInput>(EMPTY_SPACE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<SpaceAdmin | null>(null);
  const [editForm, setEditForm] = useState<CreateSpaceInput>(EMPTY_SPACE_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);

  function startEdit(s: SpaceAdmin) {
    setEditing(s);
    setEditForm({ code: s.code, name: s.name, type: s.type, active: s.active });
  }

  async function handleAdd() {
    if (!form.code.trim() || !form.name.trim()) return;
    setSubmitting(true);
    try {
      await actions.create(form);
      toast("Espaço cadastrado.");
      setForm(EMPTY_SPACE_FORM);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o espaço.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing || !editForm.code.trim() || !editForm.name.trim()) return;
    setEditSubmitting(true);
    try {
      await actions.update(editing.id, editForm);
      toast("Espaço atualizado.");
      setEditing(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o espaço.");
    } finally {
      setEditSubmitting(false);
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
        <SpaceFormFields form={form} setForm={setForm} />
        <Button variant="primary" onClick={() => void handleAdd()} disabled={submitting}>
          Adicionar
        </Button>
      </div>

      {editing && (
        <Modal title="Editar espaço" onClose={() => setEditing(null)}>
          <div className={styles.form} style={{ margin: 0 }}>
            <SpaceFormFields form={editForm} setForm={setEditForm} />
          </div>
          <div className={styles.rowActions} style={{ marginTop: 16, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void handleSaveEdit()} disabled={editSubmitting}>
              Salvar
            </Button>
          </div>
        </Modal>
      )}

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
 * contador salvo) — esta consulta mostra, pra um dia específico (ex.:
 * ontem), TODOS os terapeutas que pontuaram naquele dia, do maior pro
 * menor. Complementada por uma busca rápida de UM terapeuta específico. */
function PointsByDayLookup() {
  const { data: therapists } = useTherapists();
  const [isoDate, setIsoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { data, loading, error } = useAsyncResource(
    () => operationsApiRepository.listPointsByDay(isoDate),
    [isoDate],
  );

  const [singleTherapistId, setSingleTherapistId] = useState("");
  const [singleResult, setSingleResult] = useState<{
    pointsManha: number;
    pointsNoturno: number;
  } | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);

  async function lookupSingle() {
    if (!singleTherapistId) return;
    setSingleLoading(true);
    setSingleResult(null);
    try {
      const points = await operationsApiRepository.getTherapistPoints(singleTherapistId, isoDate);
      setSingleResult({ pointsManha: points.pointsManha, pointsNoturno: points.pointsNoturno });
    } catch {
      setSingleResult(null);
    } finally {
      setSingleLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div className={styles.filters} style={{ alignItems: "center" }}>
        <span className={styles.rowMeta}>Pontos de:</span>
        <input
          className={styles.inputSmall}
          type="date"
          value={isoDate}
          onChange={(e) => setIsoDate(e.target.value)}
        />
        <select
          className={styles.select}
          value={singleTherapistId}
          onChange={(e) => setSingleTherapistId(e.target.value)}
        >
          <option value="">Ou busque um terapeuta específico…</option>
          {(therapists ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          onClick={() => void lookupSingle()}
          disabled={singleLoading || !singleTherapistId}
        >
          {singleLoading ? "Consultando…" : "Consultar"}
        </Button>
        {singleResult && (
          <span className={styles.rowStat}>
            {singleResult.pointsManha} manhã · {singleResult.pointsNoturno} noturno
          </span>
        )}
      </div>

      {error && <div className={styles.rowMeta}>Não foi possível carregar os pontos do dia.</div>}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}
      {data && data.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Terapeuta</th>
                <th>Manhã</th>
                <th>Noturno</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.therapistId}>
                  <td>
                    {row.code} · {row.name}
                  </td>
                  <td>{row.pointsManha}</td>
                  <td>{row.pointsNoturno}</td>
                  <td>{row.pointsTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.length === 0 && (
        <div className={styles.rowMeta}>Ninguém pontuou nesse dia.</div>
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

  const { data, loading, error, reload } = useAttendanceHistory({
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
  const { toast } = useToast();

  // Correção pontual de pontos de um atendimento já finalizado — pontos não
  // são mais um contador à parte no terapeuta, o saldo do dia é sempre
  // somado a partir do histórico, então corrigir aqui é o único lugar que
  // faz sentido.
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  function startEditPoints(a: AttendanceRecord) {
    setEditingAttendance(a);
    setEditPoints(String(a.pointsAwarded ?? 0));
  }

  async function handleSaveEditPoints() {
    if (!editingAttendance) return;
    const parsed = Number(editPoints);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setEditSubmitting(true);
    try {
      await operationsApiRepository.updateAttendancePoints(editingAttendance.id, Math.round(parsed));
      toast("Pontuação corrigida.");
      setEditingAttendance(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível corrigir a pontuação.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleExport() {
    try {
      const csv = await operationsApiRepository.exportHistory({
        therapistId: therapistId || undefined,
        procedureId: procedureId || undefined,
        clientSearch: clientSearch || undefined,
        phase: phase || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "terapeuta-da-vez-historico.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível exportar o histórico.");
    }
  }

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
        <Button variant="ghost" onClick={() => void handleExport()}>
          Exportar CSV
        </Button>
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
                  <th></th>
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
                    <td>
                      {a.phase === "finished" && (
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => startEditPoints(a)}
                        >
                          Editar pontos
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={9}>Nenhum atendimento encontrado para os filtros selecionados.</td>
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

      {editingAttendance && (
        <Modal
          title="Editar pontuação"
          subtitle={`${editingAttendance.clientName} · ${editingAttendance.therapistName} · ${editingAttendance.procedureName ?? "—"}`}
          onClose={() => setEditingAttendance(null)}
        >
          <div className={styles.form} style={{ margin: 0 }}>
            <input
              className={styles.inputSmall}
              type="number"
              min={0}
              value={editPoints}
              onChange={(e) => setEditPoints(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.rowActions} style={{ marginTop: 16, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setEditingAttendance(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSaveEditPoints()}
              disabled={editSubmitting || editPoints.trim() === "" || Number(editPoints) < 0}
            >
              Salvar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
