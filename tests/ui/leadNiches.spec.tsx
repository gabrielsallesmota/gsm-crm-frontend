// Nichos e fila: nichos cadastrados na Equipe (e no convite) e "Vincular a você?" ao começar o
// atendimento de um lead sem dono. Os serviços são substituídos: sem rede.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/PipelinesService", () => ({
  pipelinesService: { list: vi.fn(), reorderStages: vi.fn() },
}));
vi.mock("../../src/services/LeadsService", () => ({
  leadsService: {
    list: vi.fn(),
    move: vi.fn(),
    claim: vi.fn(),
    exportCsv: vi.fn(),
    listMessageTemplates: vi.fn(),
    timeline: vi.fn(),
    bulkImport: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("../../src/services/UsersService", () => ({
  usersService: {
    list: vi.fn(),
    directory: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    resendInvitation: vi.fn(),
  },
}));
vi.mock("../../src/services/LeadServicesService", () => ({
  leadServicesService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setUserServices: vi.fn() },
}));
vi.mock("../../src/services/TagsService", () => ({ tagsService: { list: vi.fn() } }));
vi.mock("../../src/services/TasksService", () => ({
  tasksService: { list: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
vi.mock("../../src/services/LeadCommentsService", () => ({ leadCommentsService: { create: vi.fn() } }));

import { PipelinePage } from "../../src/pages/PipelinePage";
import { UsersPage } from "../../src/pages/UsersPage";
import { leadServicesService } from "../../src/services/LeadServicesService";
import { leadsService } from "../../src/services/LeadsService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { tagsService } from "../../src/services/TagsService";
import { tasksService } from "../../src/services/TasksService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import type { Lead, LeadListFilter } from "../../src/types/lead";
import { initialStageOf, needsClaimPrompt } from "../../src/utils/leadClaim";
import { ADMIN, STAGES, VENDEDOR, makeLead, makePipeline, page, renderApp } from "./support/harness";

const api = vi.mocked(leadsService);
const niches = vi.mocked(leadServicesService);
const users = vi.mocked(usersService);

const AUTO = { id: "n1", key: "seguro_auto", name: "Seguro Auto", isDefault: true, active: true, memberUserIds: ["u-vend"] };
const VIDA = { id: "n2", key: "seguro_de_vida", name: "Seguro de Vida", isDefault: false, active: true, memberUserIds: [] };
const QUEUE_LEAD = makeLead({ ownerId: null, serviceId: "n1" });

function serveBoard(byStage: Record<string, Lead[]>) {
  api.list.mockImplementation(async (filter: LeadListFilter) => page(byStage[filter.stageId ?? ""] ?? []));
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pipelinesService.list).mockResolvedValue([makePipeline()]);
  users.directory.mockResolvedValue([
    { id: "u-admin", name: "Ana Admin", role: "admin" as const },
    { id: "u-vend", name: "Vera Vendedora", role: "vendedor" as const },
  ]);
  vi.mocked(tagsService.list).mockResolvedValue([]);
  vi.mocked(tasksService.list).mockResolvedValue(page([]));
  api.listMessageTemplates.mockResolvedValue([]);
  api.timeline.mockResolvedValue([]);
  niches.list.mockResolvedValue([AUTO, VIDA]);
  serveBoard({ "s-novo": [QUEUE_LEAD] });
});

const moveSelect = (name: string) => screen.getByLabelText(`Mover ${name} para outra etapa`) as HTMLSelectElement;

describe("regra do 'Vincular a você?'", () => {
  it("pergunta só para lead sem dono saindo para uma etapa que não é a inicial", () => {
    const initial = initialStageOf(STAGES);
    const [novo, contato, ganho] = STAGES as [typeof STAGES[0], typeof STAGES[0], typeof STAGES[0]];
    expect(initial?.id).toBe("s-novo");
    expect(needsClaimPrompt({ ownerId: null, stageId: "s-novo" }, contato, initial)).toBe(true);
    expect(needsClaimPrompt({ ownerId: null, stageId: "s-novo" }, ganho, initial)).toBe(true);
    expect(needsClaimPrompt({ ownerId: null, stageId: "s-contato" }, novo, initial)).toBe(false);
    expect(needsClaimPrompt({ ownerId: "u1", stageId: "s-novo" }, contato, initial)).toBe(false);
    expect(needsClaimPrompt({ ownerId: null, stageId: "s-contato" }, contato, initial)).toBe(false);
  });
});

describe("pipeline: fila do nicho", () => {
  it("o card mostra o nicho; mover pede 'Vincular a você?' e 'Vincular a mim' assume e move", async () => {
    api.claim.mockResolvedValue({ ...QUEUE_LEAD, ownerId: "u-vend" });
    api.move.mockImplementation(async (_id: string, stageId: string) => ({ ...QUEUE_LEAD, ownerId: "u-vend", stageId }));
    renderApp(<PipelinePage />, { user: VENDEDOR });
    await screen.findByText("Maria Souza");
    expect(await screen.findByText("Seguro Auto")).toBeTruthy();

    fireEvent.change(moveSelect("Maria Souza"), { target: { value: "s-contato" } });
    const dialog = await screen.findByRole("dialog", { name: "Vincular a você?" });
    expect(api.move).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Vincular a mim" }));
    await waitFor(() => expect(api.claim).toHaveBeenCalledWith("l1"));
    await waitFor(() => expect(api.move).toHaveBeenCalledWith("l1", "s-contato"));
  });

  it("'Agora não' move sem vincular", async () => {
    api.move.mockImplementation(async (_id: string, stageId: string) => ({ ...QUEUE_LEAD, stageId }));
    renderApp(<PipelinePage />, { user: VENDEDOR });
    await screen.findByText("Maria Souza");
    fireEvent.change(moveSelect("Maria Souza"), { target: { value: "s-contato" } });
    fireEvent.click(await screen.findByRole("button", { name: "Agora não" }));
    await waitFor(() => expect(api.move).toHaveBeenCalledWith("l1", "s-contato"));
    expect(api.claim).not.toHaveBeenCalled();
  });

  it("outra pessoa assumiu antes (409): avisa, recarrega e não move", async () => {
    api.claim.mockRejectedValue(new ApiError(409, "Este lead já foi assumido por Bia"));
    renderApp(<PipelinePage />, { user: VENDEDOR });
    await screen.findByText("Maria Souza");
    const calls = api.list.mock.calls.length;
    fireEvent.change(moveSelect("Maria Souza"), { target: { value: "s-contato" } });
    fireEvent.click(await screen.findByRole("button", { name: "Vincular a mim" }));
    expect(await screen.findByText(/já foi assumido por Bia/)).toBeTruthy();
    await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThan(calls));
    expect(api.move).not.toHaveBeenCalled();
  });

  it("lead com dono não pergunta nada", async () => {
    serveBoard({ "s-novo": [makeLead()] });
    api.move.mockImplementation(async (_id: string, stageId: string) => makeLead({ stageId }));
    renderApp(<PipelinePage />, { user: ADMIN });
    await screen.findByText("Maria Souza");
    fireEvent.change(moveSelect("Maria Souza"), { target: { value: "s-contato" } });
    await waitFor(() => expect(api.move).toHaveBeenCalledWith("l1", "s-contato"));
    expect(screen.queryByRole("dialog", { name: "Vincular a você?" })).toBeNull();
  });

  it("admin alterna 'Meus' / 'Todos'; vendedor não tem o seletor", async () => {
    renderApp(<PipelinePage />, { user: ADMIN });
    await screen.findByText("Maria Souza");
    fireEvent.click(screen.getByRole("button", { name: "Meus" }));
    await waitFor(() =>
      expect(api.list.mock.calls.some(([f]) => (f as LeadListFilter).ownerId === "u-admin")).toBe(true),
    );
    expect(screen.getByRole("button", { name: "Meus" }).getAttribute("aria-pressed")).toBe("true");
    cleanup();
    renderApp(<PipelinePage />, { user: VENDEDOR });
    await screen.findByText("Maria Souza");
    expect(screen.queryByRole("button", { name: "Meus" })).toBeNull();
  });
});

describe("Equipe: nichos", () => {
  const member = (id: string, name: string, phone: string | null) =>
    ({ id, tenantId: "t1", name, email: `${id}@x.com`, role: "vendedor", status: "active", pendingFirstAccess: false, phone }) as never;

  beforeEach(() => {
    users.list.mockResolvedValue([member("u-admin", "Ana Admin", "+5511911111111"), member("u-vend", "Vera Vendedora", null)]);
  });

  it("lista os nichos com quem atende e mostra os nichos de cada pessoa", async () => {
    renderApp(<UsersPage />, { user: ADMIN });
    const auto = (await screen.findByRole("region", { name: "Nicho Seguro Auto" })) as HTMLElement;
    expect(within(auto).getByText("Padrão")).toBeTruthy();
    expect(within(auto).getByText("Vera Vendedora")).toBeTruthy();
    expect(within(auto).getByText(/sem telefone/)).toBeTruthy();
    expect(screen.getByText(/Nichos: Seguro Auto/)).toBeTruthy();
  });

  it("convite já vincula os nichos marcados", async () => {
    users.create.mockResolvedValue({
      user: { id: "u-new", tenantId: "t1", name: "Nova", email: "nova@x.com", role: "vendedor", status: "active", pendingFirstAccess: true } as never,
      invitationSent: true,
    });
    niches.setUserServices.mockResolvedValue([AUTO, VIDA]);
    renderApp(<UsersPage />, { user: ADMIN });
    fireEvent.click((await screen.findAllByRole("button", { name: /Convidar pessoa/ }))[0]!);
    const dialog = within(await screen.findByRole("dialog", { name: "Convidar pessoa" }));
    fireEvent.change(dialog.getByLabelText(/^Nome/), { target: { value: "Nova Pessoa" } });
    fireEvent.change(dialog.getByLabelText(/E-mail/), { target: { value: "nova@x.com" } });
    fireEvent.change(dialog.getByLabelText(/Telefone/), { target: { value: "11988887777" } });
    fireEvent.click(dialog.getByRole("checkbox", { name: /Seguro de Vida/ }));
    fireEvent.click(dialog.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(niches.setUserServices).toHaveBeenCalledWith("u-new", ["n2"]));
  });

  it("'Editar' nichos de uma pessoa salva a lista inteira", async () => {
    niches.setUserServices.mockResolvedValue([AUTO, VIDA]);
    renderApp(<UsersPage />, { user: ADMIN });
    fireEvent.click(await screen.findByRole("button", { name: "Editar nichos de Vera Vendedora" }));
    const dialog = await screen.findByRole("dialog", { name: /Nichos de Vera Vendedora/ });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Seguro de Vida/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(niches.setUserServices).toHaveBeenCalledWith("u-vend", ["n1", "n2"]));
  });
});
