// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { EntryKind, FinCategory, FinanceDashboard, Totals } from "../types/finance.ts";

/** Centavos → "R$ 1.234,56" (negativo: "-R$ 1.234,56"). */
export function formatCents(cents: number): string {
  const abs = Math.abs(cents) / 100;
  const text = abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? "-" : ""}R$ ${text}`;
}

/** Versão curta para eixos de gráfico: 1,2 mil · 3,4 mi. */
export function compactCents(cents: number): string {
  const v = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  if (v >= 1_000_000) return `${sign}${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (v >= 1_000) return `${sign}${(v / 1_000).toFixed(1).replace(".", ",")} mil`;
  return `${sign}${Math.round(v)}`;
}

/** "1.234,56" / "1234,5" / "R$ 12" → centavos (0 se não der para entender). */
export function parseMoneyToCents(text: string): number {
  const cleaned = text.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);
  // um único separador seguido de 1–2 dígitos é decimal; senão é milhar
  const digitsAfter = decimalAt >= 0 ? cleaned.length - decimalAt - 1 : 0;
  const isDecimal = decimalAt >= 0 && digitsAfter > 0 && digitsAfter <= 2;
  const normalized = isDecimal
    ? `${cleaned.slice(0, decimalAt).replace(/[.,]/g, "")}.${cleaned.slice(decimalAt + 1)}`
    : cleaned.replace(/[.,]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Variação em relação ao período anterior: `null` quando não há base de comparação. */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatDelta(pct: number | null): string {
  if (pct === null) return "—";
  const rounded = Math.round(pct);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/** "2031-03" → "mar/31" (rótulo curto de eixo). */
export function monthLabel(month: string): string {
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = month.split("-");
  return `${names[Number(m) - 1] ?? "?"}/${(y ?? "").slice(2)}`;
}

/** "2031-03" → "março de 2031". */
export function monthTitle(month: string): string {
  const names = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const [y, m] = month.split("-");
  return `${names[Number(m) - 1] ?? "?"} de ${y}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = (y ?? 1970) * 12 + ((m ?? 1) - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Altura (0–1) de uma barra dentro do maior valor do gráfico. */
export function barRatio(value: number, max: number): number {
  return max <= 0 ? 0 : Math.min(1, Math.abs(value) / max);
}

export function seriesMax(series: Totals[]): number {
  return series.reduce((acc, s) => Math.max(acc, s.income, s.expense, Math.abs(s.result)), 0);
}

/** Cor do gasto vs orçamento: dentro, perto do limite (≥ 80%) ou estourado. */
export function budgetTone(used: number | null): "none" | "ok" | "warn" | "over" {
  if (used === null) return "none";
  if (used > 1) return "over";
  return used >= 0.8 ? "warn" : "ok";
}

/** O painel tem algum lançamento no mês? (decide entre o painel e o estado vazio) */
export function dashboardIsEmpty(d: FinanceDashboard): boolean {
  return d.kpis.income === 0 && d.kpis.expense === 0 && d.pending.upcoming.length === 0;
}

/** Categoria vale para o tipo e o perfil escolhidos? (mesma regra do servidor) */
export function categoryFits(c: FinCategory, kind: EntryKind, profileId: string): boolean {
  return !c.archived && c.kind === kind && c.profileId === profileId;
}

/** Mesmas regras do servidor, para o erro aparecer antes de enviar. */
export function validateEntryDraft(d: {
  description: string;
  amount: number;
  entryDate: string;
  dueDate: string;
  paid: boolean;
  paidAt: string;
}): string | null {
  if (!d.description.trim()) return "Informe a descrição.";
  if (!(d.amount > 0)) return "O valor precisa ser maior que zero.";
  if (!d.entryDate) return "Informe a data do lançamento.";
  if (d.dueDate && d.dueDate < d.entryDate) return "O vencimento não pode ser antes da data do lançamento.";
  if (d.paid && !d.paidAt) return "Informe a data da baixa.";
  if (d.paid && d.paidAt < d.entryDate) return "A baixa não pode ser antes da data do lançamento.";
  return null;
}

/** "AAAA-MM" da fatura que recebe uma compra (mesma regra do servidor). */
export function invoiceRefOf(purchaseIso: string, closingDay: number): string {
  const month = purchaseIso.slice(0, 7);
  const day = Number(purchaseIso.slice(8, 10));
  return day <= closingDay ? month : shiftMonth(month, 1);
}

/** Vencimento da fatura `ref` (fecha em `closingDay`, vence em `dueDay`). */
export function invoiceDueDate(ref: string, closingDay: number, dueDay: number): string {
  const month = dueDay > closingDay ? ref : shiftMonth(ref, 1);
  return `${month}-${String(dueDay).padStart(2, "0")}`;
}

/** Vencimento da fatura em que uma compra cai. */
export function purchaseDueDate(purchaseIso: string, closingDay: number, dueDay: number): string {
  return invoiceDueDate(invoiceRefOf(purchaseIso, closingDay), closingDay, dueDay);
}

/** Percentual do limite comprometido (0–1+); `null` sem limite. */
export function limitUsage(usedCents: number, limitCents: number | null): number | null {
  return limitCents && limitCents > 0 ? usedCents / limitCents : null;
}
