// CRM-008 — utilitários CLIENT-FACING que antes não tinham teste nenhum:
// parser do CSV de importação de leads, escolha/renderização do template de
// WhatsApp por (estágio, origem), link `wa.me`, filtro de período do
// dashboard e formatação de telefone.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseCsv, readFileAsText } from "../src/utils/csv.ts";
import {
  buildWhatsappUrl,
  findMatchingLeadTemplate,
  renderLeadMessage,
} from "../src/utils/leadMessageTemplates.ts";
import {
  lastMonthPeriod,
  last7DaysPeriod,
  thisMonthPeriod,
  todayPeriod,
} from "../src/utils/periods.ts";
import { formatPhone, onlyDigits, toWhatsappPhone } from "../src/utils/phone.ts";
import type { Lead, LeadMessageTemplate } from "../src/types/lead.ts";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    tenantId: "t",
    name: "Maria Souza",
    company: "Clínica Sorriso",
    role: "",
    phone: "",
    whatsapp: "",
    phoneNormalized: "5511999990000",
    email: "",
    city: "Campinas",
    state: "SP",
    notes: "",
    pipelineId: "p",
    stageId: "s1",
    ownerId: "u",
    value: 0,
    probability: 0,
    origin: "instagram",
    tags: [],
    createdAt: "2026-10-01T12:00:00Z",
    updatedAt: "2026-10-01T12:00:00Z",
    lastInteractionAt: null,
    ...overrides,
  };
}

function template(stageId: string, origin: string | null, message: string): LeadMessageTemplate {
  return {
    id: `${stageId}-${origin ?? "any"}`,
    stageId,
    origin,
    message,
    createdAt: "2026-10-01T12:00:00Z",
    updatedAt: "2026-10-01T12:00:00Z",
  };
}

describe("parseCsv — importação de leads", () => {
  it("detecta `;` (padrão do Excel em português) e `,`", () => {
    assert.deepEqual(parseCsv("nome;telefone\nAna;119").rows, [["Ana", "119"]]);
    assert.deepEqual(parseCsv("nome,telefone\nAna,119").rows, [["Ana", "119"]]);
  });

  it("remove o BOM e apara os cabeçalhos", () => {
    const { headers } = parseCsv("﻿ Nome ; Telefone \nAna;1");
    assert.deepEqual(headers, ["Nome", "Telefone"]);
  });

  it("aceita aspas com separador, quebra de linha e aspas escapadas dentro do campo", () => {
    const text = 'nome,obs\n"Silva, Ana","linha 1\nlinha 2"\n"Bar ""do Zé""",x';
    assert.deepEqual(parseCsv(text).rows, [
      ["Silva, Ana", "linha 1\nlinha 2"],
      ['Bar "do Zé"', "x"],
    ]);
  });

  it("aceita CRLF e ignora linhas totalmente vazias", () => {
    const { rows } = parseCsv("nome;cidade\r\nAna;SP\r\n;\r\n\r\nBia;RJ\r\n");
    assert.deepEqual(rows, [
      ["Ana", "SP"],
      ["Bia", "RJ"],
    ]);
  });

  it("arquivo vazio não quebra", () => {
    assert.deepEqual(parseCsv(""), { headers: [], rows: [] });
  });
});

describe("readFileAsText — codificação do arquivo", () => {
  it("lê UTF-8 (com ou sem BOM) sem perder acento", async () => {
    const utf8 = new File([new TextEncoder().encode("﻿nome\nCrânio")], "a.csv");
    assert.equal(await readFileAsText(utf8), "nome\nCrânio");
  });

  it("cai para Windows-1252 quando o Excel salvou em ANSI", async () => {
    // "Crânio" em Windows-1252: â = 0xE2 (byte inválido sozinho em UTF-8)
    const ansi = new File([new Uint8Array([0x43, 0x72, 0xe2, 0x6e, 0x69, 0x6f])], "a.csv");
    assert.equal(await readFileAsText(ansi), "Crânio");
  });
});

