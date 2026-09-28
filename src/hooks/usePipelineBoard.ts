import { useCallback, useEffect, useRef, useState } from "react";
import { leadsService } from "../services/LeadsService";
import type { Lead, LeadListFilter } from "../types/lead";
import type { PipelineStage } from "../types/pipeline";
import {
  BOARD_PAGE_SIZE,
  applyColumnPage,
  emptyColumn,
  findLead,
  initialBoard,
  moveLeadOptimistic,
  replaceLead,
  type BoardState,
} from "../utils/pipelineBoard";
import { describeError } from "../utils/apiErrors";
import { useAuth } from "./useAuth";

export type BoardFilter = Omit<LeadListFilter, "stageId" | "page" | "pageSize" | "pipelineId">;

export type MoveResult =
  | { ok: true; lead: Lead }
  | { ok: false; reason: "busy" | "noop" }
  | { ok: false; reason: "error"; error: unknown };

export interface PipelineBoard {
  board: BoardState;
  loadMore(stageId: string): void;
  /** Movimento otimista com rollback. Um lead só tem UM movimento em voo
   * por vez (evita a corrida "arrastei duas vezes rápido"). */
  move(leadId: string, toStageId: string): Promise<MoveResult>;
  /** Troca a cópia local por uma versão vinda do servidor (ex.: drawer). */
  applyLead(lead: Lead): void;
  isMoving(leadId: string): boolean;
  reload(): void;
}

/**
 * Quadro Kanban sobre as etapas REAIS: uma consulta paginada por etapa
 * (`stage_id` + `page`), "carregar mais" por coluna. Respostas de uma
 * geração antiga de filtros são descartadas (troca rápida de filtro não
 * mistura resultados).
 */
export function usePipelineBoard(
  pipelineId: string | null,
  stages: PipelineStage[],
  filter: BoardFilter,
): PipelineBoard {
  const { currentTenantId } = useAuth();
  const [board, setBoard] = useState<BoardState>(() => initialBoard(stages));
  const [tick, setTick] = useState(0);
  const [moving, setMoving] = useState<ReadonlySet<string>>(new Set());
  const generation = useRef(0);
  const boardRef = useRef(board);
  boardRef.current = board;
  const movingRef = useRef(new Set<string>());
  const stageKey = stages.map((s) => s.id).join(",");
  const filterKey = JSON.stringify(filter);

  const loadPage = useCallback(
    async (stageId: string, page: number, gen: number) => {
      if (!pipelineId) return;
      setBoard((b) => {
        const column = b[stageId];
        return column ? { ...b, [stageId]: { ...column, loading: true, error: null } } : b;
      });
      try {
        const result = await leadsService.list({
          ...(JSON.parse(filterKey) as BoardFilter),
          pipelineId,
          stageId,
          page,
          pageSize: BOARD_PAGE_SIZE,
        });
        if (gen !== generation.current) return;
        setBoard((b) => applyColumnPage(b, stageId, page, result.items, result.total));
      } catch (err) {
        if (gen !== generation.current) return;
        setBoard((b) => {
          const column = b[stageId];
          if (!column) return b;
          return {
            ...b,
            [stageId]: {
              ...column,
              loading: false,
              error: describeError(err, "Não foi possível carregar esta etapa."),
            },
          };
        });
      }
    },
    [pipelineId, filterKey],
  );

  useEffect(() => {
    const gen = ++generation.current;
    const ids = stageKey ? stageKey.split(",") : [];
    setBoard(Object.fromEntries(ids.map((id) => [id, emptyColumn()])));
    for (const id of ids) void loadPage(id, 1, gen);
  }, [stageKey, loadPage, currentTenantId, tick]);

  const loadMore = useCallback(
    (stageId: string) => {
      const column = boardRef.current[stageId];
      if (!column || column.loading) return;
      void loadPage(stageId, column.page + 1, generation.current);
    },
    [loadPage],
  );

  const move = useCallback(async (leadId: string, toStageId: string): Promise<MoveResult> => {
    if (movingRef.current.has(leadId)) return { ok: false, reason: "busy" };
    const original = findLead(boardRef.current, leadId);
    if (!original || original.stageId === toStageId) return { ok: false, reason: "noop" };
    movingRef.current.add(leadId);
    setMoving(new Set(movingRef.current));
    setBoard((b) => moveLeadOptimistic(b, leadId, toStageId));
    try {
      const updated = await leadsService.move(leadId, toStageId);
      setBoard((b) => replaceLead(b, updated));
      return { ok: true, lead: updated };
    } catch (error) {
      // Rollback: devolve a cópia ORIGINAL para a etapa de origem (não um
      // snapshot do quadro inteiro — outros movimentos em paralelo ficam).
      setBoard((b) => replaceLead(b, original));
      return { ok: false, reason: "error", error };
    } finally {
      movingRef.current.delete(leadId);
      setMoving(new Set(movingRef.current));
    }
  }, []);

  const applyLead = useCallback((lead: Lead) => setBoard((b) => replaceLead(b, lead)), []);
  const isMoving = useCallback((leadId: string) => moving.has(leadId), [moving]);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { board, loadMore, move, applyLead, isMoving, reload };
}
