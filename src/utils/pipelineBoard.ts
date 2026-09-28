// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { Lead } from "../types/lead.ts";
import type { PipelineStage } from "../types/pipeline.ts";

/**
 * Estado do quadro Kanban (Etapa 1) — uma coluna por etapa REAL, cada uma
 * paginada no backend (`GET /leads?stage_id=...&page=N`). Nada de "buscar
 * 200 e filtrar no cliente": o total de cada coluna é o `total` real da API.
 * Funções puras, testadas em `tests/pipelineBoard.test.ts`.
 */
export interface BoardColumn {
  items: Lead[];
  /** Total REAL da etapa no backend (com os filtros aplicados). */
  total: number;
  /** Última página carregada (0 = nada carregado ainda). */
  page: number;
  loading: boolean;
  error: string | null;
}

export type BoardState = Record<string, BoardColumn>;

export const BOARD_PAGE_SIZE = 25;

export function emptyColumn(): BoardColumn {
  return { items: [], total: 0, page: 0, loading: true, error: null };
}

export function initialBoard(stages: PipelineStage[]): BoardState {
  return Object.fromEntries(stages.map((s) => [s.id, emptyColumn()]));
}

/** Página N da coluna chegou. Página 1 substitui; as seguintes acumulam
 * (sem duplicar um lead que um movimento otimista já colocou ali). */
export function applyColumnPage(
  board: BoardState,
  stageId: string,
  page: number,
  items: Lead[],
  total: number,
): BoardState {
  const current = board[stageId] ?? emptyColumn();
  const base = page === 1 ? [] : current.items;
  const seen = new Set(base.map((l) => l.id));
  return {
    ...board,
    [stageId]: {
      items: [...base, ...items.filter((l) => !seen.has(l.id))],
      total,
      page,
      loading: false,
      error: null,
    },
  };
}

export function hasMore(column: BoardColumn): boolean {
  return column.items.length < column.total;
}

export function findLead(board: BoardState, leadId: string): Lead | null {
  for (const column of Object.values(board)) {
    const lead = column.items.find((l) => l.id === leadId);
    if (lead) return lead;
  }
  return null;
}

/**
 * Movimento OTIMISTA: tira o card da coluna de origem e põe no topo da de
 * destino (totais ajustados). Devolve o estado novo — o chamador guarda o
 * anterior para `rollback` se a API recusar. Mesma etapa = sem mudança.
 */
export function moveLeadOptimistic(
  board: BoardState,
  leadId: string,
  toStageId: string,
): BoardState {
  const lead = findLead(board, leadId);
  const target = board[toStageId];
  if (!lead || !target || lead.stageId === toStageId) return board;
  const source = board[lead.stageId];
  const next: BoardState = { ...board };
  if (source) {
    next[lead.stageId] = {
      ...source,
      items: source.items.filter((l) => l.id !== leadId),
      total: Math.max(0, source.total - 1),
    };
  }
  next[toStageId] = {
    ...target,
    items: [{ ...lead, stageId: toStageId }, ...target.items.filter((l) => l.id !== leadId)],
    total: target.total + 1,
  };
  return next;
}

/** Resposta da API para um lead (movido/editado): troca a cópia local pela
 * do servidor, na coluna da etapa que o SERVIDOR diz. */
export function replaceLead(board: BoardState, lead: Lead): BoardState {
  const current = findLead(board, lead.id);
  let next = board;
  if (current && current.stageId !== lead.stageId) {
    next = moveLeadOptimistic(board, lead.id, lead.stageId);
  }
  const column = next[lead.stageId];
  if (!column) return next;
  return {
    ...next,
    [lead.stageId]: {
      ...column,
      items: column.items.map((l) => (l.id === lead.id ? lead : l)),
    },
  };
}

/** Nova ordem de ids após arrastar `draggedId` para a posição de `targetId`. */
export function reorderIds(ids: string[], draggedId: string, targetId: string): string[] | null {
  if (draggedId === targetId) return null;
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1) return null;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, draggedId);
  return next;
}
