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
 *
 * CRM-003B.1: `notifications` e `calendar_task_integrations` estão
 * registradas mas RESERVADAS no backend (ninguém consegue ligá-las ainda) —
 * nenhuma tela as usa até os cards B.3/B.4.
 */
export type TenantFeature =
  | "crm"
  | "dashboard"
  | "reports"
  | "api"
  | "webhooks"
  | "notifications"
  | "calendar_task_integrations";

export const FEATURE_DEFAULTS: Record<TenantFeature, boolean> = {
  crm: true,
  dashboard: true,
  reports: true,
  api: true,
  webhooks: false,
  notifications: false,
  calendar_task_integrations: false,
};

export const FEATURE_LABELS: Record<TenantFeature, string> = {
  crm: "CRM",
  dashboard: "Dashboard",
  reports: "Relatórios",
  api: "API pública",
  webhooks: "Webhooks",
  notifications: "Central de Notificações",
  calendar_task_integrations: "Agendas e tarefas Google/Microsoft",
};

type WithFeatures = Pick<AuthUser, "features"> | null | undefined;

export function hasFeature(user: WithFeatures, feature: TenantFeature): boolean {
  const explicit = user?.features?.[feature];
  return explicit ?? FEATURE_DEFAULTS[feature];
}
