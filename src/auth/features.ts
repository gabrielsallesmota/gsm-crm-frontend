// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { AuthUser } from "../types/auth.ts";

/**
 * Catálogo de funcionalidades CONTRATÁVEIS por tenant — espelha
 * `app/shared/features.py` do backend (mesmos códigos e defaults). SDR,
 * Prospecção e Clientes GSM NÃO estão aqui: são áreas internas da GSM
 * (`platform.internal`), nunca contratadas por cliente.
 *
 * Isto só decide o que a UI MOSTRA. Quem bloqueia é o backend
 * (`require_feature` → 403).
 */
export type TenantFeature = "crm" | "dashboard" | "reports" | "api" | "webhooks";

export const FEATURE_DEFAULTS: Record<TenantFeature, boolean> = {
  crm: true,
  dashboard: true,
  reports: true,
  api: true,
  webhooks: false,
};

export const FEATURE_LABELS: Record<TenantFeature, string> = {
  crm: "CRM",
  dashboard: "Dashboard",
  reports: "Relatórios",
  api: "API pública",
  webhooks: "Webhooks",
};

type WithFeatures = Pick<AuthUser, "features"> | null | undefined;

export function hasFeature(user: WithFeatures, feature: TenantFeature): boolean {
  const explicit = user?.features?.[feature];
  return explicit ?? FEATURE_DEFAULTS[feature];
}
