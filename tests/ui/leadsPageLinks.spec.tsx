// FASE 0 — links profundos e estados vazios da lista de Leads (F-35): `?novo=1` e o caminho para a
// importação. Caracterização; o formulário completo de "Novo lead" fica como cobertura parcial.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/PipelinesService", () => ({ pipelinesService: { list: vi.fn() } }));
vi.mock("../../src/services/LeadsService", () => ({
  leadsService: { list: vi.fn(), create: vi.fn(), listMessageTemplates: vi.fn() },
}));
vi.mock("../../src/services/UsersService", () => ({ usersService: { directory: vi.fn() } }));
vi.mock("../../src/services/TagsService", () => ({ tagsService: { list: vi.fn() } }));

import { LeadsPage } from "../../src/pages/LeadsPage";
import { leadsService } from "../../src/services/LeadsService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { tagsService } from "../../src/services/TagsService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import { VENDEDOR, makeLead, makePipeline, page, renderApp } from "./support/harness";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pipelinesService.list).mockResolvedValue([makePipeline()]);
  vi.mocked(usersService.directory).mockResolvedValue([{ id: "u-admin", name: "Ana Admin", role: "admin" as const }]);
  vi.mocked(tagsService.list).mockResolvedValue([]);
  vi.mocked(leadsService.listMessageTemplates).mockResolvedValue([]);
  vi.mocked(leadsService.list).mockResolvedValue(page([makeLead()]));
});

describe("F-35 links profundos da lista de leads", () => {
  it("?novo=1 abre o cadastro de lead já na primeira renderização", async () => {
    renderApp(<LeadsPage />, { route: "/leads?novo=1" });
    expect(await screen.findByRole("dialog", { name: "Novo lead" })).toBeTruthy();
  });

  it("sem ?novo=1 o cadastro NÃO abre", async () => {
    renderApp(<LeadsPage />, { route: "/leads" });
    await screen.findByText("Maria Souza");
    expect(screen.queryByRole("dialog", { name: "Novo lead" })).toBeNull();
  });

  it("fechar o cadastro remove o parâmetro e não reabre", async () => {
    renderApp(<LeadsPage />, { route: "/leads?novo=1" });
    const dialog = await screen.findByRole("dialog", { name: "Novo lead" });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Novo lead" })).toBeNull());
    expect(dialog.isConnected).toBe(false);
  });
});

describe("F-35 estados da lista", () => {
  it("lista vazia sem filtros: orienta com 'Adicionar lead' e 'Importar planilha'", async () => {
    vi.mocked(leadsService.list).mockResolvedValue(page([]));
    renderApp(<LeadsPage />, { route: "/leads" });
    expect(await screen.findByText("Nenhum lead ainda")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar lead" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Importar planilha" })).toBeTruthy();
  });

  it("'Configurar integração' só para quem gerencia integrações (admin), não para vendedor", async () => {
    vi.mocked(leadsService.list).mockResolvedValue(page([]));
    renderApp(<LeadsPage />, { route: "/leads" });
    expect(await screen.findByRole("button", { name: "Configurar integração" })).toBeTruthy();
    cleanup();
    renderApp(<LeadsPage />, { route: "/leads", user: VENDEDOR });
    await screen.findByText("Nenhum lead ainda");
    expect(screen.queryByRole("button", { name: "Configurar integração" })).toBeNull();
  });

  it("erro ao carregar: mensagem e 'Tentar de novo'", async () => {
    vi.mocked(leadsService.list).mockRejectedValueOnce(new ApiError(500, "x"));
    renderApp(<LeadsPage />, { route: "/leads" });
    expect(await screen.findByText("Não foi possível carregar os leads")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Maria Souza")).toBeTruthy();
  });
});
