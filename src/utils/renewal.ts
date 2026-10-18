// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { RenewalAlertMode } from "../types/client.ts";

/** "YYYY-MM-DD" de uma data local (sem passar por UTC — evita "voltar um dia" no fuso do Brasil). */
export function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
}

/** Soma meses preservando o dia quando possível (31/03 − 1 mês = 28/02; nunca transborda). Igual ao backend. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  const index = m - 1 + months;
  const year = y + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return toIsoDate(new Date(year, month, Math.min(d, lastDay)));
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  return toIsoDate(new Date(y, m - 1, d + days));
}

/** Dia a partir do qual a tarefa de renovação passa a existir — mesma regra do backend. */
export function renewalAlertDate(
  renewalIso: string,
  mode: RenewalAlertMode,
  value: number,
): string {
  if (mode === "month_start") return `${renewalIso.slice(0, 7)}-01`;
  if (mode === "days_before") return addDays(renewalIso, -value);
  return addMonths(renewalIso, -value);
}

/** Alerta padrão do tenant (regra `renewal`): `alert_mode` numérico 0/1/2. */
export const ALERT_MODE_BY_INDEX: readonly RenewalAlertMode[] = [
  "month_start",
  "days_before",
  "months_before",
];

export function alertModeFromIndex(index: number): RenewalAlertMode {
  return ALERT_MODE_BY_INDEX[index] ?? "month_start";
}

export function alertModeToIndex(mode: RenewalAlertMode): number {
  return Math.max(0, ALERT_MODE_BY_INDEX.indexOf(mode));
}

/** Texto curto da regra: "No 1º dia do mês da renovação", "15 dias antes", "1 mês antes". */
export function describeAlert(mode: RenewalAlertMode, value: number): string {
  if (mode === "month_start") return "No 1º dia do mês da renovação";
  if (mode === "days_before") {
    return value === 0 ? "No dia da renovação" : `${value} ${value === 1 ? "dia" : "dias"} antes`;
  }
  return value === 0 ? "No dia da renovação" : `${value} ${value === 1 ? "mês" : "meses"} antes`;
}

export type RenewalUrgency = "overdue" | "soon" | "ok";

/** Vencida; "em breve" = nos próximos 30 dias; senão "ok". Datas ISO (YYYY-MM-DD). */
export function renewalUrgency(renewalIso: string, todayIso: string): RenewalUrgency {
  if (renewalIso < todayIso) return "overdue";
  return renewalIso <= addDays(todayIso, 30) ? "soon" : "ok";
}

export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
