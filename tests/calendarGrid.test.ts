// Agenda em grade: intervalos, navegação, eventos por dia e posicionamento.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eventSpan,
  eventsOnDay,
  isAllDayLike,
  layoutDay,
  shiftAnchor,
  viewRange,
  viewTitle,
} from "../src/utils/calendarGrid.ts";
import type { CalEvent } from "../src/types/event.ts";

const ev = (id: string, at: string, endsAt: string | null = null, extra: Partial<CalEvent> = {}): CalEvent => ({
  id,
  leadId: null,
  leadName: null,
  title: id,
  type: "reuniao",
  at: new Date(at).toISOString(),
  time: "",
  endsAt: endsAt ? new Date(endsAt).toISOString() : null,
  ...extra,
});

// 13/10/2026 é terça-feira (horário local do ambiente de teste).
const TUE = new Date(2026, 9, 13, 12, 0);

describe("intervalos da grade", () => {
  it("mês: 42 dias começando no domingo anterior ao dia 1", () => {
    const r = viewRange("month", TUE);
    assert.equal(r.days.length, 42);
    assert.equal(r.days[0]!.getDay(), 0);
    assert.deepEqual([r.days[0]!.getMonth(), r.days[0]!.getDate()], [8, 27]); // 27/set (1/out é quinta)
    assert.equal(r.to.getTime() - r.from.getTime(), 42 * 24 * 3600 * 1000 - (r.from.getTimezoneOffset() - r.to.getTimezoneOffset()) * 60000);
  });

  it("semana de domingo a sábado e dia único", () => {
    const week = viewRange("week", TUE);
    assert.deepEqual([week.days[0]!.getDate(), week.days[6]!.getDate()], [11, 17]);
    assert.equal(viewRange("day", TUE).days.length, 1);
  });

  it("navegar: mês sem estourar o dia, semana ±7, dia ±1", () => {
    assert.deepEqual(
      (() => {
        const d = shiftAnchor("month", new Date(2026, 0, 31), 1);
        return [d.getMonth(), d.getDate()];
      })(),
      [1, 1], // 31/jan + 1 mês = fevereiro (nunca 3/mar)
    );
    assert.equal(shiftAnchor("week", TUE, 1).getDate(), 20);
    assert.equal(shiftAnchor("day", TUE, -1).getDate(), 12);
    assert.equal(shiftAnchor("month", new Date(2026, 0, 15), -1).getFullYear(), 2025);
  });

  it("títulos em português", () => {
    assert.match(viewTitle("month", TUE), /outubro de 2026/);
    assert.match(viewTitle("day", TUE), /terça-feira, 13 de outubro/);
    assert.match(viewTitle("week", TUE), /11 – 17 out 2026/);
  });
});

describe("eventos por dia", () => {
  it("evento sem término dura 1 hora; término inválido volta ao padrão", () => {
    const a = eventSpan({ at: new Date(2026, 9, 13, 12).toISOString(), endsAt: null, allDay: false });
    assert.equal(a.end.getTime() - a.start.getTime(), 3600 * 1000);
    const bad = eventSpan({
      at: new Date(2026, 9, 13, 12).toISOString(),
      endsAt: new Date(2026, 9, 13, 11).toISOString(),
      allDay: false,
    });
    assert.equal(bad.end.getTime() - bad.start.getTime(), 3600 * 1000);
  });

  it("evento que passa da meia-noite aparece nos dois dias", () => {
    const night = ev("noite", "2026-10-13T22:00:00", "2026-10-14T02:00:00");
    assert.equal(eventsOnDay([night], new Date(2026, 9, 13)).length, 1);
    assert.equal(eventsOnDay([night], new Date(2026, 9, 14)).length, 1);
    assert.equal(eventsOnDay([night], new Date(2026, 9, 15)).length, 0);
  });

  it("ordena por horário e separa 'dia inteiro'", () => {
    const events = [
      ev("b", "2026-10-13T15:00:00"),
      ev("a", "2026-10-13T09:00:00"),
      ev("dia", "2026-10-13T00:00:00", "2026-10-14T00:00:00", { allDay: true }),
    ];
    const day = new Date(2026, 9, 13);
    assert.deepEqual(eventsOnDay(events, day).map((e) => e.id), ["dia", "a", "b"]);
    assert.equal(isAllDayLike(events[2]!, day), true);
    assert.deepEqual(layoutDay(events, day).map((p) => p.event.id), ["a", "b"]);
  });
});

describe("posicionamento sem sobreposição", () => {
  const day = new Date(2026, 9, 13);

  it("eventos separados ocupam a largura inteira", () => {
    const [a, b] = layoutDay([ev("a", "2026-10-13T09:00:00", "2026-10-13T10:00:00"), ev("b", "2026-10-13T11:00:00", "2026-10-13T12:00:00")], day);
    assert.deepEqual([a!.column, a!.columns, b!.column, b!.columns], [0, 1, 0, 1]);
    assert.deepEqual([a!.startMin, a!.endMin], [540, 600]);
  });

  it("eventos que se sobrepõem dividem a largura em colunas", () => {
    const placed = layoutDay(
      [
        ev("a", "2026-10-13T12:00:00", "2026-10-13T13:00:00"),
        ev("b", "2026-10-13T12:00:00", "2026-10-13T12:30:00"),
        ev("c", "2026-10-13T12:20:00", "2026-10-13T13:30:00"),
      ],
      day,
    );
    const by = Object.fromEntries(placed.map((p) => [p.event.id, p]));
    assert.equal(by.a!.columns, 3);
    assert.deepEqual([by.a!.column, by.b!.column, by.c!.column].sort(), [0, 1, 2]);
  });

  it("reaproveita a coluna quando o anterior já terminou", () => {
    const placed = layoutDay(
      [
        ev("a", "2026-10-13T09:00:00", "2026-10-13T10:00:00"),
        ev("b", "2026-10-13T09:30:00", "2026-10-13T10:30:00"),
        ev("c", "2026-10-13T10:00:00", "2026-10-13T11:00:00"),
      ],
      day,
    );
    const by = Object.fromEntries(placed.map((p) => [p.event.id, p]));
    assert.equal(by.c!.column, by.a!.column);
    assert.equal(by.a!.columns, 2);
  });

  it("evento curtíssimo continua com altura clicável e o corte no dia é respeitado", () => {
    const [short] = layoutDay([ev("s", "2026-10-13T09:00:00", "2026-10-13T09:05:00")], day);
    assert.ok(short!.endMin - short!.startMin >= 25);
    const [night] = layoutDay([ev("n", "2026-10-13T23:00:00", "2026-10-14T03:00:00")], day);
    assert.equal(night!.endMin, 1440);
    const [next] = layoutDay([ev("n", "2026-10-13T23:00:00", "2026-10-14T03:00:00")], new Date(2026, 9, 14));
    assert.deepEqual([next!.startMin, next!.endMin], [0, 180]);
  });
});
