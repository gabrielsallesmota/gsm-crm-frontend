// FASE 1B — acessibilidade remanescente da Prospecção interna: importação de prospects (diálogo
// acessível, rótulos, erro anunciado) e rótulos dos formulários de Configurações da Prospecção.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/ProspectsService", () => ({
  prospectsService: { listStages: vi.fn(), listMessageTemplates: vi.fn(), bulkImport: vi.fn() },
}));
vi.mock("../../src/services/PipelinesService", () => ({ pipelinesService: { list: vi.fn() } }));
vi.mock("../../src/services/UsersService", () => ({ usersService: { directory: vi.fn() } }));
vi.mock("../../src/services/TagsService", () => ({ tagsService: { list: vi.fn() } }));
vi.mock("../../src/services/LeadsService", () => ({ leadsService: { listMessageTemplates: vi.fn() } }));
vi.mock("../../src/services/SdrService", () => ({ sdrService: { getAiSettings: vi.fn() } }));

import { ProspectImportModal } from "../../src/components/prospects/ProspectImportModal";
import { MessageTemplatesSettings } from "../../src/components/prospects/MessageTemplatesSettings";
import { SettingsPage } from "../../src/pages/SettingsPage";
import { leadsService } from "../../src/services/LeadsService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { prospectsService } from "../../src/services/ProspectsService";
import { sdrService } from "../../src/services/SdrService";
import { tagsService } from "../../src/services/TagsService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import type { ProspectStage } from "../../src/types/prospect";
import { STAFF, deferred, makePipeline, renderApp } from "./support/harness";

afterEach(cleanup);

const STAGE = { id: "ps1", name: "Contato", order: 0, color: "#4aa3ff" } as unknown as ProspectStage;
const api = vi.mocked(prospectsService);

beforeEach(() => {
  vi.clearAllMocks();
  api.listStages.mockResolvedValue([STAGE]);
  api.listMessageTemplates.mockResolvedValue([]);
  vi.mocked(pipelinesService.list).mockResolvedValue([makePipeline()]);
  vi.mocked(usersService.directory).mockResolvedValue([]);
  vi.mocked(tagsService.list).mockResolvedValue([]);
  vi.mocked(leadsService.listMessageTemplates).mockResolvedValue([]);
  vi.mocked(sdrService.getAiSettings).mockResolvedValue({
    apiProvider: "openai",
    chatTarget: "chatgpt",
    openai: { configured: false, last4: null },
    anthropic: { configured: false, last4: null },
  } as never);
});

function hasName(el: HTMLElement): boolean {
  if (el.getAttribute("aria-label")?.trim()) return true;
  const by = el.getAttribute("aria-labelledby");
  if (by && by.split(/\s+/).some((id) => document.getElementById(id)?.textContent?.trim())) return true;
  const labels = (el as HTMLInputElement).labels;
  return Boolean(labels && [...labels].some((l) => l.textContent?.trim()));
}
const FIELD = "input:not([type=hidden]):not([type=color]), select, textarea";
const unnamed = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>(FIELD)].filter((el) => !hasName(el)).length;

function openImport() {
  const onClose = vi.fn();
  const onImported = vi.fn();
  const view = renderApp(
    <ProspectImportModal stages={[STAGE]} defaultStageId="ps1" onClose={onClose} onImported={onImported} />,
    { user: STAFF },
  );
  return { ...view, onClose, onImported };
}
const upload = (csv: string) => {
  const input = document.querySelector("input[type=file]") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([csv], "p.csv", { type: "text/csv" })] } });
};
const submit = () => screen.getByRole("button", { name: /^Importar/ }) as HTMLButtonElement;

describe("ProspectImportModal acessível (1B)", () => {
  it("é um diálogo modal com nome; Esc fecha enquanto nada foi escolhido", async () => {
    const { onClose } = openImport();
    const dialog = screen.getByRole("dialog", { name: "Importar prospects via CSV" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("seletor de arquivo, estágio, duplicados e de/para têm nome acessível", async () => {
    openImport();
    expect(screen.getByLabelText("Arquivo CSV com os prospects")).toBeTruthy();
    upload("Nome da empresa,Telefone\nClínica Sol,11999990000");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    expect(unnamed(screen.getByRole("dialog"))).toBe(0);
    expect(screen.getByLabelText("Estágio de entrada (leads novos)")).toBeTruthy();
    expect(screen.getByLabelText("Se já existir (telefone, empresa ou Maps)")).toBeTruthy();
    expect(screen.getByLabelText("Campo do prospect para a coluna Nome da empresa")).toBeTruthy();
  });

  it("erro de leitura/importação é anunciado UMA vez (role=alert)", async () => {
    api.bulkImport.mockRejectedValueOnce(new ApiError(422, "Lote recusado"));
    openImport();
    upload("Nome da empresa\nClínica Sol");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    const dialog = screen.getByRole("dialog");
    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toBe("Lote recusado");
    expect(within(dialog).getAllByRole("alert")).toHaveLength(1);
  });

  it("durante o envio nada fecha o diálogo (Esc, fundo e ×)", async () => {
    const pending = deferred<never>();
    api.bulkImport.mockReturnValue(pending.promise);
    const { onClose } = openImport();
    upload("Nome da empresa\nClínica Sol");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await screen.findByRole("button", { name: "Importando…" });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Configurações da Prospecção — campos com nome acessível (1B)", () => {
  it("mensagens de WhatsApp: estágio, área e mensagem", async () => {
    renderApp(<MessageTemplatesSettings />, { user: STAFF });
    await screen.findByLabelText("Mensagem de WhatsApp");
    expect(screen.getByLabelText("Estágio da mensagem")).toBeTruthy();
    expect(screen.getByLabelText("Área (opcional — em branco = coringa do estágio)")).toBeTruthy();
    expect(unnamed(document.body)).toBe(0);
  });

  it("estágios de prospecção: nome do novo estágio e IA dos textos sem campos anônimos", async () => {
    renderApp(<SettingsPage />, { user: STAFF });
    await screen.findByText("Prospecção — Estágios");
    await screen.findByText("Prospecção — IA dos textos");
    await screen.findByLabelText("Mensagem de WhatsApp");
    expect(screen.getByLabelText("Nome do novo estágio de prospecção")).toBeTruthy();
    const section = (title: string) => screen.getByRole("heading", { name: title }).closest("section")!;
    expect(unnamed(section("Prospecção — Estágios"))).toBe(0);
    expect(unnamed(section("Prospecção — mensagens de WhatsApp"))).toBe(0);
    expect(unnamed(section("Prospecção — IA dos textos"))).toBe(0);
  });
});
