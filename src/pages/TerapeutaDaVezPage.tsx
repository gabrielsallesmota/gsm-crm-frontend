import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTerapeutaDaVezPanel } from "../hooks/useTerapeutaDaVezPanel";
import { terapeutaDaVezPublicRepository } from "../repositories/api/TerapeutaDaVezPublicRepository";
import {
  PAYMENT_METHOD_OPTIONS,
  type AbsentTherapist,
  type Appointment,
  type AppointmentStatus,
  type AttendanceRecord,
  type CreateAppointmentInput,
  type HistoryPage,
  type PanelState,
  type PaymentAllocationInput,
  type PaymentMethod,
  type ProcedureOption,
  type QueueEntry,
  type ReturnReservation,
  type ScheduleEntry,
  type Shift,
  type SpacePanelView,
  type SpaceType,
  type UpdateAppointmentInput,
  type WaitlistEntry,
} from "../types/operations";
import { buildWhatsappUrl } from "../utils/messageTemplates";
import { formatPhone, onlyDigits, toWhatsappPhone } from "../utils/phone";
import styles from "./TerapeutaDaVezPage.module.css";

type Tab = "operacao" | "escala" | "historico" | "agenda";
const TAB_LABEL: Record<Tab, string> = {
  operacao: "Operação",
  escala: "Escala",
  historico: "Histórico",
  agenda: "Agenda",
};

// Espelha `QUICK_RETURN_MAX_DURATION_MINUTES` do backend
// (`domain.entities`) — procedimento até esse tamanho oferece a reserva
// rápida de "volta mais tarde"; mais longo que isso direciona pra Agenda.
const QUICK_RETURN_MAX_DURATION_MINUTES = 25;

/** Dados já escolhidos na tentativa de "volta mais tarde" (nome, telefone,
 * procedimento) que não era rápido o suficiente — repassados pra Agenda,
 * que abre o modal de criar já com isto preenchido (pedido do usuário:
 * "demais deve direcionar para a tela de agendamento... com os campos já
 * pré preenchidos"). */
interface AgendaPrefill {
  clientName: string;
  phone: string;
  procedureId: string;
  spaceType: SpaceType | null;
  durationMinutes: number;
}

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

function queueMetaText(entry: QueueEntry): string {
  // `clientName` só existe a partir da escolha do espaço (digitado ali,
  // nunca antes) — na recepção ainda não tem nome nenhum pra mostrar.
  if (entry.status === "reception") return "Escolhendo procedimento";
  if (entry.status === "therapy") return `Em terapia · ${entry.clientName ?? ""} · ${entry.spaceNames.join(" + ")}`;
  if (entry.status === "pausa") return "Em pausa";
  return `${entry.shiftLabel} · ${entry.shiftRange}`;
}

// Um status só por linha — funde o que antes eram dois lugares (status da
// fila + seção separada de fila de espera) num único selo, texto + cor
// (nunca só cor, pedido do usuário). "RESERVADO" cobre quem está livre mas
// tem uma reserva de terapeuta específico ativa (`state.waitlist`). "PAUSA"
// é pausa manual (Pausar/Retomar) — não é histórico, só sai da fila de quem
// pode ser chamado enquanto durar.
type RowStatus = "livre" | "reservado" | "pausa" | "escolhendo_procedimento" | "atendendo";

const ROW_STATUS_LABEL: Record<RowStatus, string> = {
  livre: "LIVRE",
  reservado: "RESERVADO",
  pausa: "EM PAUSA",
  escolhendo_procedimento: "ESCOLHENDO PROCEDIMENTO",
  atendendo: "ATENDENDO",
};

const ROW_STATUS_COLOR: Record<RowStatus, string> = {
  livre: "#5A5A5A",
  reservado: "#C9A44C",
  pausa: "#7A7A7A",
  escolhendo_procedimento: "#9A7426",
  atendendo: "#1E8A86",
};

function rowStatus(entry: QueueEntry, waitlistEntry: WaitlistEntry | undefined): RowStatus {
  if (entry.status === "therapy") return "atendendo";
  if (entry.status === "reception") return "escolhendo_procedimento";
  if (entry.status === "pausa") return "pausa";
  return waitlistEntry ? "reservado" : "livre";
}

