import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  defaultDueInput,
  isOverdue,
  isoToLocalInput,
  localDateTimeToIso,
  localInputToIso,
} from "../src/utils/datetime.ts";
import { clampPage, pageCount, rangeLabel } from "../src/utils/pagination.ts";
import { agendaRange, groupEventsByLocalDay, localDayKey } from "../src/utils/agenda.ts";
import { describeTimelineItem, timelineActor } from "../src/utils/leadTimeline.ts";
import { can } from "../src/auth/permissions.ts";
import type { LeadTimelineItem } from "../src/types/lead.ts";
import type { CalEvent } from "../src/types/event.ts";

describe("datas de tarefa/compromisso — sempre com fuso", () => {
  it("horário local digitado vira ISO UTC com Z (backend recusa sem fuso)", () => {
    const iso = localInputToIso("2026-09-27T14:30");
    assert.ok(iso?.endsWith("Z"));
    // ida e volta preserva o horário local digitado
    assert.equal(isoToLocalInput(iso!), "2026-09-27T14:30");
  });
  it("valor vazio ou inválido → null (nada é enviado)", () => {
    assert.equal(localInputToIso(""), null);
    assert.equal(localInputToIso("amanhã"), null);
    assert.equal(localDateTimeToIso("2026-13-45", "10:00"), null);
  });
  it("vencimento padrão = amanhã às 09:00 locais", () => {
    assert.equal(defaultDueInput(new Date(2026, 8, 27, 18, 0)), "2026-09-28T09:00");
  });
  it("atrasada só se não concluída e vencida", () => {
    const now = new Date("2026-09-27T12:00:00Z");
    assert.equal(isOverdue("2026-09-27T11:00:00Z", false, now), true);
    assert.equal(isOverdue("2026-09-27T11:00:00Z", true, now), false);
    assert.equal(isOverdue("2026-09-27T13:00:00Z", false, now), false);
  });
});

describe("paginação pelo total real", () => {
  it("conta páginas e rótulo de faixa", () => {
    assert.equal(pageCount(0, 25), 1);
    assert.equal(pageCount(25, 25), 1);
    assert.equal(pageCount(26, 25), 2);
    assert.equal(pageCount(1000, 25), 40);
    assert.equal(rangeLabel(2, 25, 132), "26–50 de 132");
    assert.equal(rangeLabel(6, 25, 132), "126–132 de 132");
    assert.equal(rangeLabel(1, 25, 0), "0 de 0");
  });
  it("clampPage volta para a última página válida", () => {
    assert.equal(clampPage(5, 50, 25), 2);
    assert.equal(clampPage(0, 50, 25), 1);
  });
});

describe("agenda — janela e agrupamento por dia LOCAL", () => {
  it("janela de 7 dias começa à meia-noite local de hoje", () => {
    const now = new Date(2026, 8, 27, 15, 0);
    const range = agendaRange("next7", now);
    assert.equal(new Date(range.from!).getTime(), new Date(2026, 8, 27).getTime());
    assert.equal(new Date(range.to!).getTime(), new Date(2026, 9, 4).getTime());
  });
  it("agrupa pelo dia local, ordenado, com Hoje/Amanhã", () => {
    const now = new Date(2026, 8, 27, 8, 0);
    const at = (d: number, h: number) => new Date(2026, 8, d, h, 0).toISOString();
    const ev = (id: string, iso: string): CalEvent => ({
      id,
      leadId: "l",
      leadName: "L",
      title: id,
      type: "reuniao",
      at: iso,
      time: "",
    });
    const days = groupEventsByLocalDay(
      [ev("b", at(28, 9)), ev("a", at(27, 23)), ev("c", at(27, 7))],
      now,
    );
    assert.deepEqual(
      days.map((d) => d.label),
      ["Hoje", "Amanhã"],
    );
    assert.deepEqual(
      days[0]?.events.map((e) => e.id),
      ["c", "a"],
    );
    assert.equal(localDayKey(at(27, 23)), "2026-09-27");
  });
});

describe("timeline comercial — só eventos reais", () => {
  const base = (
    type: string,
    payload: Record<string, unknown>,
    extra: Partial<LeadTimelineItem> = {},
  ) =>
    ({
      id: "1",
      type,
      createdAt: "2026-09-27T12:00:00Z",
      actorType: "user",
      actorName: "Ana",
      payload,
      text: null,
      ...extra,
    }) as LeadTimelineItem;

  it("mudança de etapa usa os nomes REAIS gravados no evento", () => {
    const v = describeTimelineItem(
      base("stage_changed", { from_stage_name: "Triagem", to_stage_name: "Demonstração" }),
    );
    assert.equal(v.detail, "Triagem → Demonstração");
  });
  it("ganho, perda, dono e tarefas", () => {
    assert.equal(
      describeTimelineItem(base("won", { to_stage_name: "Fechado" })).title,
      "Negócio ganho",
    );
    assert.equal(describeTimelineItem(base("lost", {})).title, "Negócio perdido");
    assert.equal(
      describeTimelineItem(base("owner_changed", { from_owner_name: null, to_owner_name: "Bia" }))
        .detail,
      "Sem responsável → Bia",
    );
    assert.equal(
      describeTimelineItem(base("task_completed", { task_title: "Ligar" })).detail,
      "Ligar",
    );
  });
  it("edição mostra valor antigo → novo dos campos comerciais", () => {
    const v = describeTimelineItem(
      base("updated", {
        changes: { probability: { from: 20, to: 60 } },
        fields: ["probability", "notes"],
      }),
    );
    assert.equal(v.detail, "Probabilidade: 20% → 60% · Editou: Notas");
  });
  it("criação via API e autor da integração", () => {
    const item = base(
      "created",
      { source: "api", to_stage_name: "Entrada" },
      { actorType: "api_key", actorName: null },
    );
    assert.equal(describeTimelineItem(item).title, "Lead criado via formulário/integração");
    assert.equal(timelineActor(item), "Integração (API)");
  });
  it("tipo desconhecido (backend mais novo) aparece neutro, sem quebrar", () => {
    assert.equal(describeTimelineItem(base("something_new", {})).title, "Atividade registrada");
  });
});

describe("permissões de responsável (espelham o backend)", () => {
  const as = (role: string) => ({ role, isPlatformStaff: false }) as never;
  it("só admin/gestor atribuem e veem a equipe inteira", () => {
    assert.equal(can(as("admin"), "leads.assign"), true);
    assert.equal(can(as("gestor"), "leads.assign"), true);
    assert.equal(can(as("vendedor"), "leads.assign"), false);
    assert.equal(can(as("vendedor"), "leads.viewAll"), false);
    assert.equal(can(as("gestor"), "users.create"), false);
  });
});
