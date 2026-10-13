// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
/**
 * Central de Notificações (CRM-003B.3) — regras PURAS do frontend:
 * mapeamento DTO ↔ tipos, PATCH parcial (só o que mudou), validação de
 * telefone espelhando o backend e rótulos. Quem decide permissão, herança e
 * o que é aceito é SEMPRE o backend; aqui só se evita prometer o que ele
 * recusaria.
 */
import type { TenantRole } from "../auth/permissions.ts";
import type {
  ChannelStatus,
  Delivery,
  DeliveryKind,
  DeliveryStage,
  DeliveryStatus,
  DigestPreview,
  DigestSection,
  EffectiveSettings,
  MyPreferences,
  NotificationPolicy,
  NotificationSettings,
  NotReceivingReason,
  PolicyPatch,
  Recipient,
  SectionMode,
} from "../types/notifications.ts";

type Dto = Record<string, unknown>;

function obj(v: unknown): Dto {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Dto) : {};
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}
function bool(v: unknown): boolean {
  return v === true;
}
function mode(v: unknown): SectionMode {
  return v === "off" || v === "count" || v === "list" ? v : "off";
}

// ---- DTO → tipos -------------------------------------------------------------

export function toPolicy(raw: unknown): NotificationPolicy {
  const d = obj(raw);
  const schedule = obj(d.schedule);
  const recipient = obj(d.recipient);
  const content = obj(d.content);
  const tasks = obj(content.tasks);
  const leads = obj(content.leads);
  const calendar = obj(content.calendar);
  const opportunities = obj(content.opportunities);
  return {
    enabled: bool(d.enabled),
    channel: "whatsapp",
    schedule: {
      frequency: "daily",
      time: str(schedule.time, "08:00"),
      timezone: strOrNull(schedule.timezone),
      includeWeekends: bool(schedule.include_weekends),
    },
    recipient: {
      roles: (Array.isArray(recipient.roles) ? recipient.roles : []).map(String) as TenantRole[],
      scope: recipient.scope === "team" ? "team" : "self",
    },
    content: {
      tasks: { mode: mode(tasks.mode), maxItems: num(tasks.max_items, 5) },
      leads: { mode: mode(leads.mode), maxItems: num(leads.max_items, 5) },
      includeOverdue: bool(content.include_overdue),
      calendar: { enabled: bool(calendar.enabled), maxItems: num(calendar.max_items, 5) },
      opportunities: {
        enabled: bool(opportunities.enabled),
        maxItems: num(opportunities.max_items, 5),
      },
    },
    triggers: { newLead: { enabled: bool(obj(obj(d.triggers).new_lead).enabled) } },
  };
}

function toReason(v: unknown): NotReceivingReason | null {
  return v === "company_disabled" || v === "role_not_recipient" || v === "user_opted_out"
    ? v
    : null;
}

export function toEffective(raw: unknown): EffectiveSettings {
  const d = obj(raw);
  const source = d.timezone_source;
  return {
    receives: bool(d.receives),
    notReceivingReason: toReason(d.not_receiving_reason),
    timezone: str(d.timezone, "America/Sao_Paulo"),
    timezoneSource: source === "user" || source === "company" ? source : "tenant",
    restrictedFields: Array.isArray(d.restricted_fields) ? d.restricted_fields.map(String) : [],
    policy: toPolicy(d.policy),
  };
}

export function toSettings(raw: unknown): NotificationSettings {
  const d = obj(raw);
  return {
    version: num(d.version),
    persisted: bool(d.persisted),
    updatedAt: strOrNull(d.updated_at),
    tenantTimezone: str(d.tenant_timezone, "America/Sao_Paulo"),
    policy: toPolicy(d.policy),
    roles: obj(d.roles) as NotificationSettings["roles"],
    effective: d.effective ? toEffective(d.effective) : null,
  };
}

function toChannelStatus(v: unknown): ChannelStatus {
  return v === "no_phone" || v === "no_consent" || v === "channel_disabled"
    ? v
    : "channel_unavailable";
}

