import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { Modal } from "../components/common/Modal";
import { ToastHost } from "../components/common/ToastHost";
import { ProcedureImportModal } from "../components/operations/ProcedureImportModal";
import { TherapistImportModal } from "../components/operations/TherapistImportModal";
import { useAsyncResource } from "../hooks/useAsyncResource";
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
  BusinessHoursEntry,
  CreateProcedureInput,
  CreateSpaceInput,
  CreateTherapistInput,
  Procedure,
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

// Escala e Histórico saíram da gestão — o painel público já tem as
// próprias abas Escala/Histórico, sem senha nenhuma; manter os dois em
// lugares diferentes só duplicava a mesma informação. Clientes saiu por
// pedido do usuário.
type Tab = "terapeutas" | "horario" | "procedimentos" | "espacos";

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

/** Mesma máscara "dígitos = centavos" de `formatPriceInput`, mas devolve o
 * número de verdade (não um texto de exibição) — o campo "Preço" do form é
 * só um (o rótulo exibido), e `price` (`Decimal` no backend, valida a soma
 * das formas de pagamento na finalização) é sempre derivado dele. Dois
 * campos manuais pro mesmo valor não fazia sentido (pedido do usuário). */
function parsePriceInputToNumber(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
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
            Cadastro de terapeutas, horário de funcionamento, procedimentos e espaços do painel de
            fila. Escala e Histórico ficam no painel público (abas próprias, sem senha).
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
            ["horario", "Horário"],
            ["procedimentos", "Procedimentos"],
            ["espacos", "Espaços"],
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
      {tab === "horario" && <BusinessHoursTab />}
      {tab === "procedimentos" && <ProceduresTab />}
      {tab === "espacos" && <SpacesTab />}
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
  price: 0,
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
          placeholder="Preço (ex.: R$ 260,00 — R$ 0,00 vale como gratuito)"
          inputMode="numeric"
          value={form.priceLabel}
          onChange={(e) =>
            setForm((f) => {
              const priceLabel = formatPriceInput(e.target.value);
              return { ...f, priceLabel, price: parsePriceInputToNumber(priceLabel) };
            })
          }
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
      price: p.price,
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
