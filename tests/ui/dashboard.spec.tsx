// Dashboard (revisão): fila de atenção, variação contra o período anterior, aviso de valor ausente,
// valor por etapa no funil e ranking por responsável. Serviços substituídos: nada chama rede.
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/DashboardService", () => ({
  dashboardService: { getMetrics: vi.fn() },
}));
vi.mock("../../src/services/PipelinesService", () => ({ pipelinesService: { list: vi.fn() } }));
vi.mock("../../src/services/UsersService", () => ({ usersService: { directory: vi.fn() } }));
vi.mock("../../src/components/onboarding/OnboardingChecklist", () => ({
  OnboardingChecklist: () => null,
}));

import { DashboardPage } from "../../src/pages/DashboardPage";
import { dashboardService } from "../../src/services/DashboardService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { usersService } from "../../src/services/UsersService";
import { NO_ATTENTION, type DashboardMetrics } from "../../src/types/dashboard";
import { invalidateShared } from "../../src/utils/requestCache";
import { ADMIN, VENDEDOR, renderApp } from "./support/harness";

const metrics = vi.mocked(dashboardService.getMetrics);
afterEach(cleanup);

function data(over: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return {
    totalLeads: 25,
    today: 8,
    week: 16,
    month: 25,
    closed: 5,
    conversionRate: 20,
    forecastRevenue: 12_900,
    closedRevenue: 9_500,
    avgCloseDays: 3,
    open: 20,
    lost: 0,
    originLegend: [
      { key: "whatsapp", label: "WhatsApp", color: "#2ee66e", count: 25, pct: "100%" },
    ],
    funnel: [
      {
        key: "a",
        label: "Novo",
        color: "#4aa3ff",
        count: 20,
        widthPct: "80%",
        pct: "80%",
        valueLabel: "R$ 18,0k",
        withoutValue: 3,
      },
      {
        key: "b",
        label: "Ganho",
        color: "#2ee66e",
        count: 5,
        widthPct: "20%",
        pct: "20%",
        valueLabel: "R$ 9,5k",
        withoutValue: 0,
      },
    ],
    weekSeries: [{ day: "Ter", count: 8, heightPct: "100%", isToday: true }],
    openWithoutValue: 0,
    wonWithoutValue: 0,
    stalled: [],
    owners: [],
    previous: null,
    attention: NO_ATTENTION,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateShared("pipelines:t1");
  invalidateShared("team-directory:t1");
  vi.mocked(pipelinesService.list).mockResolvedValue([]);
  vi.mocked(usersService.directory).mockResolvedValue([
    { id: "u-admin", name: "Ana Admin", role: "admin" },
    { id: "u-vera", name: "Vera Vendedora", role: "vendedor" },
  ]);
});

const open = (user = ADMIN) => renderApp(<DashboardPage />, { user });

describe("Dashboard — o que pede atenção", () => {
  it("lista tarefas atrasadas, leads parados, parcelas vencidas e renovações com link", async () => {
    metrics.mockResolvedValue(
      data({
        attention: {
          tasksOverdue: 3,
          tasksToday: 1,
          stalledLeads: 2,
          renewalsNext30Days: 4,
          clientsOverdue: 1,
        },
        stalled: [{ id: "L1", name: "Clínica Aurora", days: 21 }],
      }),
    );
    open();
    const panel = await screen.findByRole("region", { name: "Precisa de atenção" });
    expect(within(panel).getByText("tarefas atrasadas").closest("a")?.getAttribute("href")).toBe(
      "/tarefas",
    );
    expect(within(panel).getByText("tarefa para hoje")).toBeTruthy();
    expect(within(panel).getByText("leads parados há 7+ dias")).toBeTruthy();
    expect(
      within(panel).getByText("cliente com parcela vencida").closest("a")?.getAttribute("href"),
    ).toBe("/clientes");
    expect(within(panel).getByText("renovações nos próximos 30 dias")).toBeTruthy();
    const lead = within(panel).getByText("Clínica Aurora").closest("a");
    expect(lead?.getAttribute("href")).toBe("/leads/L1");
    expect(within(panel).getByText("21 dias")).toBeTruthy();
  });

  it("sem pendências diz que está tudo em dia, em vez de uma lista vazia", async () => {
    metrics.mockResolvedValue(data());
    open();
    const panel = await screen.findByRole("region", { name: "Precisa de atenção" });
    expect(within(panel).getByText(/Tudo em dia/)).toBeTruthy();
  });

  it("vendedor vê 'seus itens'; administrador vê 'toda a equipe'", async () => {
    metrics.mockResolvedValue(data());
    open(VENDEDOR);
    expect(await screen.findByText(/seus itens/)).toBeTruthy();
    cleanup();
    open(ADMIN);
    expect(await screen.findByText(/toda a equipe · agora/)).toBeTruthy();
  });
});

