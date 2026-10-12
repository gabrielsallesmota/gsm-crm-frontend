// CRM-003B.3 — lógica pura da Central de Notificações: contratos reais do
// backend (B.2), PATCH parcial, telefone E.164, herança e rótulos.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, evaluateRouteAccess } from "../src/auth/permissions.ts";
import { hasFeature } from "../src/auth/features.ts";
import { navSections } from "../src/layouts/navigation.ts";
import { ApiError } from "../src/types/common.ts";
import { saveFailure } from "../src/utils/saveState.ts";
import {
  allowedModes,
  applyPatch,
  ceilingPolicy,
  DELIVERY_REASON_LABELS,
  DELIVERY_STATUS_LABELS,
  formatInZone,
  normalizeE164,
  policyPatch,
  restrictedLabel,
  roleOverrideBody,
  toDelivery,
  toPolicy,
  toPreferences,
  toPreview,
  toRecipient,
  toSettings,
} from "../src/utils/notifications.ts";

// Resposta REAL do GET /notifications/settings (padrão aprovado, sem salvar).
const POLICY_DTO = {
  enabled: true,
  channel: "whatsapp",
  schedule: { frequency: "daily", time: "08:00", timezone: null, include_weekends: true },
  recipient: { roles: ["admin"], scope: "team" },
  content: {
    tasks: { mode: "list", max_items: 5 },
    leads: { mode: "list", max_items: 5 },
    include_overdue: true,
    calendar: { enabled: true, max_items: 5 },
    opportunities: { enabled: false, max_items: 5 },
  },
  triggers: { new_lead: { enabled: true } },
};

const SETTINGS_DTO = {
  version: 0,
  persisted: false,
  updated_at: null,
  tenant_timezone: "America/Sao_Paulo",
  policy: POLICY_DTO,
  roles: {},
  effective: {
    receives: true,
    not_receiving_reason: null,
    timezone: "America/Sao_Paulo",
    timezone_source: "tenant",
    restricted_fields: [],
    policy: POLICY_DTO,
  },
};

const user = (role: string, extra: Record<string, unknown> = {}) =>
  ({ role, isPlatformStaff: false, features: { notifications: true }, ...extra }) as never;

describe("contratos do backend B.2", () => {
  it("o padrão aprovado chega inteiro, sem gravar (version 0, persisted false)", () => {
    const s = toSettings(SETTINGS_DTO);
    assert.equal(s.version, 0);
    assert.equal(s.persisted, false);
    assert.equal(s.policy.schedule.time, "08:00");
    assert.equal(s.policy.schedule.timezone, null);
    assert.equal(s.policy.schedule.includeWeekends, true);
    assert.deepEqual(s.policy.recipient, { roles: ["admin"], scope: "team" });
    assert.deepEqual(s.policy.content.tasks, { mode: "list", maxItems: 5 });
    assert.deepEqual(s.policy.content.leads, { mode: "list", maxItems: 5 });
    assert.equal(s.policy.content.includeOverdue, true);
    assert.equal(s.policy.content.calendar.enabled, true);
    assert.equal(s.policy.content.opportunities.enabled, false);
    assert.equal(s.policy.triggers.newLead.enabled, true);
    assert.equal(s.effective?.timezoneSource, "tenant");
  });

  it("suporte (effective ausente) vira null, nunca um objeto inventado", () => {
    assert.equal(toSettings({ ...SETTINGS_DTO, effective: null }).effective, null);
  });

  it("resposta incompleta cai em valores seguros", () => {
    const p = toPolicy({});
    assert.equal(p.enabled, false);
    assert.equal(p.content.tasks.mode, "off");
    assert.equal(p.recipient.scope, "self");
  });

  it("preferências: consentimento, verificação e restrições vêm da API", () => {
    const prefs = toPreferences({
      version: 3,
      persisted: true,
      preferences: { content: { tasks: { mode: "count" } } },
      timezone: "Europe/Lisbon",
      whatsapp: {
        phone: "+5511987654321",
        enabled: true,
        consent: true,
        consent_at: "2026-10-12T12:00:00Z",
        consent_revoked_at: null,
        verified: false,
        status: "channel_unavailable",
      },
      effective: { ...SETTINGS_DTO.effective, restricted_fields: ["tasks_max_items"] },
    });
    assert.equal(prefs.version, 3);
    assert.equal(prefs.whatsapp.consent, true);
    assert.equal(prefs.whatsapp.verified, false);
    assert.equal(prefs.whatsapp.status, "channel_unavailable");
    assert.deepEqual(prefs.effective.restrictedFields, ["tasks_max_items"]);
    assert.equal(prefs.timezone, "Europe/Lisbon");
  });

  it("destinatário traz só o telefone mascarado", () => {
    const r = toRecipient({
      user_id: "u1",
      name: "Ana",
      role: "vendedor",
      receives: false,
      not_receiving_reason: "role_not_recipient",
      scope: "self",
      timezone: "America/Sao_Paulo",
      whatsapp: { phone_masked: "+55•••••••••21", consent: false, verified: false, enabled: true },
      channel_status: "no_consent",
    });
    assert.equal(r.phoneMasked, "+55•••••••••21");
    assert.equal(r.notReceivingReason, "role_not_recipient");
    assert.equal(r.channelStatus, "no_consent");
    assert.equal("phone" in r, false);
  });

  it("a prévia nunca é entrega e o canal nunca aparece disponível", () => {
    const p = toPreview({
      recipient_user_id: "u1",
      recipient_name: "Ana",
      local_date: "2026-10-12",
      timezone: "America/Sao_Paulo",
      scope: "team",
      receives: true,
      not_receiving_reason: null,
      empty: true,
      sections: [],
      text: "*Resumo do dia*",
      channel: { name: "whatsapp", available: true, status: "no_phone" },
      delivered: true,
    });
    assert.equal(p.delivered, false);
    assert.equal(p.channel.available, false);
  });

  it("histórico: skipped e channel_unavailable NUNCA são 'enviada'", () => {
    const d = toDelivery({
      id: "d1",
      recipient_user_id: "u1",
      kind: "daily_digest",
      channel: "whatsapp",
      status: "channel_unavailable",
      status_reason: "whatsapp_not_integrated",
      scheduled_for: "2026-10-12T11:00:00Z",
      local_date: "2026-10-12",
      item_count: null,
      expires_at: "2026-10-12T17:00:00Z",
      sent_at: null,
      created_at: "2026-10-12T11:00:05Z",
    });
    assert.equal(d.sentAt, null);
    assert.notEqual(DELIVERY_STATUS_LABELS[d.status], DELIVERY_STATUS_LABELS.sent);
    assert.match(DELIVERY_STATUS_LABELS.skipped, /Não enviada/);
    assert.match(DELIVERY_STATUS_LABELS.channel_unavailable, /Não enviada/);
    assert.match(DELIVERY_REASON_LABELS.whatsapp_not_integrated ?? "", /não está integrado/);
  });
});

