import { useEffect, useMemo, useRef, useState } from "react";
import { useTerapeutaDaVezPanel } from "../hooks/useTerapeutaDaVezPanel";
import type {
  AbsentTherapist,
  PanelState,
  ProcedureOption,
  QueueEntry,
  Shift,
  SpacePanelView,
  WaitlistEntry,
} from "../types/operations";
import styles from "./TerapeutaDaVezPage.module.css";

const SHIFT_ORDER: Shift[] = ["manha", "inter", "noturno"];
const SHIFT_DOT: Record<Shift, string> = { manha: "#1E8A86", inter: "#C9A44C", noturno: "#0B4F4C" };
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

// A fila só tem quem está presente e dentro do turno atual (ver
// `in_current_shift` no backend) — então toda entrada aqui já está "ativa"
// por definição; a faixa só mostra quais turnos têm gente na fila agora.
function buildShiftChips(queue: QueueEntry[]): ShiftChip[] {
  const byShift = new Map<Shift, ShiftChip>();
  for (const e of queue) {
    if (!byShift.has(e.shift)) {
      byShift.set(e.shift, { key: e.shift, label: e.shiftLabel, range: e.shiftRange, active: true });
    }
  }
  return SHIFT_ORDER.filter((s) => byShift.has(s)).map((s) => byShift.get(s)!);
}

