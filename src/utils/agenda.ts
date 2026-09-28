// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { CalEvent, CalendarRange } from "../types/event.ts";

export type AgendaWindow = "next7" | "next30" | "past30";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Janela [from, to) em ISO UTC, com limites na meia-noite LOCAL. */
export function agendaRange(window: AgendaWindow, now: Date): CalendarRange {
  const today = startOfLocalDay(now);
  if (window === "past30") {
    return { from: addDays(today, -30).toISOString(), to: addDays(today, 1).toISOString() };
  }
  const days = window === "next30" ? 30 : 7;
  return { from: today.toISOString(), to: addDays(today, days).toISOString() };
}

/** "YYYY-MM-DD" do dia LOCAL (antes o agrupamento usava `at.slice(0, 10)` —
 * o dia em UTC: um compromisso às 22h em São Paulo caía no dia seguinte). */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface AgendaDay {
  key: string;
  label: string;
  date: string;
  events: CalEvent[];
}

export function groupEventsByLocalDay(events: CalEvent[], now: Date = new Date()): AgendaDay[] {
  const todayKey = localDayKey(now.toISOString());
  const tomorrowKey = localDayKey(addDays(startOfLocalDay(now), 1).toISOString());
  const yesterdayKey = localDayKey(addDays(startOfLocalDay(now), -1).toISOString());
  const groups = new Map<string, AgendaDay>();
  for (const event of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    const key = localDayKey(event.at);
    let group = groups.get(key);
    if (!group) {
      const d = new Date(event.at);
      group = {
        key,
        label:
          key === todayKey
            ? "Hoje"
            : key === tomorrowKey
              ? "Amanhã"
              : key === yesterdayKey
                ? "Ontem"
                : d.toLocaleDateString("pt-BR", { weekday: "long" }),
        date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        events: [],
      };
      groups.set(key, group);
    }
    group.events.push(event);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}
