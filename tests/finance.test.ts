import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  barRatio,
  budgetTone,
  compactCents,
  currentMonth,
  deltaPercent,
  formatCents,
  formatDelta,
  invoiceDueDate,
  invoiceRefOf,
  limitUsage,
  purchaseDueDate,
  monthLabel,
  monthTitle,
  parseMoneyToCents,
  shiftMonth,
} from "../src/utils/finance.ts";

describe("dinheiro", () => {
  it("formata centavos em reais (com negativo)", () => {
    assert.match(formatCents(123456), /^R\$\s1\.234,56$/);
    assert.match(formatCents(-5000), /^-R\$\s50,00$/);
    assert.match(formatCents(0), /^R\$\s0,00$/);
  });

  it("compacta para eixos", () => {
    assert.equal(compactCents(150_000), "1,5 mil");
    assert.equal(compactCents(250_000_000), "2,5 mi");
    assert.equal(compactCents(-80_000), "-800");
  });

  it("entende o que a pessoa digita", () => {
    assert.equal(parseMoneyToCents("1.234,56"), 123456);
    assert.equal(parseMoneyToCents("1234,5"), 123450);
    assert.equal(parseMoneyToCents("R$ 12"), 1200);
    assert.equal(parseMoneyToCents("1.500"), 150000); // milhar
    assert.equal(parseMoneyToCents("19.90"), 1990);
    assert.equal(parseMoneyToCents(""), 0);
    assert.equal(parseMoneyToCents("abc"), 0);
  });
});

describe("variação e meses", () => {
  it("calcula a variação sem dividir por zero", () => {
    assert.equal(deltaPercent(150, 100), 50);
    assert.equal(deltaPercent(50, 100), -50);
    assert.equal(deltaPercent(10, 0), null);
    assert.equal(formatDelta(50), "+50%");
    assert.equal(formatDelta(-12.4), "-12%");
    assert.equal(formatDelta(null), "—");
  });

  it("rótulos e navegação de mês", () => {
    assert.equal(monthLabel("2031-03"), "mar/31");
    assert.equal(monthTitle("2031-12"), "dezembro de 2031");
    assert.equal(shiftMonth("2031-01", -1), "2030-12");
    assert.equal(shiftMonth("2031-12", 1), "2032-01");
    assert.equal(shiftMonth("2031-03", -14), "2030-01");
    assert.equal(currentMonth(new Date(2031, 2, 15)), "2031-03");
  });
});

describe("gráficos e orçamento", () => {
  it("escala de barra limitada a 0–1", () => {
    assert.equal(barRatio(50, 100), 0.5);
    assert.equal(barRatio(500, 100), 1);
    assert.equal(barRatio(-50, 100), 0.5);
    assert.equal(barRatio(10, 0), 0);
  });

  it("tom do orçamento", () => {
    assert.equal(budgetTone(null), "none");
    assert.equal(budgetTone(0.5), "ok");
    assert.equal(budgetTone(0.8), "warn");
    assert.equal(budgetTone(1), "warn");
    assert.equal(budgetTone(1.01), "over");
  });
});

describe("fatura do cartão (espelha o servidor)", () => {
  it("compra até o fechamento entra na fatura do mês; depois, na seguinte", () => {
    assert.equal(invoiceRefOf("2031-03-10", 10), "2031-03");
    assert.equal(invoiceRefOf("2031-03-11", 10), "2031-04");
    assert.equal(invoiceRefOf("2031-12-20", 10), "2032-01");
  });

  it("vencimento no mesmo mês ou no seguinte", () => {
    assert.equal(invoiceDueDate("2031-03", 10, 20), "2031-03-20");
    assert.equal(invoiceDueDate("2031-03", 25, 5), "2031-04-05");
    assert.equal(invoiceDueDate("2031-12", 25, 5), "2032-01-05");
    assert.equal(purchaseDueDate("2031-03-11", 10, 20), "2031-04-20");
    assert.equal(purchaseDueDate("2031-03-26", 25, 5), "2031-05-05");
  });

  it("uso do limite", () => {
    assert.equal(limitUsage(250, 1000), 0.25);
    assert.equal(limitUsage(250, null), null);
    assert.equal(limitUsage(250, 0), null);
  });
});
