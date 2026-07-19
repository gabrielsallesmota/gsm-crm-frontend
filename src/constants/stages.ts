import type { StageKey } from "../types/pipeline";

export const STAGES: Record<StageKey, { label: string; color: string; bg: string }> = {
  novo: { label: "Novo", color: "#4aa3ff", bg: "rgba(74,163,255,.12)" },
  contato: { label: "Em contato", color: "#f5b13d", bg: "rgba(245,177,61,.12)" },
  proposta: { label: "Proposta", color: "#a78bfa", bg: "rgba(167,139,250,.16)" },
  ganho: { label: "Ganho", color: "#2ee66e", bg: "rgba(46,230,110,.12)" },
  perdido: { label: "Perdido", color: "#9aa6b2", bg: "rgba(255,255,255,.05)" },
};

export const STAGE_ORDER: StageKey[] = ["novo", "contato", "proposta", "ganho", "perdido"];