describe("Dashboard — dado ausente e comparação", () => {
  it("avisa quando há leads em andamento sem valor (a previsão os conta como R$ 0)", async () => {
    metrics.mockResolvedValue(data({ openWithoutValue: 7, wonWithoutValue: 1 }));
    open();
    const note = await screen.findByRole("note");
    expect(note.textContent).toMatch(/7\s*leads em andamento estão sem valor/);
    expect(screen.getByText(/valor dos ganhos · 1 sem valor/)).toBeTruthy();
  });

  it("não mostra o aviso quando todos têm valor", async () => {
    metrics.mockResolvedValue(data());
    open();
    await screen.findByText("Total de leads");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("mostra a variação contra o período anterior (e perdidos a menos é bom)", async () => {
    metrics.mockResolvedValue(
      data({
        lost: 1,
        previous: {
          dateFrom: "2026-09-01",
          dateTo: "2026-09-30",
          totalLeads: 23,
          closed: 4,
          lost: 4,
          conversionRate: 17,
          closedRevenue: 6_500,
        },
      }),
    );
    open();
    await screen.findByText("Total de leads");
    expect(screen.getByText("▲ 2 vs período anterior")).toBeTruthy(); // total
    expect(screen.getByText("▲ 1 vs período anterior")).toBeTruthy(); // ganhos
    expect(screen.getByText("▲ 3 p.p. vs período anterior")).toBeTruthy(); // conversão
    expect(screen.getByText("▲ R$ 3,0k vs período anterior")).toBeTruthy(); // receita ganha
    const perdidos = screen.getByText("▼ 3 vs período anterior");
    expect(perdidos.className).toMatch(/deltaGood/); // menos perdas = bom
  });

  it("sem período filtrado não inventa comparação", async () => {
    metrics.mockResolvedValue(data());
    open();
    await screen.findByText("Total de leads");
    expect(screen.queryByText(/vs período anterior/)).toBeNull();
  });
});

describe("Dashboard — funil com valor e ranking por responsável", () => {
  it("mostra o valor por etapa e marca '*' quando há leads sem valor", async () => {
    metrics.mockResolvedValue(data());
    open();
    const star = await screen.findByText("R$ 18,0k*");
    expect(star.getAttribute("title")).toMatch(/3 lead\(s\) sem valor/);
    expect(screen.getAllByText("R$ 9,5k").length).toBeGreaterThanOrEqual(1); // KPI e funil
  });

  it("ranking só com 2+ responsáveis, com nomes da equipe, para quem vê a equipe", async () => {
    const owners = [
      { ownerId: "u-vera", total: 8, open: 6, closed: 2, lost: 0, closedRevenue: 5_000 },
      { ownerId: "u-admin", total: 17, open: 14, closed: 3, lost: 0, closedRevenue: 4_500 },
    ];
    metrics.mockResolvedValue(data({ owners }));
    open(ADMIN);
    const table = await screen.findByRole("region", { name: "Por responsável" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("rowheader")[0]?.textContent)).toEqual([
      "Vera Vendedora",
      "Ana Admin",
    ]);
    expect(within(rows[0]!).getByText("R$ 5,0k")).toBeTruthy();
    cleanup();
    metrics.mockResolvedValue(data({ owners: owners.slice(0, 1) }));
    open(ADMIN);
    await screen.findByText("Total de leads");
    expect(screen.queryByRole("region", { name: "Por responsável" })).toBeNull();
  });

  it("vendedor não vê o ranking da equipe", async () => {
    metrics.mockResolvedValue(
      data({
        owners: [
          { ownerId: "u-vera", total: 8, open: 6, closed: 2, lost: 0, closedRevenue: 5_000 },
          { ownerId: "u-admin", total: 17, open: 14, closed: 3, lost: 0, closedRevenue: 4_500 },
        ],
      }),
    );
    open(VENDEDOR);
    await screen.findByText("Total de leads");
    expect(screen.queryByRole("region", { name: "Por responsável" })).toBeNull();
  });
});
