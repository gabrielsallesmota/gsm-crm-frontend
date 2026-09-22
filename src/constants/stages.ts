import type { StageKey } from "../types/pipeline";

export const STAGES: Record<StageKey, { label: string; color: string; bg: string }> = {
  novo: { label: "Novo", color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
  contato: { label: "Em contato", color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  proposta: { label: "Proposta", color: "var(--tone-purple)", bg: "var(--tone-purple-bg)" },
  ganho: { label: "Ganho", color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  perdido: { label: "Perdido", color: "var(--tone-gray)", bg: "var(--tone-gray-2-bg)" },
};

export const STAGE_ORDER: StageKey[] = ["novo", "contato", "proposta", "ganho", "perdido"];
