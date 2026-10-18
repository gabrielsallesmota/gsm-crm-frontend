import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  addDays,
  addMonths,
  alertModeFromIndex,
  alertModeToIndex,
  describeAlert,
  fmtDate,
  renewalAlertDate,
  renewalUrgency,
} from "../src/utils/renewal.ts";

describe("alerta de renovação (espelha o backend)", () => {
  it("1º dia do mês da renovação", () => {
    assert.equal(renewalAlertDate("2031-06-20", "month_start", 0), "2031-06-01");
    assert.equal(renewalAlertDate("2031-06-01", "month_start", 0), "2031-06-01");
  });

  it("N dias antes, cruzando mês e ano", () => {
    assert.equal(renewalAlertDate("2031-06-20", "days_before", 10), "2031-06-10");
    assert.equal(renewalAlertDate("2031-01-05", "days_before", 10), "2030-12-26");
  });

  it("N meses antes preserva o dia e ajusta fim de mês (31/03 − 1 mês = 28/02)", () => {
    assert.equal(renewalAlertDate("2031-06-15", "months_before", 3), "2031-03-15");
    assert.equal(renewalAlertDate("2031-03-31", "months_before", 1), "2031-02-28");
    assert.equal(renewalAlertDate("2032-03-31", "months_before", 1), "2032-02-29"); // bissexto
    assert.equal(renewalAlertDate("2031-02-10", "months_before", 3), "2030-11-10");
  });

  it("addMonths/addDays aceitam valores negativos e grandes", () => {
    assert.equal(addMonths("2031-01-31", 1), "2031-02-28");
    assert.equal(addMonths("2031-01-15", -13), "2029-12-15");
    assert.equal(addDays("2031-03-01", -1), "2031-02-28");
    assert.equal(addDays("2031-12-31", 1), "2032-01-01");
  });
});

describe("textos e urgência", () => {
  it("descreve a regra", () => {
    assert.equal(describeAlert("month_start", 0), "No 1º dia do mês da renovação");
    assert.equal(describeAlert("days_before", 1), "1 dia antes");
    assert.equal(describeAlert("days_before", 15), "15 dias antes");
    assert.equal(describeAlert("months_before", 1), "1 mês antes");
    assert.equal(describeAlert("months_before", 3), "3 meses antes");
    assert.equal(describeAlert("days_before", 0), "No dia da renovação");
  });

  it("urgência: vencida, em breve (até 30 dias) e ok", () => {
    assert.equal(renewalUrgency("2031-05-31", "2031-06-01"), "overdue");
    assert.equal(renewalUrgency("2031-06-01", "2031-06-01"), "soon");
    assert.equal(renewalUrgency("2031-07-01", "2031-06-01"), "soon");
    assert.equal(renewalUrgency("2031-07-02", "2031-06-01"), "ok");
  });

  it("índice numérico do padrão do tenant ↔ modo", () => {
    assert.equal(alertModeFromIndex(0), "month_start");
    assert.equal(alertModeFromIndex(1), "days_before");
    assert.equal(alertModeFromIndex(2), "months_before");
    assert.equal(alertModeFromIndex(9), "month_start");
    assert.equal(alertModeToIndex("months_before"), 2);
  });

  it("formata data sem depender de fuso", () => {
    assert.equal(fmtDate("2031-06-20"), "20/06/2031");
    assert.equal(fmtDate(null), "—");
  });
});