export function toPreferences(raw: unknown): MyPreferences {
  const d = obj(raw);
  const w = obj(d.whatsapp);
  return {
    version: num(d.version),
    persisted: bool(d.persisted),
    preferences: obj(d.preferences) as PolicyPatch,
    timezone: strOrNull(d.timezone),
    whatsapp: {
      phone: strOrNull(w.phone),
      enabled: w.enabled !== false,
      consent: bool(w.consent),
      consentAt: strOrNull(w.consent_at),
      consentRevokedAt: strOrNull(w.consent_revoked_at),
      verified: bool(w.verified),
      status: toChannelStatus(w.status),
    },
    effective: toEffective(d.effective),
  };
}

export function toRecipient(raw: unknown): Recipient {
  const d = obj(raw);
  const w = obj(d.whatsapp);
  return {
    userId: str(d.user_id),
    name: str(d.name),
    role: str(d.role) as TenantRole,
    receives: bool(d.receives),
    notReceivingReason: toReason(d.not_receiving_reason),
    scope: d.scope === "team" ? "team" : "self",
    timezone: str(d.timezone),
    phoneMasked: strOrNull(w.phone_masked),
    consent: bool(w.consent),
    verified: bool(w.verified),
    channelEnabled: w.enabled !== false,
    channelStatus: toChannelStatus(d.channel_status),
  };
}

export function toPreview(raw: unknown): DigestPreview {
  const d = obj(raw);
  const channel = obj(d.channel);
  return {
    recipientUserId: str(d.recipient_user_id),
    recipientName: str(d.recipient_name),
    localDate: str(d.local_date),
    timezone: str(d.timezone),
    scope: d.scope === "team" ? "team" : "self",
    receives: bool(d.receives),
    notReceivingReason: toReason(d.not_receiving_reason),
    empty: bool(d.empty),
    sections: (Array.isArray(d.sections) ? d.sections : []).map((s): DigestSection => {
      const section = obj(s);
      return {
        key: str(section.key) as DigestSection["key"],
        mode: mode(section.mode),
        total: num(section.total),
        counts: obj(section.counts) as Record<string, number>,
        items: (Array.isArray(section.items) ? section.items : []).map(obj),
        truncated: num(section.truncated),
      };
    }),
    text: str(d.text),
    // O canal nunca está disponível no B.3 — não se confia em outro valor.
    channel: { name: "whatsapp", available: false, status: toChannelStatus(channel.status) },
    delivered: false,
  };
}

const DELIVERY_KINDS: readonly DeliveryKind[] = [
  "daily_digest",
  "new_lead_alert",
  "overdue_task_alert",
  "stalled_lead_alert",
];

function toKind(value: unknown): DeliveryKind {
  return DELIVERY_KINDS.find((k) => k === value) ?? "daily_digest";
}

export function toDelivery(raw: unknown): Delivery {
  const d = obj(raw);
  return {
    id: str(d.id),
    recipientUserId: str(d.recipient_user_id),
    kind: toKind(d.kind),
    channel: str(d.channel, "whatsapp"),
    status: str(d.status) as DeliveryStatus,
    statusReason: strOrNull(d.status_reason),
    scheduledFor: str(d.scheduled_for),
    localDate: strOrNull(d.local_date),
    itemCount: typeof d.item_count === "number" ? d.item_count : null,
    expiresAt: str(d.expires_at),
    sentAt: strOrNull(d.sent_at),
    createdAt: str(d.created_at),
    stage: toStage(d.stage, str(d.status)),
    failureCode: strOrNull(d.failure_code),
  };
}

const STAGES: DeliveryStage[] = [
  "planned",
  "accepted",
  "processed",
  "sent",
  "confirmed",
  "failed",
  "skipped",
  "channel_unavailable",
  "expired",
];

function toStage(raw: unknown, status: string): DeliveryStage {
  if ((STAGES as string[]).includes(String(raw))) return raw as DeliveryStage;
  return (STAGES as string[]).includes(status) ? (status as DeliveryStage) : "planned";
}

// ---- PATCH parcial --------------------------------------------------------------