describe("PATCH parcial", () => {
  const base = toPolicy(POLICY_DTO);

  it("sem mudança não há o que salvar", () => {
    assert.equal(policyPatch(base, structuredClone(base)), undefined);
  });

  it("leva só os campos alterados, no formato aninhado da API", () => {
    const draft = structuredClone(base);
    draft.schedule.time = "07:30";
    draft.content.tasks.mode = "count";
    assert.deepEqual(policyPatch(base, draft), {
      schedule: { time: "07:30" },
      content: { tasks: { mode: "count" } },
    });
  });

  it("fuso: voltar a herdar vai como null explícito", () => {
    const draft = structuredClone(base);
    draft.schedule.timezone = "America/Manaus";
    assert.deepEqual(policyPatch(base, draft), { schedule: { timezone: "America/Manaus" } });
    assert.deepEqual(policyPatch(draft, base), { schedule: { timezone: null } });
  });

  it("perfis: a ordem dos papéis não conta como mudança", () => {
    const a = structuredClone(base);
    a.recipient.roles = ["admin", "gestor"];
    const b = structuredClone(a);
    b.recipient.roles = ["gestor", "admin"];
    assert.equal(policyPatch(a, b), undefined);
    b.recipient.roles = ["gestor"];
    assert.deepEqual(policyPatch(a, b), { recipient: { roles: ["gestor"] } });
  });

  it("alerta de novo lead e agenda", () => {
    const draft = structuredClone(base);
    draft.triggers.newLead.enabled = false;
    draft.content.calendar.enabled = false;
    assert.deepEqual(policyPatch(base, draft), {
      content: { calendar: { enabled: false } },
      triggers: { new_lead: { enabled: false } },
    });
  });
});

describe("herança e teto da preferência pessoal", () => {
  const company = toPolicy(POLICY_DTO);

  it("ajuste do perfil aplica sobre a empresa", () => {
    const applied = applyPatch(company, { content: { leads: { mode: "count" } } });
    assert.equal(applied.content.leads.mode, "count");
    assert.equal(applied.content.tasks.mode, "list");
  });

  it("vendedor nunca passa de SELF, mesmo com empresa em TEAM", () => {
    const settings = toSettings(SETTINGS_DTO);
    assert.equal(ceilingPolicy(settings, "gestor").recipient.scope, "team");
    assert.equal(ceilingPolicy(settings, "vendedor").recipient.scope, "self");
  });

  it("modos oferecidos nunca passam do teto", () => {
    assert.deepEqual(allowedModes("list"), ["list", "count", "off"]);
    assert.deepEqual(allowedModes("count"), ["count", "off"]);
    assert.deepEqual(allowedModes("off"), ["off"]);
  });

  it("restrições têm rótulo em português", () => {
    assert.equal(restrictedLabel("tasks_max_items"), "Quantidade de tarefas");
    assert.equal(restrictedLabel("campo_novo"), "campo_novo");
  });
});