export function TerapeutaDaVezPage() {
  const {
    state,
    loading,
    error,
    now,
    call,
    decline,
    start,
    finish,
    checkIn,
    releaseCleaning,
    createWaitlistEntry,
    confirmWaitlistEntry,
    cancelWaitlistEntry,
  } = useTerapeutaDaVezPanel();
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

  // ---- Fila de espera (reserva de terapeuta específico) ---------------------
  // Cliente quer um terapeuta específico, que está livre mas o ESPAÇO que o
  // procedimento precisa não está — pedido do usuário.
  const [waitlistTarget, setWaitlistTarget] = useState<QueueEntry | null>(null);
  const [waitlistForm, setWaitlistForm] = useState({ clientName: "", phone: "", procedureId: "" });
  const waitlistOk =
    waitlistForm.clientName.trim().length > 2 &&
    onlyDigits(waitlistForm.phone).length >= 10 &&
    waitlistForm.procedureId !== "";

  async function confirmWaitlist() {
    if (!waitlistTarget || !waitlistOk) return;
    try {
      await createWaitlistEntry({
        therapistId: waitlistTarget.therapistId,
        clientName: waitlistForm.clientName.trim(),
        phone: waitlistForm.phone,
        procedureId: waitlistForm.procedureId,
      });
      showToast(`${waitlistTarget.name} reservado(a) para ${waitlistForm.clientName.trim()}.`);
      setWaitlistTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível criar a reserva.");
    }
  }

  async function handleConfirmWaitlistEntry(entry: WaitlistEntry) {
    try {
      await confirmWaitlistEntry(entry.id);
      showToast(`Atendimento de ${entry.clientName} com ${entry.therapistName} iniciado.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível confirmar o atendimento.");
    }
  }

  async function handleCancelWaitlistEntry(entry: WaitlistEntry) {
    if (!confirm(`Cancelar a reserva de ${entry.clientName} com ${entry.therapistName}?`)) return;
    try {
      await cancelWaitlistEntry(entry.id);
      showToast("Reserva cancelada.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível cancelar a reserva.");
    }
  }

  // ---- Procedimento / espaço / confirmação ----------------------------------
  const [wizardEntry, setWizardEntry] = useState<QueueEntry | null>(null);
  const [wizardStep, setWizardStep] = useState<"procedure" | "space" | "confirm">("procedure");
  const [chosenProcedureId, setChosenProcedureId] = useState<string | null>(null);
  // Um slot por trecho do procedimento, na mesma ordem de
  // `chosenProcedure.spaceRequirements` — não é mais "N espaços quaisquer
  // desse tipo", é "o espaço do trecho 1", "o espaço do trecho 2" etc.
  const [chosenSpaceIds, setChosenSpaceIds] = useState<(string | null)[]>([]);

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

  // "Colocar na fila de espera" direto do passo 3 (escolher espaço) — nome
  // e telefone já estão no atendimento em recepção, não precisa perguntar
  // de novo. O atendimento pendente é recusado junto (backend), liberando o
  // terapeuta pra fila normal.
  async function waitlistFromWizard() {
    if (!wizardEntry || !chosenProcedureId) return;
    try {
      await createWaitlistEntry({
        therapistId: wizardEntry.therapistId,
        clientName: wizardEntry.clientName ?? "",
        phone: wizardEntry.clientPhone ?? "",
        procedureId: chosenProcedureId,
        ...(wizardEntry.attendanceId ? { attendanceId: wizardEntry.attendanceId } : {}),
      });
      showToast(`${wizardEntry.name} reservado(a) para ${wizardEntry.clientName}.`);
      closeWizard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível criar a reserva.");
    }
  }

  // Botão pequeno "Liberar" ao lado de um espaço em higienização — pula o
  // resto da espera quando a limpeza de verdade já terminou antes do tempo
  // padrão.
  async function handleReleaseCleaning(spaceId: string) {
    try {
      await releaseCleaning(spaceId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível liberar o espaço.");
    }
  }

  const allProcedures: ProcedureOption[] = useMemo(
    () => (state ? Object.values(state.procedureGroups).flat() : []),
    [state],
  );
  const chosenProcedure = allProcedures.find((p) => p.id === chosenProcedureId) ?? null;

  function selectProcedure(id: string) {
    setChosenProcedureId(id);
    const procedure = allProcedures.find((p) => p.id === id);
    setChosenSpaceIds(procedure ? procedure.spaceRequirements.map(() => null) : []);
  }

  // Espaços livres compatíveis com CADA trecho, na mesma ordem — um
  // seletor por trecho, não um multi-select genérico por tipo.
  const spaceOptionsByRequirement: SpacePanelView[][] = useMemo(() => {
    if (!state || !chosenProcedure) return [];
    return chosenProcedure.spaceRequirements.map((req) =>
      state.spaces.filter((s) => s.type === req.type),
    );
  }, [state, chosenProcedure]);

  function pickSpaceForRequirement(index: number, spaceId: string) {
    setChosenSpaceIds((prev) => prev.map((id, i) => (i === index ? spaceId : id)));
  }

  const spaceReady =
    chosenSpaceIds.length > 0 && chosenSpaceIds.every((id) => id !== null);

  async function confirmStart() {
    if (!wizardEntry?.attendanceId || !chosenProcedureId || !spaceReady) return;
    try {
      await start(wizardEntry.attendanceId, chosenProcedureId, chosenSpaceIds as string[]);
      showToast(`Terapia iniciada — liberação prevista às ${formatHM(new Date(Date.now() + (chosenProcedure?.durationMinutes ?? 0) * 60000).toISOString())}.`);
      closeWizard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível iniciar a terapia.");
    }
  }

  // Terminando com folga considerável antes do previsto (cliente saiu mais
  // cedo, sessão interrompida etc.) — pergunta se conta os pontos do
  // procedimento pro terapeuta. Nos últimos 10 min do previsto (ou no prazo,
  // ou atrasado) conta normal sem perguntar — é tempo curto demais pra valer
  // a pena interromper a recepção com uma pergunta.
  const EARLY_FINISH_GRACE_MINUTES = 10;

  const [pointsConfirmTarget, setPointsConfirmTarget] = useState<QueueEntry | null>(null);

  async function doFinish(entry: QueueEntry, awardPoints: boolean) {
    if (!entry.attendanceId) return;
    try {
      await finish(entry.attendanceId, awardPoints);
      showToast(
        awardPoints
          ? `${entry.name}: atendimento finalizado. Fila recalculada.`
          : `${entry.name}: atendimento finalizado sem pontuar (encerrado antes do previsto).`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível finalizar o atendimento.");
    } finally {
      setPointsConfirmTarget(null);
    }
  }

  function finishTherapy(entry: QueueEntry) {
    if (!entry.attendanceId) return;
    const minutesRemaining = remainingMinutes(entry.plannedEndAt, now) ?? 0;
    if (minutesRemaining > EARLY_FINISH_GRACE_MINUTES) {
      setPointsConfirmTarget(entry);
      return;
    }
    void doFinish(entry, true);
  }

  // ---- Iniciar turno -------------------------------------------------------
  // Sem Saída manual (questão trabalhista: terapeutas são PJ) — a presença
  // termina sozinha quando a janela do turno passa. "Iniciar turno" só
  // aparece pros turnos que a escala de hoje (cadastrada na gestão) coloca
  // pra aquele terapeuta E que já estão na janela de horário agora
  // (`AbsentTherapist.availableShifts`, calculado pelo backend). Quando há
  // mais de um turno escalado aberto ao mesmo tempo (14h–16h: manhã e
  // interturno), pergunta pra recepção em vez de adivinhar.
  const [shiftPickTarget, setShiftPickTarget] = useState<AbsentTherapist | null>(null);

  async function doCheckIn(therapist: AbsentTherapist, shift?: Shift) {
    try {
      await checkIn(therapist.id, shift);
      showToast(`${therapist.name}: turno iniciado.`);
      setShiftPickTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível iniciar o turno.");
    }
  }

  function requestCheckIn(therapist: AbsentTherapist) {
    if (therapist.availableShifts.length > 1) {
      setShiftPickTarget(therapist);
      return;
    }
    if (therapist.availableShifts.length === 1) {
      void doCheckIn(therapist, therapist.availableShifts[0]);
      return;
    }
    showToast(`${therapist.name}: nenhum turno escalado está aberto agora.`);
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

  if (!state.storeOpen) {
    return <StoreClosedScreen now={now} nextOpenAt={state.nextOpenAt} />;
  }

  const nextIdle = state.queue.find((e) => e.status === "idle") ?? null;
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
              <div key={entry.therapistId} className={`${styles.queueRow} ${entry.status !== "idle" ? styles.queueRowTurn : ""}`}>
                <div className={styles.queuePos}>{entry.position ?? "—"}</div>
                <div className={styles.queueInfo}>
                  <span className={styles.queueName}>{entry.name}</span>
                  <span className={styles.queueMeta}>{queueMetaText(entry)}</span>
                </div>
                <div className={styles.queuePoints}>{entry.points}</div>
                <div className={styles.queueAction}>
                  {entry.status === "idle" && (
                    <>
                      <button type="button" className={styles.smallBtn} onClick={() => { setCallTarget(entry); setCallForm({ clientName: "", phone: "" }); }}>
                        Chamar
                      </button>
                      {state.waitlist.some((w) => w.therapistId === entry.therapistId) ? (
                        <span className={styles.queueMeta}>reservado</span>
                      ) : (
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={() => {
                            setWaitlistTarget(entry);
                            setWaitlistForm({ clientName: "", phone: "", procedureId: "" });
                          }}
                        >
                          Fila de espera
                        </button>
                      )}
                    </>
                  )}
                  {entry.status === "reception" && (
                    <button type="button" className={styles.smallBtn} onClick={() => openWizard(entry)}>
                      Definir procedimento
                    </button>
                  )}
                  {entry.status === "therapy" && (
                    <>
                      <span className={styles.queueMeta}>restam {remainingMinutes(entry.plannedEndAt, now)} min</span>
                      <button type="button" className={styles.smallBtn} onClick={() => finishTherapy(entry)}>
                        Finalizar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {state.waitlist.length > 0 && (
              <WaitlistSection
                entries={state.waitlist}
                now={now}
                onConfirm={(e) => void handleConfirmWaitlistEntry(e)}
                onCancel={(e) => void handleCancelWaitlistEntry(e)}
              />
            )}
          </div>
        </section>

        <Sidebar state={state} onCheckIn={requestCheckIn} />
      </div>

      <SpacesSection spaces={state.spaces} now={now} onReleaseCleaning={handleReleaseCleaning} />

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

      {waitlistTarget && (
        <WaitlistModal
          entry={waitlistTarget}
          form={waitlistForm}
          setForm={setWaitlistForm}
          procedures={allProcedures}
          ok={waitlistOk}
          onCancel={() => setWaitlistTarget(null)}
          onConfirm={() => void confirmWaitlist()}
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
          selectProcedure={selectProcedure}
          spaceOptionsByRequirement={spaceOptionsByRequirement}
          chosenSpaceIds={chosenSpaceIds}
          pickSpaceForRequirement={pickSpaceForRequirement}
          spaceReady={spaceReady}
          spaces={state.spaces}
          now={now}
          onClose={closeWizard}
          onDecline={() => void declineWizard()}
          onWaitlist={() => void waitlistFromWizard()}
          onConfirmStart={() => void confirmStart()}
        />
      )}

      {shiftPickTarget && (
        <ShiftPickModal
          therapist={shiftPickTarget}
          onCancel={() => setShiftPickTarget(null)}
          onPick={(shift) => void doCheckIn(shiftPickTarget, shift)}
        />
      )}

      {pointsConfirmTarget && (
        <PointsConfirmModal
          entry={pointsConfirmTarget}
          onCancel={() => setPointsConfirmTarget(null)}
          onAnswer={(awardPoints) => void doFinish(pointsConfirmTarget, awardPoints)}
        />
      )}
    </div>
  );
}

// ---- Loja fechada -------------------------------------------------------------

function StoreClosedScreen({ now, nextOpenAt }: { now: Date; nextOpenAt: string | null }) {
  const opensLabel = nextOpenAt
    ? new Date(nextOpenAt).toLocaleString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className={styles.page} style={{ alignItems: "center", justifyContent: "center", gap: 18, textAlign: "center", padding: 24 }}>
      <div className={styles.headerClockValue} style={{ color: "#012A2A" }}>
        {formatClock(now)}
      </div>
      <div className={styles.heroTag} style={{ color: "#5A5A5A" }}>
        <span className={styles.dot} style={{ background: "#C0453A" }} />
        LOJA FECHADA
      </div>
      {opensLabel && (
        <div style={{ fontSize: 14, color: "#5A5A5A" }}>Abre {opensLabel}</div>
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

const SHIFT_LABEL_FULL: Record<Shift, string> = { manha: "Manhã", inter: "Interturno", noturno: "Noturno" };

function Sidebar({ state, onCheckIn }: { state: PanelState; onCheckIn: (t: AbsentTherapist) => void }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarBlock}>
        <span className={styles.sidebarTitle}>Ausentes</span>
        {state.absent.length === 0 && (
          <div className={styles.sidebarLine}>Todos os terapeutas escalados já iniciaram o turno.</div>
        )}
        {state.absent.map((t) => (
          <div key={t.id} className={styles.sidebarLine} style={{ alignItems: "center" }}>
            <span>{t.name}</span>
            {t.availableShifts.length > 0 ? (
              <button type="button" className={styles.smallBtn} onClick={() => onCheckIn(t)}>
                Iniciar turno
              </button>
            ) : (
              <span style={{ fontSize: 10.5 }}>Sem turno escalado agora</span>
            )}
          </div>
        ))}
      </div>
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

function SpacesSection({
  spaces,
  now,
  onReleaseCleaning,
}: {
  spaces: SpacePanelView[];
  now: Date;
  onReleaseCleaning: (spaceId: string) => void;
}) {
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
            <div className={styles.spaceCardTop}>
              <span className={styles.spaceCardName}>{s.name}</span>
              <span className={styles.spaceCardStatus} style={{ color: SPACE_DOT[s.state] }}>
                {SPACE_STATUS_LABEL[s.state]}
              </span>
            </div>
            {s.state === "free" && !s.occupiesAt && (
              <span className={styles.spaceCardLine}>Pronto para uso</span>
            )}
            {s.state === "free" && s.occupiesAt && (
              <span className={styles.spaceCardLine} style={{ color: "#C9A44C" }}>
                Ocupada em {remainingMinutes(s.occupiesAt, now)} min
              </span>
            )}
            {s.state === "occupied" && (
              <span className={styles.spaceCardLine}>
                {s.procedureName} · {s.therapistName} · libera às {formatHM(s.availableAt)} (faltam {remainingMinutes(s.availableAt, now)} min)
              </span>
            )}
            {s.state === "cleaning" && (
              <div className={styles.spaceCleaningRow}>
                <span className={styles.spaceCardLine}>
                  Higienização · disponível às {formatHM(s.availableAt)} (faltam {remainingMinutes(s.availableAt, now)} min)
                </span>
                <button
                  type="button"
                  className={styles.releaseCleaningBtn}
                  title="Já limpei — liberar agora"
                  aria-label={`Liberar ${s.name} agora`}
                  onClick={() => onReleaseCleaning(s.id)}
                >
                  ✓
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Reservas (fila de espera de terapeuta específico) --------------------------

function waitlistStatusLabel(e: WaitlistEntry, now: Date): string {
  if (e.ready) return "PRONTO PRA CONFIRMAR";
  if (e.conflict) return "PODE ATRASAR";
  const minutes = remainingMinutes(e.availableAt, now);
  return minutes === null ? "AGUARDANDO" : `LIBERA EM ${minutes} MIN`;
}

function WaitlistSection({
  entries,
  now,
  onConfirm,
  onCancel,
}: {
  entries: WaitlistEntry[];
  now: Date;
  onConfirm: (entry: WaitlistEntry) => void;
  onCancel: (entry: WaitlistEntry) => void;
}) {
  return (
    <section className={styles.waitlistSection}>
      <span className={styles.waitlistTitle}>Fila de espera</span>
      {entries.map((e) => {
        const color = e.ready ? "#1E8A86" : e.conflict ? "#c0392b" : "#C9A44C";
        return (
          <div key={e.id} className={styles.waitlistRow}>
            <div className={styles.waitlistInfo}>
              <span className={styles.queueName}>
                {e.clientName} · {e.therapistName}
              </span>
              <span className={styles.queueMeta}>{e.procedureName}</span>
            </div>
            <span
              className={styles.waitlistStatus}
              style={{ background: `${color}22`, color }}
            >
              {waitlistStatusLabel(e, now)}
            </span>
            <div className={styles.queueAction}>
              <button
                type="button"
                className={styles.smallBtn}
                disabled={!e.ready}
                title={
                  e.ready
                    ? "Iniciar o atendimento deste cliente com este terapeuta"
                    : "Ainda não está livre — só dá pra confirmar quando o status virar \"pronto pra confirmar\""
                }
                onClick={() => onConfirm(e)}
              >
                Confirmar
              </button>
              <button type="button" className={styles.ghostBtn} onClick={() => onCancel(e)}>
                Cancelar
              </button>
            </div>
          </div>
        );
      })}
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

// ---- Modal: fila de espera (reserva de terapeuta específico) ----------------------

function WaitlistModal({
  entry,
  form,
  setForm,
  procedures,
  ok,
  onCancel,
  onConfirm,
}: {
  entry: QueueEntry;
  form: { clientName: string; phone: string; procedureId: string };
  setForm: (
    updater: (f: { clientName: string; phone: string; procedureId: string }) => {
      clientName: string;
      phone: string;
      procedureId: string;
    },
  ) => void;
  procedures: ProcedureOption[];
  ok: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div>
          <div className={styles.modalEyebrow}>FILA DE ESPERA</div>
          <div className={styles.modalTitle}>{entry.name}</div>
          <div className={styles.modalSub}>
            Terapeuta livre, mas o espaço do procedimento ainda não está — reserva pra este
            terapeuta assim que liberar.
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
        <div className={styles.field}>
          <span className={styles.fieldLabel}>PROCEDIMENTO</span>
          <select
            className={styles.fieldInput}
            value={form.procedureId}
            onChange={(e) => setForm((f) => ({ ...f, procedureId: e.target.value }))}
          >
            <option value="">Selecione…</option>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.ghostBtn} onClick={onCancel} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.smallBtn}
            disabled={!ok}
            onClick={onConfirm}
            style={{ flex: 2, padding: "14px 12px" }}
          >
            Reservar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Modal: escolher turno na entrada (sobreposição manhã/interturno 14h-16h) -------

function ShiftPickModal({
  therapist,
  onCancel,
  onPick,
}: {
  therapist: AbsentTherapist;
  onCancel: () => void;
  onPick: (shift: Shift) => void;
}) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div>
          <div className={styles.modalEyebrow}>INICIAR TURNO · MAIS DE UM TURNO ABERTO AGORA</div>
          <div className={styles.modalTitle}>{therapist.name}</div>
          <div className={styles.modalSub}>Em qual turno iniciar?</div>
        </div>
        <div className={styles.modalDivider} />
        <div className={styles.modalActions} style={{ flexDirection: "column" }}>
          {therapist.availableShifts.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.smallBtn}
              style={{ padding: "14px 12px" }}
              onClick={() => onPick(s)}
            >
              {SHIFT_LABEL_FULL[s]}
            </button>
          ))}
        </div>
        <button type="button" className={styles.ghostBtn} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---- Modal: contabilizar pontos ao finalizar bem antes do previsto ------------------

function PointsConfirmModal({
  entry,
  onCancel,
  onAnswer,
}: {
  entry: QueueEntry;
  onCancel: () => void;
  onAnswer: (awardPoints: boolean) => void;
}) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div>
          <div className={styles.modalEyebrow}>FINALIZAR ANTES DO PREVISTO</div>
          <div className={styles.modalTitle}>Contabilizar pontos para {entry.name}?</div>
          <div className={styles.modalSub}>
            {entry.clientName ?? "Cliente"} ainda não chegou no horário previsto de término.
          </div>
        </div>
        <div className={styles.modalDivider} />
        <div className={styles.heroHint}>
          Se o cliente concluiu o procedimento normalmente, contabilize. Se o atendimento foi
          interrompido antes do fim (cliente desistiu, saiu mais cedo etc.), não contabilize.
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.ghostBtn} onClick={onCancel} style={{ flex: 1 }}>
            Voltar
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            style={{ flex: 1, borderColor: "#C0453A", color: "#C0453A" }}
            onClick={() => onAnswer(false)}
          >
            Não
          </button>
          <button
            type="button"
            className={styles.smallBtn}
            style={{ flex: 1, padding: "14px 12px" }}
            onClick={() => onAnswer(true)}
          >
            Sim, contabilizar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Modal: procedimento / espaço / confirmação ------------------------------------

/** Disponibilidade do PRIMEIRO trecho de um procedimento — é o único que
 * precisa estar livre AGORA pra dar pra iniciar (os trechos seguintes têm
 * mais folga: podem liberar até a terapia chegar neles). `null` = já dá pra
 * começar sem esperar nada (algum espaço desse tipo está livre de verdade,
 * sem reserva futura pendente). */
function procedureFirstSegmentWait(
  p: ProcedureOption,
  spaces: SpacePanelView[],
): { typeLabel: string; iso: string } | null {
  const firstType = p.spaceRequirements[0]?.type;
  if (!firstType) return null;
  const candidates = spaces.filter((s) => s.type === firstType);
  if (candidates.length === 0) return null;
  if (candidates.some((s) => s.state === "free" && !s.occupiesAt)) return null;
  const isos = candidates
    .map((s) => s.availableAt ?? s.occupiesAt)
    .filter((v): v is string => v !== null);
  if (isos.length === 0) return null;
  const soonest = isos.reduce((a, b) => (new Date(a).getTime() < new Date(b).getTime() ? a : b));
  const typeLabel = firstType.charAt(0).toUpperCase() + firstType.slice(1);
  return { typeLabel, iso: soonest };
}

function WizardModal({
  entry,
  step,
  setStep,
  procedureGroups,
  chosenProcedure,
  chosenProcedureId,
  selectProcedure,
  spaceOptionsByRequirement,
  chosenSpaceIds,
  pickSpaceForRequirement,
  spaceReady,
  spaces,
  now,
  onClose,
  onDecline,
  onWaitlist,
  onConfirmStart,
}: {
  entry: QueueEntry;
  step: "procedure" | "space" | "confirm";
  setStep: (s: "procedure" | "space" | "confirm") => void;
  procedureGroups: Record<string, ProcedureOption[]>;
  chosenProcedure: ProcedureOption | null;
  chosenProcedureId: string | null;
  selectProcedure: (id: string) => void;
  spaceOptionsByRequirement: SpacePanelView[][];
  chosenSpaceIds: (string | null)[];
  pickSpaceForRequirement: (index: number, spaceId: string) => void;
  spaceReady: boolean;
  spaces: SpacePanelView[];
  now: Date;
  onClose: () => void;
  onDecline: () => void;
  onWaitlist: () => void;
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
                    {items.map((p) => {
                      const wait = procedureFirstSegmentWait(p, spaces);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`${styles.procedureCard} ${chosenProcedureId === p.id ? styles.procedureCardActive : ""}`}
                          onClick={() => selectProcedure(p.id)}
                        >
                          <span className={styles.procedureCardName}>{p.name}</span>
                          <div className={styles.procedureCardMeta}>
                            <span>{p.durationLabel}</span>
                            <span>{p.priceLabel}</span>
                            <span style={{ color: "#9A7426" }}>+{p.points} pts</span>
                          </div>
                          <span style={{ fontSize: 10, color: "#5A5A5A" }}>{p.typeLabel}</span>
                          {wait && (
                            <span style={{ fontSize: 10.5, color: "#9A7426", fontWeight: 700 }}>
                              ⚠ {wait.typeLabel} ocupada — libera às {formatHM(wait.iso)} (faltam{" "}
                              {remainingMinutes(wait.iso, now)} min)
                            </span>
                          )}
                        </button>
                      );
                    })}
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
              <div className={styles.modalSub}>{chosenProcedure.typeLabel}</div>
            </div>
            {chosenProcedure.spaceRequirements.map((req, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 10, letterSpacing: 1.6, color: "#9A7426" }}>
                  TRECHO {i + 1} · {req.label}
                </span>
                <div className={styles.spaceGrid}>
                  {spaceOptionsByRequirement[i]?.map((s) => {
                    const selected = chosenSpaceIds[i] === s.id;
                    // Livre em geral, OU já selecionado num trecho anterior/posterior
                    // deste mesmo procedimento (reaproveitar o mesmo espaço em
                    // trechos não sequenciais no tempo é permitido pelo backend).
                    const disabled = s.state !== "free" && !selected;
                    // "Livre agora" mas com reserva futura chegando (outro
                    // atendimento já em andamento vai usar este espaço daqui a
                    // pouco) — não dá pra saber com certeza no front se bate com
                    // o horário deste combo (o backend é quem valida de verdade
                    // no fim), mas o recepcionista PRECISA ver isso antes de
                    // escolher, não só depois de um erro — pedido explícito.
                    const reservedSoon = s.state === "free" && !!s.occupiesAt;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`${styles.spaceOption} ${selected ? styles.spaceOptionSelected : ""} ${disabled ? styles.spaceOptionDisabled : ""} ${reservedSoon ? styles.spaceOptionWarning : ""}`}
                        onClick={() => pickSpaceForRequirement(i, s.id)}
                        disabled={disabled}
                      >
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                        <div style={{ fontSize: 11.5, color: reservedSoon ? "#9A7426" : "#5A5A5A" }}>
                          {s.state === "free" && !reservedSoon && "Disponível agora"}
                          {s.state === "free" &&
                            reservedSoon &&
                            `⚠ Ocupada em ${remainingMinutes(s.occupiesAt, now)} min — confira o horário`}
                          {s.state !== "free" && `Ocupado até ${formatHM(s.availableAt)}`}
                        </div>
                      </button>
                    );
                  })}
                  {(spaceOptionsByRequirement[i]?.length ?? 0) === 0 && <div>Nenhum espaço desse tipo cadastrado.</div>}
                </div>
              </div>
            ))}
            {(spaceOptionsByRequirement[0]?.length ?? 0) > 0 &&
              spaceOptionsByRequirement[0]?.every((s) => s.state !== "free") && (
                <div className={styles.heroHint} style={{ borderColor: "#c9a44c" }}>
                  Nenhuma opção livre agora pro trecho 1 — em vez de esperar aqui, dá pra colocar
                  {" "}{entry.clientName} na fila de espera desse terapeuta: o painel avisa sozinho
                  quando liberar.
                </div>
              )}
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setStep("procedure")} style={{ flex: 1 }}>
                Voltar
              </button>
              {(spaceOptionsByRequirement[0]?.length ?? 0) > 0 &&
                spaceOptionsByRequirement[0]?.every((s) => s.state !== "free") && (
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    style={{ flex: 2, padding: "14px 12px", borderColor: "#c9a44c", color: "#9A7426" }}
                    onClick={onWaitlist}
                  >
                    Colocar na fila de espera
                  </button>
                )}
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
              <SummaryField
                label="ESPAÇO"
                value={chosenSpaceIds
                  .map((id, i) => spaceOptionsByRequirement[i]?.find((s) => s.id === id)?.name)
                  .filter(Boolean)
                  .join(" + ")}
              />
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