function sameRoles(a: TenantRole[], b: TenantRole[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

function prune<T extends object>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
}

/** Só os campos que mudaram entre `base` e `draft`, no formato da API.
 * `undefined` = nada a salvar (o botão nem dispara requisição). */
export function policyPatch(
  base: NotificationPolicy,
  draft: NotificationPolicy,
): PolicyPatch | undefined {
  const diff = <V>(a: V, b: V): V | undefined => (a === b ? undefined : b);
  const tasks = prune({
    mode: diff(base.content.tasks.mode, draft.content.tasks.mode),
    max_items: diff(base.content.tasks.maxItems, draft.content.tasks.maxItems),
  });
  const leads = prune({
    mode: diff(base.content.leads.mode, draft.content.leads.mode),
    max_items: diff(base.content.leads.maxItems, draft.content.leads.maxItems),
  });
  const calendar = prune({
    enabled: diff(base.content.calendar.enabled, draft.content.calendar.enabled),
    max_items: diff(base.content.calendar.maxItems, draft.content.calendar.maxItems),
  });
  const opportunities = prune({
    enabled: diff(base.content.opportunities.enabled, draft.content.opportunities.enabled),
    max_items: diff(base.content.opportunities.maxItems, draft.content.opportunities.maxItems),
  });
  const newLead = prune({
    enabled: diff(base.triggers.newLead.enabled, draft.triggers.newLead.enabled),
  });
  return prune<PolicyPatch>({
    enabled: diff(base.enabled, draft.enabled),
    schedule: prune({
      time: diff(base.schedule.time, draft.schedule.time),
      timezone:
        base.schedule.timezone === draft.schedule.timezone ? undefined : draft.schedule.timezone,
      include_weekends: diff(base.schedule.includeWeekends, draft.schedule.includeWeekends),
    }),
    recipient: prune({
      roles: sameRoles(base.recipient.roles, draft.recipient.roles)
        ? undefined
        : draft.recipient.roles,
      scope: diff(base.recipient.scope, draft.recipient.scope),
    }),
    content: prune({
      tasks,
      leads,
      include_overdue: diff(base.content.includeOverdue, draft.content.includeOverdue),
      calendar,
      opportunities,
    }),
    triggers: newLead ? { new_lead: newLead } : undefined,
  });
}

// ---- telefone ---------------------------------------------------------------------

const E164 = /^\+[1-9]\d{7,14}$/;

/** Mesma regra do backend (`normalize_e164`): `+` + DDI + número, 8 a 15
 * dígitos; separadores de digitação são aceitos. `null` = inválido. */
export function normalizeE164(raw: string): string | null {
  const candidate = raw.replace(/[\s().-]/g, "");
  return E164.test(candidate) ? candidate : null;
}

// ---- rótulos -------------------------------------------------------------------------

export const SECTION_MODE_LABELS: Record<SectionMode, string> = {
  off: "Não incluir",
  count: "Só a quantidade",
  list: "Lista com itens",
};

export const NOT_RECEIVING_LABELS: Record<NotReceivingReason, string> = {
  company_disabled: "Notificações desligadas pela empresa",
  role_not_recipient: "Este perfil não está entre os destinatários",
  user_opted_out: "Desativado pela própria pessoa",
};

export const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  no_phone: "Sem telefone",
  no_consent: "Sem autorização",
  channel_disabled: "WhatsApp desligado pela pessoa",
  channel_unavailable: "Pronto — canal ainda indisponível",
};

export const DELIVERY_KIND_LABELS: Record<DeliveryKind, string> = {
  daily_digest: "Resumo diário",
  new_lead_alert: "Alerta de novos leads",
  overdue_task_alert: "Aviso de tarefa atrasada",
  stalled_lead_alert: "Aviso de oportunidade parada",
};

/** Nenhum destes é "enviado": `skipped`/`channel_unavailable` são estados
 * finais sem mensagem (CRM-003B.2). `sent` só existirá a partir do B.8. */
export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  skipped: "Não enviada",
  channel_unavailable: "Não enviada — canal indisponível",
  pending: "Aguardando envio",
  sent: "Enviada",
  failed: "Falhou",
  expired: "Expirada",
};

/** Etapas do despacho. “Aceita” só diz que o WhatsApp/n8n RECEBEU o pedido —
 * ainda NÃO é envio. “Enviada” vem da confirmação do provedor. */
export const DELIVERY_STAGE_LABELS: Record<DeliveryStage, string> = {
  planned: "Aguardando envio",
  accepted: "Aceita pelo n8n — aguardando confirmação de envio",
  processed: "Processada — aguardando confirmação de envio",
  sent: "Enviada",
  confirmed: "Entregue",
  failed: "Falhou",
  skipped: "Não enviada",
  channel_unavailable: "Não enviada — canal indisponível",
  expired: "Expirada",
};

