import type { StageKey } from "../../types/pipeline";
import { STAGE_ORDER } from "../../constants/stages";

/**
 * O backend modela estágios como UUIDs livres por pipeline (com flags
 * is_won/is_lost), enquanto o domínio do frontend (compartilhado com o
 * modo Demo) usa um funil fixo de 5 chaves (novo/contato/proposta/
 * ganho/perdido), espelhando o protótipo original. Este módulo faz a
 * ponte: mapeia os estágios reais de cada pipeline (ordenados, com o
 * primeiro is_won -> 'ganho' e o primeiro is_lost -> 'perdido') para
 * essas chaves fixas. Pipelines com mais de 3 estágios "em andamento"
 * colapsam os excedentes na última chave intermediária ('proposta').
 */
export interface RemoteStage {
  id: string;
  name: string;
  color: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

interface PipelineStageMap {
  keyToId: Map<StageKey, string>;
  idToKey: Map<string, StageKey>;
}

const cache = new Map<string, PipelineStageMap>();
const INTERMEDIATE_KEYS = STAGE_ORDER.filter((k) => k !== "ganho" && k !== "perdido");

export function buildStageMap(pipelineId: string, stages: RemoteStage[]): void {
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const keyToId = new Map<StageKey, string>();
  const idToKey = new Map<string, StageKey>();

  const won = ordered.find((s) => s.isWon);
  const lost = ordered.find((s) => s.isLost);
  const intermediate = ordered.filter((s) => s !== won && s !== lost);

  intermediate.forEach((stage, i) => {
    const key = INTERMEDIATE_KEYS[Math.min(i, INTERMEDIATE_KEYS.length - 1)] as StageKey;
    keyToId.set(key, stage.id);
    idToKey.set(stage.id, key);
  });
  if (won) {
    keyToId.set("ganho", won.id);
    idToKey.set(won.id, "ganho");
  }
  if (lost) {
    keyToId.set("perdido", lost.id);
    idToKey.set(lost.id, "perdido");
  }

  cache.set(pipelineId, { keyToId, idToKey });
}

export function stageIdToKey(pipelineId: string, stageId: string): StageKey {
  return cache.get(pipelineId)?.idToKey.get(stageId) ?? "novo";
}

export function stageKeyToId(pipelineId: string, key: StageKey): string | undefined {
  return cache.get(pipelineId)?.keyToId.get(key);
}

export function findPipelineIdForStageId(stageId: string): string | undefined {
  for (const [pipelineId, map] of cache) {
    if (map.idToKey.has(stageId)) return pipelineId;
  }
  return undefined;
}