describe("template de WhatsApp do lead (estágio × origem)", () => {
  const templates = [
    template("s1", null, "Oi {nome}, tudo bem?"),
    template("s1", "instagram", "Oi {nome}, vi a {empresa} no Instagram ({cidade}/{estado})"),
    template("s2", null, "Outro estágio"),
  ];

  it("prefere o template específico da origem do lead", () => {
    const chosen = findMatchingLeadTemplate(lead(), templates);
    assert.equal(chosen?.origin, "instagram");
    assert.equal(
      chosen && renderLeadMessage(chosen, lead()),
      "Oi Maria Souza, vi a Clínica Sorriso no Instagram (Campinas/SP)",
    );
  });

  it("cai no coringa do estágio quando não há template da origem", () => {
    const chosen = findMatchingLeadTemplate(lead({ origin: "whatsapp" }), templates);
    assert.equal(chosen?.origin, null);
    assert.equal(chosen?.stageId, "s1");
  });

  it("nunca usa template de outro estágio; sem template → undefined", () => {
    assert.equal(findMatchingLeadTemplate(lead({ stageId: "s9" }), templates), undefined);
  });

  it("placeholder sem valor vira vazio (nunca o token cru)", () => {
    const text = renderLeadMessage(template("s1", null, "{empresa}|{cidade}"), lead({ company: "", city: "" }));
    assert.equal(text, "|");
  });

  it("link wa.me usa o telefone normalizado e codifica a mensagem", () => {
    assert.equal(
      buildWhatsappUrl("5511999990000", "Olá & até já?"),
      "https://wa.me/5511999990000?text=Ol%C3%A1%20%26%20at%C3%A9%20j%C3%A1%3F",
    );
  });
});

describe("período do dashboard (datas locais YYYY-MM-DD)", () => {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const days = (from: string, to: string) =>
    Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000);

  it("hoje = um único dia", () => {
    const p = todayPeriod();
    assert.match(p.dateFrom ?? "", ISO);
    assert.equal(p.dateFrom, p.dateTo);
  });

  it("últimos 7 dias incluem hoje (6 dias de diferença)", () => {
    const p = last7DaysPeriod();
    assert.equal(days(p.dateFrom ?? "", p.dateTo ?? ""), 6);
    assert.equal(p.dateTo, todayPeriod().dateTo);
  });

  it("este mês começa no dia 1 e vai até hoje", () => {
    const p = thisMonthPeriod();
    assert.ok(p.dateFrom?.endsWith("-01"));
    assert.equal(p.dateTo, todayPeriod().dateTo);
  });

  it("mês passado vai do dia 1 ao último dia, terminando antes deste mês", () => {
    const p = lastMonthPeriod();
    assert.ok(p.dateFrom?.endsWith("-01"));
    assert.equal(days(p.dateTo ?? "", thisMonthPeriod().dateFrom ?? ""), 1);
  });
});

describe("telefone", () => {
  it("formata incrementalmente e trava em 11 dígitos", () => {
    assert.equal(formatPhone("11"), "11");
    assert.equal(formatPhone("1191234"), "(11) 9123-4");
    assert.equal(formatPhone("1133334444"), "(11) 3333-4444");
    assert.equal(formatPhone("11912345678999"), "(11) 91234-5678");
  });

  it("número para o wa.me: só dígitos com DDI 55, sem duplicar o DDI", () => {
    assert.equal(onlyDigits("(11) 91234-5678"), "11912345678");
    assert.equal(toWhatsappPhone("(11) 91234-5678"), "5511912345678");
    assert.equal(toWhatsappPhone("+55 11 91234-5678"), "5511912345678");
    assert.equal(toWhatsappPhone("011 91234-5678"), "5511912345678");
    assert.equal(toWhatsappPhone(""), "");
  });
});
