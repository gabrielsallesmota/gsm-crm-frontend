// Agenda em grade (mês, semana e dia) com os componentes REAIS (jsdom).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonthGrid, TimeGrid } from "../../src/components/calendar/AgendaGrid";
import { EventDetailsModal } from "../../src/components/calendar/EventDetailsModal";
import { viewRange } from "../../src/utils/calendarGrid";
import type { CalEvent } from "../../src/types/event";

afterEach(cleanup);

const TUE = new Date(2026, 9, 13, 12, 0);

const ev = (id: string, at: Date, minutes = 60, extra: Partial<CalEvent> = {}): CalEvent => ({
  id,
  leadId: null,
  leadName: null,
  title: id,
  type: "reuniao",
  at: at.toISOString(),
  time: "",
  endsAt: new Date(at.getTime() + minutes * 60000).toISOString(),
  ...extra,
});

describe("grade do mês", () => {
  const days = viewRange("month", TUE).days;
  const render_ = (events: CalEvent[], extra: Partial<Parameters<typeof MonthGrid>[0]> = {}) => {
    const onOpen = vi.fn();
    const onPickDay = vi.fn();
    render(
      <MonthGrid events={events} days={days} today={TUE} anchorMonth={9} onOpen={onOpen} onPickDay={onPickDay} {...extra} />,
    );
    return { onOpen, onPickDay };
  };

  it("mostra 42 dias, cabeçalho de semana e marca o dia de hoje", () => {
    render_([]);
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]);
    expect(screen.getByRole("grid", { name: "Calendário do mês" })).toBeTruthy();
  });

  it("evento aparece no dia certo, com hora e título, e abre ao clicar", () => {
    const { onOpen } = render_([ev("Reunião Nova Estação", new Date(2026, 9, 13, 12, 0))]);
    const chip = screen.getByRole("button", { name: /Reunião Nova Estação, 12:00/ });
    expect(chip.textContent).toContain("12:00");
    fireEvent.click(chip);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]![0].id).toBe("Reunião Nova Estação");
  });

  it("mostra até 3 por dia e leva ao dia no '+N mais'", () => {
    const events = [1, 2, 3, 4, 5].map((n) => ev(`e${n}`, new Date(2026, 9, 13, 8 + n)));
    const { onPickDay } = render_(events);
    expect(screen.getAllByRole("button", { name: /^e\d, / })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "+2 mais" }));
    expect(onPickDay).toHaveBeenCalledTimes(1);
    expect(onPickDay.mock.calls[0]![0].getDate()).toBe(13);
  });

  it("clicar no número do dia abre o dia; o rótulo diz quantos compromissos há", () => {
    const { onPickDay } = render_([ev("a", new Date(2026, 9, 13, 9)), ev("b", new Date(2026, 9, 13, 10))]);
    const day = screen.getByRole("button", { name: /terça-feira, 13 de outubro, 2 compromisso/ });
    fireEvent.click(day);
    expect(onPickDay).toHaveBeenCalled();
  });

  it("evento de vários dias aparece em cada dia; origem Google fica no rótulo (leitor de tela)", () => {
    render_([
      ev("Viagem", new Date(2026, 9, 14, 20), 60 * 30, { source: "google", readOnly: true }),
    ]);
    const chips = screen.getAllByRole("button", { name: /Viagem, 20:00, Google/ });
    expect(chips.length).toBeGreaterThanOrEqual(2);
  });
});

describe("grade de semana e dia", () => {
  const week = viewRange("week", TUE).days;

  function setup(events: CalEvent[], days = week) {
    const onOpen = vi.fn();
    const onPickDay = vi.fn();
    const onCreateAt = vi.fn();
    Element.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 1248, width: 100, height: 1248, x: 0, y: 0, toJSON: () => ({}) });
    render(<TimeGrid events={events} days={days} today={TUE} now={TUE} onOpen={onOpen} onPickDay={onPickDay} onCreateAt={onCreateAt} />);
    return { onOpen, onPickDay, onCreateAt };
  }

  it("semana: 7 colunas com os dias e 24 rótulos de hora", () => {
    setup([]);
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(screen.getByText("13:00")).toBeTruthy();
    expect(screen.getByRole("grid", { name: "Agenda da semana" })).toBeTruthy();
  });

  it("evento com hora vira bloco; dois no mesmo horário dividem a largura", () => {
    setup([ev("A", new Date(2026, 9, 13, 12, 0)), ev("B", new Date(2026, 9, 13, 12, 0), 30)]);
    const a = screen.getByRole("button", { name: /^A, 12:00/ });
    const b = screen.getByRole("button", { name: /^B, 12:00/ });
    expect(a.style.width).toContain("50%");
    expect(b.style.width).toContain("50%");
    expect(a.style.left).not.toBe(b.style.left);
    expect(parseFloat(a.style.top)).toBeCloseTo((12 * 60 * 52) / 60, 0);
  });

  it("'dia inteiro' vai para a faixa do topo", () => {
    setup([ev("Feriado", new Date(2026, 9, 13, 0, 0), 24 * 60, { allDay: true })]);
    expect(screen.getByText("dia todo")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Feriado, dia inteiro/ })).toBeTruthy();
  });

  it("clicar numa hora vazia cria um compromisso naquele horário (meia em meia hora)", () => {
    const { onCreateAt } = setup([], [new Date(2026, 9, 13)]);
    const cell = screen.getByRole("gridcell");
    // y = 9h30 => 9.5 * 52px
    fireEvent.click(cell, { clientY: 9.5 * 52 + 2 });
    expect(onCreateAt).toHaveBeenCalledTimes(1);
    const at = onCreateAt.mock.calls[0]![0] as Date;
    expect([at.getHours(), at.getMinutes()]).toEqual([9, 30]);
  });

  it("clicar no cabeçalho do dia abre aquele dia", () => {
    const { onPickDay } = setup([]);
    fireEvent.click(screen.getByRole("columnheader", { name: /terça-feira, 13 de outubro/ }));
    expect(onPickDay.mock.calls[0]![0].getDate()).toBe(13);
  });

  it("dia: uma coluna, rotulada como agenda do dia", () => {
    setup([], [new Date(2026, 9, 13)]);
    expect(screen.getAllByRole("columnheader")).toHaveLength(1);
    expect(screen.getByRole("grid", { name: "Agenda do dia" })).toBeTruthy();
  });
});

describe("detalhes do compromisso", () => {
  const mount = (event: CalEvent) =>
    render(
      <MemoryRouter>
        <EventDetailsModal event={event} onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />
      </MemoryRouter>,
    );

  it("compromisso do CRM pode ser editado e excluído", () => {
    mount(ev("Visita", new Date(2026, 9, 13, 15), 60, { leadId: "l1", leadName: "Acme", type: "visita" }));
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Acme" })).toBeTruthy();
    expect(screen.getByText(/terça-feira, 13 de outubro de 2026 · 15:00 – 16:00/)).toBeTruthy();
  });

  it("do Google é somente leitura, com aviso e link para o original", () => {
    mount(
      ev("Alinhamento", new Date(2026, 9, 13, 12), 60, {
        source: "google",
        readOnly: true,
        externalUrl: "https://calendar.google.com/e/1",
      }),
    );
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
    expect(screen.getByRole("note").textContent).toMatch(/somente leitura/);
    expect((screen.getByRole("link", { name: "Abrir no Google" }) as HTMLAnchorElement).target).toBe("_blank");
    expect(within(screen.getByRole("dialog")).getByText("Pessoal (sem lead)")).toBeTruthy();
  });
});
