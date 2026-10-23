// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
/**
 * Central de Notificações (CRM-003B.3) — espelha os contratos REAIS de
 * `app/modules/notifications/adapters/inbound/schemas.py` (backend B.2).
 * Nenhum tipo aqui representa uma mensagem enviada: o canal WhatsApp só
 * existe no CRM-003B.8.
 */
import type { TenantRole } from "../auth/permissions.ts";

export type SectionMode = "off" | "count" | "list";
export type RecipientScope = "self" | "team";

export interface SectionConfig {
  mode: SectionMode;
  maxItems: number;
}

export interface ToggleSection {
  enabled: boolean;
  maxItems: number;
}

/** Política COMPLETA (empresa ou efetiva). `timezone: null` = herda o fuso
 * da organização. */
export interface NotificationPolicy {
  enabled: boolean;
  channel: "whatsapp";
  schedule: {
    frequency: "daily";
    time: string;
    timezone: string | null;
    includeWeekends: boolean;
  };
  recipient: { roles: TenantRole[]; scope: RecipientScope };
  content: {
    tasks: SectionConfig;
    leads: SectionConfig;
    includeOverdue: boolean;
    calendar: ToggleSection;
    opportunities: ToggleSection;
  };
  /** Cada automação da Central liga/desliga sozinha (`enabled` acima é a chave geral). */
  triggers: {
    newLead: { enabled: boolean };
    dailyDigest: { enabled: boolean };
    weeklyReport: { enabled: boolean };
    monthlyReport: { enabled: boolean };
  };
}

/** Alterações PARCIAIS no formato aninhado da API (só o que mudou).
 * `undefined` = não enviado (JSON.stringify o descarta). */
export interface PolicyPatch {
  enabled?: boolean | undefined;
  schedule?:
    | {
        time?: string | undefined;
        timezone?: string | null | undefined;
        include_weekends?: boolean | undefined;
      }
    | undefined;
  recipient?: { roles?: TenantRole[] | undefined; scope?: RecipientScope | undefined } | undefined;
  content?:
    | {
        tasks?: { mode?: SectionMode | undefined; max_items?: number | undefined } | undefined;
        leads?: { mode?: SectionMode | undefined; max_items?: number | undefined } | undefined;
        include_overdue?: boolean | undefined;
        calendar?: { enabled?: boolean | undefined; max_items?: number | undefined } | undefined;
        opportunities?:
          { enabled?: boolean | undefined; max_items?: number | undefined } | undefined;
      }
    | undefined;
  triggers?:
    | {
        new_lead?: { enabled?: boolean | undefined } | undefined;
        daily_digest?: { enabled?: boolean | undefined } | undefined;
        weekly_report?: { enabled?: boolean | undefined } | undefined;
        monthly_report?: { enabled?: boolean | undefined } | undefined;
      }
    | undefined;
}

export type NotReceivingReason = "company_disabled" | "role_not_recipient" | "user_opted_out";

export interface EffectiveSettings {
  receives: boolean;
  notReceivingReason: NotReceivingReason | null;
  timezone: string;
  timezoneSource: "user" | "company" | "tenant";
  restrictedFields: string[];
  policy: NotificationPolicy;
}

export interface NotificationSettings {
  version: number;
  persisted: boolean;
  updatedAt: string | null;
  tenantTimezone: string;
  policy: NotificationPolicy;
  /** Ajuste por perfil, só o que foi personalizado. */
  roles: Partial<Record<TenantRole, PolicyPatch>>;
  /** `null` quando quem pergunta não é membro ativo (ex.: suporte da GSM). */
  effective: EffectiveSettings | null;
}

/** `no_phone` | `no_consent` | `channel_disabled` | `channel_unavailable`. */
export type ChannelStatus = "no_phone" | "no_consent" | "channel_disabled" | "channel_unavailable";

export interface WhatsappContact {
  phone: string | null;
  enabled: boolean;
  consent: boolean;
  consentAt: string | null;
  consentRevokedAt: string | null;
  verified: boolean;
  status: ChannelStatus;
}

export interface MyPreferences {
  version: number;
  persisted: boolean;
  /** Só os campos que a pessoa personalizou (formato aninhado da API). */
  preferences: PolicyPatch;
  timezone: string | null;
  whatsapp: WhatsappContact;
  effective: EffectiveSettings;
}

export interface UpdateMyPreferencesInput {
  version: number;
  preferences?: PolicyPatch;
  resetPreferences?: boolean;
  /** `undefined` = não mexe; `null` = volta a herdar. */
  timezone?: string | null;
  whatsapp?: { phone?: string | null; consent?: boolean; enabled?: boolean };
}

export interface Recipient {
  userId: string;
  name: string;
  role: TenantRole;
  receives: boolean;
  notReceivingReason: NotReceivingReason | null;
  scope: RecipientScope;
  timezone: string;
  phoneMasked: string | null;
  consent: boolean;
  verified: boolean;
  channelEnabled: boolean;
  channelStatus: ChannelStatus;
}

export interface DigestSection {
  key: "tasks" | "leads" | "calendar" | "opportunities";
  mode: SectionMode;
  total: number;
  counts: Record<string, number>;
  items: Record<string, unknown>[];
  truncated: number;
}

export interface DigestPreview {
  recipientUserId: string;
  recipientName: string;
  localDate: string;
  timezone: string;
  scope: RecipientScope;
  receives: boolean;
  notReceivingReason: NotReceivingReason | null;
  empty: boolean;
  sections: DigestSection[];
  text: string;
  channel: { name: "whatsapp"; available: boolean; status: ChannelStatus };
  /** Sempre `false`: prévia nunca é entrega. */
  delivered: false;
}

export type DeliveryKind =
  | "daily_digest"
  | "weekly_report"
  | "monthly_report"
  | "new_lead_alert"
  | "follow_up_alert"
  | "unassigned_lead_alert"
  | "stalled_lead_alert"
  /** Histórico: tarefa atrasada não avisa mais sozinha (vai nos resumos). */
  | "overdue_task_alert";
export type DeliveryStatus =
  "skipped" | "channel_unavailable" | "pending" | "sent" | "failed" | "expired";

export interface Delivery {
  id: string;
  recipientUserId: string;
  kind: DeliveryKind;
  channel: string;
  status: DeliveryStatus;
  statusReason: string | null;
  scheduledFor: string;
  localDate: string | null;
  itemCount: number | null;
  expiresAt: string;
  sentAt: string | null;
  createdAt: string;
  /** Andamento do despacho (CRM-003B.8): aceita ≠ enviada. */
  stage?: DeliveryStage;
  failureCode?: string | null;
}

export type DeliveryStage =
  | "planned"
  | "accepted"
  | "processed"
  | "sent"
  | "confirmed"
  | "failed"
  | "skipped"
  | "channel_unavailable"
  | "expired";

export interface DeliveryFilters {
  recipientUserId?: string | undefined;
  kind?: DeliveryKind | undefined;
  status?: DeliveryStatus | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}
