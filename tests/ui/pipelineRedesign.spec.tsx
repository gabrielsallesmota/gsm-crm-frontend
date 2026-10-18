// Prompt 06 — redesign do Pipeline: cabeçalho, filtros com chips, colunas, cartão, estados, mobile.
// Convive com `pipelinePage.spec.tsx` (caracterização do comportamento) sem apagar nada dele.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/PipelinesService", () => ({
  pipelinesService: { list: vi.fn(), reorderStages: vi.fn() },
}));
vi.mock("../../src/services/LeadsService", () => ({
  leadsService: {
    list: vi.fn(),
    move: vi.fn(),
    exportCsv: vi.fn(),
    listMessageTemplates: vi.fn(),
    timeline: vi.fn(),
    bulkImport: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("../../src/services/UsersService", () => ({ usersService: { directory: vi.fn() } }));
vi.mock("../../src/services/TagsService", () => ({ tagsService: { list: vi.fn() } }));
vi.mock("../../src/services/TasksService", () => ({
  tasksService: { list: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
vi.mock("../../src/services/LeadCommentsService", () => ({ leadCommentsService: { create: vi.fn() } }));
// Conta quantas vezes cada cartão é DESENHADO (prova do `memo`): `leadAge` roda em cada render.
vi.mock("../../src/utils/pipelineView", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/utils/pipelineView")>();
  return { ...real, leadAge: vi.fn(real.leadAge) };
});

import { PipelinePage } from "../../src/pages/PipelinePage";
import { leadsService } from "../../src/services/LeadsService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { tagsService } from "../../src/services/TagsService";
import { tasksService } from "../../src/services/TasksService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import type { Lead, LeadListFilter } from "../../src/types/lead";
import { leadAge } from "../../src/utils/pipelineView";
import {
  STAGES,
  VENDEDOR,
  deferred,
  makeLead,
  makePipeline,
  makeStage,
  page,
  renderApp,
} from "./support/harness";

const api = vi.mocked(leadsService);
const pipelines = vi.mocked(pipelinesService);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const TEAM = [
  { id: "u-admin", name: "Ana Admin", role: "admin" as const },
  { id: "u-vend", name: "Vera Vendedora", role: "vendedor" as const },
];

function serveBoard(byStage: Record<string, Lead[]>, totals: Record<string, number> = {}) {
  api.list.mockImplementation(async (filter: LeadListFilter) => {
    const items = byStage[filter.stageId ?? ""] ?? [];
    const pageNumber = filter.page ?? 1;
    const size = filter.pageSize ?? 25;
    const slice = items.slice((pageNumber - 1) * size, pageNumber * size);
    return page(slice, totals[filter.stageId ?? ""] ?? items.length, pageNumber);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  pipelines.list.mockResolvedValue([makePipeline()]);
  vi.mocked(usersService.directory).mockResolvedValue(TEAM);
  vi.mocked(tagsService.list).mockResolvedValue([]);
  vi.mocked(tasksService.list).mockResolvedValue(page([]));
  api.listMessageTemplates.mockResolvedValue([]);
  api.timeline.mockResolvedValue([]);
  serveBoard({ "s-novo": [makeLead()] });
});

const render = (opts: Parameters<typeof renderApp>[1] = {}) => renderApp(<PipelinePage />, opts);
const card = (name: string) => screen.getByRole("button", { name: `Abrir ${name}` }).parentElement as HTMLElement;
const openFilters = () => fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
const lastFilter = () => api.list.mock.calls.at(-1)![0] as LeadListFilter;

// ---------------------------------------------------------------------------------------------
describe("cabeçalho", () => {
  it("nome do pipeline sempre visível (um pipeline = rótulo; vários = seletor)", async () => {
    render();
    await screen.findByText("Maria Souza");
    expect(screen.getByRole("heading", { level: 1, name: /Pipeline/ })).toBeTruthy();
    expect(screen.getByText("Comercial")).toBeTruthy();
    expect(screen.queryByLabelText("Pipeline")).toBeNull();
    cleanup();
    pipelines.list.mockResolvedValue([makePipeline(), makePipeline({ id: "p2", name: "Pós-venda", isDefault: false })]);
    render();
    await screen.findByText("Maria Souza");
    expect((screen.getByLabelText("Pipeline") as HTMLSelectElement).value).toBe("p1");
  });

  it("totais são os do SERVIDOR (não os dos cards carregados) e 'em andamento' exclui ganho e perdido", async () => {
    serveBoard(
      { "s-novo": [makeLead()], "s-contato": [makeLead({ id: "l2", stageId: "s-contato" })] },
      { "s-novo": 60, "s-contato": 30, "s-ganho": 7, "s-perdido": 3 },
    );
    render();
    await screen.findAllByText("Maria Souza");
    await waitFor(() => expect(screen.getByText(/oportunidades/).textContent).toContain("100"));
    const summary = screen.getByText(/oportunidades/).closest("p") as HTMLElement;
    expect(summary.textContent).toMatch(/100\s*oportunidades.*90\s*em andamento/);
    // colunas parciais → NENHUM valor em R$ no cabeçalho (não vira "total" de página parcial)
    expect(summary.textContent).not.toMatch(/R\$/);
  });

  it("valor em andamento só aparece quando todas as etapas abertas estão inteiras", async () => {
    serveBoard({
      "s-novo": [makeLead({ id: "a", value: 1000 }), makeLead({ id: "b", value: 500 })],
      "s-contato": [makeLead({ id: "c", stageId: "s-contato", value: 250 })],
    });
    render();
    await screen.findAllByText("Maria Souza");
    const summary = (await screen.findByText(/oportunidades/)).closest("p") as HTMLElement;
    await waitFor(() => expect(summary.textContent).toMatch(/3\s*oportunidades/));
    expect(summary.textContent).toContain("R$ 1.750");
  });

  it("antes dos totais chegarem mostra 'Carregando totais…' (nada de zero falso)", async () => {
    const gate = deferred<ReturnType<typeof page<Lead>>>();
    api.list.mockImplementation(() => gate.promise);
    render();
    expect(await screen.findByText("Carregando totais…")).toBeTruthy();
    expect(screen.queryByText(/0\s*oportunidades/)).toBeNull();
    await act(async () => {
      gate.resolve(page([]));
      await Promise.resolve();
    });
  });

  it("ações: Novo lead (link), Importar planilha (abre o assistente) e Exportar CSV (chama a API)", async () => {
    api.exportCsv.mockResolvedValue("nome\n");
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    render();
    await screen.findByText("Maria Souza");
    expect(screen.getByRole("link", { name: /Novo lead/ }).getAttribute("href")).toBe("/leads?novo=1");
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(api.exportCsv).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Importar planilha" }));
    expect(await screen.findByRole("dialog", { name: "Importar leads via CSV" })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
describe("filtros: progressive disclosure e chips removíveis", () => {
  it("o período fica atrás de 'Filtros' (aria-expanded) e é rotulado 'Criados em'", async () => {
    render();
    await screen.findByText("Maria Souza");
    const toggle = screen.getByRole("button", { name: /^Filtros/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "Hoje" })).toBeNull(); // painel fechado: fora da árvore
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
    expect(screen.getByText("Criados em")).toBeTruthy();
  });

  it("cada filtro ativo vira um chip 'grupo: valor' com botão de remover que o desfaz", async () => {
    render();
    await screen.findByText("Maria Souza");
    fireEvent.change(screen.getByLabelText("Buscar lead"), { target: { value: "maria" } });
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "u-vend" } });
    openFilters();
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    fireEvent.change(screen.getByLabelText("Ordenação"), { target: { value: "az" } });
    const chips = await screen.findByRole("group", { name: "Filtros ativos" });
    expect(chips.textContent).toMatch(/Busca:\s*maria/);
    expect(chips.textContent).toMatch(/Responsável:\s*Vera Vendedora/);
    expect(chips.textContent).toMatch(/Criados em:\s*7 dias/);
    expect(chips.textContent).toMatch(/Ordem:\s*Nome A-Z/);
    await waitFor(() => expect(lastFilter()).toMatchObject({ search: "maria", ownerId: "u-vend", sortBy: "name" }));

    fireEvent.click(within(chips).getByRole("button", { name: "Remover filtro Responsável: Vera Vendedora" }));
    await waitFor(() => expect(lastFilter().ownerId).toBeUndefined());
    expect(lastFilter()).toMatchObject({ search: "maria", sortBy: "name" }); // os outros seguem
    fireEvent.click(screen.getByRole("button", { name: "Remover filtro Criados em: 7 dias" }));
    await waitFor(() => expect(lastFilter().dateFrom).toBeUndefined());
  });

  it("'Limpar filtros' zera tudo de uma vez e some quando não há mais nada ativo", async () => {
    render();
    await screen.findByText("Maria Souza");
    fireEvent.change(screen.getByLabelText("Buscar lead"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Ordenação"), { target: { value: "za" } });
    fireEvent.click(await screen.findByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => {
      const f = lastFilter();
      expect(f.search).toBeUndefined();
      expect(f.sortBy).toBeUndefined();
    });
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).toBeNull();
    expect((screen.getByLabelText("Buscar lead") as HTMLInputElement).value).toBe("");
  });

  it("'sem responsável' também vira chip; vendedor não tem filtro de responsável", async () => {
    render();
    await screen.findByText("Maria Souza");
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "__none__" } });
    expect((await screen.findByRole("group", { name: "Filtros ativos" })).textContent).toMatch(/Responsável:\s*Sem responsável/);
    cleanup();
    render({ user: VENDEDOR });
    await screen.findByText("Maria Souza");
    expect(screen.queryByLabelText("Responsável")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe("coluna", () => {
  it("contador é o total REAL; soma de valores só quando a coluna está inteira", async () => {
    serveBoard(
      {
        "s-novo": Array.from({ length: 30 }, (_, i) => makeLead({ id: `n${i}`, name: `N ${i}`, value: 100 })),
        "s-contato": [makeLead({ id: "c1", name: "C 1", stageId: "s-contato", value: 700 })],
      },
      {},
    );
    render();
    await screen.findByText("C 1");
    const novo = document.querySelector("[data-stage-column][data-stage-name='Novo']") as HTMLElement;
    const contato = document.querySelector("[data-stage-column][data-stage-name='Em contato']") as HTMLElement;
    expect(within(novo).getByTitle("Total real nesta etapa").textContent).toBe("30");
    expect(within(novo).getByRole("button", { name: /Carregar mais \(5\)/ })).toBeTruthy(); // só 25 de 30
    expect(within(novo).queryByTitle(/Soma dos valores/)).toBeNull(); // parcial → sem soma no cabeçalho
    expect(within(contato).getByTitle(/Soma dos valores/).textContent).toBe("R$ 700"); // inteira → soma exata
  });

  it("estados: vazia, carregando (esqueleto com texto para leitor de tela) e erro com 'Tentar de novo'", async () => {
    const gate = deferred<ReturnType<typeof page<Lead>>>();
    api.list.mockImplementation(async (f: LeadListFilter) => {
      if (f.stageId === "s-ganho") throw new ApiError(500, "");
      if (f.stageId === "s-perdido") return gate.promise;
      return page([]);
    });
    render();
    const ganho = await waitFor(() => {
      const el = document.querySelector("[data-stage-column][data-stage-name='Ganho']") as HTMLElement;
      expect(within(el).getByRole("alert")).toBeTruthy();
      return el;
    });
    expect(within(ganho).getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
    const perdido = document.querySelector("[data-stage-column][data-stage-name='Perdido']") as HTMLElement;
    expect(within(perdido).getByRole("status").textContent).toContain("Carregando…");
    const novo = document.querySelector("[data-stage-column][data-stage-name='Novo']") as HTMLElement;
    await waitFor(() => expect(within(novo).getByText("Sem leads")).toBeTruthy());
    await act(async () => {
      gate.resolve(page([]));
      await Promise.resolve();
    });
  });

  it("etapas de ganho/perda: marcador visual + texto para leitor de tela (nunca só emoji)", async () => {
    render();
    await screen.findByText("Maria Souza");
    const ganho = document.querySelector("[data-stage-column][data-stage-name='Ganho']") as HTMLElement;
    const perdido = document.querySelector("[data-stage-column][data-stage-name='Perdido']") as HTMLElement;
    expect(within(ganho).getByText("etapa de ganho")).toBeTruthy();
    expect(within(perdido).getByText("etapa de perda")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
describe("cartão", () => {
  it("hierarquia e informações: nome, empresa, valor (só se > 0), origem, idade, responsável", async () => {
    serveBoard({
      "s-novo": [
        makeLead({ value: 2500, createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }),
        makeLead({ id: "l2", name: "Sem Valor", value: 0, company: "" }),
      ],
    });
    render();
    await screen.findByText("Maria Souza");
    const withValue = card("Maria Souza");
    expect(within(withValue).getByText("R$ 2.500")).toBeTruthy();
    expect(within(withValue).getByText("3 d").getAttribute("title")).toMatch(/^Criado em /);
    const noValue = card("Sem Valor");
    expect(within(noValue).queryByText(/^R\$/)).toBeNull();
    expect(noValue.textContent).not.toMatch(/R\$ 0/);
  });

  it("o botão de abrir não contém controles interativos; contatos e mover são IRMÃOS; resumo falado por aria-describedby", async () => {
    render();
    const main = await screen.findByRole("button", { name: "Abrir Maria Souza" });
    expect(main.querySelectorAll("a[href], button, select, input, textarea").length).toBe(0);
    const summary = document.getElementById(main.getAttribute("aria-describedby") as string) as HTMLElement;
    expect(summary.textContent).toMatch(/Empresa Clínica Sol.*Valor R\$ 1\.800.*Responsável Ana Admin/);
    const wrapper = main.parentElement as HTMLElement;
    expect(wrapper.querySelector("select")).toBeTruthy();
    expect(within(wrapper).getAllByRole("link").length).toBeGreaterThanOrEqual(1);
  });

  it("ações essenciais NÃO dependem de hover: contatos têm nome acessível e o seletor 'mover' existe sem foco", async () => {
    render();
    await screen.findByText("Maria Souza");
    const c = card("Maria Souza");
    expect(within(c).getByRole("link", { name: "Abrir WhatsApp de Maria Souza" })).toBeTruthy();
    expect(within(c).getByRole("link", { name: "Escrever e-mail para Maria Souza" })).toBeTruthy();
    expect((within(c).getByLabelText("Mover Maria Souza para outra etapa") as HTMLSelectElement).tabIndex).not.toBe(-1);
  });

  it("'Sem responsável' é atenção por texto + estilo (não só cor) e dono removido vira '—'", async () => {
    serveBoard({ "s-novo": [makeLead({ ownerId: null }), makeLead({ id: "l2", name: "Dono Saiu", ownerId: "u-fora" })] });
    render();
    await screen.findByText("Maria Souza");
    expect(within(card("Maria Souza")).getByText("Sem responsável")).toBeTruthy();
    expect(within(card("Dono Saiu")).getByText("—")).toBeTruthy();
  });

  it("estado 'movendo': aviso em texto, aria-busy e seletor desabilitado", async () => {
    const gate = deferred<Lead>();
    api.move.mockReturnValue(gate.promise);
    render();
    await screen.findByText("Maria Souza");
    fireEvent.change(screen.getByLabelText("Mover Maria Souza para outra etapa"), { target: { value: "s-contato" } });
    const c = await waitFor(() => {
      const el = card("Maria Souza");
      expect(el.getAttribute("aria-busy")).toBe("true");
      return el;
    });
    expect(within(c).getByText("Movendo…")).toBeTruthy();
    expect((within(c).getByLabelText("Mover Maria Souza para outra etapa") as HTMLSelectElement).disabled).toBe(true);
    await act(async () => {
      gate.resolve(makeLead({ stageId: "s-contato" }));
      await Promise.resolve();
    });
  });
});

// ---------------------------------------------------------------------------------------------
describe("arrastar: estados visuais, cancelamento e desempenho", () => {
  const stageCol = (name: string) => document.querySelector(`[data-stage-column][data-stage-name='${name}']`) as HTMLElement;

  it("durante o arraste: cartão de origem 'arrastando' e coluna de destino realçada com 'Soltar aqui'", async () => {
    render();
    await screen.findByText("Maria Souza");
    const c = card("Maria Souza");
    fireEvent.dragStart(c);
    expect(c.className).toMatch(/dragging/);
    fireEvent.dragEnter(stageCol("Em contato"));
    expect(within(stageCol("Em contato")).getByText("Soltar aqui")).toBeTruthy();
    // a coluna de ORIGEM não ganha realce (soltar ali é "nada a fazer")
    fireEvent.dragEnter(stageCol("Novo"));
    expect(within(stageCol("Novo")).queryByText("Soltar aqui")).toBeNull();
  });

  it("arraste CANCELADO (Esc / soltar fora) limpa tudo; um drop depois disso NÃO move ninguém", async () => {
    render();
    await screen.findByText("Maria Souza");
    const c = card("Maria Souza");
    fireEvent.dragStart(c);
    fireEvent.dragEnter(stageCol("Em contato"));
    fireEvent.dragEnd(c);
    expect(c.className).not.toMatch(/dragging/);
    expect(screen.queryByText("Soltar aqui")).toBeNull();
    fireEvent.drop(stageCol("Em contato")); // um drop "solto" (ex.: arquivo) não pode mover o lead antigo
    await new Promise((r) => setTimeout(r, 30));
    expect(api.move).not.toHaveBeenCalled();
  });

  it("soltar na coluna continua chamando a API de mover (comportamento preservado)", async () => {
    api.move.mockResolvedValue(makeLead({ stageId: "s-contato" }));
    render();
    await screen.findByText("Maria Souza");
    fireEvent.dragStart(card("Maria Souza"));
    fireEvent.drop(stageCol("Em contato"));
    await waitFor(() => expect(api.move).toHaveBeenCalledWith("l1", "s-contato"));
  });

  it("desempenho: realçar o destino do arraste NÃO redesenha os cartões (React.memo)", async () => {
    serveBoard({ "s-novo": Array.from({ length: 12 }, (_, i) => makeLead({ id: `m${i}`, name: `Memo ${i}` })) });
    render();
    await screen.findByText("Memo 0");
    const spy = vi.mocked(leadAge);
    spy.mockClear();
    const c = card("Memo 0");
    fireEvent.dragStart(c);
    const afterStart = spy.mock.calls.length; // o cartão arrastado muda de estado (1 redesenho)
    expect(afterStart).toBeLessThanOrEqual(1);
    fireEvent.dragEnter(stageCol("Em contato"));
    fireEvent.dragEnter(stageCol("Ganho"));
    fireEvent.dragEnter(stageCol("Perdido"));
    expect(spy.mock.calls.length).toBe(afterStart); // 3 realces de destino = 0 redesenhos de cartão
  });
});

// ---------------------------------------------------------------------------------------------
describe("celular: uma etapa por vez", () => {
  const stubMobile = () =>
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query.includes("max-width: 760px"),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );

  it("mostra as abas de etapa com o total real e só a coluna ativa; trocar de aba troca a coluna", async () => {
    stubMobile();
    serveBoard({
      "s-novo": [makeLead()],
      "s-contato": [makeLead({ id: "l2", name: "Do Contato", stageId: "s-contato" })],
    });
    render();
    await screen.findByText("Maria Souza");
    const tabs = screen.getByRole("group", { name: "Escolher etapa" });
    expect(within(tabs).getByRole("button", { name: /Novo/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(tabs).getByRole("button", { name: /Em contato/ }).textContent).toMatch(/1/);
    expect(document.querySelectorAll("[data-stage-column]").length).toBe(1);
    expect(screen.queryByText("Do Contato")).toBeNull();
    fireEvent.click(within(tabs).getByRole("button", { name: /Em contato/ }));
    expect(await screen.findByText("Do Contato")).toBeTruthy();
    expect(screen.queryByText("Maria Souza")).toBeNull();
    expect(within(tabs).getByRole("button", { name: /Em contato/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("no celular nenhuma função some: mover (seletor), contatos, abrir, importar e exportar continuam", async () => {
    stubMobile();
    render();
    await screen.findByText("Maria Souza");
    const c = card("Maria Souza");
    expect(within(c).getByLabelText("Mover Maria Souza para outra etapa")).toBeTruthy();
    expect(within(c).getAllByRole("link").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Importar planilha" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir Maria Souza" }));
    expect(await screen.findByRole("dialog", { name: "Lead Maria Souza" })).toBeTruthy();
  });

  it("em largura normal as abas não existem e todas as colunas aparecem", async () => {
    render();
    await screen.findByText("Maria Souza");
    expect(screen.queryByRole("group", { name: "Escolher etapa" })).toBeNull();
    expect(document.querySelectorAll("[data-stage-column]").length).toBe(STAGES.length);
  });

  it("etapa extra do pipeline entra nas abas na ordem do funil", async () => {
    stubMobile();
    pipelines.list.mockResolvedValue([
      makePipeline({ stages: [makeStage("s-a", "Alfa", 0), makeStage("s-b", "Beta", 1), makeStage("s-c", "Gama", 2)] }),
    ]);
    render();
    const tabs = await screen.findByRole("group", { name: "Escolher etapa" });
    expect(within(tabs).getAllByRole("button").map((b) => b.textContent?.replace(/[^A-Za-z]/g, ""))).toEqual(["Alfa", "Beta", "Gama"]);
  });
});
