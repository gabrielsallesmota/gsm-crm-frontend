/**
 * Etapa REAL do pipeline, exatamente como o backend define (fonte da
 * verdade): `id` é o UUID da etapa, `label` é o nome dado pelo cliente,
 * `order` é a ordem real. A UI renderiza estas etapas — nunca um funil fixo
 * (antes existia `StageKey = novo|contato|proposta|ganho|perdido`, que
 * colapsava funis customizados e movia leads para a etapa errada).
 * Identidade é SEMPRE o `id`; o nome é só exibição.
 */
export interface PipelineStage {
  id: string;
  label: string;
  color: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

export interface Pipeline {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  isDefault: boolean;
  active: boolean;
  /** Já ordenadas por `order`. */
  stages: PipelineStage[];
}

export type StageInput = Pick<PipelineStage, "label" | "color"> & {
  isWon?: boolean;
  isLost?: boolean;
};

/** Ordena por `order` sem mutar (a API já entrega ordenado; mocks e
 * atualizações otimistas podem não entregar). */
export function sortStages(stages: PipelineStage[]): PipelineStage[] {
  return [...stages].sort((a, b) => a.order - b.order);
}
