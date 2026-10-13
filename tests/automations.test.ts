// CRM-003C — conversão, validação e rótulos das automações comerciais (Node puro).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can } from "../src/auth/permissions.ts";
import {
  RULE_COPY,
  changedParams,
  toAutomationRule,
  toAutomationRules,
  validateDraft,
} from "../src/utils/automations.ts";

const RAW_FOLLOW_UP = {
  key: "follow_up",
  enabled: true,
  params: { days_without_activity: 3, due_in_days: 1 },
  limits: {
    days_without_activity: { minimum: 1, maximum: 90, default: 3 },
    due_in_days: { minimum: 0, maximum: 14, default: 1 },
  },
  version: 2,
  persisted: true,
  updated_at: "2026-10-13T12:00:00Z",
};

describe("conversão da resposta", () => {
  it("lê regra, parâmetros e limites", () => {
    const rule = toAutomationRule(RAW_FOLLOW_UP);
    assert.ok(rule);
    assert.equal(rule.key, "follow_up");
    assert.equal(rule.enabled, true);
    assert.equal(rule.version, 2);
    assert.deepEqual(rule.params, { days_without_activity: 3, due_in_days: 1 });
    assert.deepEqual(rule.limits.days_without_activity, { minimum: 1, maximum: 90, default: 3 });
  });

  it("ignora regra desconhecida e resposta torta, sem quebrar a tela", () => {
    assert.equal(toAutomationRule({ key: "futura" }), null);
    assert.equal(toAutomationRule(null), null);
    assert.deepEqual(toAutomationRules(undefined), []);
    assert.deepEqual(
      toAutomationRules({ items: [RAW_FOLLOW_UP, { key: "futura" }, 7] }).map((r) => r.key),
      ["follow_up"],
    );
  });

  it("enabled só é verdadeiro quando o servidor diz true", () => {
    assert.equal(toAutomationRule({ ...RAW_FOLLOW_UP, enabled: "true" })?.enabled, false);
  });
});

describe("validação do rascunho", () => {
  const rule = toAutomationRule(RAW_FOLLOW_UP)!;

  it("aceita valores dentro dos limites do servidor", () => {
    assert.equal(validateDraft(rule, { days_without_activity: 1, due_in_days: 0 }), null);
    assert.equal(validateDraft(rule, { days_without_activity: 90, due_in_days: 14 }), null);
  });

  it("recusa vazio, decimal e fora do intervalo com mensagem em português", () => {
    assert.match(
      validateDraft(rule, { days_without_activity: null, due_in_days: 1 })!,
      /número inteiro/,
    );
    assert.match(
      validateDraft(rule, { days_without_activity: 2.5, due_in_days: 1 })!,
      /número inteiro/,
    );
    assert.match(
      validateDraft(rule, { days_without_activity: 0, due_in_days: 1 })!,
      /entre 1 e 90/,
    );
    assert.match(
      validateDraft(rule, { days_without_activity: 3, due_in_days: 15 })!,
      /entre 0 e 14/,
    );
  });
});

describe("o que muda no PUT", () => {
  const rule = toAutomationRule(RAW_FOLLOW_UP)!;

  it("envia só o parâmetro alterado", () => {
    assert.deepEqual(changedParams(rule, { days_without_activity: 7, due_in_days: 1 }), {
      days_without_activity: 7,
    });
  });

  it("nada alterado ou campo vazio = nada a enviar", () => {
    assert.equal(changedParams(rule, { days_without_activity: 3, due_in_days: 1 }), undefined);
    assert.equal(changedParams(rule, { days_without_activity: null, due_in_days: 1 }), undefined);
  });
});

describe("textos e permissões", () => {
  it("toda regra tem texto para cada parâmetro e diz se avisa pessoas", () => {
    for (const key of ["follow_up", "overdue_task", "stalled_opportunity"] as const) {
      assert.ok(RULE_COPY[key].title.length > 0);
      assert.ok(Object.keys(RULE_COPY[key].params).length > 0);
    }
    assert.equal(RULE_COPY.follow_up.notifies, false); // só cria tarefa interna
    assert.equal(RULE_COPY.overdue_task.notifies, true);
  });

  it("admin gerencia, gestor só consulta, vendedor nada; suporte da GSM nunca altera", () => {
    const base = { isPlatformStaff: false as const };
    assert.equal(can({ ...base, role: "admin" }, "automations.manage"), true);
    assert.equal(can({ ...base, role: "admin" }, "automations.view"), true);
    assert.equal(can({ ...base, role: "gestor" }, "automations.view"), true);
    assert.equal(can({ ...base, role: "gestor" }, "automations.manage"), false);
    assert.equal(can({ ...base, role: "vendedor" }, "automations.view"), false);
    const supporting = {
      ...base,
      role: "admin" as const,
      impersonation: { sessionId: "s", tenantId: "t", tenantName: "x", mode: "read_only" },
    };
    assert.equal(can(supporting as never, "automations.manage"), false);
  });
});
