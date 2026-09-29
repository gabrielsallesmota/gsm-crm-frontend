import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { can } from "../src/auth/permissions.ts";
import {
  canManageCredential,
  credentialState,
  deliveryStatusLabel,
  deliveryTone,
  describeAttempt,
  expirationToIso,
  lastResultLabel,
  toggleItem,
  validateCredentialDraft,
  validateWebhookDraft,
  webhookState,
} from "../src/utils/integrations.ts";
import { describeTimelineItem } from "../src/utils/leadTimeline.ts";
import type { ApiCredential, WebhookEndpoint } from "../src/types/integrations.ts";
import type { LeadTimelineItem } from "../src/types/lead.ts";

function credential(over: Partial<ApiCredential> = {}): ApiCredential {
  return {
    id: "c1",
    name: "n8n",
    clientId: "gsm_live_abc",
    environment: "prod",
    status: "active",
    expired: false,
    scopes: ["leads:create"],
    createdAt: "2026-09-01T00:00:00Z",
    revokedAt: null,
    lastUsedAt: null,
    lastUsedIp: null,
    expiresAt: null,
    rotatedAt: null,
    previousSecretValidUntil: null,
    ...over,
  };
}

function endpoint(over: Partial<WebhookEndpoint> = {}): WebhookEndpoint {
  return {
    id: "w1",
    url: "https://hooks.example.com/crm",
    description: null,
    events: ["lead.created"],
    status: "active",
    secretHint: "abcd",
    consecutiveFailures: 0,
    disabledReason: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    lastDeliveryAt: null,
    lastDeliveryStatus: null,
    lastDeliveryStatusCode: null,
    ...over,
  };
}

describe("integrations.manage", () => {
  it("só admin do tenant gerencia integrações", () => {
    assert.equal(can({ role: "admin", isPlatformStaff: false }, "integrations.manage"), true);
    assert.equal(can({ role: "gestor", isPlatformStaff: false }, "integrations.manage"), false);
    assert.equal(can({ role: "vendedor", isPlatformStaff: false }, "integrations.manage"), false);
    assert.equal(can({ role: null, isPlatformStaff: true } as never, "integrations.manage"), false);
  });
});

describe("credenciais", () => {
  it("valida nome e ao menos um scope", () => {
    assert.match(validateCredentialDraft("  ", ["leads:create"]) ?? "", /nome/i);
    assert.match(validateCredentialDraft("n8n", []) ?? "", /permiss/i);
    assert.equal(validateCredentialDraft("n8n", ["leads:create"]), null);
  });

  it("toggle de scope não duplica", () => {
    assert.deepEqual(toggleItem(["a"], "b"), ["a", "b"]);
    assert.deepEqual(toggleItem(["a", "b"], "a"), ["b"]);
  });

  it("expiração vira ISO futuro ou null", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    assert.equal(expirationToIso("never", now), null);
    assert.equal(expirationToIso("30", now), "2026-10-29T12:00:00.000Z");
  });

  it("estado: revogada > expirada > em rotação > ativa", () => {
    assert.equal(credentialState(credential({ status: "revoked", expired: true })).label, "Revogada");
    assert.equal(credentialState(credential({ expired: true })).label, "Expirada");
    assert.equal(
      credentialState(credential({ previousSecretValidUntil: "2026-09-30T00:00:00Z" })).label,
      "Em rotação",
    );
    assert.equal(credentialState(credential()).tone, "ok");
  });

  it("revogada não oferece rotação/revogação", () => {
    assert.equal(canManageCredential(credential({ status: "revoked" })), false);
    assert.equal(canManageCredential(credential()), true);
  });

  it("o modelo de credencial não tem campo de hash nem secret", () => {
    const keys = Object.keys(credential());
    assert.ok(!keys.some((k) => /hash|secret$/i.test(k)));
  });
});

describe("webhooks", () => {
  it("valida URL https sem credenciais embutidas e ao menos um evento", () => {
    assert.match(validateWebhookDraft("nada", ["lead.created"]) ?? "", /URL/);
    assert.match(validateWebhookDraft("http://x.example.com", ["lead.created"]) ?? "", /https/);
    assert.match(
      validateWebhookDraft("https://u:p@x.example.com", ["lead.created"]) ?? "",
      /usuário/,
    );
    assert.match(validateWebhookDraft("https://x.example.com", []) ?? "", /evento/);
    assert.equal(validateWebhookDraft(" https://x.example.com/h ", ["lead.won"]), null);
  });

  it("estado do endpoint", () => {
    assert.equal(webhookState(endpoint({ status: "disabled" })).tone, "bad");
    assert.equal(webhookState(endpoint({ status: "paused" })).label, "Pausado");
    assert.equal(webhookState(endpoint({ consecutiveFailures: 3 })).tone, "warn");
    assert.equal(webhookState(endpoint()).label, "Ativo");
  });

  it("status e tentativas de entrega (200/500/timeout/retry)", () => {
    assert.equal(deliveryTone("succeeded"), "ok");
    assert.equal(deliveryTone("retrying"), "warn");
    assert.equal(deliveryTone("failed"), "bad");
    assert.equal(deliveryStatusLabel("retrying"), "Nova tentativa agendada");
    assert.equal(deliveryStatusLabel("algo_novo"), "algo_novo");
    const base = { attempt: 1, startedAt: "", error: null, responseExcerpt: null };
    assert.equal(
      describeAttempt({ ...base, statusCode: 500, outcome: "http_error", durationMs: 120 }),
      "HTTP 500 · Erro HTTP · 120 ms",
    );
    assert.equal(
      describeAttempt({ ...base, statusCode: null, outcome: "timeout", durationMs: 10000 }),
      "Tempo esgotado · 10000 ms",
    );
    assert.equal(lastResultLabel(401, null), "HTTP 401");
    assert.equal(lastResultLabel(null, "timeout"), "timeout");
    assert.equal(lastResultLabel(null, null), "—");
  });
});

describe("timeline: atividade de integração", () => {
  it("mostra tipo e texto da atividade", () => {
    const view = describeTimelineItem({
      id: "e1",
      type: "activity",
      payload: { activity_type: "whatsapp", text: "Cliente respondeu" },
    } as unknown as LeadTimelineItem);
    assert.equal(view.title, "Atividade: WhatsApp");
    assert.equal(view.detail, "Cliente respondeu");
  });
});
