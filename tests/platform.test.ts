import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { can, evaluateRouteAccess } from "../src/auth/permissions.ts";
import { FEATURE_DEFAULTS, hasFeature } from "../src/auth/features.ts";
import {
  formatCountdown,
  isImpersonating,
  isReadOnlySupport,
  secondsLeft,
} from "../src/auth/impersonation.ts";
import {
  describeAuditAction,
  emptyDraft,
  initialFeatures,
  slugify,
  validateStep,
} from "../src/platform/provisioning.ts";
import { createSessionClient } from "../src/repositories/api/sessionClient.ts";
import type { FeatureDefinition, PlanOption } from "../src/types/platform.ts";

const support = {
  sessionId: "s1",
  mode: "read_only",
  expiresAt: "2026-09-28T12:30:00Z",
  reason: "Ticket",
};
const staff = { role: "admin", isPlatformStaff: true };
const tenantAdmin = { role: "admin", isPlatformStaff: false };

describe("fronteira /platform (UI) — espelha o backend", () => {
  it("só platform staff enxerga o control plane", () => {
    assert.equal(can(staff, "platform.console"), true);
    assert.equal(can(tenantAdmin, "platform.console"), false);
    // tenant comum nem descobre que a área existe
    assert.equal(evaluateRouteAccess(tenantAdmin, "platform.console"), "not_found");
  });

  it("durante uma sessão de suporte, plataforma e área interna somem", () => {
    const supporting = { ...staff, impersonation: support };
    assert.equal(can(supporting, "platform.console"), false);
    assert.equal(can(supporting, "platform.internal"), false);
    // e o suporte não gerencia usuários do cliente
    assert.equal(can(supporting, "users.create"), false);
    // mas enxerga o CRM como o admin do cliente vê
    assert.equal(can(supporting, "settings.manage"), true);
  });
});

describe("features contratadas", () => {
  it("sem informação usa o default do catálogo (compatível com backend antigo)", () => {
    assert.equal(hasFeature({}, "crm"), true);
    assert.equal(hasFeature({}, "webhooks"), false);
    assert.equal(hasFeature(null, "reports"), FEATURE_DEFAULTS.reports);
  });
  it("o valor explícito do tenant vence", () => {
    assert.equal(hasFeature({ features: { crm: false } }, "crm"), false);
    assert.equal(hasFeature({ features: { reports: false } }, "crm"), true);
  });
});

describe("sessão de suporte", () => {
  it("identifica modo e tempo restante", () => {
    assert.equal(isImpersonating({ impersonation: support }), true);
    assert.equal(isImpersonating({ impersonation: null }), false);
    assert.equal(isReadOnlySupport(support), true);
    assert.equal(isReadOnlySupport({ ...support, mode: "write" }), false);
    const now = new Date("2026-09-28T12:00:00Z");
    assert.equal(secondsLeft(support.expiresAt, now), 1800);
    assert.equal(secondsLeft("2026-09-28T11:00:00Z", now), 0);
    assert.equal(formatCountdown(1800), "30:00");
    assert.equal(formatCountdown(3725), "1h 02min");
  });

  it("token de suporte (sem refresh) que recebe 401 encerra a sessão local", async () => {
    let expired = 0;
    const client = createSessionClient("http://api", async () =>
      new Response(JSON.stringify({ detail: "Sessão de suporte encerrada ou expirada" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    client.setTokens({ accessToken: "imp-token", refreshToken: "" });
    client.setOnSessionExpired(() => {
      expired += 1;
    });
    await assert.rejects(client.json("/api/v1/leads"));
    assert.equal(expired, 1);
  });
});

describe("assistente de provisionamento", () => {
  const catalog: FeatureDefinition[] = [
    { code: "crm", label: "CRM", description: "", defaultEnabled: true, available: true },
    { code: "reports", label: "Relatórios", description: "", defaultEnabled: true, available: true },
    { code: "webhooks", label: "Webhooks", description: "", defaultEnabled: false, available: false },
  ];
  const plan: PlanOption = {
    code: "basic",
    name: "Básico",
    priceCents: 9900,
    maxTenants: 1,
    maxApiKeys: 1,
    features: ["crm", "webhooks"],
  };

  it("slug a partir do nome (sem acento, minúsculo, hífens)", () => {
    assert.equal(slugify("Clínica São João & Filhos"), "clinica-sao-joao-filhos");
    assert.equal(slugify("  --Ótica--  "), "otica");
  });

  it("módulos iniciais: o que o plano sugere, nunca os reservados", () => {
    assert.deepEqual(initialFeatures(plan, catalog), {
      crm: true,
      reports: false,
      webhooks: false,
    });
    assert.deepEqual(initialFeatures(undefined, catalog), {
      crm: true,
      reports: true,
      webhooks: false,
    });
  });

  it("valida cada passo antes de avançar", () => {
    const draft = emptyDraft();
    assert.match(validateStep("basics", draft) ?? "", /nome/);
    const basics = { ...draft, name: "Clínica", slug: "clinica", planCode: "basic" };
    assert.equal(validateStep("basics", basics), null);
    assert.match(validateStep("basics", { ...basics, slug: "Com Espaço" }) ?? "", /Identificador/);
    assert.match(validateStep("admin", basics) ?? "", /administrador/);
    const admin = { ...basics, adminName: "Ana", adminEmail: "ana@clinica.com" };
    assert.equal(validateStep("admin", admin), null);
    assert.match(validateStep("features", { ...admin, features: { crm: false } }) ?? "", /módulo/);
    assert.equal(validateStep("features", { ...admin, features: { crm: true } }), null);
  });

  it("ações de auditoria têm rótulo legível (desconhecida passa como está)", () => {
    assert.equal(describeAuditAction("impersonation.elevated"), "Suporte: escrita liberada");
    assert.equal(describeAuditAction("algo.novo"), "algo.novo");
  });
});
