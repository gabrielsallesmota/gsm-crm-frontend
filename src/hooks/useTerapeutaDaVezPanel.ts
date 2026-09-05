import { useCallback, useEffect, useRef, useState } from "react";
import { terapeutaDaVezPanelService } from "../services/TerapeutaDaVezPanelService";
import type {
  AttendanceRecord,
  CreateReturnReservationInput,
  CreateWaitlistEntryInput,
  PanelState,
  PaymentAllocationInput,
  ReturnReservation,
  Shift,
  Therapist,
  WaitlistEntry,
} from "../types/operations";

const POLL_MS = 3000;
const CLOCK_MS = 1000;
// Pequena folga depois do instante calculado da transição, garantindo que o
// `now` do SERVIDOR já passou daquele instante antes do poll extra chegar lá
// (evita pedir de novo um pouquinho cedo demais e receber o mesmo estado
// "ainda não mudou").
const TRANSITION_BUFFER_MS = 250;

export interface TerapeutaDaVezPanel {
  state: PanelState | null;
  loading: boolean;
  error: Error | null;
  /** Relógio local, atualizado a cada segundo — usado pra recalcular "faltam
   * X min"/"libera às" sem precisar re-buscar o painel a cada tick (só o
   * `state` em si vem do polling de `POLL_MS` em `POLL_MS`). */
  now: Date;
  call: (therapistId: string) => Promise<AttendanceRecord>;
  decline: (attendanceId: string) => Promise<AttendanceRecord>;
  start: (
    attendanceId: string,
    procedureId: string,
    spaceIds: string[],
    clientName: string,
    phone: string,
    payments?: PaymentAllocationInput[],
  ) => Promise<AttendanceRecord>;
  finish: (
    attendanceId: string,
    awardPoints: boolean,
    payments?: PaymentAllocationInput[],
  ) => Promise<AttendanceRecord>;
  /** "Iniciar turno" — sem `checkOut`: não existe Saída manual (questão
   * trabalhista, terapeutas são PJ). A presença termina sozinha quando a
   * janela do turno passa. */
  checkIn: (therapistId: string, shift?: Shift) => Promise<Therapist>;
  /** Pausa manual (ex.: foi almoçar) — sem limite de tempo, nunca vira
   * histórico/jornada. Bloqueada enquanto o terapeuta está em atendimento. */
  pause: (therapistId: string) => Promise<Therapist>;
  /** Volta da pausa. */
  resume: (therapistId: string) => Promise<Therapist>;
  /** Botão pequeno "Liberar" ao lado de um espaço em higienização. */
  releaseCleaning: (spaceId: string) => Promise<void>;
  /** "Colocar na fila de espera" — terapeuta específico, livre, mas o
   * espaço que o procedimento precisa não está. */
  createWaitlistEntry: (input: CreateWaitlistEntryInput) => Promise<WaitlistEntry>;
  confirmWaitlistEntry: (entryId: string) => Promise<AttendanceRecord>;
  cancelWaitlistEntry: (entryId: string) => Promise<void>;
  /** "Volta mais tarde" rápida — mostrada no painel principal (sidebar),
   * por isso passa pelo hook (igual fila de espera) em vez de ir direto
   * pelo repository como Escala/Histórico. */
  createReturnReservation: (input: CreateReturnReservationInput) => Promise<ReturnReservation>;
  resolveReturnReservation: (reservationId: string) => Promise<void>;
}

/** Próximo instante em que ALGUMA coisa do painel muda sozinha, sem clique
 * de ninguém: loja abrindo, espaço liberando (fim de higienização ou de
 * trecho), espaço prestes a ser ocupado por um trecho futuro reservado, ou
 * um atendimento em terapia batendo o horário previsto (libera terapeuta e
 * espaço — ver sweep automático no backend). `null` quando não há nenhuma
 * transição conhecida pela frente. */
function nextTransitionAt(state: PanelState): number | null {
  const candidates: string[] = [];
  if (state.nextOpenAt) candidates.push(state.nextOpenAt);
  for (const s of state.spaces) {
    if (s.availableAt) candidates.push(s.availableAt);
    if (s.occupiesAt) candidates.push(s.occupiesAt);
  }
  for (const q of state.queue) {
    if (q.plannedEndAt) candidates.push(q.plannedEndAt);
  }
  for (const w of state.waitlist) {
    if (w.availableAt) candidates.push(w.availableAt);
  }
  for (const r of state.returnReservations) {
    candidates.push(r.returnAt);
  }
  if (candidates.length === 0) return null;
  return Math.min(...candidates.map((iso) => new Date(iso).getTime()));
}

