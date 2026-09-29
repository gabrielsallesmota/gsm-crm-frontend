// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { FeatureDefinition, PlanOption } from "../types/platform.ts";

/**
 * Assistente de provisionamento (Etapa 2): dados básicos → primeiro admin →
 * módulos → confirmação. Validação espelha a do backend (que é quem decide);
 * aqui só evita ida-e-volta com erro óbvio. Testado em `tests/platform.test.ts`.
 */
export interface ProvisionDraft {
  name: string;
  slug: string;
  planCode: string;
  adminName: string;
  adminEmail: string;
  features: Record<string, boolean>;
}

export type ProvisionStep = "basics" | "admin" | "features" | "confirm";

export const PROVISION_STEPS: { key: ProvisionStep; label: string }[] = [
  { key: "basics", label: "Dados básicos" },
  { key: "admin", label: "Primeiro admin" },
  { key: "features", label: "Módulos" },
  { key: "confirm", label: "Confirmação" },
];

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function emptyDraft(): ProvisionDraft {
  return { name: "", slug: "", planCode: "", adminName: "", adminEmail: "", features: {} };
}

/** Estado inicial dos módulos: o que o plano sugere; o resto, o default do
 * catálogo. Módulos reservados (não disponíveis) sempre desligados. */
export function initialFeatures(
  plan: PlanOption | undefined,
  catalog: FeatureDefinition[],
): Record<string, boolean> {
  const suggested = new Set(plan?.features ?? []);
  return Object.fromEntries(
    catalog.map((f) => [
      f.code,
      f.available && (plan ? suggested.has(f.code) : f.defaultEnabled),
    ]),
  );
}

/** Mensagem do primeiro problema do passo, ou `null` se pode avançar. */
export function validateStep(step: ProvisionStep, draft: ProvisionDraft): string | null {
  if (step === "basics") {
    if (draft.name.trim().length < 2) return "Informe o nome da organização.";
    if (!SLUG_RE.test(draft.slug))
      return "Identificador inválido: 3 a 80 letras minúsculas, números ou hífens.";
    if (!draft.planCode) return "Escolha o plano.";
    return null;
  }
  if (step === "admin") {
    if (draft.adminName.trim().length < 2) return "Informe o nome do primeiro administrador.";
    if (!EMAIL_RE.test(draft.adminEmail.trim())) return "E-mail do administrador inválido.";
    return null;
  }
  if (step === "features") {
    if (!Object.values(draft.features).some(Boolean))
      return "Ative pelo menos um módulo para o cliente.";
    return null;
  }
  return null;
}

const AUDIT_LABELS: Record<string, string> = {
  "organization.created": "Organização criada",
  "organization.updated": "Organização alterada",
  "organization.suspended": "Organização suspensa",
  "organization.reactivated": "Organização reativada",
  "tenant.created": "Tenant criado",
  "tenant.suspended": "Tenant suspenso",
  "tenant.reactivated": "Tenant reativado",
  "tenant.features_updated": "Módulos alterados",
  "tenant.admin_assigned": "Primeiro admin definido",
  "tenant.admin_invitation_resent": "Convite do admin reenviado",
  "impersonation.started": "Sessão de suporte iniciada",
  "impersonation.elevated": "Suporte: escrita liberada",
  "impersonation.ended": "Sessão de suporte encerrada",
  "api_key.created": "API Key criada",
  "api_key.revoked": "API Key revogada",
  "member.updated": "Papel/status de membro alterado",
  "user.invited": "Usuário convidado",
  "user.created": "Usuário criado",
  "platform_staff.granted": "Acesso de plataforma concedido",
  "platform_staff.revoked": "Acesso de plataforma revogado",
  "platform.internal_tenant_set": "Tenant interno definido",
};

export function describeAuditAction(action: string): string {
  return AUDIT_LABELS[action] ?? action;
}

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