export function deliveryStageLabel(d: Pick<Delivery, "status" | "stage">): string {
  return DELIVERY_STAGE_LABELS[d.stage ?? "planned"] ?? DELIVERY_STATUS_LABELS[d.status];
}

export const DELIVERY_REASON_LABELS: Record<string, string> = {
  awaiting_dispatch: "na fila para ser enviada",
  accepted_by_n8n: "o n8n recebeu o pedido; falta a confirmação do envio",
  retry_scheduled: "falha temporária; nova tentativa agendada",
  sent_confirmed: "envio confirmado pelo provedor de WhatsApp",
  confirmation_timeout: "aceita, mas o envio não foi confirmado a tempo",
  dispatch_attempts_exhausted: "tentativas esgotadas",
  consent_missing_or_revoked: "a autorização do WhatsApp foi revogada ou não existe",
  company_disabled: "a empresa desligou as notificações",
  not_a_recipient: "a pessoa deixou de ser destinatária",
  recipient_inactive: "a pessoa não está mais ativa na equipe",
  no_phone: "a pessoa não cadastrou telefone",
  no_consent: "a pessoa não autorizou o WhatsApp",
  channel_disabled: "a pessoa desligou o WhatsApp",
  whatsapp_not_integrated: "o WhatsApp ainda não está integrado",
  expired_before_dispatch: "venceu antes do envio",
  no_content: "não havia mais nada a avisar (tarefa concluída, lead movido ou regra desligada)",
};

const RESTRICTED_LABELS: Record<string, string> = {
  enabled: "Receber notificações",
  include_weekends: "Fins de semana",
  scope: "Ver dados da equipe",
  tasks_mode: "Formato de tarefas",
  tasks_max_items: "Quantidade de tarefas",
  leads_mode: "Formato de leads",
  leads_max_items: "Quantidade de leads",
  include_overdue: "Incluir atrasados",
  calendar_enabled: "Agenda",
  calendar_max_items: "Quantidade de compromissos",
  opportunities_enabled: "Oportunidades",
  opportunities_max_items: "Quantidade de oportunidades",
  new_lead_alert: "Alerta de novos leads",
};

export function restrictedLabel(field: string): string {
  return RESTRICTED_LABELS[field] ?? field;
}

/** Fusos IANA do navegador (sempre com o atual da política no topo). */
export function timezoneOptions(extra: (string | null | undefined)[] = []): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const all = intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : [];
  const base = all.length ? all : ["America/Sao_Paulo", "America/Manaus", "UTC"];
  const wanted = extra.filter((z): z is string => typeof z === "string" && z.length > 0);
  return Array.from(new Set([...wanted, ...base]));
}

/** Data/hora no fuso informado (ex.: o fuso efetivo de quem lê). */
export function formatInZone(iso: string, timeZone: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString("pt-BR");
  }
}

// ---- herança (só para a UI não oferecer o que a empresa não permite) ----------------

/** Aplica um ajuste parcial (formato da API) sobre a política — mesma regra
 * de `apply_changes` do backend. Usado para mostrar a base de um perfil. */
export function applyPatch(
  policy: NotificationPolicy,
  patch: PolicyPatch | undefined,
): NotificationPolicy {
  if (!patch) return policy;
  const c = patch.content ?? {};
  const s = patch.schedule ?? {};
  return {
    ...policy,
    enabled: patch.enabled ?? policy.enabled,
    schedule: {
      ...policy.schedule,
      time: s.time ?? policy.schedule.time,
      timezone: s.timezone !== undefined ? s.timezone : policy.schedule.timezone,
      includeWeekends: s.include_weekends ?? policy.schedule.includeWeekends,
    },
    recipient: {
      roles: patch.recipient?.roles ?? policy.recipient.roles,
      scope: patch.recipient?.scope ?? policy.recipient.scope,
    },
    content: {
      tasks: {
        mode: c.tasks?.mode ?? policy.content.tasks.mode,
        maxItems: c.tasks?.max_items ?? policy.content.tasks.maxItems,
      },
      leads: {
        mode: c.leads?.mode ?? policy.content.leads.mode,
        maxItems: c.leads?.max_items ?? policy.content.leads.maxItems,
      },
      includeOverdue: c.include_overdue ?? policy.content.includeOverdue,
      calendar: {
        enabled: c.calendar?.enabled ?? policy.content.calendar.enabled,
        maxItems: c.calendar?.max_items ?? policy.content.calendar.maxItems,
      },
      opportunities: {
        enabled: c.opportunities?.enabled ?? policy.content.opportunities.enabled,
        maxItems: c.opportunities?.max_items ?? policy.content.opportunities.maxItems,
      },
    },
    triggers: {
      newLead: { enabled: patch.triggers?.new_lead?.enabled ?? policy.triggers.newLead.enabled },
    },
  };
}

