import { useEffect, useMemo, useRef, useState } from "react";
import { useTerapeutaDaVezPanel } from "../hooks/useTerapeutaDaVezPanel";
import type { PanelState, ProcedureOption, QueueEntry, Shift, SpacePanelView, SpaceType } from "../types/operations";
import styles from "./TerapeutaDaVezPage.module.css";

const SHIFT_ORDER: Shift[] = ["manha", "inter", "tarde"];
const SHIFT_DOT: Record<Shift, string> = { manha: "#1E8A86", inter: "#C9A44C", tarde: "#1E8A86" };
const SPACE_DOT: Record<string, string> = { free: "#69C8AF", occupied: "#1E8A86", cleaning: "#C9A44C" };
const SPACE_STATUS_LABEL: Record<string, string> = { free: "LIVRE", occupied: "OCUPADO", cleaning: "PREPARAÇÃO" };

function formatClock(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDateLabel(d: Date): string {
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatHM(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function remainingMinutes(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 60000));
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function formatPhone(raw: string): string {
  const v = onlyDigits(raw).slice(0, 11);
  if (v.length > 10) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  if (v.length > 6) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  if (v.length > 2) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  return v;
}

function queueMetaText(entry: QueueEntry): string {
  if (entry.status === "out_of_shift") return `${entry.shiftLabel} · ${entry.shiftRange} · fora do turno`;
  if (entry.status === "reception") return `Na recepção · ${entry.clientName ?? ""}`;
  if (entry.status === "therapy") return `Em terapia · ${entry.clientName ?? ""} · ${entry.spaceNames.join(" + ")}`;
  return `${entry.shiftLabel} · ${entry.shiftRange}`;
}

interface ShiftChip {
  key: Shift;
  label: string;
  range: string;
  active: boolean;
}

function buildShiftChips(queue: QueueEntry[]): ShiftChip[] {
  const byShift = new Map<Shift, ShiftChip>();
  for (const e of queue) {
    if (!byShift.has(e.shift)) {
      byShift.set(e.shift, { key: e.shift, label: e.shiftLabel, range: e.shiftRange, active: e.inShift });
    }
  }
  return SHIFT_ORDER.filter((s) => byShift.has(s)).map((s) => byShift.get(s)!);
}

export function TerapeutaDaVezPage() {
  const { state, loading, error, now, call, decline, start, finish } = useTerapeutaDaVezPanel();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 4200);
  }
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // ---- Chamar terapeuta -----------------------------------------------------
  const [callTarget, setCallTarget] = useState<QueueEntry | null>(null);
  const [callForm, setCallForm] = useState({ clientName: "", phone: "" });
  const callOk = callForm.clientName.trim().length > 2 && onlyDigits(callForm.phone).length >= 10;

  async function confirmCall() {
    if (!callTarget || !callOk) return;
    try {
      await call(callTarget.therapistId, callForm.clientName.trim(), callForm.phone);
      showToast(`${callTarget.name} foi chamado(a) para atender ${callForm.clientName.trim()} na recepção.`);
      setCallTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível chamar o terapeuta.");
    }
  }

  // ---- Procedimento / espaço / confirmação ----------------------------------
  const [wizardEntry, setWizardEntry] = useState<QueueEntry | null>(null);
  const [wizardStep, setWizardStep] = useState<"procedure" | "space" | "confirm">("procedure");
  const [chosenProcedureId, setChosenProcedureId] = useState<string | null>(null);
  const [chosenSpaceIds, setChosenSpaceIds] = useState<string[]>([]);

  function openWizard(entry: QueueEntry) {
    setWizardEntry(entry);
    setWizardStep("procedure");
    setChosenProcedureId(null);
    setChosenSpaceIds([]);
  }

  function closeWizard() {
    setWizardEntry(null);
  }

  async function declineWizard() {
    if (!wizardEntry?.attendanceId) return;
    try {
      await decline(wizardEntry.attendanceId);
      showToast("Atendimento encerrado. Cliente não realizou procedimento.");
      closeWizard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível recusar o atendimento.");
    }
  }

  const allProcedures: ProcedureOption[] = useMemo(
    () => (state ? Object.values(state.procedureGroups).flat() : []),
    [state],
  );
  const chosenProcedure = allProcedures.find((p) => p.id === chosenProcedureId) ?? null;

  const neededByType = useMemo(() => {
    const m = new Map<SpaceType, number>();
    for (const t of chosenProcedure?.spaceTypes ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [chosenProcedure]);

  const compatibleSpaces: SpacePanelView[] = useMemo(
    () => (state && chosenProcedure ? state.spaces.filter((s) => chosenProcedure.spaceTypes.includes(s.type)) : []),
    [state, chosenProcedure],
  );

  function toggleSpace(space: SpacePanelView) {
    if (space.state !== "free") return;
    setChosenSpaceIds((prev) => {
      if (prev.includes(space.id)) return prev.filter((id) => id !== space.id);
      const needed = neededByType.get(space.type) ?? 0;
      const sameType = prev.filter((id) => compatibleSpaces.find((s) => s.id === id)?.type === space.type);
      const withoutOverflow = sameType.length >= needed
        ? prev.filter((id) => compatibleSpaces.find((s) => s.id === id)?.type !== space.type)
        : prev;
      return [...withoutOverflow, space.id];
    });
  }

  const spaceReady =
    neededByType.size > 0 &&
    [...neededByType.entries()].every(
      ([type, needed]) => chosenSpaceIds.filter((id) => compatibleSpaces.find((s) => s.id === id)?.type === type).length >= needed,
    );

  async function confirmStart() {
    if (!wizardEntry?.attendanceId || !chosenProcedureId || !spaceReady) return;
    try {
      await start(wizardEntry.attendanceId, chosenProcedureId, chosenSpaceIds);
      showToast(`Terapia iniciada — liberação prevista às ${formatHM(new Date(Date.now() + (chosenProcedure?.durationMinutes ?? 0) * 60000).toISOString())}.`);
      closeWizard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível iniciar a terapia.");
    }
  }

  async function finishTherapy(entry: QueueEntry) {
    if (!entry.attendanceId) return;
    try {
      await finish(entry.attendanceId);
      showToast(`${entry.name}: atendimento finalizado. Fila recalculada.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível finalizar o atendimento.");
    }
  }

  if (loading && !state) {
    return (
      <div className={styles.page} style={{ alignItems: "center", justifyContent: "center" }}>
        Carregando painel…
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className={styles.page} style={{ alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        Não foi possível carregar o painel: {error.message}
      </div>
    );
  }

  if (!state) return null;

  const nextIdle = state.queue.find((e) => e.status === "idle" && e.inShift) ?? null;
  const shiftChips = buildShiftChips(state.queue);

  return (
    <div className={styles.page}>
      <Header now={now} />
      <ShiftStrip chips={shiftChips} />

      <div className={styles.body}>
        <HeroPanel nextIdle={nextIdle} onCall={(entry) => { setCallTarget(entry); setCallForm({ clientName: "", phone: "" }); }} />

        <section className={styles.queueSection}>
          <div className={styles.queueHeader}>
            <div>
              <div className={styles.queueTitle}>Fila de atendimento</div>
              <div className={styles.queueSubtitle}>Ordenada pela menor pontuação entre quem está na jornada</div>
            </div>
            <div className={styles.queueSubtitle}>
              Trilha: {state.pointsMin}–{state.pointsMax} pts
            </div>
          </div>
          <div className={styles.queueList}>
            {state.queue.map((entry) => (
              <div key={entry.therapistId} className={`${styles.queueRow} ${entry.status !== "out_of_shift" && entry.status !== "idle" ? styles.queueRowTurn : ""}`}>
                <div className={styles.queuePos}>{entry.position ?? "—"}</div>
                <div className={styles.queueInfo}>
                  <span className={styles.queueName}>{entry.name}</span>
                  <span className={styles.queueMeta}>{queueMetaText(entry)}</span>
                </div>
                <div className={styles.queuePoints}>{entry.points}</div>
                <div className={styles.queueAction}>
                  {entry.status === "idle" && entry.inShift && (
                    <button type="button" className={styles.smallBtn} onClick={() => { setCallTarget(entry); setCallForm({ clientName: "", phone: "" }); }}>
                      Chamar
                    </button>
                  )}
                  {entry.status === "reception" && (
                    <button type="button" className={styles.smallBtn} onClick={() => openWizard(entry)}>
                      Definir procedimento
                    </button>
                  )}
                  {entry.status === "therapy" && (
                    <>
                      <span className={styles.queueMeta}>restam {remainingMinutes(entry.plannedEndAt, now)} min</span>
                      <button type="button" className={styles.smallBtn} onClick={() => void finishTherapy(entry)}>
                        Finalizar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <Sidebar state={state} />
      </div>

      <SpacesSection spaces={state.spaces} now={now} />

      {toastMsg && <div className={styles.toast}>{toastMsg}</div>}

      {callTarget && (
        <CallModal
          entry={callTarget}
          form={callForm}
          setForm={setCallForm}
          ok={callOk}
          onCancel={() => setCallTarget(null)}
          onConfirm={() => void confirmCall()}
        />
      )}

      {wizardEntry && (
        <WizardModal
          entry={wizardEntry}
          step={wizardStep}
          setStep={setWizardStep}
          procedureGroups={state.procedureGroups}
          chosenProcedure={chosenProcedure}
          chosenProcedureId={chosenProcedureId}
          setChosenProcedureId={setChosenProcedureId}
          compatibleSpaces={compatibleSpaces}
          chosenSpaceIds={chosenSpaceIds}
          toggleSpace={toggleSpace}
          spaceReady={spaceReady}
          now={now}
          onClose={closeWizard}
          onDecline={() => void declineWizard()}
          onConfirmStart={() => void confirmStart()}
        />
      )}
    </div>
  );
}

// ---- Header -----------------------------------------------------------------

function Header({ now }: { now: Date }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerBrand}>
        <div>
          <div className={styles.headerBrandTitle}>Nova Estação</div>
          <div className={styles.headerBrandSub}>PAINEL DE OPERAÇÃO</div>
        </div>
      </div>
      <div className={styles.headerDivider} />
      <div className={styles.headerSection}>
        <span className={styles.headerSectionTitle}>Terapeuta da Vez</span>
        <span className={styles.headerSectionSub}>Distribuição por pontuação</span>
      </div>
      <div className={styles.headerSpacer} />
      <div className={styles.headerStatus}>
        <div className={styles.dot} style={{ background: "#69C8AF" }} />
        <div className={styles.headerStatusText}>
          <span className={styles.headerStatusMain}>Sistema online</span>
          <span className={styles.headerStatusSub}>sincronizado agora</span>
        </div>
      </div>
      <div className={styles.headerClock}>
        <div>
          <div className={styles.headerClockValue}>{formatClock(now)}</div>
          <div className={styles.headerClockDate}>{formatDateLabel(now)}</div>
        </div>
      </div>
    </header>
  );
}

function ShiftStrip({ chips }: { chips: ShiftChip[] }) {
  return (
    <div className={styles.shiftStrip}>
      <span className={styles.shiftLabel}>JORNADAS ATIVAS</span>
      {chips.map((c) => (
        <span
          key={c.key}
          className={styles.shiftChip}
          style={{
            background: c.active ? "#F5F1E3" : "transparent",
            border: `1px solid ${c.active ? "#C6BFA6" : "#E0DCCC"}`,
            color: c.active ? "#012A2A" : "#5A5A5A",
          }}
        >
          <span className={styles.dot} style={{ background: c.active ? SHIFT_DOT[c.key] : "#D9D9D9", animation: "none" }} />
          {c.label} {c.range}
        </span>
      ))}
    </div>
  );
}

// ---- Hero ---------------------------------------------------------------------

function HeroPanel({ nextIdle, onCall }: { nextIdle: QueueEntry | null; onCall: (entry: QueueEntry) => void }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroTag}>
        <div className={styles.dot} style={{ background: "#F0BE32" }} />
        TERAPEUTA DA VEZ
      </div>
      {nextIdle ? (
        <>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
            <div className={styles.heroName}>{nextIdle.name}</div>
            <div className={styles.heroMeta}>
              <span className={styles.heroShiftPill}>{nextIdle.shiftLabel.toUpperCase()}</span>
              <span style={{ color: "#8FB5AE", fontSize: 14 }}>{nextIdle.shiftRange}</span>
            </div>
            <div style={{ height: 1, background: "rgba(240,240,230,0.16)" }} />
            <div className={styles.heroPoints}>{nextIdle.points} pontos</div>
            <div className={styles.heroHint}>
              Menor pontuação entre os terapeutas dentro da jornada. A cada terapia concluída os pontos são
              aplicados e a fila se reordena sozinha.
            </div>
          </div>
          <button type="button" className={styles.heroBtn} onClick={() => onCall(nextIdle)}>
            Chamar terapeuta
          </button>
        </>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8FB5AE", textAlign: "center" }}>
          Nenhum terapeuta disponível na jornada atual.
        </div>
      )}
    </section>
  );
}

// ---- Sidebar --------------------------------------------------------------------

function Sidebar({ state }: { state: PanelState }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarBlock}>
        <span className={styles.sidebarTitle}>Pontuação por procedimento</span>
        {state.lastEntry && (
          <>
            <div className={styles.sidebarLine}>
              <span>Último procedimento</span>
              <span>{state.lastEntry.label}</span>
            </div>
            <div className={styles.sidebarLine}>
              <span>Pontos</span>
              <span>{state.lastEntry.points}</span>
            </div>
          </>
        )}
        {!state.lastEntry && <div className={styles.sidebarLine}>Nenhum atendimento finalizado ainda hoje.</div>}
        <div style={{ height: 1, background: "#DFDACA" }} />
        {state.recentHistory.map((h, i) => (
          <div key={i} className={styles.sidebarLine}>
            <span>{h.label}</span>
            <span>{h.points}</span>
          </div>
        ))}
      </div>
      <div className={styles.sidebarBlock} style={{ flex: 1, overflowY: "auto" }}>
        <span className={styles.sidebarTitle}>Avisos da operação</span>
        {state.alerts.map((a, i) => (
          <div key={i} className={styles.alertItem} style={{ borderColor: a.dot }}>
            <span className={styles.alertKind}>{a.kind}</span>
            <span className={styles.alertText}>{a.text}</span>
          </div>
        ))}
      </div>
      <div className={styles.sidebarBlock}>
        <div className={styles.sidebarLine}>
          <span>Atendimentos hoje</span>
          <span>{state.servicesToday}</span>
        </div>
        <div className={styles.sidebarLine}>
          <span>Pontos distribuídos</span>
          <span>{state.pointsToday}</span>
        </div>
        <div className={styles.sidebarLine}>
          <span>Espaços disponíveis</span>
          <span>{state.spacesFree} de {state.spacesTotal}</span>
        </div>
      </div>
    </aside>
  );
}

// ---- Espaços --------------------------------------------------------------------

function SpacesSection({ spaces, now }: { spaces: SpacePanelView[]; now: Date }) {
  const free = spaces.filter((s) => s.state === "free").length;
  return (
    <section className={styles.spacesSection}>
      <div className={styles.spacesHeader}>
        <span className={styles.spacesTitle}>Espaços de atendimento</span>
        <span style={{ color: "#C9A44C", fontVariantNumeric: "tabular-nums" }}>
          {free} de {spaces.length} disponíveis
        </span>
        <div style={{ flex: 1 }} />
        <div className={styles.spacesLegend}>
          <span className={styles.spacesLegendItem}>
            <span className={styles.dot} style={{ background: SPACE_DOT.free, animation: "none" }} /> livre
          </span>
          <span className={styles.spacesLegendItem}>
            <span className={styles.dot} style={{ background: SPACE_DOT.occupied, animation: "none" }} /> ocupado
          </span>
          <span className={styles.spacesLegendItem}>
            <span className={styles.dot} style={{ background: SPACE_DOT.cleaning, animation: "none" }} /> em preparação
          </span>
        </div>
      </div>
      <div className={styles.spacesGrid}>
        {spaces.map((s) => (
          <div key={s.id} className={styles.spaceCard} style={{ borderTopColor: SPACE_DOT[s.state], background: s.state === "occupied" ? "#0B4F4C" : "rgba(240,240,230,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className={styles.spaceCardName}>{s.name}</span>
              <span className={styles.spaceCardStatus} style={{ color: SPACE_DOT[s.state] }}>
                {SPACE_STATUS_LABEL[s.state]}
              </span>
            </div>
            {s.state === "free" && <span className={styles.spaceCardLine}>Pronto para uso</span>}
            {s.state === "occupied" && (
              <span className={styles.spaceCardLine}>
                {s.procedureName} · {s.therapistName} · libera às {formatHM(s.availableAt)} (faltam {remainingMinutes(s.availableAt, now)} min)
              </span>
            )}
            {s.state === "cleaning" && (
              <span className={styles.spaceCardLine}>
                Higienização · disponível às {formatHM(s.availableAt)} (faltam {remainingMinutes(s.availableAt, now)} min)
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Modal: chamar terapeuta -----------------------------------------------------

function CallModal({
  entry,
  form,
  setForm,
  ok,
  onCancel,
  onConfirm,
}: {
  entry: QueueEntry;
  form: { clientName: string; phone: string };
  setForm: (updater: (f: { clientName: string; phone: string }) => { clientName: string; phone: string }) => void;
  ok: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div>
          <div className={styles.modalEyebrow}>ETAPA 1 DE 3 · CHAMAR TERAPEUTA</div>
          <div className={styles.modalTitle}>{entry.name}</div>
          <div className={styles.modalSub}>
            {entry.shiftLabel} · {entry.shiftRange} · {entry.points} pontos
          </div>
        </div>
        <div className={styles.modalDivider} />
        <div className={styles.field}>
          <span className={styles.fieldLabel}>NOME DO CLIENTE</span>
          <input
            className={styles.fieldInput}
            placeholder="Digite o nome completo"
            value={form.clientName}
            onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>TELEFONE</span>
          <input
            className={styles.fieldInput}
            placeholder="(00) 00000-0000"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
          />
        </div>
        <div className={styles.heroHint}>
          A chamada não ocupa maca, cadeira ou poltrona. O terapeuta conversa com o cliente na recepção; o
          espaço é definido depois, se houver venda.
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.ghostBtn} onClick={onCancel} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button type="button" className={styles.smallBtn} disabled={!ok} onClick={onConfirm} style={{ flex: 2, padding: "14px 12px" }}>
            Confirmar chamada
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Modal: procedimento / espaço / confirmação ------------------------------------

function WizardModal({
  entry,
  step,
  setStep,
  procedureGroups,
  chosenProcedure,
  chosenProcedureId,
  setChosenProcedureId,
  compatibleSpaces,
  chosenSpaceIds,
  toggleSpace,
  spaceReady,
  now,
  onClose,
  onDecline,
  onConfirmStart,
}: {
  entry: QueueEntry;
  step: "procedure" | "space" | "confirm";
  setStep: (s: "procedure" | "space" | "confirm") => void;
  procedureGroups: Record<string, ProcedureOption[]>;
  chosenProcedure: ProcedureOption | null;
  chosenProcedureId: string | null;
  setChosenProcedureId: (id: string) => void;
  compatibleSpaces: SpacePanelView[];
  chosenSpaceIds: string[];
  toggleSpace: (space: SpacePanelView) => void;
  spaceReady: boolean;
  now: Date;
  onClose: () => void;
  onDecline: () => void;
  onConfirmStart: () => void;
}) {
  const plannedEnd = chosenProcedure ? new Date(now.getTime() + chosenProcedure.durationMinutes * 60000) : null;

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${step === "procedure" ? styles.modalWide : ""}`}>
        {step === "procedure" && (
          <>
            <div>
              <div className={styles.modalEyebrow}>
                ETAPA 2 DE 3 · {entry.clientName} COM {entry.name}
              </div>
              <div className={styles.modalTitle}>Qual procedimento o cliente deseja realizar?</div>
            </div>
            <div className={styles.procedureGrid}>
              {Object.entries(procedureGroups).map(([category, items]) => (
                <div key={category} style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 10, letterSpacing: 1.6, color: "#9A7426" }}>{category}</span>
                  <div className={styles.procedureGrid} style={{ maxHeight: "none" }}>
                    {items.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`${styles.procedureCard} ${chosenProcedureId === p.id ? styles.procedureCardActive : ""}`}
                        onClick={() => setChosenProcedureId(p.id)}
                      >
                        <span className={styles.procedureCardName}>{p.name}</span>
                        <div className={styles.procedureCardMeta}>
                          <span>{p.durationLabel}</span>
                          <span>{p.priceLabel}</span>
                          <span style={{ color: "#9A7426" }}>+{p.points} pts</span>
                        </div>
                        <span style={{ fontSize: 10, color: "#5A5A5A" }}>{p.typeLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onDecline} style={{ flex: 1 }}>
                Cliente não quis
              </button>
              <button type="button" className={styles.ghostBtn} onClick={onClose} style={{ flex: 1 }}>
                Fechar
              </button>
              <button
                type="button"
                className={styles.smallBtn}
                style={{ flex: 2, padding: "14px 12px" }}
                disabled={!chosenProcedure}
                onClick={() => setStep("space")}
              >
                Escolher espaço
              </button>
            </div>
          </>
        )}

        {step === "space" && chosenProcedure && (
          <>
            <div>
              <div className={styles.modalEyebrow}>ETAPA 3 DE 3 · ESCOLHER ESPAÇO</div>
              <div className={styles.modalTitle}>
                {chosenProcedure.name} · {chosenProcedure.durationLabel}
              </div>
              <div className={styles.modalSub}>Espaço necessário: {chosenProcedure.typeLabel}</div>
            </div>
            <div className={styles.spaceGrid}>
              {compatibleSpaces.map((s) => {
                const selected = chosenSpaceIds.includes(s.id);
                const disabled = s.state !== "free" && !selected;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`${styles.spaceOption} ${selected ? styles.spaceOptionSelected : ""} ${disabled ? styles.spaceOptionDisabled : ""}`}
                    onClick={() => toggleSpace(s)}
                    disabled={disabled}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: "#5A5A5A" }}>
                      {s.state === "free" ? "Disponível agora" : `Ocupado até ${formatHM(s.availableAt)}`}
                    </div>
                  </button>
                );
              })}
              {compatibleSpaces.length === 0 && <div>Nenhum espaço compatível cadastrado.</div>}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setStep("procedure")} style={{ flex: 1 }}>
                Voltar
              </button>
              <button
                type="button"
                className={styles.smallBtn}
                style={{ flex: 2, padding: "14px 12px" }}
                disabled={!spaceReady}
                onClick={() => setStep("confirm")}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "confirm" && chosenProcedure && (
          <>
            <div>
              <div className={styles.modalEyebrow}>CONFIRMAR ATENDIMENTO</div>
              <div className={styles.modalTitle}>Iniciar terapia agora?</div>
            </div>
            <div className={styles.summaryGrid}>
              <SummaryField label="CLIENTE" value={entry.clientName ?? "—"} />
              <SummaryField label="TERAPEUTA" value={entry.name} />
              <SummaryField label="PROCEDIMENTO" value={chosenProcedure.name} />
              <SummaryField label="ESPAÇO" value={chosenSpaceIds.map((id) => compatibleSpaces.find((s) => s.id === id)?.name).filter(Boolean).join(" + ")} />
              <SummaryField label="VALOR · PONTOS" value={`${chosenProcedure.priceLabel} · +${chosenProcedure.points} pts`} />
            </div>
            <div className={`${styles.summaryGrid} ${styles.summaryDark}`}>
              <SummaryField label="INÍCIO" value={formatHM(now.toISOString())} dark />
              <SummaryField label="PREVISÃO DE TÉRMINO" value={plannedEnd ? formatHM(plannedEnd.toISOString()) : "—"} dark accent />
              <SummaryField label="DURAÇÃO" value={chosenProcedure.durationLabel} dark />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setStep("space")} style={{ flex: 1 }}>
                Voltar
              </button>
              <button type="button" className={styles.smallBtn} style={{ flex: 2, padding: "14px 12px" }} onClick={onConfirmStart}>
                Iniciar terapia
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryField({ label, value, dark, accent }: { label: string; value: string; dark?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, letterSpacing: 1.2, color: dark ? "#7FA6A0" : "#5A5A5A" }}>{label}</span>
      <span style={{ fontSize: dark ? 22 : 15, fontWeight: dark ? 500 : 700, color: accent ? "#C9A44C" : dark ? "#F5F1E3" : "#012A2A" }}>
        {value || "—"}
      </span>
    </div>
  );
}
