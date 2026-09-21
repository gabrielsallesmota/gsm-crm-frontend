import type { Temperature } from "../types/lead";

export const TEMP: Record<Temperature, { label: string; color: string }> = {
  frio: { label: "Frio", color: "var(--tone-blue)" },
  morno: { label: "Morno", color: "var(--tone-amber)" },
  quente: { label: "Quente", color: "var(--tone-red)" },
};
