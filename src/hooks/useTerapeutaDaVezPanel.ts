import { useCallback, useEffect, useRef, useState } from "react";
import { terapeutaDaVezPanelService } from "../services/TerapeutaDaVezPanelService";
import type { AttendanceRecord, PanelState, Shift, Therapist } from "../types/operations";

const POLL_MS = 3000;
const CLOCK_MS = 1000;

export interface TerapeutaDaVezPanel {
  state: PanelState | null;
  loading: boolean;
  error: Error | null;
  /** Relógio local, atualizado a cada segundo — usado pra recalcular "faltam
   * X min"/"libera às" sem precisar re-buscar o painel a cada tick (só o
   * `state` em si vem do polling de `POLL_MS` em `POLL_MS`). */
  now: Date;
  call: (therapistId: string, clientName: string, phone: string) => Promise<AttendanceRecord>;
  decline: (attendanceId: string) => Promise<AttendanceRecord>;
  start: (attendanceId: string, procedureId: string, spaceIds: string[]) => Promise<AttendanceRecord>;
  finish: (attendanceId: string, awardPoints: boolean) => Promise<AttendanceRecord>;
  checkIn: (therapistId: string, shift?: Shift) => Promise<Therapist>;
  checkOut: (therapistId: string) => Promise<Therapist>;
}

export function useTerapeutaDaVezPanel(): TerapeutaDaVezPanel {
  const [state, setState] = useState<PanelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [now, setNow] = useState(() => new Date());
  const mounted = useRef(true);

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

  async function call(therapistId: string, clientName: string, phone: string) {
    const result = await terapeutaDaVezPanelService.call(therapistId, clientName, phone);
    setState(result.state);
    return result.attendance;
  }

  async function decline(attendanceId: string) {
    const result = await terapeutaDaVezPanelService.decline(attendanceId);
    setState(result.state);
    return result.attendance;
  }

  async function start(attendanceId: string, procedureId: string, spaceIds: string[]) {
    const result = await terapeutaDaVezPanelService.start(attendanceId, procedureId, spaceIds);
    setState(result.state);
    return result.attendance;
  }

  async function finish(attendanceId: string, awardPoints: boolean) {
    const result = await terapeutaDaVezPanelService.finish(attendanceId, awardPoints);
    setState(result.state);
    return result.attendance;
  }

  async function checkIn(therapistId: string, shift?: Shift) {
    const result = await terapeutaDaVezPanelService.checkIn(therapistId, shift);
    setState(result.state);
    return result.therapist;
  }

  async function checkOut(therapistId: string) {
    const result = await terapeutaDaVezPanelService.checkOut(therapistId);
    setState(result.state);
    return result.therapist;
  }

  return { state, loading, error, now, call, decline, start, finish, checkIn, checkOut };
}
