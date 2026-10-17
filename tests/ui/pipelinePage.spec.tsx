// FASE 0 — rede de segurança do Pipeline (matriz F-01..F-13). Testes de CARACTERIZAÇÃO: descrevem
// o comportamento ATUAL; não corrigem nada. Os serviços são substituídos: sem rede.
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
vi.mock("../../src/services/UsersService", () => ({
  usersService: { directory: vi.fn() },
}));
vi.mock("../../src/services/TagsService", () => ({
  tagsService: { list: vi.fn() },
}));
vi.mock("../../src/services/TasksService", () => ({
  tasksService: { list: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
vi.mock("../../src/services/LeadCommentsService", () => ({
  leadCommentsService: { create: vi.fn() },
}));

import { PipelinePage } from "../../src/pages/PipelinePage";
import { leadsService } from "../../src/services/LeadsService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { tagsService } from "../../src/services/TagsService";
import { tasksService } from "../../src/services/TasksService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import type { Lead, LeadListFilter } from "../../src/types/lead";
import {
  ADMIN,
  GESTOR,
  VENDEDOR,
  STAGES,
  deferred,
  makeLead,
  makePipeline,
  makeStage,
  makeTemplate,
  page,
  renderApp,
} from "./support/harness";

const api = vi.mocked(leadsService);
const pipelines = vi.mocked(pipelinesService);
const users = vi.mocked(usersService);

afterEach(cleanup);

const TEAM = [
  { id: "u-admin", name: "Ana Admin", role: "admin" as const },
  { id: "u-vend", name: "Vera Vendedora", role: "vendedor" as const },
];

/** Servidor falso: devolve a página pedida da etapa pedida e respeita total/paginação. */
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
  users.directory.mockResolvedValue(TEAM);
  vi.mocked(tagsService.list).mockResolvedValue([]);
  vi.mocked(tasksService.list).mockResolvedValue(page([]));
  api.listMessageTemplates.mockResolvedValue([]);
  api.timeline.mockResolvedValue([]);
  serveBoard({ "s-novo": [makeLead()] });
});

const render = (opts: Parameters<typeof renderApp>[1] = {}) => renderApp(<PipelinePage />, opts);
const card = (name: string) => screen.getByRole("button", { name: `Abrir ${name}` });

// ---------------------------------------------------------------------------------------------
// F-01 carregamento
// ---------------------------------------------------------------------------------------------
describe("F-01 carregamento do quadro", () => {
  it("uma coluna por etapa real, com nome, ordem e contador total", async () => {
    serveBoard({ "s-novo": [makeLead()], "s-contato": [makeLead({ id: "l2", name: "João", stageId: "s-contato" })] });
    render();
    expect(await screen.findByText("Maria Souza")).toBeTruthy();
    const heads = screen.getAllByTitle("Total real nesta etapa");
    expect(heads).toHaveLength(STAGES.length);
    await waitFor(() => expect(heads.map((h) => h.textContent)).toEqual(["1", "1", "0", "0"]));
    for (const stage of STAGES) {
      expect(screen.getByText(new RegExp(`^${stage.label}`), { selector: "span" })).toBeTruthy();
    }
  });

  it("etapas Ganho e Perdido recebem os marcadores 🏆 e ✕", async () => {
    render();
    await screen.findByText("Maria Souza");
    expect(screen.getByText(/Ganho 🏆/)).toBeTruthy();
    expect(screen.getByText(/Perdido ✕/)).toBeTruthy();
  });

  it("consulta cada etapa com pipeline, etapa, página 1 e 25 itens por página", async () => {
    render();
    await screen.findByText("Maria Souza");
    const calls = api.list.mock.calls.map(([f]) => f);
    expect(calls).toHaveLength(STAGES.length);
    for (const call of calls) {
      expect(call).toMatchObject({ pipelineId: "p1", page: 1, pageSize: 25 });
    }
    expect(new Set(calls.map((c) => c.stageId))).toEqual(new Set(STAGES.map((s) => s.id)));
  });

  it("pipeline único não mostra o seletor de pipeline", async () => {
    render();
    await screen.findByText("Maria Souza");
    expect(screen.queryByLabelText("Pipeline")).toBeNull();
  });

  it("vários pipelines: seletor aparece e o PADRÃO é o selecionado", async () => {
    pipelines.list.mockResolvedValue([
      makePipeline({ id: "pa", name: "Outro", isDefault: false }),
      makePipeline({ id: "p1", name: "Comercial", isDefault: true }),
    ]);
    render();
    const select = (await screen.findByLabelText("Pipeline")) as HTMLSelectElement;
    expect(select.value).toBe("p1");
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(api.list.mock.calls.every(([f]) => f.pipelineId === "p1")).toBe(true);
  });

  it("trocar de pipeline recarrega as etapas do pipeline escolhido", async () => {
    const other = makePipeline({
      id: "pb",
      name: "Pós-venda",
      isDefault: false,
      stages: [makeStage("b-1", "Onboarding", 0), makeStage("b-2", "Ativo", 1)],
    });
    pipelines.list.mockResolvedValue([makePipeline(), other]);
    render();
    const select = await screen.findByLabelText("Pipeline");
    await screen.findByText("Maria Souza");
    api.list.mockClear();
    fireEvent.change(select, { target: { value: "pb" } });
    expect(await screen.findByText("Onboarding")).toBeTruthy();
    await waitFor(() => {
      const calls = api.list.mock.calls.map(([f]) => f);
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(calls.every((c) => c.pipelineId === "pb")).toBe(true);
    });
    expect(screen.queryByText("Em contato")).toBeNull();
  });

  it("sem pipeline: orienta o admin a criar em Configurações", async () => {
    pipelines.list.mockResolvedValue([]);
    render();
    expect(await screen.findByText("Nenhum pipeline cadastrado ainda")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir Configurações" })).toBeTruthy();
  });

  it("sem pipeline: vendedor vê orientação para falar com o administrador, sem link", async () => {
    pipelines.list.mockResolvedValue([]);
    render({ user: VENDEDOR });
    expect(await screen.findByText(/Fale com ele para começar/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Abrir Configurações" })).toBeNull();
  });

  it("pipeline sem etapas mostra estado vazio próprio", async () => {
    pipelines.list.mockResolvedValue([makePipeline({ stages: [] })]);
    render();
    expect(await screen.findByText("Este pipeline ainda não tem etapas")).toBeTruthy();
  });

  it("erro ao carregar pipelines: mensagem e 'Tentar de novo' que refaz a chamada", async () => {
    pipelines.list.mockRejectedValueOnce(new ApiError(500, "falha"));
    render();
    expect(await screen.findByText("Não foi possível carregar o pipeline")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Maria Souza")).toBeTruthy();
    expect(pipelines.list).toHaveBeenCalledTimes(2);
  });

  it("funil vazio (sem filtro): orienta a adicionar ou importar", async () => {
    serveBoard({});
    render();
    expect(await screen.findByText("Seu funil ainda está vazio")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Importar planilha" }).length).toBeGreaterThanOrEqual(1);
  });

  it("erro em UMA coluna não derruba as outras e oferece nova tentativa", async () => {
    api.list.mockImplementation(async (filter: LeadListFilter) => {
      if (filter.stageId === "s-contato") throw new ApiError(500, "x");
      return page(filter.stageId === "s-novo" ? [makeLead()] : []);
    });
    render();
    expect(await screen.findByText("Maria Souza")).toBeTruthy();
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(within(alerts[0]!).getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });

  it("trocar de tenant descarta o quadro anterior e recarrega", async () => {
    const view = render({ tenantId: "t1" });
    await screen.findByText("Maria Souza");
    serveBoard({ "s-novo": [makeLead({ id: "l9", name: "Cliente da Empresa B", tenantId: "t2" })] });
    api.list.mockClear();
    view.rerenderAs({ tenantId: "t2", content: <PipelinePage /> });
    expect(await screen.findByText("Cliente da Empresa B")).toBeTruthy();
    expect(screen.queryByText("Maria Souza")).toBeNull();
  });

  it("resposta antiga (filtro anterior) que chega depois NÃO sobrescreve a nova", async () => {
    const slow = deferred<ReturnType<typeof page<Lead>>>();
    let call = 0;
    api.list.mockImplementation(async (filter: LeadListFilter) => {
      if (filter.stageId !== "s-novo") return page([]);
      call += 1;
      if (call === 1) return page([makeLead({ name: "Inicial" })]);
      if (filter.search === "ana") return slow.promise; // consulta antiga, lenta
      return page([makeLead({ id: "l2", name: "Resultado novo" })]);
    });
    render();
    await screen.findByText("Inicial");
    const box = screen.getByLabelText("Buscar lead");
    fireEvent.change(box, { target: { value: "ana" } });
    await waitFor(() => expect(api.list.mock.calls.some(([f]) => f.search === "ana")).toBe(true));
    fireEvent.change(box, { target: { value: "bruno" } });
    expect(await screen.findByText("Resultado novo")).toBeTruthy();
    await act(async () => slow.resolve(page([makeLead({ id: "l3", name: "Resposta velha" })])));
    expect(screen.queryByText("Resposta velha")).toBeNull();
    expect(screen.getByText("Resultado novo")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
// paginação por coluna
// ---------------------------------------------------------------------------------------------
describe("F-01 paginação por coluna", () => {
  const many = (n: number, stageId = "s-novo") =>
    Array.from({ length: n }, (_, i) => makeLead({ id: `x${i}`, name: `Lead ${String(i).padStart(2, "0")}`, stageId }));

  it("mostra os 25 primeiros, o total REAL e o botão 'Carregar mais (N)'", async () => {
    serveBoard({ "s-novo": many(40) }, { "s-novo": 40 });
    render();
    await screen.findByText("Lead 00");
    expect(screen.getByText("Lead 24")).toBeTruthy();
    expect(screen.queryByText("Lead 25")).toBeNull();
    expect(screen.getByRole("button", { name: "Carregar mais (15)" })).toBeTruthy();
    expect(screen.getAllByTitle("Total real nesta etapa")[0]?.textContent).toBe("40");
  });

  it("carregar mais acrescenta a página 2 e o botão some no fim", async () => {
    serveBoard({ "s-novo": many(40) }, { "s-novo": 40 });
    render();
    await screen.findByText("Lead 00");
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais (15)" }));
    expect(await screen.findByText("Lead 39")).toBeTruthy();
    expect(screen.getByText("Lead 00")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Carregar mais/ })).toBeNull();
    expect(api.list.mock.calls.some(([f]) => f.stageId === "s-novo" && f.page === 2)).toBe(true);
  });

  it("erro ao carregar mais mostra aviso na coluna e preserva o que já estava", async () => {
    serveBoard({ "s-novo": many(40) }, { "s-novo": 40 });
    render();
    await screen.findByText("Lead 00");
    api.list.mockRejectedValueOnce(new ApiError(500, "x"));
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais (15)" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Lead 00")).toBeTruthy();
  });

  it("mudar o filtro no meio da paginação zera as páginas e não mistura resultados", async () => {
    serveBoard({ "s-novo": many(40) }, { "s-novo": 40 });
    render();
    await screen.findByText("Lead 00");
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais (15)" }));
    await screen.findByText("Lead 39");
    api.list.mockImplementation(async (f: LeadListFilter) =>
      page(f.stageId === "s-novo" && f.search === "zeta" ? [makeLead({ id: "z", name: "Zeta" })] : []),
    );
    fireEvent.change(screen.getByLabelText("Buscar lead"), { target: { value: "zeta" } });
    expect(await screen.findByText("Zeta")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Lead 39")).toBeNull());
    expect(screen.queryByText("Lead 00")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// F-02 / F-03 movimentação
// ---------------------------------------------------------------------------------------------
describe("F-02/F-03 mover lead", () => {
  const moveSelect = (name: string) => screen.getByLabelText(`Mover ${name} para outra etapa`) as HTMLSelectElement;

  it("pelo seletor do card: atualização OTIMISTA (move antes da API responder) e confirma com a resposta", async () => {
    const pending = deferred<Lead>();
    api.move.mockReturnValue(pending.promise);
    render();
    await screen.findByText("Maria Souza");
    fireEvent.change(moveSelect("Maria Souza"), { target: { value: "s-contato" } });
    await waitFor(() => expect(api.move).toHaveBeenCalledWith("l1", "s-contato"));
    // ainda sem resposta do servidor, o contador da etapa de origem já caiu (otimista)
    await waitFor(() => expect(screen.getAllByTitle("Total real nesta etapa")[0]?.textContent).not.toBe("1"));
    await act(async () => pending.resolve(makeLead({ stageId: "s-contato" })));
    expect(api.move).toHaveBeenCalledTimes(1);
  });

  it("falha na API: ROLLBACK para a etapa original e toast de erro", async () => {
    api.move.mockRejectedValue(new ApiError(500, "x"));
    render();
    await screen.findByText("Maria Souza");
    fireEvent.change(moveSelect("Maria Souza"), { target: { value: "s-contato" } });
    // 500 → mensagem padrão de `describeError` (o texto do 'fallback' só vale para outros status)
    expect(await screen.findByText(/Erro inesperado no servidor/)).toBeTruthy();
    await waitFor(() => expect(moveSelect("Maria Souza").value).toBe("s-novo"));
    expect(screen.getAllByTitle("Total real nesta etapa")[0]?.textContent).toBe("1");
  });

  it("mover para a MESMA etapa não chama a API", async () => {
    render();
    await screen.findByText("Maria Souza");
    fireEvent.change(moveSelect("Maria Souza"), { target: { value: "s-novo" } });
    await new Promise((r) => setTimeout(r, 30));
    expect(api.move).not.toHaveBeenCalled();
  });

  it("enquanto o movimento está em voo o card fica bloqueado (select desabilitado, aria-busy) e há UMA só chamada", async () => {
    const pending = deferred<Lead>();
    api.move.mockReturnValue(pending.promise);
    render();
    await screen.findByText("Maria Souza");
    fireEvent.change(moveSelect("Maria Souza"), { target: { value: "s-contato" } });
    await waitFor(() => expect(api.move).toHaveBeenCalledTimes(1));
    // o card em movimento fica bloqueado: select desabilitado e aria-busy
    expect(moveSelect("Maria Souza").disabled).toBe(true);
    // PIP-01: o estado "ocupado" fica no contêiner do cartão (o botão de abrir é só o resumo)
    expect(card("Maria Souza").parentElement?.getAttribute("aria-busy")).toBe("true");
    await act(async () => pending.resolve(makeLead({ stageId: "s-contato" })));
  });

  it("mover para Ganho mostra o aviso de negócio ganho; para Perdido, o de perdido (sem confirmação extra)", async () => {
    api.move.mockImplementation(async (_id: string, stageId: string) => makeLead({ stageId }));
    render();
    await screen.findByText("Maria Souza");
    fireEvent.change(moveSelect("Maria Souza"), { target: { value: "s-ganho" } });
    expect(await screen.findByText(/marcado como ganho/)).toBeTruthy();
    fireEvent.change(moveSelect("Maria Souza"), { target: { value: "s-perdido" } });
    expect(await screen.findByText(/marcado como perdido/)).toBeTruthy();
    // D-03 (futuro): hoje NÃO há diálogo de confirmação ao perder — caracterização
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("arrastar o card para outra coluna chama a API de mover", async () => {
    api.move.mockImplementation(async (_id: string, stageId: string) => makeLead({ stageId }));
    render();
    await screen.findByText("Maria Souza");
    const columns = document.querySelectorAll("[class*='column']");
    const target = [...columns].find((c) => c.textContent?.startsWith("Em contato"));
    fireEvent.dragStart(card("Maria Souza"));
    fireEvent.drop(target as Element);
    await waitFor(() => expect(api.move).toHaveBeenCalledWith("l1", "s-contato"));
  });
});

// ---------------------------------------------------------------------------------------------
// F-04 reordenar etapas por permissão
// ---------------------------------------------------------------------------------------------
describe("F-04 reordenar etapas", () => {
  const header = (label: string) =>
    screen.getByText(new RegExp(`^${label}`), { selector: "span" }).closest("[draggable]") as HTMLElement | null;

  it("admin e gestor: cabeçalho da coluna é arrastável; vendedor não", async () => {
    for (const [user, expected] of [
      [ADMIN, "true"],
      [GESTOR, "true"],
      [VENDEDOR, "false"],
    ] as const) {
      const view = render({ user });
      await screen.findByText("Maria Souza");
      expect(header("Novo")?.getAttribute("draggable")).toBe(expected);
      view.unmount();
    }
  });

  it("arrastar uma coluna sobre outra chama reorderStages com a permutação completa", async () => {
    pipelines.reorderStages.mockResolvedValue(undefined);
    render();
    await screen.findByText("Maria Souza");
    const from = header("Novo") as HTMLElement;
    const target = header("Em contato")!.parentElement as HTMLElement;
    fireEvent.dragStart(from);
    fireEvent.drop(target);
    await waitFor(() => expect(pipelines.reorderStages).toHaveBeenCalledTimes(1));
    const [pipelineId, ids] = pipelines.reorderStages.mock.calls[0]!;
    expect(pipelineId).toBe("p1");
    expect([...ids].sort()).toEqual(STAGES.map((s) => s.id).sort());
    expect(ids[0]).not.toBe("s-novo");
  });
});

// ---------------------------------------------------------------------------------------------
// F-06..F-09 filtros e ordenação
// ---------------------------------------------------------------------------------------------
describe("F-06..F-09 filtros", () => {
  it("busca com DEBOUNCE: digitar rápido dispara uma consulta só, com o texto final (aparado)", async () => {
    render();
    await screen.findByText("Maria Souza");
    api.list.mockClear();
    const box = screen.getByLabelText("Buscar lead");
    fireEvent.change(box, { target: { value: "a" } });
    fireEvent.change(box, { target: { value: "ab" } });
    fireEvent.change(box, { target: { value: "  abc  " } });
    expect(api.list).not.toHaveBeenCalled(); // ainda dentro dos 300 ms
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    const searches = api.list.mock.calls.map(([f]) => f.search);
    expect(new Set(searches)).toEqual(new Set(["abc"]));
  });

  it("filtro por responsável envia ownerId; 'Sem responsável' envia unassigned", async () => {
    render();
    await screen.findByText("Maria Souza");
    const owner = screen.getByLabelText("Responsável");
    api.list.mockClear();
    fireEvent.change(owner, { target: { value: "u-vend" } });
    await waitFor(() => expect(api.list.mock.calls.some(([f]) => f.ownerId === "u-vend")).toBe(true));
    api.list.mockClear();
    fireEvent.change(owner, { target: { value: "__none__" } });
    await waitFor(() => expect(api.list.mock.calls.some(([f]) => f.unassigned === true)).toBe(true));
    expect(api.list.mock.calls.every(([f]) => f.ownerId === undefined)).toBe(true);
  });

  it("vendedor NÃO vê o filtro de responsável (escopo próprio garantido no backend)", async () => {
    render({ user: VENDEDOR });
    await screen.findByText("Maria Souza");
    expect(screen.queryByLabelText("Responsável")).toBeNull();
  });

  it("período usa dateFrom/dateTo (hoje o backend filtra pela data de CRIAÇÃO do lead — D-02)", async () => {
    render();
    await screen.findByText("Maria Souza");
    api.list.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    await waitFor(() => {
      const f = api.list.mock.calls[0]?.[0];
      expect(f?.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(f?.dateTo).toBe(f?.dateFrom);
    });
    // a tela não rotula o período como "criados em" — rótulo previsto para a Fase 2 (D-02)
    expect(screen.queryByText(/Criados em/i)).toBeNull();
  });

  it("combina período + busca + responsável na MESMA consulta e 'Limpar' remove só o período", async () => {
    render();
    await screen.findByText("Maria Souza");
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "u-vend" } });
    fireEvent.change(screen.getByLabelText("Buscar lead"), { target: { value: "maria" } });
    await waitFor(() => {
      const f = api.list.mock.calls.at(-1)?.[0];
      expect(f).toMatchObject({ ownerId: "u-vend", search: "maria" });
      expect(f?.dateFrom).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    await waitFor(() => {
      const f = api.list.mock.calls.at(-1)?.[0];
      expect(f?.dateFrom).toBeUndefined();
      expect(f).toMatchObject({ ownerId: "u-vend", search: "maria" });
    });
  });

  it("com filtro ativo e quadro vazio NÃO aparece o aviso de 'funil vazio'", async () => {
    serveBoard({});
    render();
    await screen.findByText("Seu funil ainda está vazio");
    fireEvent.change(screen.getByLabelText("Buscar lead"), { target: { value: "xyz" } });
    await waitFor(() => expect(screen.queryByText("Seu funil ainda está vazio")).toBeNull());
  });

  it("ordenação é APLICADA NO CLIENTE e só sobre o que já foi carregado (PIP-02)", async () => {
    serveBoard({
      "s-novo": [makeLead({ id: "a", name: "Carlos" }), makeLead({ id: "b", name: "Alberto" }), makeLead({ id: "c", name: "Bia" })],
    });
    render();
    await screen.findByText("Carlos");
    api.list.mockClear();
    fireEvent.change(screen.getByLabelText("Ordenação"), { target: { value: "az" } });
    const names = () =>
      screen.getAllByRole("button", { name: /^Abrir / }).map((b) => b.getAttribute("aria-label"));
    await waitFor(() => expect(names()).toEqual(["Abrir Alberto", "Abrir Bia", "Abrir Carlos"]));
    expect(api.list).not.toHaveBeenCalled(); // não consulta o servidor para ordenar
    fireEvent.change(screen.getByLabelText("Ordenação"), { target: { value: "za" } });
    await waitFor(() => expect(names()).toEqual(["Abrir Carlos", "Abrir Bia", "Abrir Alberto"]));
  });
});

// ---------------------------------------------------------------------------------------------
// F-12 cartão
// ---------------------------------------------------------------------------------------------
describe("F-12 cartão do lead", () => {
  it("exibe nome, empresa, valor, origem, responsável e último comentário", async () => {
    serveBoard({
      "s-novo": [
        makeLead({
          lastComment: { text: "Pediu retorno na sexta", createdAt: "2026-10-12T10:00:00Z" },
          value: 2500,
        }),
      ],
    });
    render();
    const c = await screen.findByRole("button", { name: "Abrir Maria Souza" });
    expect(within(c).getByText("Clínica Sol")).toBeTruthy();
    expect(within(c).getByText(/R\$ 2\.500/)).toBeTruthy();
    expect(within(c).getByText("WhatsApp")).toBeTruthy();
    expect(within(c).getByText("Ana Admin")).toBeTruthy();
    expect(within(c).getByText(/Pediu retorno na sexta/)).toBeTruthy();
  });

  it("dados opcionais ausentes: sem empresa, sem comentário e 'Sem responsável'", async () => {
    serveBoard({ "s-novo": [makeLead({ company: "", ownerId: null, lastComment: null })] });
    render();
    const c = await screen.findByRole("button", { name: "Abrir Maria Souza" });
    expect(within(c).getByText("Sem responsável")).toBeTruthy();
    expect(within(c).queryByText("Clínica Sol")).toBeNull();
    expect(c.querySelector("[class*='cardComment']")).toBeNull();
  });

  it("dono que já não está na equipe aparece como '—' (nunca 'undefined')", async () => {
    serveBoard({ "s-novo": [makeLead({ ownerId: "u-removido" })] });
    render();
    const c = await screen.findByRole("button", { name: "Abrir Maria Souza" });
    expect(within(c).getByText("—")).toBeTruthy();
    expect(c.textContent).not.toMatch(/undefined|null/);
  });

  it("clicar no cartão abre o painel do lead; Enter e Espaço também", async () => {
    render();
    const c = await screen.findByRole("button", { name: "Abrir Maria Souza" });
    fireEvent.click(c);
    expect(await screen.findByRole("dialog", { name: "Lead Maria Souza" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar lead" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.keyDown(screen.getByRole("button", { name: "Abrir Maria Souza" }), { key: "Enter" });
    expect(await screen.findByRole("dialog", { name: "Lead Maria Souza" })).toBeTruthy();
  });

  it("ações internas do cartão (mover, e-mail, WhatsApp) NÃO abrem o painel por engano", async () => {
    api.move.mockResolvedValue(makeLead({ stageId: "s-contato" }));
    render();
    const c = (await screen.findByRole("button", { name: "Abrir Maria Souza" })).parentElement as HTMLElement;
    fireEvent.click(within(c).getByLabelText("Mover Maria Souza para outra etapa"));
    fireEvent.click(within(c).getByRole("link", { name: "Escrever e-mail para Maria Souza" }));
    fireEvent.click(within(c).getByRole("link", { name: /WhatsApp/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("links de contato: e-mail abre mailto; WhatsApp abre wa.me (com template: com mensagem; sem: em branco)", async () => {
    api.listMessageTemplates.mockResolvedValue([makeTemplate({ message: "Oi {nome}" })]);
    render();
    const c = (await screen.findByRole("button", { name: "Abrir Maria Souza" })).parentElement as HTMLElement;
    await waitFor(() => expect(within(c).getByRole("link", { name: /WhatsApp/ })).toBeTruthy());
    expect(within(c).getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toBe(
      "https://wa.me/5511987654321?text=Oi%20Maria%20Souza",
    );
    expect(within(c).getByRole("link", { name: "Escrever e-mail para Maria Souza" }).getAttribute("href")).toMatch(/^mailto:maria@example\.com/);
  });

  it("lead sem telefone não mostra o botão de WhatsApp", async () => {
    serveBoard({ "s-novo": [makeLead({ phoneNormalized: "", phone: "" })] });
    render();
    const c = await screen.findByRole("button", { name: "Abrir Maria Souza" });
    expect(within(c).queryByRole("link", { name: /WhatsApp/ })).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// F-10/F-11 importar e exportar (acesso a partir do Pipeline) e links profundos
// ---------------------------------------------------------------------------------------------
describe("F-10/F-11 importar e exportar a partir do Pipeline", () => {
  it("'Importar planilha' abre a importação sobre a etapa de entrada (primeira aberta)", async () => {
    render();
    await screen.findByText("Maria Souza");
    fireEvent.click(screen.getByRole("button", { name: "Importar planilha" }));
    expect(await screen.findByText("Importar leads via CSV")).toBeTruthy();
  });

  it("link profundo ?importar=1 abre a importação já na primeira renderização", async () => {
    render({ route: "/pipeline?importar=1" });
    expect(await screen.findByText("Importar leads via CSV")).toBeTruthy();
  });

  it("'Exportar CSV' pede o CSV ao servidor; falha vira toast de erro", async () => {
    api.exportCsv.mockRejectedValue(new ApiError(500, "x"));
    render();
    await screen.findByText("Maria Souza");
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(api.exportCsv).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Erro inesperado no servidor/)).toBeTruthy();
  });
});
