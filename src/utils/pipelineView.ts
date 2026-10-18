// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { PipelineStage } from "../types/pipeline.ts";
import {
  EMPTY_PERIOD,
  last7DaysPeriod,
  lastMonthPeriod,
  thisMonthPeriod,
  todayPeriod,
  type Period,
} from "./periods.ts";
import type { BoardColumn, BoardState } from "./pipelineBoard.ts";

/**
 * Regras de APRESENTAÇÃO do quadro (Prompt 06) — puras e testadas em `tests/pipelineView.test.ts`.
 *
 * Princípio: nenhum número aqui é "calculado sobre a página carregada e apresentado como total".
 * Contagens usam o `total` REAL devolvido pelo servidor por etapa; valores em R$ só existem quando a
 * coluna está INTEIRA no navegador (`items.length === total`) — senão são `null` e a tela omite.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LeadAge {
  /** Texto curto do cartão ("hoje", "3 d", "2 sem"). */
  short: string;
  /** Frase para leitor de tela e tooltip ("Criado há 3 dias"). */
  long: string;
  /** Data absoluta ("Criado em 10/10/2026"). */
  title: string;
}

/** Idade desde a CRIAÇÃO do lead (dado existente; nada a ver com "última interação" — D-01). */
export function leadAge(createdAtIso: string, now: Date = new Date()): LeadAge {
  const created = new Date(createdAtIso);
  const absolute = Number.isNaN(created.getTime())
    ? ""
    : `Criado em ${created.toLocaleDateString("pt-BR")}`;
  if (Number.isNaN(created.getTime())) return { short: "", long: "", title: "" };
  const days = Math.max(0, Math.floor((now.getTime() - created.getTime()) / DAY_MS));
  if (days < 1) return { short: "hoje", long: "Criado hoje", title: absolute };
  if (days < 7) return { short: `${days} d`, long: `Criado há ${days} ${days === 1 ? "dia" : "dias"}`, title: absolute };
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return { short: `${weeks} sem`, long: `Criado há ${weeks} ${weeks === 1 ? "semana" : "semanas"}`, title: absolute };
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return { short: `${months} m`, long: `Criado há ${months} ${months === 1 ? "mês" : "meses"}`, title: absolute };
  }
  const years = Math.floor(days / 365);
  return { short: `${years} a`, long: `Criado há ${years} ${years === 1 ? "ano" : "anos"}`, title: absolute };
}

const PRESET_LABELS: [string, () => Period][] = [
  ["Hoje", todayPeriod],
  ["7 dias", last7DaysPeriod],
  ["Este mês", thisMonthPeriod],
  ["Mês passado", lastMonthPeriod],
];

function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return month && day ? `${day}/${month}` : iso;
}

/** Rótulo do período ativo para o chip; `null` = sem filtro. Sempre sobre a data de CRIAÇÃO. */
export function describePeriod(period: Period): string | null {
  if (!period.dateFrom && !period.dateTo) return null;
  for (const [label, make] of PRESET_LABELS) {
    const preset = make();
    if (preset.dateFrom === period.dateFrom && preset.dateTo === period.dateTo) return label;
  }
  if (period.dateFrom && period.dateTo) return `${shortDate(period.dateFrom)} – ${shortDate(period.dateTo)}`;
  if (period.dateFrom) return `desde ${shortDate(period.dateFrom)}`;
  return `até ${shortDate(period.dateTo as string)}`;
}

export function isEmptyPeriod(period: Period): boolean {
  return !period.dateFrom && !period.dateTo && JSON.stringify(period) === JSON.stringify(EMPTY_PERIOD);
}

export interface FilterChipModel {
  key: "search" | "owner" | "period" | "sort";
  /** "Responsável" · "Criados em" · … */
  group: string;
  value: string;
}

export function filterChips(input: {
  search: string;
  ownerLabel: string | null;
  period: Period;
  sortLabel: string | null;
}): FilterChipModel[] {
  const chips: FilterChipModel[] = [];
  if (input.search) chips.push({ key: "search", group: "Busca", value: input.search });
  if (input.ownerLabel) chips.push({ key: "owner", group: "Responsável", value: input.ownerLabel });
  const period = describePeriod(input.period);
  if (period) chips.push({ key: "period", group: "Criados em", value: period });
  if (input.sortLabel) chips.push({ key: "sort", group: "Ordem", value: input.sortLabel });
  return chips;
}

/** Soma de valores de uma coluna — só se ela está INTEIRA no navegador; senão `null` (não inventa total). */
export function columnValue(column: BoardColumn | undefined): number | null {
  if (!column || column.page === 0 || column.loading || column.error) return null;
  if (column.items.length !== column.total) return null;
  return column.items.reduce((sum, lead) => sum + (lead.value || 0), 0);
}

export interface BoardSummary {
  /** Todas as colunas já têm a 1ª página (totais confiáveis). */
  ready: boolean;
  /** Σ dos `total` reais de todas as etapas. */
  total: number;
  /** Σ dos `total` das etapas que não são ganho nem perda. */
  open: number;
  /** Valor das oportunidades em andamento — só quando TODAS as etapas abertas estão inteiras; senão `null`. */
  openValue: number | null;
}

export function boardSummary(stages: PipelineStage[], board: BoardState): BoardSummary {
  const columns = stages.map((s) => ({ stage: s, column: board[s.id] }));
  const ready = columns.length > 0 && columns.every(({ column }) => column && column.page > 0 && !column.error);
  if (!ready) return { ready: false, total: 0, open: 0, openValue: null };
  let total = 0;
  let open = 0;
  let openValue: number | null = 0;
  for (const { stage, column } of columns) {
    const c = column as BoardColumn;
    total += c.total;
    if (stage.isWon || stage.isLost) continue;
    open += c.total;
    const value = columnValue(c);
    openValue = openValue === null || value === null ? null : openValue + value;
  }
  return { ready: true, total, open, openValue };
}
