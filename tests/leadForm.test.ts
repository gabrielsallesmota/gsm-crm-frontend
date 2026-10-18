import test from "node:test";
import assert from "node:assert/strict";
import { formFromLead, isFormDirty, telHref, validateLeadForm } from "../src/utils/leadForm.ts";
import { timelineKind } from "../src/utils/leadTimeline.ts";
import type { Lead } from "../src/types/lead.ts";

const lead = {
  name: "Maria",
  company: "Sol",
  phone: "(11) 98765-4321",
  email: "m@sol.com",
  value: 100,
  probability: 35,
  origin: "google",
  notes: "",
  tags: ["a", "b"],
} as unknown as Lead;

test("formulário sem mudanças não está sujo; espaços nas pontas não contam", () => {
  const f = formFromLead(lead);
  assert.equal(isFormDirty(f, lead), false);
  assert.equal(isFormDirty({ ...f, name: " Maria " }, lead), false);
  assert.equal(isFormDirty({ ...f, tags: ["b", "a"] }, lead), false);
  assert.equal(isFormDirty({ ...f, tags: ["a"] }, lead), true);
  assert.equal(isFormDirty({ ...f, notes: "x" }, lead), true);
});

test("validação: nome obrigatório, e-mail, limites e probabilidade", () => {
  const f = formFromLead(lead);
  assert.deepEqual(validateLeadForm(f), {});
  assert.ok(validateLeadForm({ ...f, name: "  " }).name);
  assert.ok(validateLeadForm({ ...f, email: "sem-arroba" }).email);
  assert.equal(validateLeadForm({ ...f, email: "" }).email, undefined);
  assert.ok(validateLeadForm({ ...f, company: "x".repeat(201) }).company);
  assert.ok(validateLeadForm({ ...f, probability: "150" }).probability);
  assert.equal(validateLeadForm({ ...f, probability: "" }).probability, undefined);
});

test("telHref exige dígitos suficientes e assume Brasil para números nacionais", () => {
  assert.equal(telHref("(11) 98765-4321"), "tel:+5511987654321");
  assert.equal(telHref("+55 11 98765-4321"), "tel:+5511987654321");
  assert.equal(telHref("123"), null);
});

test("timelineKind agrupa só tipos conhecidos", () => {
  assert.equal(timelineKind("comment"), "comment");
  assert.equal(timelineKind("task_completed"), "task");
  assert.equal(timelineKind("won"), "stage");
  assert.equal(timelineKind("updated"), "data");
  assert.equal(timelineKind("activity"), "activity");
  assert.equal(timelineKind("novo_tipo"), "other");
});

import { needsLostConfirmation } from "../src/utils/pipelineBoard.ts";

test("D-03: só pede confirmação ao ENTRAR em etapa perdida (não entre duas perdidas, não na mesma)", () => {
  const novo = { id: "a", isLost: false };
  const perdido = { id: "p", isLost: true };
  const outroPerdido = { id: "p2", isLost: true };
  assert.equal(needsLostConfirmation(novo, perdido), true);
  assert.equal(needsLostConfirmation(undefined, perdido), true);
  assert.equal(needsLostConfirmation(perdido, perdido), false);
  assert.equal(needsLostConfirmation(perdido, outroPerdido), false);
  assert.equal(needsLostConfirmation(novo, { id: "g", isLost: false }), false);
});

import { activeNavTarget } from "../src/layouts/navigation.ts";

test("menu: só UM item ativo — o de caminho mais específico (Integrações × Configurações)", () => {
  const items = [{ to: "/configuracoes" }, { to: "/configuracoes/integracoes" }, { to: "/pipeline" }];
  assert.equal(activeNavTarget(items, "/configuracoes/integracoes"), "/configuracoes/integracoes");
  assert.equal(activeNavTarget(items, "/configuracoes"), "/configuracoes");
  assert.equal(activeNavTarget(items, "/configuracoes/automacoes"), "/configuracoes");
  assert.equal(activeNavTarget(items, "/pipeline/x"), "/pipeline");
  assert.equal(activeNavTarget(items, "/pipelinex"), null);
});
