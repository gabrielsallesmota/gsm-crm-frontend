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
