// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import { ROUTES } from "../constants/routes.ts";
import { can, type Permission } from "../auth/permissions.ts";
import { hasFeature, type TenantFeature } from "../auth/features.ts";
import type { AuthUser } from "../types/auth.ts";

/**
 * Arquitetura de informação (Etapa 4). Duas áreas que nunca se misturam:
 *
 * - `crm`: o produto do cliente, na ordem do dia a dia —
 *   Dashboard, Pipeline, Leads, Tarefas, Agenda, Relatórios, Equipe,
 *   Integrações, Configurações.
 * - `gsm`: ferramentas INTERNAS da GSM (Clientes, SDR, Plataforma), só para
 *   platform staff e num grupo separado com título próprio. O cliente nunca
 *   vê esse grupo (nem o título).
 *
 * Cada item usa a MESMA permissão/feature da rota (`routes/index.tsx`).
 */
export type NavIconName =
  | "dashboard"
  | "pipeline"
  | "leads"
  | "tasks"
  | "agenda"
  | "reports"
  | "users"
  | "integrations"
  | "settings"
  | "clients"
  | "prospects"
  | "platform";

export interface NavItem {
  to: string;
  icon: NavIconName;
  label: string;
  permission?: Permission;
  feature?: TenantFeature;
  /** Basta UMA destas features (ex.: Integrações = API ou Webhooks). */
  anyFeature?: TenantFeature[];
}

export interface NavSection {
  id: "crm" | "gsm";
  title: string | null;
  items: NavItem[];
}

export const CRM_NAV: NavItem[] = [
  { to: ROUTES.dashboard, icon: "dashboard", label: "Dashboard", feature: "dashboard" },
  { to: ROUTES.pipeline, icon: "pipeline", label: "Pipeline", feature: "crm" },
  { to: ROUTES.leads, icon: "leads", label: "Leads", feature: "crm" },
  { to: ROUTES.tarefas, icon: "tasks", label: "Tarefas", feature: "crm" },
  { to: ROUTES.agenda, icon: "agenda", label: "Agenda", feature: "crm" },
  { to: ROUTES.relatorios, icon: "reports", label: "Relatórios", feature: "reports" },
  { to: ROUTES.equipe, icon: "users", label: "Equipe", permission: "users.view" },
  {
    to: ROUTES.integracoes,
    icon: "integrations",
    label: "Integrações",
    permission: "integrations.manage",
    anyFeature: ["api", "webhooks"],
  },
  { to: ROUTES.configuracoes, icon: "settings", label: "Configurações", permission: "settings.manage" },
];

export const GSM_NAV: NavItem[] = [
  { to: ROUTES.clientes, icon: "clients", label: "Clientes GSM", permission: "platform.internal" },
  { to: ROUTES.sdrDashboard, icon: "prospects", label: "SDR", permission: "platform.internal" },
  { to: ROUTES.platform, icon: "platform", label: "Plataforma GSM", permission: "platform.console" },
];

type Principal = AuthUser | null | undefined;

export function isNavItemVisible(user: Principal, item: NavItem): boolean {
  if (item.permission && !can(user, item.permission)) return false;
  if (item.feature && !hasFeature(user, item.feature)) return false;
  if (item.anyFeature && !item.anyFeature.some((f) => hasFeature(user, f))) return false;
  return true;
}

export function navSections(user: Principal): NavSection[] {
  const crm = CRM_NAV.filter((i) => isNavItemVisible(user, i));
  const gsm = GSM_NAV.filter((i) => isNavItemVisible(user, i));
  const sections: NavSection[] = [{ id: "crm", title: null, items: crm }];
  if (gsm.length > 0) sections.push({ id: "gsm", title: "Área interna GSM", items: gsm });
  return sections;
}
