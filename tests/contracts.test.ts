import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { alertPreview, validateContractDraft } from "../src/utils/contracts.ts";

describe("validação do contrato (espelha o backend)", () => {
  it("aceita datas coerentes e campos opcionais vazios", () => {
    assert.equal(validateContractDraft({ startDate: "2026-01-01", endDate: "", renewalDate: "" }), null);
    assert.equal(
      validateContractDraft({ startDate: "2026-01-01", endDate: "2026-12-31", renewalDate: "2027-01-01" }),
      null,
    );
  });

  it("recusa início vazio, fim antes do início e renovação antes do início", () => {
    assert.match(validateContractDraft({ startDate: "", endDate: "", renewalDate: "" }) ?? "", /início/);
    assert.match(
      validateContractDraft({ startDate: "2026-05-01", endDate: "2026-04-01", renewalDate: "" }) ?? "",
      /fim/,
    );
    assert.match(
      validateContractDraft({ startDate: "2026-05-01", endDate: "", renewalDate: "2026-04-01" }) ?? "",
      /renovação/,
    );
  });
});

describe("prévia do aviso de renovação", () => {
  it("sem data de renovação não há prévia", () => {
    assert.equal(alertPreview("", "month_start", 0, null), null);
  });

  it("regra própria do contrato", () => {
    assert.equal(
      alertPreview("2031-06-20", "days_before", 10, null),
      "10 dias antes — a tarefa aparece em 10/06/2031.",
    );
    assert.equal(
      alertPreview("2031-03-31", "months_before", 1, { mode: "month_start", value: 0 }),
      "1 mês antes — a tarefa aparece em 28/02/2031.",
    );
  });

  it("sem regra própria usa o padrão da empresa, e diz isso", () => {
    assert.equal(
      alertPreview("2031-06-20", null, null, { mode: "month_start", value: 0 }),
      "Padrão da empresa: No 1º dia do mês da renovação — a tarefa aparece em 01/06/2031.",
    );
  });

  it("sem regra própria e sem acesso ao padrão (vendedor): texto neutro", () => {
    assert.equal(alertPreview("2031-06-20", null, null, null), "Aviso conforme o padrão da empresa.");
  });
});