const MODE_ORDER: Record<SectionMode, number> = { off: 0, count: 1, list: 2 };

/** Modos que a pessoa pode escolher sem passar do que a base permite. */
export function allowedModes(base: SectionMode): SectionMode[] {
  return (["list", "count", "off"] as SectionMode[]).filter(
    (m) => MODE_ORDER[m] <= MODE_ORDER[base],
  );
}

/** Teto da preferência pessoal: política da empresa + ajuste do perfil +
 * regra do vendedor (sempre SELF). A pessoa só reduz a partir daqui — o
 * backend também ignora o que passar (`restricted_fields`). */
export function ceilingPolicy(
  settings: NotificationSettings,
  role: TenantRole,
): NotificationPolicy {
  const base = applyPatch(settings.policy, settings.roles[role]);
  return role === "vendedor" ? { ...base, recipient: { ...base.recipient, scope: "self" } } : base;
}

// ---- ajuste por perfil (esparso) ----------------------------------------------------

/** Campos que o backend aceita num ajuste por perfil (nunca enabled, canal,
 * fuso ou destinatários; vendedor nunca recebe escopo). */
function roleSnapshot(role: TenantRole, policy: NotificationPolicy): PolicyPatch {
  return {
    schedule: { time: policy.schedule.time, include_weekends: policy.schedule.includeWeekends },
    ...(role === "vendedor" ? {} : { recipient: { scope: policy.recipient.scope } }),
    content: {
      tasks: { mode: policy.content.tasks.mode, max_items: policy.content.tasks.maxItems },
      leads: { mode: policy.content.leads.mode, max_items: policy.content.leads.maxItems },
      include_overdue: policy.content.includeOverdue,
      calendar: {
        enabled: policy.content.calendar.enabled,
        max_items: policy.content.calendar.maxItems,
      },
      opportunities: {
        enabled: policy.content.opportunities.enabled,
        max_items: policy.content.opportunities.maxItems,
      },
    },
    triggers: { new_lead: { enabled: policy.triggers.newLead.enabled } },
  };
}

type Tree = { [key: string]: unknown };
const isTree = (v: unknown): v is Tree => Boolean(v) && typeof v === "object" && !Array.isArray(v);

function sparsify(full: Tree, company: Tree, saved: Tree | undefined): Tree | undefined {
  const out: Tree = {};
  for (const [key, value] of Object.entries(full)) {
    if (isTree(value)) {
      const child = sparsify(
        value,
        isTree(company[key]) ? (company[key] as Tree) : {},
        isTree(saved?.[key]) ? (saved?.[key] as Tree) : undefined,
      );
      if (child) out[key] = child;
    } else if (JSON.stringify(value) !== JSON.stringify(company[key]) || (saved && key in saved)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Corpo do ajuste por perfil: SÓ o que diverge da política da empresa — assim
 * o perfil continua acompanhando a empresa no resto. Campo já personalizado
 * antes vai explícito (o merge do backend não apaga o que não é enviado).
 * `undefined` = nada a salvar.
 */
export function roleOverrideBody(
  role: TenantRole,
  company: NotificationPolicy,
  saved: PolicyPatch | undefined,
  draft: NotificationPolicy,
): PolicyPatch | undefined {
  return sparsify(
    roleSnapshot(role, draft) as Tree,
    roleSnapshot(role, company) as Tree,
    saved as Tree | undefined,
  ) as PolicyPatch | undefined;
}