function StatusBadge({ status }: { status: RowStatus }) {
  const color = ROW_STATUS_COLOR[status];
  return (
    <span className={styles.statusBadge} style={{ color, background: `${color}22` }}>
      {ROW_STATUS_LABEL[status]}
    </span>
  );
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
    pause,
    resume,
    releaseCleaning,
    createWaitlistEntry,
    confirmWaitlistEntry,
    cancelWaitlistEntry,
    createReturnReservation,
    resolveReturnReservation,
  } = useTerapeutaDaVezPanel();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Navegação em abas — Operação é a home, sem sincronizar com a URL
  // (fica tudo na mesma tela, sem recarregar nada ao trocar).
  const [activeTab, setActiveTab] = useState<Tab>("operacao");

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 4200);
  }
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // ---- Chamar terapeuta -------------------------------------------------------
  // Sem tela de cliente/telefone — pedido do usuário: chama direto e já
  // abre o wizard no passo de procedimento. O nome do paciente é digitado
  // só mais adiante, junto com a escolha do espaço (ver `wizardClientName`).
  async function chooseProcedure(entry: QueueEntry) {
    try {
      // `call` já devolve o atendimento recém-criado (com `id`) — usar isso
      // direto, em vez de procurar em `state.queue` logo em seguida. `state`
      // aqui é a variável já capturada nesta função (o valor de quando ela
      // foi criada, no render anterior); o `setState` que `call` faz por
      // dentro não "atualiza" essa variável retroativamente, então a busca
      // sempre batia no `state` de ANTES da chamada — o wizard abria com
      // `attendanceId: null`, e só quebrava lá na frente, no fim do wizard,
      // com a mensagem de "sessão expirou" (bug real, achado em produção).
      const attendance = await call(entry.therapistId);
      openWizard({ ...entry, status: "reception", attendanceId: attendance.id });
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
        // Veio do wizard (terapeuta já chamado, sem espaço livre) — o
        // backend recusa esse atendimento pendente junto, liberando o
        // terapeuta pra fila normal de novo.
        ...(waitlistTarget.attendanceId ? { attendanceId: waitlistTarget.attendanceId } : {}),
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
  const [wizardStep, setWizardStep] = useState<"procedure" | "space" | "confirm" | "payment">(
    "procedure",
  );
  const [chosenProcedureId, setChosenProcedureId] = useState<string | null>(null);
  // Um slot por trecho do procedimento, na mesma ordem de
  // `chosenProcedure.spaceRequirements` — não é mais "N espaços quaisquer
  // desse tipo", é "o espaço do trecho 1", "o espaço do trecho 2" etc.
  const [chosenSpaceIds, setChosenSpaceIds] = useState<(string | null)[]>([]);
  // Combo de 2+ trechos, cliente prefere ficar num espaço só o atendimento
  // inteiro (pedido do usuário: "1h na maca e depois 30min na poltrona,
  // mas o cliente pediu pra ficar na maca") — quando `true`, só o espaço
  // do trecho 1 é enviado (backend trata como um trecho só, na duração
  // total). Sempre falso de novo ao trocar de procedimento/reabrir.
  const [mergeIntoSingleSpace, setMergeIntoSingleSpace] = useState(false);
  // Nome e telefone do paciente, pedidos junto com a escolha do espaço —
  // a partir daqui sempre cadastram/reaproveitam um `Client` (pedido do
  // usuário: "no escolher procedimento pedir cadastro nome e telefone").
  const [wizardClientName, setWizardClientName] = useState("");
  const [wizardPhone, setWizardPhone] = useState("");

  function openWizard(entry: QueueEntry) {
    setWizardEntry(entry);
    setWizardStep("procedure");
    setChosenProcedureId(null);
    setStarting(false);
    setChosenSpaceIds([]);
    setMergeIntoSingleSpace(false);
    setWizardClientName("");
    setWizardPhone("");
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

  // "Colocar na fila de espera" direto do passo de escolher espaço — a
  // chamada não pede mais telefone, então abre o modal de reserva padrão
  // (mesmo usado pro botão avulso "Fila de espera" numa linha ociosa) já
  // com nome/procedimento preenchidos, só faltando o telefone. O
  // atendimento pendente é recusado junto quando a reserva é confirmada
  // (`confirmWaitlist`, via `attendanceId`), liberando o terapeuta pra
  // fila normal.
  function openWaitlistFromWizard() {
    if (!wizardEntry || !chosenProcedureId) return;
    setWaitlistTarget(wizardEntry);
    setWaitlistForm({
      clientName: wizardClientName.trim(),
      phone: wizardPhone.trim(),
      procedureId: chosenProcedureId,
    });
    closeWizard();
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
    setMergeIntoSingleSpace(false);
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

  const spaceReady = mergeIntoSingleSpace
    ? chosenSpaceIds[0] !== null && chosenSpaceIds[0] !== undefined
    : chosenSpaceIds.length > 0 && chosenSpaceIds.every((id) => id !== null);
  const clientNameReady = wizardClientName.trim().length > 2;
  const clientPhoneReady = onlyDigits(wizardPhone).length >= 10;
  // Trava duplo clique e cobre o botão "Iniciar terapia" (etapa 3, sem
  // `disabled` nenhum antes) — um clique nele com o estado por algum motivo
  // incompleto simplesmente não fazia nada, sem toast nem erro no console.
  const [starting, setStarting] = useState(false);

  async function confirmStart(payments: PaymentAllocationInput[] = []) {
    if (starting) return;
    // Clique duplicado depois que um clique anterior já fechou o wizard
    // (sucesso ou cancelamento) — ignora em silêncio, não é um erro de
    // verdade pro usuário ver.
    if (!wizardEntry) return;
    if (
      !wizardEntry.attendanceId ||
      !chosenProcedureId ||
      !spaceReady ||
      !clientNameReady ||
      !clientPhoneReady
    ) {
      // Mensagem específica por campo — se isso ainda aparecer depois de
      // preenchido tudo, o texto já diz sozinho qual condição realmente
      // falhou, em vez de um aviso genérico que não ajuda a diagnosticar.
      const missing: string[] = [];
      if (!wizardEntry.attendanceId) missing.push("sessão do atendimento expirou — feche e chame de novo");
      if (!chosenProcedureId) missing.push("procedimento");
      if (!spaceReady) missing.push("espaço de cada trecho");
      if (!clientNameReady) missing.push("nome do cliente (mín. 3 letras)");
      if (!clientPhoneReady) missing.push("telefone do cliente (mín. 10 dígitos)");
      showToast(`Antes de iniciar, falta: ${missing.join(", ")}.`);
      return;
    }
    setStarting(true);
    try {
      // Combo mesclado num espaço só: manda SÓ o espaço do trecho 1 — o
      // backend reconhece um único `space_ids` num procedimento de 2+
      // trechos como "fica nele o atendimento inteiro" (ver
      // `StartTherapyUseCase`).
      const spaceIdsToSend = mergeIntoSingleSpace
        ? [chosenSpaceIds[0] as string]
        : (chosenSpaceIds as string[]);
      await start(
        wizardEntry.attendanceId,
        chosenProcedureId,
        spaceIdsToSend,
        wizardClientName.trim(),
        wizardPhone.trim(),
        payments,
      );
      showToast(`Terapia iniciada — liberação prevista às ${formatHM(new Date(Date.now() + (chosenProcedure?.durationMinutes ?? 0) * 60000).toISOString())}.`);
      closeWizard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível iniciar a terapia.");
    } finally {
      setStarting(false);
    }
  }

  // Terminando com folga considerável antes do previsto (cliente saiu mais
  // cedo, sessão interrompida etc.) — pergunta se conta os pontos do
  // procedimento pro terapeuta. Nos últimos 10 min do previsto (ou no prazo,
  // ou atrasado) conta normal sem perguntar — é tempo curto demais pra valer
  // a pena interromper a recepção com uma pergunta.
  const EARLY_FINISH_GRACE_MINUTES = 10;

  const [pointsConfirmTarget, setPointsConfirmTarget] = useState<QueueEntry | null>(null);
  // Forma de pagamento só é perguntada quando o atendimento tem valor
  // (procedimentos cadastrados antes desta funcionalidade ficam sem preço
  // até alguém preencher na gestão — nesse caso finaliza direto, como
  // sempre funcionou).
  const [paymentTarget, setPaymentTarget] = useState<{ entry: QueueEntry; awardPoints: boolean } | null>(
    null,
  );

  async function doFinish(entry: QueueEntry, awardPoints: boolean, payments: PaymentAllocationInput[] = []) {
    if (!entry.attendanceId) return;
    try {
      await finish(entry.attendanceId, awardPoints, payments);
      showToast(
        awardPoints
          ? `${entry.name}: atendimento finalizado. Fila recalculada.`
          : `${entry.name}: atendimento finalizado sem pontuar (encerrado antes do previsto).`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível finalizar o atendimento.");
    } finally {
      setPointsConfirmTarget(null);
      setPaymentTarget(null);
    }
  }

  function proceedToFinish(entry: QueueEntry, awardPoints: boolean) {
    // Já pago no início (pagamento é ANTES de iniciar, pedido do usuário) —
    // `paymentPending` reflete isso ao vivo, não pergunta forma de
    // pagamento de novo aqui.
    if (entry.price !== null && entry.price > 0 && entry.paymentPending) {
      setPaymentTarget({ entry, awardPoints });
      return;
    }
    void doFinish(entry, awardPoints, []);
  }

  function finishTherapy(entry: QueueEntry) {
    if (!entry.attendanceId) return;
    const minutesRemaining = remainingMinutes(entry.plannedEndAt, now) ?? 0;
    if (minutesRemaining > EARLY_FINISH_GRACE_MINUTES) {
      setPointsConfirmTarget(entry);
      return;
    }
    proceedToFinish(entry, true);
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

  // ---- Pausa manual (ex.: foi almoçar) --------------------------------------
  // Sem limite de tempo, nunca vira histórico/jornada — só sai do "quem pode
  // ser chamado" enquanto durar (ver `domain.services.build_queue`).
  async function handlePause(entry: QueueEntry) {
    try {
      await pause(entry.therapistId);
      showToast(`${entry.name}: em pausa.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível pausar.");
    }
  }

  async function handleResume(entry: QueueEntry) {
    try {
      await resume(entry.therapistId);
      showToast(`${entry.name}: de volta.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível retomar.");
    }
  }

  // ---- "Volta mais tarde" (reserva rápida) + Agenda -------------------------
  // Pedido do usuário: procedimento RÁPIDO (Quick 15min, Shiatsu 25min) vira
  // uma reserva com contagem regressiva + botão de WhatsApp; procedimento
  // mais longo direciona pra Agenda, já com os campos preenchidos.
  const [returnReservationOpen, setReturnReservationOpen] = useState(false);
  const [returnReservationForm, setReturnReservationForm] = useState({
    clientName: "",
    phone: "",
    procedureId: "",
    minutes: 15,
  });
  const [agendaPrefill, setAgendaPrefill] = useState<AgendaPrefill | null>(null);

  function openReturnReservationModal() {
    setReturnReservationForm({ clientName: "", phone: "", procedureId: "", minutes: 15 });
    setReturnReservationOpen(true);
  }

  async function confirmReturnReservation() {
    const procedure = allProcedures.find((p) => p.id === returnReservationForm.procedureId);
    if (!procedure || procedure.durationMinutes > QUICK_RETURN_MAX_DURATION_MINUTES) return;
    try {
      await createReturnReservation({
        clientName: returnReservationForm.clientName.trim(),
        phone: returnReservationForm.phone,
        procedureId: returnReservationForm.procedureId,
        minutes: returnReservationForm.minutes,
      });
      showToast(`${returnReservationForm.clientName.trim()}: reserva de retorno criada.`);
      setReturnReservationOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível criar a reserva.");
    }
  }

  function redirectReturnReservationToAgenda() {
    const procedure = allProcedures.find((p) => p.id === returnReservationForm.procedureId);
    if (!procedure) return;
    setAgendaPrefill({
      clientName: returnReservationForm.clientName.trim(),
      phone: returnReservationForm.phone,
      procedureId: procedure.id,
      spaceType: procedure.spaceRequirements[0]?.type ?? null,
      durationMinutes: procedure.durationMinutes,
    });
    setReturnReservationOpen(false);
    setActiveTab("agenda");
  }

  async function handleResolveReturnReservation(reservation: ReturnReservation, verb: string) {
    try {
      await resolveReturnReservation(reservation.id);
      showToast(`${reservation.clientName}: ${verb}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível atualizar a reserva.");
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

  if (!state.storeOpen) {
    return <StoreClosedScreen now={now} nextOpenAt={state.nextOpenAt} />;
  }

  const nextIdle = state.queue.find((e) => e.status === "idle") ?? null;
  const shiftChips = buildShiftChips(state.queue);
  const waitlistByTherapist = new Map(state.waitlist.map((w) => [w.therapistId, w]));
  const therapyEntries = state.queue.filter((e) => e.status === "therapy");
  const waitingToStart = state.absent.filter((t) => t.availableShifts.length > 0);
  const nobodyStartedYet = state.queue.length === 0;

  return (
    <div className={styles.page}>
      <Header now={now} />
      <TabStrip active={activeTab} onChange={setActiveTab} />
      {activeTab === "operacao" && <ShiftStrip chips={shiftChips} />}

      {activeTab === "operacao" && (
        <>
          <div className={styles.body}>
            <HeroPanel nextIdle={nextIdle} onCall={(entry) => void chooseProcedure(entry)} />

            <section className={styles.queueSection}>
              <div className={styles.queueHeader}>
                <div>
                  <div className={styles.queueTitle}>Fila de atendimento</div>
                  <div className={styles.queueSubtitle}>Ordenada pela menor pontuação entre quem está na jornada</div>
                </div>
                <div className={styles.queueSubtitle}>
                  Trilha: {state.pointsMin}–{state.pointsMax} pts
                </div>
                <button type="button" className={styles.smallBtn} onClick={openReturnReservationModal}>
                  Reservar retorno
                </button>
              </div>
              <div className={styles.queueList}>
                {nobodyStartedYet && (
                  <EmptyState
                    title="Nenhum terapeuta iniciou o turno ainda."
                    hint="Os terapeutas escalados aparecerão aqui depois de tocar em “Iniciar turno”."
                  />
                )}
                {state.queue.map((entry) => {
                  const waitlistEntry = waitlistByTherapist.get(entry.therapistId);
                  const status = rowStatus(entry, waitlistEntry);
                  return (
                    <div
                      key={entry.therapistId}
                      className={`${styles.queueRow} ${entry.status !== "idle" ? styles.queueRowTurn : ""} ${entry.paymentPending ? styles.queueRowPaymentPending : ""}`}
                    >
                      <div className={styles.queuePos}>{entry.position ?? "—"}</div>
                      <div className={styles.queueInfo}>
                        <span className={styles.queueName}>{entry.name}</span>
                        <span className={styles.queueMeta}>
                          {status === "reservado" && waitlistEntry
                            ? `${waitlistEntry.clientName} · ${waitlistEntry.procedureName}`
                            : queueMetaText(entry)}
                        </span>
                        {entry.outOfOrder && (
                          <span style={{ color: "#B23B3B", fontWeight: 700, fontSize: 12 }}>
                            Decisão do paciente
                          </span>
                        )}
                        {entry.paymentPending && status !== "livre" && (
                          <span className={styles.paymentPendingBadgeInline}>⚠ PAGAMENTO PENDENTE</span>
                        )}
                      </div>
                      <div className={styles.queuePoints}>{entry.points}</div>
                      <StatusBadge status={status} />
                      <div className={styles.queueAction}>
                        {status === "livre" && (
                          <>
                            <button type="button" className={styles.smallBtn} onClick={() => void chooseProcedure(entry)}>
                              Escolher procedimento
                            </button>
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
                            <button type="button" className={styles.ghostBtn} onClick={() => void handlePause(entry)}>
                              Pausar
                            </button>
                          </>
                        )}
                        {status === "pausa" && (
                          <button type="button" className={styles.smallBtn} onClick={() => void handleResume(entry)}>
                            Retomar
                          </button>
                        )}
                        {status === "reservado" && waitlistEntry && (
                          <>
                            <span className={styles.queueMeta}>{waitlistStatusLabel(waitlistEntry, now)}</span>
                            <button
                              type="button"
                              className={styles.smallBtn}
                              disabled={!waitlistEntry.ready}
                              title={
                                waitlistEntry.ready
                                  ? "Iniciar o atendimento deste cliente com este terapeuta"
                                  : "Ainda não está livre — só dá pra confirmar quando ficar pronto"
                              }
                              onClick={() => void handleConfirmWaitlistEntry(waitlistEntry)}
                            >
                              Confirmar
                            </button>
                            <button type="button" className={styles.ghostBtn} onClick={() => void handleCancelWaitlistEntry(waitlistEntry)}>
                              Cancelar
                            </button>
                          </>
                        )}
                        {status === "escolhendo_procedimento" && (
                          <button type="button" className={styles.smallBtn} onClick={() => openWizard(entry)}>
                            Definir procedimento
                          </button>
                        )}
                        {status === "atendendo" && (
                          <button type="button" className={styles.smallBtn} onClick={() => finishTherapy(entry)}>
                            Finalizar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <Sidebar
              state={state}
              waiting={waitingToStart}
              now={now}
              onCheckIn={requestCheckIn}
              onResolveReturnReservation={handleResolveReturnReservation}
            />
          </div>

          <InProgressSection entries={therapyEntries} now={now} onFinish={finishTherapy} />
          <SpacesSection spaces={state.spaces} now={now} onReleaseCleaning={handleReleaseCleaning} />
        </>
      )}

      {activeTab === "escala" && <EscalaTab state={state} showToast={showToast} />}
      {activeTab === "historico" && <HistoricoTab showToast={showToast} />}
      {activeTab === "agenda" && (
        <AgendaTab
          state={state}
          procedures={allProcedures}
          showToast={showToast}
          prefill={agendaPrefill}
          onPrefillConsumed={() => setAgendaPrefill(null)}
        />
      )}

      {toastMsg && <div className={styles.toast}>{toastMsg}</div>}

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

      {returnReservationOpen && (
        <ReturnReservationModal
          form={returnReservationForm}
          setForm={setReturnReservationForm}
          procedures={allProcedures}
          onCancel={() => setReturnReservationOpen(false)}
          onConfirm={() => void confirmReturnReservation()}
          onRedirectToAgenda={redirectReturnReservationToAgenda}
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
          mergeIntoSingleSpace={mergeIntoSingleSpace}
          setMergeIntoSingleSpace={setMergeIntoSingleSpace}
          spaceReady={spaceReady}
          clientName={wizardClientName}
          setClientName={setWizardClientName}
          clientNameReady={clientNameReady}
          phone={wizardPhone}
          setPhone={setWizardPhone}
          clientPhoneReady={clientPhoneReady}
          starting={starting}
          spaces={state.spaces}
          now={now}
          onClose={closeWizard}
          onDecline={() => void declineWizard()}
          onWaitlist={openWaitlistFromWizard}
          onConfirmStart={(payments) => void confirmStart(payments)}
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
          onAnswer={(awardPoints) => {
            setPointsConfirmTarget(null);
            proceedToFinish(pointsConfirmTarget, awardPoints);
          }}
        />
      )}

      {paymentTarget && (
        <PaymentModal
          title={paymentTarget.entry.name}
          subtitle={paymentTarget.entry.clientName ?? "Cliente"}
          total={paymentTarget.entry.price ?? 0}
          allowSkip={false}
          onCancel={() => setPaymentTarget(null)}
          onConfirm={(payments) => void doFinish(paymentTarget.entry, paymentTarget.awardPoints, payments)}
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

// ---- Navegação em abas --------------------------------------------------------

const TAB_ORDER: Tab[] = ["operacao", "escala", "historico", "agenda"];

function TabStrip({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className={styles.tabStrip}>
      {TAB_ORDER.map((t) => (
        <button
          key={t}
          type="button"
          className={`${styles.tab} ${active === t ? styles.tabActive : ""}`}
          onClick={() => onChange(t)}
        >
          {TAB_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

// ---- Estado vazio / atendimentos em andamento ----------------------------------

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyStateTitle}>{title}</span>
      <span className={styles.emptyStateHint}>{hint}</span>
    </div>
  );
}

function InProgressSection({
  entries,
  now,
  onFinish,
}: {
  entries: QueueEntry[];
  now: Date;
  onFinish: (entry: QueueEntry) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <section className={styles.inProgressSection}>
      <span className={styles.inProgressTitle}>Atendimentos em andamento</span>
      <div className={styles.inProgressGrid}>
        {entries.map((e) => (
          <div
            key={e.therapistId}
            className={`${styles.inProgressCard} ${e.paymentPending ? styles.queueRowPaymentPending : ""}`}
          >
            <div className={styles.inProgressRow}>
              <span className={styles.queueName}>{e.clientName ?? "Cliente"}</span>
              <span style={{ color: "#C9A44C", fontWeight: 700 }}>
                restam {remainingMinutes(e.plannedEndAt, now)} min
              </span>
            </div>
            <span className={styles.queueMeta}>
              {e.name} · {e.procedureName} · {e.spaceNames.join(" + ")} · libera às {formatHM(e.plannedEndAt)}
            </span>
            {e.paymentPending && (
              <span className={styles.paymentPendingBadgeInline} style={{ alignSelf: "flex-start" }}>
                ⚠ PAGAMENTO PENDENTE
              </span>
            )}
            <button type="button" className={styles.smallBtn} style={{ alignSelf: "flex-start" }} onClick={() => onFinish(e)}>
              Finalizar
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Escala / Histórico (abas novas) --------------------------------------------

// ---- Aba Escala — grade semanal editável ------------------------------------------

const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mondayOf(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0=domingo … 6=sábado
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function minutesToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function hhmmToMinutes(v: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  const hh = match?.[1];
  const mm = match?.[2];
  if (!hh || !mm) return null;
  const h = Number(hh);
  const m = Number(mm);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

interface ActiveTherapistOption {
  id: string;
  name: string;
}

/** Escala editável direto do painel público — sem senha, mesma postura do
 * resto do painel (pedido do usuário). Grade semanal Manhã/Interturno/
 * Noturno × Seg–Dom, parecida com a planilha que a recepção já usava. */
function EscalaTab({ state, showToast }: { state: PanelState; showToast: (msg: string) => void }) {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [entries, setEntries] = useState<ScheduleEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{
    date: string;
    shift: Shift;
    entry: ScheduleEntry | null;
    /** Quem já está escalado nesse dia/turno (a própria linha em edição
     * inclusa) — usado pra tirar da lista de seleção quem não tem
     * disponibilidade, em vez de deixar escolher e só barrar depois com um
     * erro do backend. */
    busyIds: string[];
  } | null>(null);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dateFrom = isoDate(weekStart);
  const dateTo = isoDate(weekEnd);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await terapeutaDaVezPublicRepository.listSchedule(dateFrom, dateTo);
      setEntries(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar a escala.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // Refaz só quando a semana visível muda — `reload` é recriada a cada
    // render, mas depende apenas de `dateFrom`/`dateTo`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  // Universo de terapeutas ativos pro seletor — não existe endpoint de
  // listagem no painel público, então junta quem está na fila agora com
  // quem está ausente hoje (`state.queue` + `state.absent` cobre todo
  // terapeuta ativo, presente ou não neste instante).
  const activeTherapists: ActiveTherapistOption[] = useMemo(() => {
    const byId = new Map<string, string>();
    for (const q of state.queue) byId.set(q.therapistId, q.name);
    for (const t of state.absent) byId.set(t.id, t.name);
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [state]);

  const byCell = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const e of entries ?? []) {
      const key = `${e.date}|${e.shift}`;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  const todayIso = isoDate(new Date());

  return (
    <div className={styles.escalaTab}>
      <div className={styles.escalaToolbar}>
        <button type="button" className={styles.ghostBtn} onClick={() => setWeekStart((d) => addDays(d, -7))}>
          ← Semana anterior
        </button>
        <span className={styles.escalaWeekLabel}>
          {weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} –{" "}
          {weekEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        </span>
        <button type="button" className={styles.ghostBtn} onClick={() => setWeekStart(mondayOf(new Date()))}>
          Hoje
        </button>
        <button type="button" className={styles.ghostBtn} onClick={() => setWeekStart((d) => addDays(d, 7))}>
          Próxima semana →
        </button>
      </div>

      {loadError && <div className={styles.escalaError}>{loadError}</div>}
      {loading && !entries && <div className={styles.escalaLoading}>Carregando escala…</div>}

      {entries && (
        <div className={styles.escalaGridWrap}>
          <div className={styles.escalaGrid}>
            <div className={styles.escalaGridHeaderCell} />
            {weekDays.map((d, i) => (
              <div
                key={i}
                className={styles.escalaGridHeaderCell}
                style={isoDate(d) === todayIso ? { color: "#0b4f4c" } : undefined}
              >
                {WEEKDAY_SHORT[i]} · {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </div>
            ))}

            {SHIFT_ORDER.map((shift) => (
              <Fragment key={shift}>
                <div className={styles.escalaGridShiftCell}>{SHIFT_LABEL_FULL[shift]}</div>
                {weekDays.map((d, i) => {
                  const dateIso = isoDate(d);
                  const cellEntries = byCell.get(`${dateIso}|${shift}`) ?? [];
                  return (
                    <div key={i} className={styles.escalaCell}>
                      {cellEntries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className={styles.escalaChip}
                          onClick={() =>
                            setEditTarget({
                              date: dateIso,
                              shift,
                              entry,
                              busyIds: cellEntries.map((e) => e.therapistId),
                            })
                          }
                        >
                          {entry.therapistName}
                          {entry.customHoursLabel && (
                            <span className={styles.escalaChipHours}> · {entry.customHoursLabel}</span>
                          )}
                          {entry.isSubstitution && <span className={styles.escalaChipSub}> ↔ subst.</span>}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={styles.escalaAddBtn}
                        onClick={() =>
                          setEditTarget({
                            date: dateIso,
                            shift,
                            entry: null,
                            busyIds: cellEntries.map((e) => e.therapistId),
                          })
                        }
                      >
                        + Adicionar
                      </button>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {editTarget && (
        <ScheduleCellModal
          date={editTarget.date}
          shift={editTarget.shift}
          entry={editTarget.entry}
          therapists={activeTherapists}
          busyIds={editTarget.busyIds}
          onClose={() => setEditTarget(null)}
          onChanged={(msg) => {
            showToast(msg);
            setEditTarget(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

/** Um modal só, reaproveitado pra adicionar (sem `entry`), substituir,
 * definir horário excepcional e remover — evita espalhar em vários popovers
 * pequenos difíceis de posicionar numa grade. */
function ScheduleCellModal({
  date,
  shift,
  entry,
  therapists,
  busyIds,
  onClose,
  onChanged,
}: {
  date: string;
  shift: Shift;
  entry: ScheduleEntry | null;
  therapists: ActiveTherapistOption[];
  /** Quem já está escalado nesse dia/turno — some da lista de seleção
   * (adicionar ou substituir), em vez de deixar escolher e só barrar
   * depois com o erro do backend. */
  busyIds: string[];
  onClose: () => void;
  onChanged: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<"menu" | "substitute" | "hours">("menu");

  const [newTherapistId, setNewTherapistId] = useState("");
  // Pra adicionar: ninguém que já esteja nesse dia/turno. Pra substituir:
  // o mesmo, mais a própria pessoa que já está na linha.
  const availableToAdd = therapists.filter((t) => !busyIds.includes(t.id));
  const availableToSubstitute = therapists.filter(
    (t) => !busyIds.includes(t.id) && t.id !== entry?.therapistId,
  );

  const [substituteId, setSubstituteId] = useState("");
  const [reason, setReason] = useState("");

  const [useCustomHours, setUseCustomHours] = useState(entry?.customOpensAt != null);
  const [opensAt, setOpensAt] = useState(entry?.customOpensAt != null ? minutesToHHMM(entry.customOpensAt) : "");
  const [closesAt, setClosesAt] = useState(
    entry?.customClosesAt != null ? minutesToHHMM(entry.customClosesAt) : "",
  );

  async function handleAdd() {
    if (!newTherapistId) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await terapeutaDaVezPublicRepository.createScheduleEntry({ therapistId: newTherapistId, date, shift });
      onChanged("Escala adicionada.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Não foi possível adicionar à escala.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubstitute() {
    if (!entry || !substituteId) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const trimmedReason = reason.trim();
      await terapeutaDaVezPublicRepository.substituteScheduleEntryTherapist(entry.id, {
        newTherapistId: substituteId,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      });
      onChanged("Substituição registrada.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Não foi possível substituir o terapeuta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveHours() {
    if (!entry) return;
    let opens: number | null = null;
    let closes: number | null = null;
    if (useCustomHours) {
      opens = hhmmToMinutes(opensAt);
      closes = hhmmToMinutes(closesAt);
      if (opens === null || closes === null || opens >= closes) {
        setErrorMsg("Informe início e fim válidos, com o início antes do fim.");
        return;
      }
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      await terapeutaDaVezPublicRepository.updateScheduleEntryHours(entry.id, { opensAt: opens, closesAt: closes });
      onChanged(useCustomHours ? "Horário excepcional salvo." : "Horário padrão do turno restaurado.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Não foi possível salvar o horário.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!entry) return;
    if (!confirm(`Remover ${entry.therapistName} da escala de ${SHIFT_LABEL_FULL[shift]} nesse dia?`)) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await terapeutaDaVezPublicRepository.deleteScheduleEntry(entry.id);
      onChanged("Escala removida.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Não foi possível remover a escala.");
    } finally {
      setBusy(false);
    }
  }

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div>
          <div className={styles.modalEyebrow}>ESCALA · {SHIFT_LABEL_FULL[shift].toUpperCase()}</div>
          <div className={styles.modalTitle}>{entry ? entry.therapistName : "Adicionar terapeuta"}</div>
          <div className={styles.modalSub} style={{ textTransform: "capitalize" }}>
            {dateLabel}
          </div>
        </div>
        <div className={styles.modalDivider} />

        {errorMsg && <div className={styles.escalaError}>{errorMsg}</div>}

        {!entry && (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>TERAPEUTA</span>
              <select
                className={styles.fieldInput}
                value={newTherapistId}
                onChange={(e) => setNewTherapistId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {availableToAdd.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {availableToAdd.length === 0 && (
                <span className={styles.rowMeta}>
                  Todo mundo com disponibilidade já está escalado(a) nesse dia/turno.
                </span>
              )}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.smallBtn}
                disabled={busy || !newTherapistId}
                onClick={() => void handleAdd()}
                style={{ flex: 2, padding: "14px 12px" }}
              >
                Adicionar
              </button>
            </div>
          </>
        )}

        {entry && mode === "menu" && (
          <>
            {entry.isSubstitution && entry.substitutedTherapistName && (
              <div className={styles.modalHint}>
                Substituindo quem estava originalmente escalado(a): {entry.substitutedTherapistName}.
              </div>
            )}
            {entry.customHoursLabel && (
              <div className={styles.modalHint}>Horário excepcional nesse dia: {entry.customHoursLabel}.</div>
            )}
            <div className={styles.modalActions} style={{ flexDirection: "column" }}>
              <button
                type="button"
                className={styles.smallBtn}
                style={{ padding: "14px 12px" }}
                onClick={() => setMode("substitute")}
              >
                Substituir terapeuta
              </button>
              <button
                type="button"
                className={styles.smallBtn}
                style={{ padding: "14px 12px" }}
                onClick={() => setMode("hours")}
              >
                Horário excepcional
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                style={{ padding: "14px 12px", borderColor: "#c0453a", color: "#c0453a" }}
                disabled={busy}
                onClick={() => void handleRemove()}
              >
                Remover da escala
              </button>
            </div>
            <button type="button" className={styles.ghostBtn} onClick={onClose}>
              Fechar
            </button>
          </>
        )}

        {entry && mode === "substitute" && (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>NOVO TERAPEUTA</span>
              <select
                className={styles.fieldInput}
                value={substituteId}
                onChange={(e) => setSubstituteId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {availableToSubstitute.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {availableToSubstitute.length === 0 && (
                <span className={styles.rowMeta}>
                  Ninguém disponível pra esse dia/turno — todos os outros terapeutas já estão escalados
                  aqui.
                </span>
              )}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>MOTIVO (OPCIONAL)</span>
              <input
                className={styles.fieldInput}
                placeholder="Ex.: folga, troca combinada…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setMode("menu")} style={{ flex: 1 }}>
                Voltar
              </button>
              <button
                type="button"
                className={styles.smallBtn}
                disabled={busy || !substituteId}
                onClick={() => void handleSubstitute()}
                style={{ flex: 2, padding: "14px 12px" }}
              >
                Confirmar substituição
              </button>
            </div>
          </>
        )}

        {entry && mode === "hours" && (
          <>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={!useCustomHours}
                onChange={(e) => setUseCustomHours(!e.target.checked)}
              />
              Usar horário padrão do turno
            </label>
            {useCustomHours && (
              <div className={styles.modalActions}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <span className={styles.fieldLabel}>INÍCIO</span>
                  <input
                    className={styles.fieldInput}
                    placeholder="16:00"
                    value={opensAt}
                    onChange={(e) => setOpensAt(e.target.value)}
                  />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <span className={styles.fieldLabel}>FIM</span>
                  <input
                    className={styles.fieldInput}
                    placeholder="18:00"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setMode("menu")} style={{ flex: 1 }}>
                Voltar
              </button>
              <button
                type="button"
                className={styles.smallBtn}
                disabled={busy}
                onClick={() => void handleSaveHours()}
                style={{ flex: 2, padding: "14px 12px" }}
              >
                Salvar horário
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Aba Histórico — consulta do dia, sem senha -----------------------------------

const PHASE_LABELS: Record<string, string> = {
  finished: "Finalizado",
  declined: "Recusado",
  reception: "Recepção",
  therapy: "Terapia",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function paymentsLabel(record: AttendanceRecord): string {
  if (record.payments.length === 0) return "—";
  // Nunca "misto" — cada forma aparece explícita, mesmo quando dividido
  // entre mais de uma (pedido do usuário).
  return record.payments.map((p) => `${p.methodLabel} R$ ${formatMoney(p.amount)}`).join(" · ");
}

function HistoricoTab({ showToast }: { showToast: (msg: string) => void }) {
  const [day, setDay] = useState(() => isoDate(new Date()));
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registerTarget, setRegisterTarget] = useState<AttendanceRecord | null>(null);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await terapeutaDaVezPublicRepository.listHistory({
        dateFrom: day,
        dateTo: day,
        pageSize: 200,
      });
      setPage(result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  async function handleExport() {
    try {
      const csv = await terapeutaDaVezPublicRepository.exportHistory({ dateFrom: day, dateTo: day });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terapeuta-da-vez-historico-${day}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Não foi possível exportar o histórico.");
    }
  }

  const items = page?.items ?? [];
  const finishedItems = items.filter((i) => i.phase === "finished");
  const totalValue = finishedItems.reduce((acc, i) => acc + (i.price ?? 0), 0);
  // Conta TODOS os pendentes, não só os finalizados — pedido do usuário:
  // um atendimento ainda em terapia (`phase === "therapy"`) sem pagamento
  // registrado já aparece aqui como pendente, não só depois de finalizar.
  const pendingCount = items.filter((i) => i.paymentPending).length;
  const summaryByMethod = useMemo(() => {
    const totals = new Map<PaymentMethod, { label: string; total: number }>();
    for (const item of finishedItems) {
      for (const p of item.payments) {
        const current = totals.get(p.method) ?? { label: p.methodLabel, total: 0 };
        current.total += p.amount;
        totals.set(p.method, current);
      }
    }
    return [...totals.values()];
  }, [finishedItems]);

  const dayLabel = new Date(`${day}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  const todayIso = isoDate(new Date());

  return (
    <div className={styles.escalaTab}>
      <div className={styles.escalaToolbar}>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => setDay((d) => isoDate(addDays(new Date(`${d}T00:00:00`), -1)))}
        >
          ← Dia anterior
        </button>
        <span className={styles.escalaWeekLabel} style={{ textTransform: "capitalize" }}>
          {dayLabel}
        </span>
        {day !== todayIso && (
          <button type="button" className={styles.ghostBtn} onClick={() => setDay(todayIso)}>
            Hoje
          </button>
        )}
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => setDay((d) => isoDate(addDays(new Date(`${d}T00:00:00`), 1)))}
        >
          Próximo dia →
        </button>
        <button type="button" className={styles.smallBtn} style={{ marginLeft: "auto" }} onClick={() => void handleExport()}>
          Exportar CSV
        </button>
      </div>

      {loadError && <div className={styles.escalaError}>{loadError}</div>}
      {loading && !page && <div className={styles.escalaLoading}>Carregando histórico…</div>}

      {page && (
        <>
          <div className={styles.summaryGrid}>
            <div>
              <div className={styles.rowMeta}>ATENDIMENTOS FINALIZADOS</div>
              <div className={styles.heroPoints} style={{ color: "#012a2a" }}>
                {finishedItems.length}
              </div>
            </div>
            <div>
              <div className={styles.rowMeta}>VALOR TOTAL DO DIA</div>
              <div className={styles.heroPoints} style={{ color: "#012a2a" }}>
                R$ {formatMoney(totalValue)}
              </div>
            </div>
            {pendingCount > 0 && (
              <div>
                <div className={styles.rowMeta}>PAGAMENTOS PENDENTES</div>
                <div className={styles.heroPoints} style={{ color: "#9a4a26", fontSize: 20 }}>
                  {pendingCount}
                </div>
              </div>
            )}
            {summaryByMethod.map((entry) => (
              <div key={entry.label}>
                <div className={styles.rowMeta}>{entry.label.toUpperCase()}</div>
                <div className={styles.heroPoints} style={{ color: "#012a2a", fontSize: 20 }}>
                  R$ {formatMoney(entry.total)}
                </div>
              </div>
            ))}
          </div>

          {items.length === 0 ? (
            <EmptyState title="Nada por aqui ainda" hint="Nenhum atendimento registrado nesse dia." />
          ) : (
            <div style={{ overflowX: "auto", flexShrink: 0 }}>
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Paciente</th>
                    <th>Terapeuta</th>
                    <th>Procedimento</th>
                    <th>Valor</th>
                    <th>Pagamento</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.finishedAt ?? item.calledAt)}</td>
                      <td>{item.clientName ?? "—"}</td>
                      <td>{item.therapistName}</td>
                      <td>{item.procedureName ?? "—"}</td>
                      <td>{item.price !== null ? `R$ ${formatMoney(item.price)}` : "—"}</td>
                      <td>
                        {item.paymentPending ? (
                          <button
                            type="button"
                            className={styles.paymentPendingBadge}
                            onClick={() => setRegisterTarget(item)}
                            style={{ cursor: "pointer", border: "1px solid #c9a44c" }}
                          >
                            PENDENTE · registrar
                          </button>
                        ) : (
                          paymentsLabel(item)
                        )}
                      </td>
                      <td>{PHASE_LABELS[item.phase] ?? item.phase}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {registerTarget && (
        <RegisterPaymentModal
          record={registerTarget}
          onClose={() => setRegisterTarget(null)}
          onRegistered={(msg) => {
            setRegisterTarget(null);
            showToast(msg);
            void reload();
          }}
        />
      )}
    </div>
  );
}

// ---- Aba Agenda ---------------------------------------------------------------
// Grade estilo Google Agenda (pedido do usuário) — colunas = espaços, linhas =
// horário (passo de 30min). Não deixa marcar em cima de outro horário: o
// backend garante (`find_conflicting_appointment`), mesma checagem que já
// protege o cliente que chega sem hora marcada.

const AGENDA_START_MINUTES = 480; // 08:00
const AGENDA_END_MINUTES = 1320; // 22:00
const AGENDA_SLOT_MINUTES = 30;
const AGENDA_SLOT_COUNT = (AGENDA_END_MINUTES - AGENDA_START_MINUTES) / AGENDA_SLOT_MINUTES;

const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  completed: "Concluído",
  no_show: "Faltou",
  cancelled: "Cancelado",
};

function combineDateAndTime(dateIso: string, time: string): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  const minutes = hhmmToMinutes(time) ?? 0;
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, Math.floor(minutes / 60), minutes % 60);
}

interface AgendaModalState {
  mode: "create" | "edit";
  appointment: Appointment | null;
  spaceId: string;
  date: string;
  time: string;
  durationMinutes: number;
  clientName: string;
  phone: string;
  therapistId: string;
  procedureId: string;
  preferenceNote: string;
}

function blankAgendaForm(date: string, spaceId: string, time: string): AgendaModalState {
  return {
    mode: "create",
    appointment: null,
    spaceId,
    date,
    time,
    durationMinutes: 30,
    clientName: "",
    phone: "",
    therapistId: "",
    procedureId: "",
    preferenceNote: "",
  };
}

function editAgendaForm(appointment: Appointment): AgendaModalState {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  return {
    mode: "edit",
    appointment,
    spaceId: appointment.spaceId,
    date: isoDate(start),
    time: minutesToHHMM(start.getHours() * 60 + start.getMinutes()),
    durationMinutes: Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)),
    clientName: appointment.clientName,
    phone: appointment.clientPhone,
    therapistId: appointment.therapistId ?? "",
    procedureId: appointment.procedureId ?? "",
    preferenceNote: appointment.preferenceNote ?? "",
  };
}

function AgendaTab({
  state,
  procedures,
  showToast,
  prefill,
  onPrefillConsumed,
}: {
  state: PanelState;
  procedures: ProcedureOption[];
  showToast: (msg: string) => void;
  prefill: AgendaPrefill | null;
  onPrefillConsumed: () => void;
}) {
  const [day, setDay] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [totals, setTotals] = useState({ total: 0, noShowCount: 0 });
  const [modal, setModal] = useState<AgendaModalState | null>(null);
  const [saving, setSaving] = useState(false);

  const dayIso = isoDate(day);
  const spaces = state.spaces;

  // Terapeutas "conhecidos" hoje (fila + ausentes escalados) — não existe
  // endpoint público de "todos os terapeutas" fora da gestão (senha), então
  // esta é a melhor aproximação disponível sem pedir senha na Agenda.
  const knownTherapists = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of state.queue) map.set(q.therapistId, q.name);
    for (const t of state.absent) map.set(t.id, t.name);
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [state.queue, state.absent]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await terapeutaDaVezPublicRepository.listAppointmentsForDay(dayIso);
      setAppointments(result.appointments);
      setTotals({ total: result.total, noShowCount: result.noShowCount });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar a Agenda.");
    } finally {
      setLoading(false);
    }
  }, [dayIso]);

  useEffect(() => {
    void load();
  }, [load]);

  // Prefill vindo de "volta mais tarde" (procedimento não era rápido o
  // suficiente) — abre já o modal de criar com nome/telefone/procedimento.
  useEffect(() => {
    if (!prefill) return;
    const today = new Date();
    setDay(today);
    setModal({
      ...blankAgendaForm(isoDate(today), spaces[0]?.id ?? "", "10:00"),
      clientName: prefill.clientName,
      phone: prefill.phone,
      procedureId: prefill.procedureId,
      durationMinutes: prefill.durationMinutes,
    });
    onPrefillConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  function openCreate(spaceId: string, slotMinutes: number) {
    setModal(blankAgendaForm(dayIso, spaceId, minutesToHHMM(slotMinutes)));
  }

  function openEdit(appointment: Appointment) {
    setModal(editAgendaForm(appointment));
  }

  async function handleSave(form: AgendaModalState) {
    if (saving) return;
    setSaving(true);
    try {
      const startAt = combineDateAndTime(form.date, form.time);
      const endAt = new Date(startAt.getTime() + form.durationMinutes * 60000);
      if (form.mode === "create") {
        const input: CreateAppointmentInput = {
          clientName: form.clientName.trim(),
          phone: form.phone,
          spaceId: form.spaceId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          ...(form.therapistId ? { therapistId: form.therapistId } : {}),
          ...(form.procedureId ? { procedureId: form.procedureId } : {}),
          ...(form.preferenceNote.trim() ? { preferenceNote: form.preferenceNote.trim() } : {}),
        };
        await terapeutaDaVezPublicRepository.createAppointment(input);
        showToast(`${form.clientName.trim()}: agendamento criado.`);
      } else if (form.appointment) {
        // Nota: não existe "clearProcedure" no backend (mesma convenção de
        // `clearTherapist`, mas só pra terapeuta) — dá pra TROCAR de
        // procedimento, não pra voltar a "nenhum" depois de definido.
        const input: UpdateAppointmentInput = {
          spaceId: form.spaceId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          preferenceNote: form.preferenceNote,
          ...(form.procedureId ? { procedureId: form.procedureId } : {}),
          ...(form.therapistId ? { therapistId: form.therapistId } : { clearTherapist: true }),
        };
        await terapeutaDaVezPublicRepository.updateAppointment(form.appointment.id, input);
        showToast(`${form.clientName.trim()}: agendamento atualizado.`);
      }
      setModal(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível salvar o agendamento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleNoShow(appointment: Appointment) {
    try {
      await terapeutaDaVezPublicRepository.markAppointmentNoShow(appointment.id);
      showToast(`${appointment.clientName}: marcado como falta.`);
      setModal(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível marcar falta.");
    }
  }

  async function handleDelete(appointment: Appointment) {
    if (!confirm(`Excluir o agendamento de ${appointment.clientName}?`)) return;
    try {
      await terapeutaDaVezPublicRepository.deleteAppointment(appointment.id);
      showToast("Agendamento excluído.");
      setModal(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível excluir o agendamento.");
    }
  }

  const dayLabel = day.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  const todayIso = isoDate(new Date());

  const slots = useMemo(
    () =>
      Array.from(
        { length: AGENDA_SLOT_COUNT },
        (_, i) => AGENDA_START_MINUTES + i * AGENDA_SLOT_MINUTES,
      ),
    [],
  );

  return (
    <div className={styles.escalaTab}>
      <div className={styles.escalaToolbar}>
        <button type="button" className={styles.ghostBtn} onClick={() => setDay((d) => addDays(d, -1))}>
          ← Dia anterior
        </button>
        <span className={styles.escalaWeekLabel} style={{ textTransform: "capitalize" }}>
          {dayLabel}
        </span>
        {dayIso !== todayIso && (
          <button type="button" className={styles.ghostBtn} onClick={() => setDay(new Date())}>
            Hoje
          </button>
        )}
        <button type="button" className={styles.ghostBtn} onClick={() => setDay((d) => addDays(d, 1))}>
          Próximo dia →
        </button>
        <span className={styles.escalaWeekLabel} style={{ marginLeft: "auto", fontWeight: 600 }}>
          {totals.total} agendamento(s) hoje · {totals.noShowCount} faltaram
        </span>
      </div>

      {loadError && <div className={styles.escalaError}>{loadError}</div>}
      {loading && appointments.length === 0 && (
        <div className={styles.escalaLoading}>Carregando Agenda…</div>
      )}
      {!loading && spaces.length === 0 && (
        <EmptyState
          title="Nenhum espaço cadastrado."
          hint="Cadastre espaços na gestão antes de usar a Agenda."
        />
      )}

      {spaces.length > 0 && (
        <div className={styles.agendaGridWrap}>
          <div
            className={styles.agendaGrid}
            style={{
              gridTemplateColumns: `72px repeat(${spaces.length}, minmax(140px, 1fr))`,
              gridTemplateRows: `40px repeat(${slots.length}, 34px)`,
            }}
          >
            <div className={styles.agendaHeaderCorner} />
            {spaces.map((s) => (
              <div key={s.id} className={styles.agendaHeaderCell}>
                {s.name}
              </div>
            ))}
            {slots.map((minutes, rowIndex) => (
              <Fragment key={minutes}>
                <div
                  className={styles.agendaTimeCell}
                  style={{ gridRow: rowIndex + 2, gridColumn: 1 }}
                >
                  {minutes % 60 === 0 ? minutesToHHMM(minutes) : ""}
                </div>
                {spaces.map((s, colIndex) => (
                  <div
                    key={s.id}
                    className={styles.agendaSlotCell}
                    style={{ gridRow: rowIndex + 2, gridColumn: colIndex + 2 }}
                    onClick={() => openCreate(s.id, minutes)}
                  />
                ))}
              </Fragment>
            ))}
            {appointments.map((a) => {
              const colIndex = spaces.findIndex((s) => s.id === a.spaceId);
              if (colIndex === -1) return null;
              const start = new Date(a.startAt);
              const startMinutes = start.getHours() * 60 + start.getMinutes();
              const rowIndex = Math.round(
                (startMinutes - AGENDA_START_MINUTES) / AGENDA_SLOT_MINUTES,
              );
              if (rowIndex < 0 || rowIndex >= slots.length) return null;
              const durationMinutes = Math.max(
                AGENDA_SLOT_MINUTES,
                Math.round((new Date(a.endAt).getTime() - start.getTime()) / 60000),
              );
              const rowSpan = Math.max(1, Math.ceil(durationMinutes / AGENDA_SLOT_MINUTES));
              const blockClass =
                a.status === "no_show"
                  ? styles.agendaBlockNoShow
                  : a.status === "cancelled"
                    ? styles.agendaBlockCancelled
                    : "";
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`${styles.agendaBlock} ${blockClass}`}
                  style={{ gridRow: `${rowIndex + 2} / span ${rowSpan}`, gridColumn: colIndex + 2 }}
                  onClick={() => openEdit(a)}
                >
                  <span className={styles.agendaBlockName}>{a.clientName}</span>
                  <span className={styles.agendaBlockMeta}>
                    {formatHM(a.startAt)}–{formatHM(a.endAt)}
                    {a.procedureName ? ` · ${a.procedureName}` : ""}
                    {a.therapistName ? ` · ${a.therapistName}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {modal && (
        <AgendaAppointmentModal
          form={modal}
          setForm={(updater) => setModal((prev) => (prev ? updater(prev) : prev))}
          spaces={spaces}
          therapists={knownTherapists}
          procedures={procedures}
          saving={saving}
          onCancel={() => setModal(null)}
          onSave={() => void handleSave(modal)}
          onNoShow={modal.appointment ? () => void handleNoShow(modal.appointment!) : undefined}
          onDelete={modal.appointment ? () => void handleDelete(modal.appointment!) : undefined}
        />
      )}
    </div>
  );
}

function AgendaAppointmentModal({
  form,
  setForm,
  spaces,
  therapists,
  procedures,
  saving,
  onCancel,
  onSave,
  onNoShow,
  onDelete,
}: {
  form: AgendaModalState;
  setForm: (updater: (f: AgendaModalState) => AgendaModalState) => void;
  spaces: SpacePanelView[];
  therapists: { id: string; name: string }[];
  procedures: ProcedureOption[];
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onNoShow?: () => void;
  onDelete?: () => void;
}) {
  const ok =
    form.clientName.trim().length > 2 &&
    onlyDigits(form.phone).length >= 10 &&
    form.spaceId !== "" &&
    form.durationMinutes > 0 &&
    hhmmToMinutes(form.time) !== null;

  function selectProcedure(procedureId: string) {
    const procedure = procedures.find((p) => p.id === procedureId);
    setForm((f) => ({
      ...f,
      procedureId,
      durationMinutes: procedure ? procedure.durationMinutes : f.durationMinutes,
    }));
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div>
          <div className={styles.modalEyebrow}>AGENDA</div>
          <div className={styles.modalTitle}>
            {form.mode === "create" ? "Novo agendamento" : form.appointment?.clientName}
          </div>
          {form.appointment && (
            <div className={styles.modalSub}>
              Status: {APPOINTMENT_STATUS_LABEL[form.appointment.status]}
            </div>
          )}
        </div>
        <div className={styles.modalDivider} />
        <div className={styles.field}>
          <span className={styles.fieldLabel}>NOME DO CLIENTE</span>
          <input
            className={styles.fieldInput}
            value={form.clientName}
            onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>TELEFONE</span>
          <input
            className={styles.fieldInput}
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>ESPAÇO</span>
          <select
            className={styles.fieldInput}
            value={form.spaceId}
            onChange={(e) => setForm((f) => ({ ...f, spaceId: e.target.value }))}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>TERAPEUTA (OPCIONAL)</span>
          <select
            className={styles.fieldInput}
            value={form.therapistId}
            onChange={(e) => setForm((f) => ({ ...f, therapistId: e.target.value }))}
          >
            <option value="">Sem preferência</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>PROCEDIMENTO (OPCIONAL)</span>
          <select
            className={styles.fieldInput}
            value={form.procedureId}
            onChange={(e) => selectProcedure(e.target.value)}
          >
            <option value="">A definir</option>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.durationLabel})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className={styles.field} style={{ flex: 1 }}>
            <span className={styles.fieldLabel}>DATA</span>
            <input
              className={styles.fieldInput}
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <span className={styles.fieldLabel}>HORÁRIO</span>
            <input
              className={styles.fieldInput}
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            />
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <span className={styles.fieldLabel}>DURAÇÃO (MIN)</span>
            <input
              className={styles.fieldInput}
              type="number"
              min={5}
              step={5}
              value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) || 0 }))}
            />
          </div>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>PREFERÊNCIA (OPCIONAL)</span>
          <input
            className={styles.fieldInput}
            placeholder="Ex.: prefere terapeuta homem"
            value={form.preferenceNote}
            onChange={(e) => setForm((f) => ({ ...f, preferenceNote: e.target.value }))}
          />
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.ghostBtn} onClick={onCancel} style={{ flex: 1 }}>
            Cancelar
          </button>
          {onDelete && (
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={onDelete}
              style={{ flex: 1, color: "#B23B3B" }}
            >
              Excluir
            </button>
          )}
          {onNoShow && (
            <button type="button" className={styles.ghostBtn} onClick={onNoShow} style={{ flex: 1 }}>
              Marcar falta
            </button>
          )}
          <button
            type="button"
            className={styles.smallBtn}
            disabled={!ok || saving}
            onClick={onSave}
            style={{ flex: 2, padding: "14px 12px" }}
          >
            {form.mode === "create" ? "Criar agendamento" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Registrar (ou corrigir) a forma de pagamento de uma linha do Histórico —
 * mesma mecânica de split/soma exata do `PaymentModal` da finalização, só
 * que operando sobre um `AttendanceRecord` do Histórico — que pode estar
 * em terapia (pagamento pendente aparece desde o início) ou já finalizado
 * — em vez de uma `QueueEntry`. */
function RegisterPaymentModal({
  record,
  onClose,
  onRegistered,
}: {
  record: AttendanceRecord;
  onClose: () => void;
  onRegistered: (msg: string) => void;
}) {
  const total = record.price ?? 0;
  const [rows, setRows] = useState<PaymentRow[]>(
    record.payments.length > 0
      ? record.payments.map((p) => ({ method: p.method, amount: formatMoney(p.amount) }))
      : [{ method: "pix", amount: formatMoney(total) }],
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<PaymentRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.method));
    const next = PAYMENT_METHOD_OPTIONS.find((o) => !used.has(o.value))?.value ?? "pix";
    setRows((prev) => [...prev, { method: next, amount: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const sum = rows.reduce((acc, r) => acc + parseMoneyInput(r.amount), 0);
  const diff = Math.round((total - sum) * 100) / 100;
  const allFilled = rows.length > 0 && rows.every((r) => parseMoneyInput(r.amount) > 0);
  const matches = allFilled && Math.abs(diff) < 0.005;

  async function save() {
    if (!matches) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await terapeutaDaVezPublicRepository.updateAttendancePayments(
        record.id,
        rows.map((r) => ({ method: r.method, amount: parseMoneyInput(r.amount) })),
      );
      onRegistered(`Pagamento de ${record.clientName ?? record.therapistName} registrado.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Não foi possível registrar o pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div>
          <div className={styles.modalEyebrow}>REGISTRAR PAGAMENTO</div>
          <div className={styles.modalTitle}>{record.clientName ?? "Cliente"}</div>
          <div className={styles.modalSub}>
            {record.therapistName} · {record.procedureName ?? "Procedimento"} · Valor: R${" "}
            {formatMoney(total)}
          </div>
        </div>
        <div className={styles.modalDivider} />

        {errorMsg && <div className={styles.escalaError}>{errorMsg}</div>}

        <div className={styles.paymentRows}>
          {rows.map((row, i) => (
            <div key={i} className={styles.paymentRow}>
              <select
                className={styles.fieldInput}
                value={row.method}
                onChange={(e) => updateRow(i, { method: e.target.value as PaymentMethod })}
              >
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                className={styles.fieldInput}
                inputMode="decimal"
                placeholder="0,00"
                value={row.amount}
                onChange={(e) => updateRow(i, { amount: e.target.value })}
              />
              {rows.length > 1 && (
                <button type="button" className={styles.paymentRemove} onClick={() => removeRow(i)}>
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>

        <button type="button" className={styles.paymentAddBtn} onClick={addRow}>
          + Adicionar forma de pagamento
        </button>

        <div className={matches ? styles.paymentSummaryOk : styles.paymentSummary}>
          {diff === 0
            ? `Os pagamentos informados somam R$ ${formatMoney(sum)}.`
            : diff > 0
              ? `Os pagamentos informados somam R$ ${formatMoney(sum)}. Ainda faltam R$ ${formatMoney(diff)}.`
              : `Os pagamentos informados somam R$ ${formatMoney(sum)}. Isso é R$ ${formatMoney(Math.abs(diff))} a mais que o valor do atendimento.`}
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.ghostBtn} onClick={onClose} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.smallBtn}
            disabled={!matches || saving}
            onClick={() => void save()}
            style={{ flex: 2, padding: "14px 12px" }}
          >
            {saving ? "Salvando…" : "Registrar pagamento"}
          </button>
        </div>
      </div>
    </div>
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
          <button
            type="button"
            className={`${styles.heroBtn} ${styles.heroBtnPulse}`}
            onClick={() => onCall(nextIdle)}
          >
            Escolher procedimento
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

function Sidebar({
  state,
  waiting,
  now,
  onCheckIn,
  onResolveReturnReservation,
}: {
  state: PanelState;
  waiting: AbsentTherapist[];
  now: Date;
  onCheckIn: (t: AbsentTherapist) => void;
  onResolveReturnReservation: (reservation: ReturnReservation, verb: string) => void;
}) {
  const occupiedSpaces = state.spaces.filter((s) => s.state !== "free");
  return (
    <aside className={styles.sidebar}>
      {waiting.length > 0 && (
        <div className={styles.sidebarBlock}>
          <span className={styles.sidebarTitle}>Aguardando início</span>
          {waiting.map((t) => (
            <div key={t.id} className={styles.sidebarLine} style={{ alignItems: "center" }}>
              <span>{t.name}</span>
              <button type="button" className={styles.smallBtn} onClick={() => onCheckIn(t)}>
                Iniciar turno
              </button>
            </div>
          ))}
        </div>
      )}
      {state.returnReservations.length > 0 && (
        <div className={styles.sidebarBlock}>
          <span className={styles.sidebarTitle}>Volta mais tarde</span>
          {state.returnReservations.map((r) => {
            const minutes = remainingMinutes(r.returnAt, now);
            const message = `Faltam ${minutes} minutos para sua massagem!`;
            return (
              <div key={r.id} className={styles.returnReservationLine}>
                <span>
                  {r.clientName} · {r.procedureName}
                </span>
                <span style={{ color: minutes !== null && minutes <= 0 ? "#B23B3B" : "#C9A44C" }}>
                  {minutes !== null && minutes > 0 ? `volta em ${minutes} min` : "já devia ter voltado"}
                </span>
                <div className={styles.returnReservationActions}>
                  <a
                    className={styles.ghostBtn}
                    href={buildWhatsappUrl(toWhatsappPhone(r.clientPhone), message)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    💬 WhatsApp
                  </a>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => onResolveReturnReservation(r, "cliente voltou")}
                  >
                    Cliente voltou
                  </button>
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={() => onResolveReturnReservation(r, "reserva cancelada")}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {occupiedSpaces.length > 0 && (
        <div className={styles.sidebarBlock}>
          <span className={styles.sidebarTitle}>Macas/espaços ocupados</span>
          {occupiedSpaces.map((s) => (
            <div key={s.id} className={styles.sidebarLine}>
              <span>{s.name}</span>
              <span style={{ color: s.state === "cleaning" ? "#C9A44C" : "#1E8A86" }}>
                {s.state === "cleaning" ? "preparação" : "ocupada"} · {remainingMinutes(s.availableAt, now)} min
              </span>
            </div>
          ))}
        </div>
      )}
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

// ---- Modal: "volta mais tarde" -----------------------------------------------
// Procedimento RÁPIDO (Quick 15min, Shiatsu 25min) ganha reserva direta com
// contagem regressiva; qualquer coisa mais longa direciona pra Agenda, já
// com nome/telefone/procedimento preenchidos (pedido do usuário).

interface ReturnReservationForm {
  clientName: string;
  phone: string;
  procedureId: string;
  minutes: number;
}

function ReturnReservationModal({
  form,
  setForm,
  procedures,
  onCancel,
  onConfirm,
  onRedirectToAgenda,
}: {
  form: ReturnReservationForm;
  setForm: (updater: (f: ReturnReservationForm) => ReturnReservationForm) => void;
  procedures: ProcedureOption[];
  onCancel: () => void;
  onConfirm: () => void;
  onRedirectToAgenda: () => void;
}) {
  const procedure = procedures.find((p) => p.id === form.procedureId) ?? null;
  const eligible = procedure ? procedure.durationMinutes <= QUICK_RETURN_MAX_DURATION_MINUTES : null;
  const ok =
    form.clientName.trim().length > 2 &&
    onlyDigits(form.phone).length >= 10 &&
    procedure !== null &&
    form.minutes > 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div>
          <div className={styles.modalEyebrow}>VOLTA MAIS TARDE</div>
          <div className={styles.modalTitle}>Reservar retorno</div>
          <div className={styles.modalSub}>
            Cliente prefere voltar depois em vez de esperar sentado — avisamos pelo WhatsApp
            perto da hora.
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
                {p.name} ({p.durationLabel})
              </option>
            ))}
          </select>
        </div>
        {eligible === true && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>VOLTA EM QUANTOS MINUTOS?</span>
            <input
              className={styles.fieldInput}
              type="number"
              min={1}
              step={5}
              value={form.minutes}
              onChange={(e) => setForm((f) => ({ ...f, minutes: Number(e.target.value) || 0 }))}
            />
          </div>
        )}
        {eligible === false && (
          <div className={styles.modalSub} style={{ color: "#9A7426" }}>
            {procedure!.name} não é rápido o suficiente pra reserva direta — vamos te direcionar
            pra Agenda pra marcar um horário certo.
          </div>
        )}
        <div className={styles.modalActions}>
          <button type="button" className={styles.ghostBtn} onClick={onCancel} style={{ flex: 1 }}>
            Cancelar
          </button>
          {eligible === false ? (
            <button
              type="button"
              className={styles.smallBtn}
              onClick={onRedirectToAgenda}
              style={{ flex: 2, padding: "14px 12px" }}
            >
              Ir para Agenda
            </button>
          ) : (
            <button
              type="button"
              className={styles.smallBtn}
              disabled={!ok}
              onClick={onConfirm}
              style={{ flex: 2, padding: "14px 12px" }}
            >
              Confirmar reserva
            </button>
          )}
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

// ---- Modal: forma de pagamento ao finalizar ----------------------------------------

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoneyInput(raw: string): number {
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

interface PaymentRow {
  method: PaymentMethod;
  amount: string;
}

/** Registro operacional de como o cliente pagou — pra bater com o Graces
 * depois, nunca um controle fiscal. Suporta pagamento dividido entre mais de
 * uma forma; a soma precisa fechar exatamente com o valor do atendimento.
 * Reaproveitado tanto ao FINALIZAR quanto ao INICIAR a terapia (pagamento é
 * antes de iniciar, pedido do usuário) — por isso os props são genéricos
 * (título/subtítulo/total), não amarrados a um `QueueEntry` já iniciado. */
function PaymentModal({
  eyebrow = "FINALIZAR ATENDIMENTO",
  title,
  subtitle,
  total,
  confirmLabel = "Finalizar atendimento",
  allowSkip = true,
  onCancel,
  onConfirm,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  total: number;
  confirmLabel?: string;
  /** `false` esconde "Não sei agora" — pedido do usuário: não deixar
   * FINALIZAR um atendimento sem registrar pagamento nenhum (diferente do
   * pagamento no INÍCIO, que continua opcional). */
  allowSkip?: boolean;
  onCancel: () => void;
  onConfirm: (payments: PaymentAllocationInput[]) => void;
}) {
  const [rows, setRows] = useState<PaymentRow[]>([{ method: "pix", amount: formatMoney(total) }]);

  function updateRow(index: number, patch: Partial<PaymentRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.method));
    const next = PAYMENT_METHOD_OPTIONS.find((o) => !used.has(o.value))?.value ?? "pix";
    setRows((prev) => [...prev, { method: next, amount: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const sum = rows.reduce((acc, r) => acc + parseMoneyInput(r.amount), 0);
  const diff = Math.round((total - sum) * 100) / 100;
  const allFilled = rows.length > 0 && rows.every((r) => parseMoneyInput(r.amount) > 0);
  const matches = allFilled && Math.abs(diff) < 0.005;

  function confirm() {
    if (!matches) return;
    onConfirm(rows.map((r) => ({ method: r.method, amount: parseMoneyInput(r.amount) })));
  }

  // "Registrar depois" — finaliza sem forma de pagamento nenhuma. O
  // atendimento fica marcado como pagamento pendente (nunca bloqueado por
  // isso) e some da fila do mesmo jeito; a recepção completa quando puder,
  // pelo Histórico (ver `paymentPending`).
  function skipForNow() {
    onConfirm([]);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div>
          <div className={styles.modalEyebrow}>{eyebrow}</div>
          <div className={styles.modalTitle}>{title}</div>
          <div className={styles.modalSub}>
            {subtitle} · Valor: R$ {formatMoney(total)}
          </div>
        </div>
        <div className={styles.modalDivider} />

        <div className={styles.paymentRows}>
          {rows.map((row, i) => (
            <div key={i} className={styles.paymentRow}>
              <select
                className={styles.fieldInput}
                value={row.method}
                onChange={(e) => updateRow(i, { method: e.target.value as PaymentMethod })}
              >
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                className={styles.fieldInput}
                inputMode="decimal"
                placeholder="0,00"
                value={row.amount}
                onChange={(e) => updateRow(i, { amount: e.target.value })}
              />
              {rows.length > 1 && (
                <button type="button" className={styles.paymentRemove} onClick={() => removeRow(i)}>
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>

        <button type="button" className={styles.paymentAddBtn} onClick={addRow}>
          + Adicionar forma de pagamento
        </button>

        <div className={matches ? styles.paymentSummaryOk : styles.paymentSummary}>
          {diff === 0
            ? `Os pagamentos informados somam R$ ${formatMoney(sum)}.`
            : diff > 0
              ? `Os pagamentos informados somam R$ ${formatMoney(sum)}. Ainda faltam R$ ${formatMoney(diff)}.`
              : `Os pagamentos informados somam R$ ${formatMoney(sum)}. Isso é R$ ${formatMoney(Math.abs(diff))} a mais que o valor do atendimento.`}
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.ghostBtn} onClick={onCancel} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.smallBtn}
            disabled={!matches}
            onClick={confirm}
            style={{ flex: 2, padding: "14px 12px" }}
          >
            {confirmLabel}
          </button>
        </div>
        {allowSkip ? (
          <button type="button" className={styles.paymentSkipBtn} onClick={skipForNow}>
            Não sei agora — registrar pagamento depois
          </button>
        ) : (
          <div style={{ color: "#B23B3B", fontWeight: 700, fontSize: 12.5, textAlign: "center" }}>
            Pagamento pendente — não dá pra finalizar sem registrar a forma de pagamento.
          </div>
        )}
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
  mergeIntoSingleSpace,
  setMergeIntoSingleSpace,
  spaceReady,
  clientName,
  setClientName,
  clientNameReady,
  phone,
  setPhone,
  clientPhoneReady,
  starting,
  spaces,
  now,
  onClose,
  onDecline,
  onWaitlist,
  onConfirmStart,
}: {
  entry: QueueEntry;
  step: "procedure" | "space" | "confirm" | "payment";
  setStep: (s: "procedure" | "space" | "confirm" | "payment") => void;
  procedureGroups: Record<string, ProcedureOption[]>;
  chosenProcedure: ProcedureOption | null;
  chosenProcedureId: string | null;
  selectProcedure: (id: string) => void;
  spaceOptionsByRequirement: SpacePanelView[][];
  chosenSpaceIds: (string | null)[];
  pickSpaceForRequirement: (index: number, spaceId: string) => void;
  /** Combo de 2+ trechos, cliente prefere ficar num espaço só (pedido do
   * usuário) — quando `true`, só o espaço do trecho 1 é enviado. */
  mergeIntoSingleSpace: boolean;
  setMergeIntoSingleSpace: (v: boolean) => void;
  spaceReady: boolean;
  /** Nome e telefone do paciente — pedidos junto com a escolha do espaço;
   * a partir daqui sempre cadastram/reaproveitam um `Client`. */
  clientName: string;
  setClientName: (v: string) => void;
  clientNameReady: boolean;
  phone: string;
  setPhone: (v: string) => void;
  clientPhoneReady: boolean;
  /** Trava o botão "Iniciar terapia" durante o envio — evita duplo clique e
   * (junto do `disabled`) garante que o clique nunca fique sem nenhum
   * retorno visível. */
  starting: boolean;
  spaces: SpacePanelView[];
  now: Date;
  onClose: () => void;
  onDecline: () => void;
  onWaitlist: () => void;
  onConfirmStart: (payments: PaymentAllocationInput[]) => void;
}) {
  const plannedEnd = chosenProcedure ? new Date(now.getTime() + chosenProcedure.durationMinutes * 60000) : null;

  // Combo de 2+ trechos: espaço escolhido pro trecho 1, candidato a "ficar
  // nele o atendimento todo" (pedido do usuário). `mergeSpaceAvailable` é
  // só uma dica visual — livre agora e sem reserva chegando antes do fim
  // da duração TOTAL do combo; o backend valida de verdade na hora de
  // confirmar (`StartTherapyUseCase`), então mesmo "não disponível" aqui
  // ainda deixa tentar.
  const mergeCandidate =
    chosenSpaceIds[0] != null
      ? (spaceOptionsByRequirement[0]?.find((s) => s.id === chosenSpaceIds[0]) ?? null)
      : null;
  const mergeSpaceAvailable =
    !!mergeCandidate &&
    mergeCandidate.state === "free" &&
    (!mergeCandidate.occupiesAt ||
      (remainingMinutes(mergeCandidate.occupiesAt, now) ?? 0) >=
        (chosenProcedure?.durationMinutes ?? 0));

  // Busca por código ou nome — filtra em tempo real conforme digita, sem
  // precisar rolar as categorias todas pra achar um procedimento
  // específico. Categoria some inteira se nenhum item dela bater.
  const [procedureSearch, setProcedureSearch] = useState("");
  const normalizedSearch = procedureSearch.trim().toLowerCase();
  const filteredProcedureGroups: Record<string, ProcedureOption[]> = normalizedSearch
    ? Object.fromEntries(
        Object.entries(procedureGroups)
          .map(([category, items]) => [
            category,
            items.filter(
              (p) =>
                p.name.toLowerCase().includes(normalizedSearch) ||
                p.code.toLowerCase().includes(normalizedSearch),
            ),
          ])
          .filter(([, items]) => (items as ProcedureOption[]).length > 0),
      )
    : procedureGroups;

  // Pagamento é ANTES de iniciar, pedido do usuário — passo extra só quando
  // o procedimento tem valor (reaproveita o mesmo `PaymentModal` do
  // "Finalizar", com rótulos diferentes). Continua opcional: "Não sei
  // agora" segue direto pro `onConfirmStart([])`, sem bloquear.
  if (step === "payment" && chosenProcedure) {
    return (
      <PaymentModal
        eyebrow="PAGAMENTO"
        title={entry.name}
        subtitle={clientName.trim() || "Cliente"}
        total={chosenProcedure.price}
        confirmLabel="Iniciar terapia"
        onCancel={() => setStep("confirm")}
        onConfirm={(payments) => onConfirmStart(payments)}
      />
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${step === "procedure" ? styles.modalWide : ""}`}>
        {step === "procedure" && (
          <>
            <div>
              <div className={styles.modalEyebrow}>ETAPA 1 DE 3 · COM {entry.name}</div>
              <div className={styles.modalTitle}>Qual procedimento o cliente deseja realizar?</div>
            </div>
            <input
              className={styles.fieldInput}
              placeholder="Buscar por código ou nome…"
              autoFocus
              value={procedureSearch}
              onChange={(e) => setProcedureSearch(e.target.value)}
            />
            {normalizedSearch && Object.keys(filteredProcedureGroups).length === 0 && (
              <span className={styles.rowMeta}>Nenhum procedimento encontrado.</span>
            )}
            <div className={styles.procedureGrid}>
              {Object.entries(filteredProcedureGroups).map(([category, items]) => (
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
              <div className={styles.modalEyebrow}>ETAPA 2 DE 3 · ESCOLHER ESPAÇO</div>
              <div className={styles.modalTitle}>
                {chosenProcedure.name} · {chosenProcedure.durationLabel}
              </div>
              <div className={styles.modalSub}>{chosenProcedure.typeLabel}</div>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>NOME DO PACIENTE</span>
              <input
                className={styles.fieldInput}
                placeholder="Digite o nome completo"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>TELEFONE DO PACIENTE</span>
              <input
                className={styles.fieldInput}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
              />
            </div>
            {chosenProcedure.spaceRequirements.map((req, i) => {
              // Combo mesclado num espaço só: some com os seletores dos
              // trechos seguintes — só o trecho 1 importa (pedido do
              // usuário: "1h na maca e depois 30min na poltrona, mas o
              // cliente pediu pra ficar na maca").
              if (mergeIntoSingleSpace && i > 0) return null;
              return (
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
              );
            })}
            {chosenProcedure.spaceRequirements.length > 1 && mergeCandidate && (
              <div
                className={styles.heroHint}
                style={{ borderColor: mergeIntoSingleSpace ? "#1E8A86" : "#c9a44c" }}
              >
                {mergeIntoSingleSpace ? (
                  <>
                    Vai ficar só na {mergeCandidate.name} o atendimento todo ({chosenProcedure.durationLabel}
                    ), sem passar pelos outros trechos.{" "}
                    <button type="button" className={styles.ghostBtn} onClick={() => setMergeIntoSingleSpace(false)}>
                      Usar espaços separados
                    </button>
                  </>
                ) : (
                  <>
                    {mergeSpaceAvailable
                      ? `A ${mergeCandidate.name} está livre pelo tempo todo — dá pra deixar o cliente nela o atendimento inteiro, sem trocar de espaço.`
                      : `A ${mergeCandidate.name} tem reserva chegando antes do fim do atendimento — ainda dá pra tentar, mas o painel pode recusar na hora de confirmar.`}
                    {" "}
                    <button type="button" className={styles.smallBtn} onClick={() => setMergeIntoSingleSpace(true)}>
                      Ficar só na {mergeCandidate.name} o atendimento todo
                    </button>
                  </>
                )}
              </div>
            )}
            {(spaceOptionsByRequirement[0]?.length ?? 0) > 0 &&
              spaceOptionsByRequirement[0]?.every((s) => s.state !== "free") && (
                <div className={styles.heroHint} style={{ borderColor: "#c9a44c" }}>
                  Nenhuma opção livre agora pro trecho 1 — em vez de esperar aqui, dá pra colocar
                  {" "}{clientName.trim() || "o cliente"} na fila de espera desse terapeuta: o painel
                  avisa sozinho quando liberar.
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
                disabled={!spaceReady || !clientNameReady || !clientPhoneReady}
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
              <div className={styles.modalEyebrow}>ETAPA 3 DE 3 · CONFIRMAR ATENDIMENTO</div>
              <div className={styles.modalTitle}>Iniciar terapia agora?</div>
            </div>
            <div className={styles.summaryGrid}>
              <SummaryField label="CLIENTE" value={`${clientName.trim() || "—"} · ${phone.trim() || "—"}`} />
              <SummaryField label="TERAPEUTA" value={entry.name} />
              <SummaryField label="PROCEDIMENTO" value={chosenProcedure.name} />
              <SummaryField
                label="ESPAÇO"
                value={
                  mergeIntoSingleSpace
                    ? `${mergeCandidate?.name ?? "—"} (atendimento todo)`
                    : chosenSpaceIds
                        .map((id, i) => spaceOptionsByRequirement[i]?.find((s) => s.id === id)?.name)
                        .filter(Boolean)
                        .join(" + ")
                }
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
              <button
                type="button"
                className={styles.smallBtn}
                style={{ flex: 2, padding: "14px 12px" }}
                disabled={starting}
                onClick={() =>
                  chosenProcedure.price > 0 ? setStep("payment") : onConfirmStart([])
                }
              >
                {starting ? "Iniciando…" : chosenProcedure.price > 0 ? "Ir para pagamento" : "Iniciar terapia"}
              </button>
            </div>
            {chosenProcedure.price > 0 && (
              <button
                type="button"
                className={styles.paymentSkipBtn}
                disabled={starting}
                onClick={() => onConfirmStart([])}
              >
                Iniciar sem pagar agora — registrar pagamento depois
              </button>
            )}
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