export function useTerapeutaDaVezPanel(): TerapeutaDaVezPanel {
  const [state, setState] = useState<PanelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [now, setNow] = useState(() => new Date());
  const mounted = useRef(true);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const next = await terapeutaDaVezPanelService.getState();
      if (mounted.current) {
        setState(next);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  // Agenda (ou reagenda) um poll extra bem em cima da próxima transição
  // conhecida — sem isto, uma mudança automática (loja abrir, procedimento
  // terminar) só refletia na tela na próxima batida do polling de 3s em 3s,
  // até 3s de atraso. Roda de novo a cada `state` novo (poll normal OU
  // resposta de uma ação), porque cada um pode trazer uma transição
  // diferente (ex.: iniciar terapia cria um `plannedEndAt` novo).
  useEffect(() => {
    if (transitionTimer.current !== null) {
      clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
    if (!state) return;
    const at = nextTransitionAt(state);
    if (at === null) return;
    const delay = Math.max(0, at - Date.now()) + TRANSITION_BUFFER_MS;
    transitionTimer.current = setTimeout(() => void poll(), delay);
    return () => {
      if (transitionTimer.current !== null) clearTimeout(transitionTimer.current);
    };
  }, [state, poll]);

  useEffect(() => {
    mounted.current = true;
    void poll();
    const pollId = setInterval(() => void poll(), POLL_MS);
    const clockId = setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => {
      mounted.current = false;
      clearInterval(pollId);
      clearInterval(clockId);
    };
  }, [poll]);

  async function call(therapistId: string) {
    const result = await terapeutaDaVezPanelService.call(therapistId);
    setState(result.state);
    return result.attendance;
  }

  async function decline(attendanceId: string) {
    const result = await terapeutaDaVezPanelService.decline(attendanceId);
    setState(result.state);
    return result.attendance;
  }

  async function start(
    attendanceId: string,
    procedureId: string,
    spaceIds: string[],
    clientName: string,
    phone: string,
    payments: PaymentAllocationInput[] = [],
  ) {
    const result = await terapeutaDaVezPanelService.start(
      attendanceId,
      procedureId,
      spaceIds,
      clientName,
      phone,
      payments,
    );
    setState(result.state);
    return result.attendance;
  }

  async function finish(
    attendanceId: string,
    awardPoints: boolean,
    payments: PaymentAllocationInput[] = [],
  ) {
    const result = await terapeutaDaVezPanelService.finish(attendanceId, awardPoints, payments);
    setState(result.state);
    return result.attendance;
  }

  async function checkIn(therapistId: string, shift?: Shift) {
    const result = await terapeutaDaVezPanelService.checkIn(therapistId, shift);
    setState(result.state);
    return result.therapist;
  }

  async function pause(therapistId: string) {
    const result = await terapeutaDaVezPanelService.pause(therapistId);
    setState(result.state);
    return result.therapist;
  }

  async function resume(therapistId: string) {
    const result = await terapeutaDaVezPanelService.resume(therapistId);
    setState(result.state);
    return result.therapist;
  }

  async function releaseCleaning(spaceId: string) {
    const next = await terapeutaDaVezPanelService.releaseCleaning(spaceId);
    setState(next);
  }

  async function createWaitlistEntry(input: CreateWaitlistEntryInput) {
    const result = await terapeutaDaVezPanelService.createWaitlistEntry(input);
    setState(result.state);
    return result.entry;
  }

  async function confirmWaitlistEntry(entryId: string) {
    const result = await terapeutaDaVezPanelService.confirmWaitlistEntry(entryId);
    setState(result.state);
    return result.attendance;
  }

  async function cancelWaitlistEntry(entryId: string) {
    const next = await terapeutaDaVezPanelService.cancelWaitlistEntry(entryId);
    setState(next);
  }

  async function createReturnReservation(input: CreateReturnReservationInput) {
    const result = await terapeutaDaVezPanelService.createReturnReservation(input);
    setState(result.state);
    return result.reservation;
  }

  async function resolveReturnReservation(reservationId: string) {
    const next = await terapeutaDaVezPanelService.resolveReturnReservation(reservationId);
    setState(next);
  }

  return {
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
  };
}
