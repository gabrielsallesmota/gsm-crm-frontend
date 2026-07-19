import type { Temperature } from "../types/lead";

export const TEMP: Record<Temperature, { label: string; color: string }> = {
  frio: { label: "Frio", color: "#4aa3ff" },
  morno: { label: "Morno", color: "#f5b13d" },
  quente: { label: "Quente", color: "#ff6b6b" },
};
