// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
/**
 * Lógica PURA da agenda em grade (mês, semana e dia): intervalos, navegação,
 * quais eventos caem em cada dia e o posicionamento sem sobreposição. Tudo no
 * fuso do navegador (a pessoa vê a agenda no horário dela). A semana começa no
 * domingo, como no Google Agenda.
 */
import type { CalEvent } from "../types/event.ts";

export type GridView = "month" | "week" | "day";

const HOUR_MS = 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -d.getDay());
}

export interface ViewRange {
  /** Dias exibidos, em ordem (7 no semana, 42 no mês, 1 no dia). */
  days: Date[];
  from: Date;
  /** Exclusivo. */
  to: Date;
}

export function viewRange(view: GridView, anchor: Date): ViewRange {
  let first: Date;
  let count: number;
  if (view === "month") {
    first = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    count = 42;
  } else if (view === "week") {
    first = startOfWeek(anchor);
    count = 7;
  } else {
    first = startOfDay(anchor);
    count = 1;
  }
  const days = Array.from({ length: count }, (_, i) => addDays(first, i));
  return { days, from: first, to: addDays(first, count) };
}

/** Anterior/próximo: mês ±1 (sem estourar o dia), semana ±7, dia ±1. */
export function shiftAnchor(view: GridView, anchor: Date, direction: -1 | 1): Date {
  if (view === "month") {
    return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  }
  return addDays(anchor, view === "week" ? 7 * direction : direction);
}

const MONTH_LONG = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const DAY_LONG = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const MONTH_SHORT = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const monthShort = (d: Date) => MONTH_SHORT.format(d).replace(".", "");

export function viewTitle(view: GridView, anchor: Date): string {
  if (view === "month") return MONTH_LONG.format(anchor);
  if (view === "day") return DAY_LONG.format(anchor);
  const { days } = viewRange("week", anchor);
  const first = days[0] as Date;
  const last = days[6] as Date;
  const sameMonth = first.getMonth() === last.getMonth();
  const left = sameMonth ? String(first.getDate()) : `${first.getDate()} ${monthShort(first)}`;
  return `${left} – ${last.getDate()} ${monthShort(last)} ${last.getFullYear()}`;
}

export const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

// ---- eventos -------------------------------------------------------------------

export interface Span {
  start: Date;
  /** Exclusivo. */
  end: Date;
}

/** Intervalo do evento. Sem término = 1 hora (dia inteiro = 24 h). */
export function eventSpan(event: Pick<CalEvent, "at" | "endsAt" | "allDay">): Span {
  const start = new Date(event.at);
  const fallback = new Date(start.getTime() + (event.allDay ? 24 * HOUR_MS : HOUR_MS));
  const parsed = event.endsAt ? new Date(event.endsAt) : fallback;
  const end = Number.isNaN(parsed.getTime()) || parsed <= start ? fallback : parsed;
  return { start, end };
}

/** O evento toca este dia (qualquer minuto dentro dele)? */
export function overlapsDay(event: CalEvent, day: Date): boolean {
  const { start, end } = eventSpan(event);
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return start < dayEnd && end > dayStart;
}

export function eventsOnDay(events: CalEvent[], day: Date): CalEvent[] {
  return events
    .filter((e) => overlapsDay(e, day))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.title.localeCompare(b.title));
}

/** Vai para o cabeçalho "dia inteiro": marcado como dia inteiro ou que cobre o dia todo. */
export function isAllDayLike(event: CalEvent, day: Date): boolean {
  if (event.allDay) return true;
  const { start, end } = eventSpan(event);
  const dayStart = startOfDay(day);
  return start <= dayStart && end >= addDays(dayStart, 1);
}

export interface Positioned {
  event: CalEvent;
  /** Minutos desde 00:00 (já cortado no dia). */
  startMin: number;
  endMin: number;
  /** Coluna e total de colunas do grupo de eventos que se sobrepõem. */
  column: number;
  columns: number;
}

const MIN_DURATION = 25; // evento curto continua clicável

/** Posiciona os eventos COM HORA de um dia, dividindo a largura quando se sobrepõem. */
export function layoutDay(events: CalEvent[], day: Date): Positioned[] {
  const dayStart = startOfDay(day);
  const items = eventsOnDay(events, day)
    .filter((e) => !isAllDayLike(e, day))
    .map((event) => {
      const { start, end } = eventSpan(event);
      const startMin = Math.max(0, (start.getTime() - dayStart.getTime()) / 60000);
      const rawEnd = Math.min(1440, (end.getTime() - dayStart.getTime()) / 60000);
      return { event, startMin, endMin: Math.max(rawEnd, startMin + MIN_DURATION), column: 0, columns: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Grupos de eventos encadeados por sobreposição; cada grupo reparte as colunas.
  let group: Positioned[] = [];
  let groupEnd = -1;
  const flush = () => {
    const columnsEnd: number[] = [];
    for (const item of group) {
      let col = columnsEnd.findIndex((end) => end <= item.startMin);
      if (col === -1) col = columnsEnd.length;
      columnsEnd[col] = item.endMin;
      item.column = col;
    }
    for (const item of group) item.columns = columnsEnd.length;
    group = [];
    groupEnd = -1;
  };
  for (const item of items) {
    if (group.length > 0 && item.startMin >= groupEnd) flush();
    group.push(item);
    groupEnd = Math.max(groupEnd, item.endMin);
  }
  flush();
  return items;
}

export function minutesLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const DAY_FULL = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Quando acontece: "terça-feira, 13 de outubro de 2026 · 12:00 – 13:00" (ou "dia inteiro"). */
export function whenLabel(event: Pick<CalEvent, "at" | "endsAt" | "allDay">): string {
  const { start, end } = eventSpan(event);
  const day = DAY_FULL.format(start);
  if (event.allDay) return `${day} · dia inteiro`;
  const endIso = end.toISOString();
  return start.toDateString() === end.toDateString()
    ? `${day} · ${timeLabel(event.at)} – ${timeLabel(endIso)}`
    : `${day}, ${timeLabel(event.at)} → ${DAY_FULL.format(end)}, ${timeLabel(endIso)}`;
}
