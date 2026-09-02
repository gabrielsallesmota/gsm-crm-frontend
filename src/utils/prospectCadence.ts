import type { ProspectStage } from "../types/prospect";

/**
 * Mesmo algoritmo do backend (`domain/services.py::add_business_days` +
 * `compute_stage_target_date`) reimplementado aqui só pra decidir, no
 * FRONTEND, se um move vai ter a data alvo calculada automaticamente —
 * evita perguntar a data manualmente (`TargetDatePrompt` em
 * `ProspectionBoard.tsx`) quando o backend vai ignorar essa resposta e
 * recalcular sozinho de qualquer jeito (`MoveProspectUseCase` sempre dá
 * prioridade à cadência quando o caminho está configurado). O backend
 * continua sendo a fonte da verdade — se os dois cálculos um dia
 * divergirem, o valor salvo é sempre o de lá.
 */

// (mês 1-indexado, dia) — mesma lista de `_BR_FIXED_HOLIDAYS` no backend.
const BR_FIXED_HOLIDAYS: [number, number][] = [
  [1, 1],
  [4, 21],
  [5, 1],
  [9, 7],
  [10, 12],
  [11, 2],
  [11, 15],
  [11, 20],
  [12, 25],
];

function toIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIso(iso: string): Date {
  const parts = iso.split("-").map(Number);
  const [year, month, day] = [parts[0] ?? 0, parts[1] ?? 1, parts[2] ?? 1];
  return new Date(Date.UTC(year, month - 1, day));
}

/** Domingo de Páscoa via Meeus/Jones/Butcher — mesma fórmula do backend
 * (`_easter_sunday`), única data móvel entre os feriados nacionais oficiais. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const n = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * n) / 451);
  const month = Math.floor((h + n - 7 * m + 114) / 31);
  const day = ((h + n - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function brNationalHolidays(year: number): Set<string> {
  const fixed = BR_FIXED_HOLIDAYS.map(([month, day]) => toIso(new Date(Date.UTC(year, month - 1, day))));
  const goodFriday = new Date(easterSunday(year).getTime() - 2 * 86_400_000);
  return new Set([...fixed, toIso(goodFriday)]);
}

/** Soma `businessDays` dias ÚTEIS a `startIso` ("YYYY-MM-DD"), pulando
 * sábado/domingo e feriados nacionais brasileiros — ver `add_business_days`
 * no backend (fonte da verdade; este é só um espelho pra UX). */
export function addBusinessDays(startIso: string, businessDays: number): string {
  if (businessDays <= 0) return startIso;
  let current = parseIso(startIso);
  let remaining = businessDays;
  const holidaysByYear = new Map<number, Set<string>>();
  while (remaining > 0) {
    current = new Date(current.getTime() + 86_400_000);
    const year = current.getUTCFullYear();
    let holidays = holidaysByYear.get(year);
    if (!holidays) {
      holidays = brNationalHolidays(year);
      holidaysByYear.set(year, holidays);
    }
    const weekday = current.getUTCDay(); // 0 = domingo, 6 = sábado
    if (weekday !== 0 && weekday !== 6 && !holidays.has(toIso(current))) {
      remaining -= 1;
    }
  }
  return toIso(current);
}

/** Espelha `compute_stage_target_date` do backend — ver docstring lá.
 * `null` sempre que o backend também devolveria `null` (sem âncora, ou
 * cadência não cobre todo o caminho até `stageId`), sinalizando que esse
 * move ainda depende do fluxo manual (`ProspectStage.asksTargetDate`). */
export function computeStageTargetDate(
  stagesInOrder: ProspectStage[],
  stageId: string,
  initialContactDate: string | null,
): string | null {
  if (!initialContactDate || stagesInOrder.length === 0) return null;
  const ordered = [...stagesInOrder].sort((a, b) => a.order - b.order);
  if (ordered[0]?.id === stageId) return initialContactDate;

  let cumulativeDays = 0;
  for (const stage of ordered.slice(1)) {
    if (stage.followupBusinessDays == null) return null;
    cumulativeDays += stage.followupBusinessDays;
    if (stage.id === stageId) return addBusinessDays(initialContactDate, cumulativeDays);
  }
  return null;
}