describe("ajuste por perfil esparso", () => {
  const company = toPolicy(POLICY_DTO);

  it("sem diferença da empresa não há o que salvar", () => {
    assert.equal(
      roleOverrideBody("gestor", company, undefined, structuredClone(company)),
      undefined,
    );
  });

  it("leva só o que diverge da empresa — o resto continua acompanhando a empresa", () => {
    const draft = structuredClone(company);
    draft.content.leads.mode = "count";
    draft.schedule.time = "09:00";
    assert.deepEqual(roleOverrideBody("gestor", company, undefined, draft), {
      schedule: { time: "09:00" },
      content: { leads: { mode: "count" } },
    });
  });

  it("campo já personalizado volta explícito mesmo igual à empresa (merge do backend não apaga)", () => {
    const saved = { content: { leads: { mode: "count" as const } } };
    const reverted = structuredClone(company); // leads de volta a "list" = valor da empresa
    assert.deepEqual(roleOverrideBody("gestor", company, saved, reverted), {
      content: { leads: { mode: "list" } },
    });
  });

  it("vendedor nunca leva escopo; gestor leva quando muda", () => {
    const draft = structuredClone(company);
    draft.recipient.scope = "self";
    assert.deepEqual(roleOverrideBody("vendedor", company, undefined, draft), undefined);
    assert.deepEqual(roleOverrideBody("gestor", company, undefined, draft), {
      recipient: { scope: "self" },
    });
  });

  it("nunca inclui campos da empresa (enabled, canal, fuso, destinatários)", () => {
    const draft = structuredClone(company);
    draft.enabled = false;
    draft.schedule.timezone = "UTC";
    draft.recipient.roles = ["vendedor"];
    assert.equal(roleOverrideBody("gestor", company, undefined, draft), undefined);
  });
});

describe("telefone E.164", () => {
  it("aceita formato internacional com separadores", () => {
    assert.equal(normalizeE164("+5511987654321"), "+5511987654321");
    assert.equal(normalizeE164("+55 (11) 98765-4321"), "+5511987654321");
  });
  it("recusa o que o backend recusaria", () => {
    for (const raw of ["11987654321", "5511987654321", "+0123456789", "+55", "abc", ""]) {
      assert.equal(normalizeE164(raw), null, raw);
    }
  });
});

describe("fuso e datas", () => {
  it("mostra a data no fuso pedido", () => {
    assert.match(formatInZone("2026-10-12T11:00:00Z", "America/Sao_Paulo"), /08:00/);
    assert.match(formatInZone("2026-10-12T11:00:00Z", "Europe/Lisbon"), /12:00/);
  });
  it("fuso inválido não derruba a tela", () => {
    assert.ok(formatInZone("2026-10-12T11:00:00Z", "Nao/Existe").length > 0);
  });
});

describe("erros de salvamento", () => {
  it("409 vira 'conflito', nunca sobrescreve", () => {
    assert.deepEqual(saveFailure(new ApiError(409, "versão"), "x"), { kind: "conflict" });
  });
  it("422 mostra a mensagem do backend; rede e 403 têm texto próprio", () => {
    const validation = saveFailure(new ApiError(422, "Horário inválido"), "x");
    assert.equal(validation.kind === "error" && validation.message, "Horário inválido");
    const offline = saveFailure(new ApiError(0, ""), "x");
    assert.match(offline.kind === "error" ? offline.message : "", /conectar/);
    const denied = saveFailure(new ApiError(403, ""), "x");
    assert.match(denied.kind === "error" ? denied.message : "", /permissão/);
  });
});

describe("permissões e navegação", () => {
  it("admin gerencia; gestor só consulta; vendedor não acessa Configurações → Notificações", () => {
    assert.equal(can(user("admin"), "notifications.manage"), true);
    assert.equal(can(user("admin"), "notifications.view"), true);
    assert.equal(can(user("gestor"), "notifications.view"), true);
    assert.equal(can(user("gestor"), "notifications.manage"), false);
    assert.equal(can(user("vendedor"), "notifications.view"), false);
    assert.equal(evaluateRouteAccess(user("vendedor"), "notifications.view"), "forbidden");
  });

  it("sessão de suporte consulta, mas não gerencia", () => {
    const support = user("admin", { impersonation: { mode: "write" } });
    assert.equal(can(support, "notifications.view"), true);
    assert.equal(can(support, "notifications.manage"), false);
  });

  it("papel desconhecido não tem acesso", () => {
    assert.equal(can(user("dono"), "notifications.view"), false);
  });

  it("a feature reservada fica desligada por padrão e a navegação não a expõe", () => {
    assert.equal(hasFeature({}, "notifications"), false);
    const nav = navSections(user("admin", { features: { notifications: false } }));
    const labels = nav.flatMap((s) => s.items.map((i) => i.label));
    assert.equal(
      labels.some((l) => /notifica/i.test(l)),
      false,
    );
  });
});
