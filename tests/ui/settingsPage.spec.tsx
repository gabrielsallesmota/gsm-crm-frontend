// FASE 0 — caracterização de Configurações (F-24..F-31): pipelines, etapas, tags, origens e
// templates de WhatsApp. Descreve o comportamento ATUAL (inclusive exclusões sem confirmação,
// que são falhas conhecidas CFG-02 documentadas à parte).
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/PipelinesService", () => ({
  pipelinesService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setDefault: vi.fn(),
    createStage: vi.fn(),
    updateStage: vi.fn(),
    deleteStage: vi.fn(),
    reorderStages: vi.fn(),
  },
}));
vi.mock("../../src/services/TagsService", () => ({
  tagsService: { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));
vi.mock("../../src/services/LeadsService", () => ({
  leadsService: {
    listMessageTemplates: vi.fn(),
    createMessageTemplate: vi.fn(),
    updateMessageTemplate: vi.fn(),
    deleteMessageTemplate: vi.fn(),
  },
}));
vi.mock("../../src/services/ProspectsService", () => ({
  prospectsService: {
    listStages: vi.fn(),
    listMessageTemplates: vi.fn(),
    createStage: vi.fn(),
    updateStage: vi.fn(),
    deleteStage: vi.fn(),
    reorderStages: vi.fn(),
  },
}));
vi.mock("../../src/services/LeadServicesService", () => ({
  leadServicesService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("../../src/services/UsersService", () => ({ usersService: { list: vi.fn() } }));
vi.mock("../../src/services/SdrService", () => ({
  sdrService: { getAiSettings: vi.fn(), updateAiSettings: vi.fn() },
}));

import { SettingsPage } from "../../src/pages/SettingsPage";
import { leadServicesService } from "../../src/services/LeadServicesService";
import { leadsService } from "../../src/services/LeadsService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { prospectsService } from "../../src/services/ProspectsService";
import { sdrService } from "../../src/services/SdrService";
import { tagsService } from "../../src/services/TagsService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import {
  ADMIN,
  GESTOR,
  STAFF,
  STAGES,
  deferred,
  makePipeline,
  makeStage,
  makeTemplate,
  renderApp,
} from "./support/harness";

const pipes = vi.mocked(pipelinesService);
const tags = vi.mocked(tagsService);
const leads = vi.mocked(leadsService);

afterEach(cleanup);

const SECOND = makePipeline({
  id: "p2",
  name: "Pós-venda",
  isDefault: false,
  stages: [makeStage("b1", "Onboarding", 0), makeStage("b2", "Renovação", 1)],
});

beforeEach(() => {
  vi.clearAllMocks();
  pipes.list.mockResolvedValue([makePipeline(), SECOND]);
  tags.list.mockResolvedValue([{ id: "tg1", label: "VIP", color: "#ff0000", bg: "rgba(255,0,0,.14)" }]);
  leads.listMessageTemplates.mockResolvedValue([]);
  vi.mocked(prospectsService.listStages).mockResolvedValue([]);
  vi.mocked(leadServicesService.list).mockResolvedValue([]);
  vi.mocked(usersService.list).mockResolvedValue([]);
  vi.mocked(prospectsService.listMessageTemplates).mockResolvedValue([]);
  vi.mocked(sdrService.getAiSettings).mockResolvedValue({
    chatTarget: "chatgpt",
    apiProvider: "openai",
    openai: { configured: false, last4: null },
    anthropic: { configured: false, last4: null },
  } as never);
});

const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<SettingsPage />, options);
const pipelineCard = (name: string) => screen.getByText(name).closest("[class*='pipelineCard']") as HTMLElement;

// ---------------------------------------------------------------------------------------------
describe("F-24 pipelines", () => {
  it("lista os pipelines com etapas; o padrão tem selo 'Padrão' e os outros 'Tornar padrão'", async () => {
    open();
    expect(await screen.findByText("Comercial")).toBeTruthy();
    expect(within(pipelineCard("Comercial")).getByText("Padrão")).toBeTruthy();
    expect(within(pipelineCard("Pós-venda")).getByRole("button", { name: "Tornar padrão" })).toBeTruthy();
    expect(within(pipelineCard("Comercial")).getByText(/Em contato/)).toBeTruthy();
  });

  it("criar pipeline: só com nome; envia nome e cor padrão e recarrega a lista", async () => {
    pipes.create.mockResolvedValue(makePipeline({ id: "p3", name: "Renovações" }));
    open();
    await screen.findByText("Comercial");
    const add = screen.getAllByRole("button", { name: "Adicionar" })[0] as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Nome do novo pipeline…"), { target: { value: "  Renovações  " } });
    fireEvent.click(add);
    await waitFor(() => expect(pipes.create).toHaveBeenCalledWith({ name: "Renovações", color: "#4aa3ff" }));
    expect(await screen.findByText("Pipeline criado")).toBeTruthy();
    expect(pipes.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("renomear/cor: salvar chama update; cancelar não chama", async () => {
    pipes.update.mockResolvedValue(SECOND);
    open();
    await screen.findByText("Pós-venda");
    fireEvent.click(screen.getByRole("button", { name: "Editar pipeline Pós-venda" }));
    const name = screen.getByDisplayValue("Pós-venda");
    fireEvent.change(name, { target: { value: "Sucesso do cliente" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(pipes.update).toHaveBeenCalledWith("p2", { name: "Sucesso do cliente", color: "#4aa3ff" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar pipeline Comercial" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(pipes.update).toHaveBeenCalledTimes(1);
  });

  it("nome em branco desabilita o Salvar da edição", async () => {
    open();
    await screen.findByText("Pós-venda");
    fireEvent.click(screen.getByRole("button", { name: "Editar pipeline Pós-venda" }));
    fireEvent.change(screen.getByDisplayValue("Pós-venda"), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("tornar padrão chama a API e confirma", async () => {
    pipes.setDefault.mockResolvedValue(SECOND);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Tornar padrão" }));
    await waitFor(() => expect(pipes.setDefault).toHaveBeenCalledWith("p2"));
    expect(await screen.findByText("Pipeline padrão atualizado")).toBeTruthy();
  });

  it("sem nenhum pipeline padrão: aviso de que as integrações não têm onde entrar", async () => {
    pipes.list.mockResolvedValue([makePipeline({ isDefault: false })]);
    open();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/não têm onde entrar/)).toBeTruthy();
  });

  it("o pipeline padrão NÃO tem botão de excluir; o único pipeline também não", async () => {
    open();
    await screen.findByText("Comercial");
    expect(screen.queryByRole("button", { name: "Excluir pipeline Comercial" })).toBeNull();
    expect(screen.getByRole("button", { name: "Excluir pipeline Pós-venda" })).toBeTruthy();
    cleanup();
    pipes.list.mockResolvedValue([makePipeline({ isDefault: false })]);
    open();
    await screen.findByText("Comercial");
    expect(screen.queryByRole("button", { name: /Excluir pipeline/ })).toBeNull();
  });

  it("excluir pipeline pede confirmação; cancelar não exclui; confirmar exclui", async () => {
    pipes.delete.mockResolvedValue(undefined);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir pipeline Pós-venda" }));
    const confirm = await screen.findByRole("dialog", { name: "Excluir pipeline?" });
    expect(within(confirm).getByText(/Só é possível excluir um pipeline sem leads/)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(pipes.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Excluir pipeline Pós-venda" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Excluir pipeline?" })).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(pipes.delete).toHaveBeenCalledWith("p2"));
  });

  it("pipeline com leads: a recusa do servidor (409) aparece como toast e o diálogo permanece", async () => {
    pipes.delete.mockRejectedValue(new ApiError(409, "Este pipeline ainda tem leads. Mova ou exclua os leads antes de excluí-lo."));
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir pipeline Pós-venda" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Excluir pipeline?" })).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText(/ainda tem leads/)).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Excluir pipeline?" })).toBeTruthy();
  });

  it("erro ao carregar os pipelines mostra aviso com 'Tentar de novo'", async () => {
    pipes.list.mockRejectedValueOnce(new ApiError(500, "x"));
    open();
    // Prompt 08: os templates ficam em outra categoria, então o aviso aparece uma vez aqui
    expect((await screen.findAllByText("Não foi possível carregar os pipelines")).length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Comercial")).toBeTruthy();
  });

  it("pipeline sem etapas oferece 'Criar estágios padrão' (cria na ordem, uma por vez)", async () => {
    pipes.list.mockResolvedValue([makePipeline({ stages: [] })]);
    pipes.createStage.mockResolvedValue(STAGES[0]!);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Criar estágios padrão" }));
    await waitFor(() => expect(pipes.createStage).toHaveBeenCalledTimes(5));
    expect(pipes.createStage.mock.calls.map(([, s]) => s.label)).toEqual(["Novo", "Em contato", "Proposta", "Ganho", "Perdido"]);
    expect(pipes.createStage.mock.calls[3]![1]).toMatchObject({ isWon: true });
    expect(pipes.createStage.mock.calls[4]![1]).toMatchObject({ isLost: true });
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-25 etapas", () => {
  const chip = (label: string | RegExp) => within(pipelineCard("Comercial")).getByRole("button", { name: label });

  it("criar etapa: nome + cor (sem Ganho/Perdido na criação — CFG-05)", async () => {
    pipes.createStage.mockResolvedValue(STAGES[0]!);
    open();
    await screen.findByText("Comercial");
    fireEvent.click(within(pipelineCard("Comercial")).getByRole("button", { name: "+ Etapa" }));
    expect(screen.queryByRole("checkbox", { name: "Ganho" })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Nome da etapa…"), { target: { value: " Negociação " } });
    fireEvent.click(within(pipelineCard("Comercial")).getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(pipes.createStage).toHaveBeenCalledWith("p1", { label: "Negociação", color: "#4aa3ff" }));
    expect(await screen.findByText("Etapa criada")).toBeTruthy();
  });

  it("editar: Ganho e Perdido são mutuamente exclusivos na tela", async () => {
    open();
    await screen.findByText("Comercial");
    fireEvent.click(chip(/Novo/));
    const won = screen.getByRole("checkbox", { name: "Ganho" }) as HTMLInputElement;
    const lost = screen.getByRole("checkbox", { name: "Perdido" }) as HTMLInputElement;
    fireEvent.click(won);
    expect([won.checked, lost.checked]).toEqual([true, false]);
    fireEvent.click(lost);
    expect([won.checked, lost.checked]).toEqual([false, true]);
  });

  it("editar: salvar envia nome aparado, cor e flags", async () => {
    pipes.updateStage.mockResolvedValue(STAGES[0]!);
    open();
    await screen.findByText("Comercial");
    fireEvent.click(chip(/Em contato/));
    const input = screen.getByDisplayValue("Em contato");
    fireEvent.change(input, { target: { value: "  Primeiro contato  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(pipes.updateStage).toHaveBeenCalledWith("s-contato", {
      label: "Primeiro contato",
      color: "#4aa3ff",
      isWon: false,
      isLost: false,
    }));
  });

  it("reordenar com as setas: envia a permutação COMPLETA e a primeira não tem seta para a esquerda", async () => {
    pipes.reorderStages.mockResolvedValue(undefined);
    open();
    await screen.findByText("Comercial");
    fireEvent.click(chip(/Novo/));
    expect((screen.getByRole("button", { name: "Mover etapa para a esquerda" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Mover etapa para a direita" }));
    await waitFor(() => expect(pipes.reorderStages).toHaveBeenCalledWith("p1", ["s-contato", "s-novo", "s-ganho", "s-perdido"]));
  });

  it("CFG-03: excluir etapa: a confirmação informa que só etapa SEM leads pode ser excluída E que os templates da etapa também serão excluídos", async () => {
    pipes.deleteStage.mockResolvedValue(undefined);
    open();
    await screen.findByText("Comercial");
    fireEvent.click(chip(/Em contato/));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    const confirm = await screen.findByRole("dialog", { name: "Excluir etapa?" });
    expect(within(confirm).getByText(/Só é possível excluir uma etapa sem leads/)).toBeTruthy();
    expect(within(confirm).getByText(/templates de mensagem de WhatsApp cadastrados para esta etapa também serão excluídos/)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(pipes.deleteStage).toHaveBeenCalledWith("s-contato"));
    expect(await screen.findByText("Etapa excluída")).toBeTruthy();
  });

  it("etapa com leads: 409 do servidor vira toast com a orientação e nada é excluído da tela", async () => {
    pipes.deleteStage.mockRejectedValue(new ApiError(409, "Esta etapa ainda tem leads. Mova os leads para outra etapa antes de excluí-la."));
    open();
    await screen.findByText("Comercial");
    fireEvent.click(chip(/Novo/));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Excluir etapa?" })).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText(/ainda tem leads/)).toBeTruthy();
  });

  it("etapas finais mostram 🏆 e ✕ nas etiquetas", async () => {
    open();
    await screen.findByText("Comercial");
    expect(chip(/Ganho/).textContent).toContain("🏆");
    expect(chip(/Perdido/).textContent).toContain("✕");
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-26 tags e F-27 origens", () => {
  it("lista as tags existentes", async () => {
    open();
    expect(await screen.findByText("VIP")).toBeTruthy();
  });

  it("criar tag: nome aparado + cor + fundo translúcido derivado da cor", async () => {
    tags.create.mockResolvedValue({ id: "tg2", label: "Retorno", color: "#4aa3ff", bg: "rgba(74, 163, 255, 0.14)" });
    open();
    await screen.findByText("VIP");
    fireEvent.change(screen.getByPlaceholderText("Nome da nova tag…"), { target: { value: "  Retorno " } });
    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[1]!);
    await waitFor(() => expect(tags.create).toHaveBeenCalled());
    expect(tags.create.mock.calls[0]![0]).toMatchObject({ label: "Retorno", color: "#4aa3ff" });
    expect(tags.create.mock.calls[0]![0].bg).toMatch(/^rgba\(/);
    expect(await screen.findByText("Tag criada")).toBeTruthy();
  });

  it("tag duplicada: a recusa do servidor aparece como toast", async () => {
    tags.create.mockRejectedValue(new ApiError(409, "Já existe uma tag com este nome"));
    open();
    await screen.findByText("VIP");
    fireEvent.change(screen.getByPlaceholderText("Nome da nova tag…"), { target: { value: "VIP" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[1]!);
    expect(await screen.findByText("Já existe uma tag com este nome")).toBeTruthy();
  });

  it("CFG-02: remover tag pede confirmação que cita a tag; cancelar NÃO remove", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Remover tag VIP" }));
    const confirm = await screen.findByRole("dialog", { name: "Remover tag?" });
    expect(within(confirm).getByText(/A tag "VIP" será removida/)).toBeTruthy();
    expect(tags.delete).not.toHaveBeenCalled(); // abrir o diálogo não remove nada
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Remover tag?" })).toBeNull());
    expect(tags.delete).not.toHaveBeenCalled();
    expect(screen.getByText("VIP")).toBeTruthy();
  });

  it("CFG-02: confirmar remove a tag com a MESMA chamada de antes e avisa só depois do sucesso", async () => {
    tags.delete.mockResolvedValue(undefined);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Remover tag VIP" }));
    const confirm = await screen.findByRole("dialog", { name: "Remover tag?" });
    expect(screen.queryByText("Tag removida")).toBeNull();
    fireEvent.click(within(confirm).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(tags.delete).toHaveBeenCalledWith("tg1"));
    expect(await screen.findByText("Tag removida")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Remover tag?" })).toBeNull());
  });

  it("CFG-02: falha ao remover a tag mantém o diálogo aberto, avisa o erro e NÃO diz que removeu", async () => {
    tags.delete.mockRejectedValue(new ApiError(500, "x"));
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Remover tag VIP" }));
    const confirm = await screen.findByRole("dialog", { name: "Remover tag?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Remover" }));
    expect(await screen.findByText(/Erro inesperado no servidor/)).toBeTruthy();
    expect(screen.queryByText("Tag removida")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Remover tag?" })).toBeTruthy();
  });

  it("CFG-02: Esc fecha o diálogo de remoção sem remover e devolve o foco ao botão da tag", async () => {
    open();
    const trigger = await screen.findByRole("button", { name: "Remover tag VIP" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Remover tag?" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(tags.delete).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("erro ao carregar as tags: aviso próprio, o resto da página continua", async () => {
    tags.list.mockRejectedValue(new ApiError(500, "x"));
    open();
    expect(await screen.findByText("Não foi possível carregar as tags")).toBeTruthy();
    expect(screen.getByText("Comercial")).toBeTruthy();
  });

  it("origens: lista ESTÁTICA do frontend (oito fixas), sem edição — D-04 mantém assim no redesign", async () => {
    open();
    await screen.findByText("Comercial");
    const section = screen.getByRole("heading", { name: "Origens" }).closest("section") as HTMLElement;
    for (const label of ["Site / landing page", "WhatsApp", "Instagram", "Facebook", "Google", "Manual", "Integração", "Outro"]) {
      expect(within(section).getByText(new RegExp(label))).toBeTruthy();
    }
    expect(within(section).queryByRole("button")).toBeNull();
    expect(within(section).queryByRole("textbox")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
const openComm = (options: Parameters<typeof renderApp>[1] = {}) =>
  open({ route: "/?secao=comunicacao", ...options });

describe("F-28 mensagens de WhatsApp (templates)", () => {
  const section = () => screen.getByRole("heading", { name: "Pipeline — mensagens de WhatsApp" }).closest("section") as HTMLElement;
  const stageSelect = () => within(section()).getAllByRole("combobox")[0] as HTMLSelectElement;
  const originSelect = () => within(section()).getAllByRole("combobox")[1] as HTMLSelectElement;

  it("sem templates: mostra a dica de placeholders e o estado vazio", async () => {
    openComm();
    expect(await screen.findByText("Nenhum template cadastrado ainda.")).toBeTruthy();
    for (const p of ["{nome}", "{empresa}", "{cidade}", "{estado}"]) {
      expect(within(section()).getByText(p)).toBeTruthy();
    }
  });

  it("etapas de todos os pipelines aparecem no seletor, prefixadas pelo pipeline (há mais de um)", async () => {
    openComm();
    await screen.findByText("Nenhum template cadastrado ainda.");
    const options = within(stageSelect()).getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("Comercial — Novo");
    expect(options).toContain("Pós-venda — Onboarding");
  });

  it("lista template com etapa, origem (ou 'Qualquer origem') e mensagem", async () => {
    leads.listMessageTemplates.mockResolvedValue([
      makeTemplate({ id: "a", origin: null, message: "Coringa {nome}" }),
      makeTemplate({ id: "b", origin: "instagram", message: "Específico" }),
    ]);
    openComm();
    expect(await screen.findByText("Coringa {nome}")).toBeTruthy();
    expect(within(section()).getByText("Qualquer origem")).toBeTruthy();
    expect(within(section()).getAllByText("Instagram").length).toBeGreaterThanOrEqual(1); // selo + opção do seletor
    expect(within(section()).getAllByText("Comercial — Novo").length).toBeGreaterThanOrEqual(2);
  });

  it("Prompt 08: recarregar a lista depois de salvar NÃO desmonta o formulário (o que a pessoa digita continua lá)", async () => {
    leads.createMessageTemplate.mockResolvedValue(makeTemplate());
    const reload = deferred<ReturnType<typeof makeTemplate>[]>();
    leads.listMessageTemplates.mockResolvedValueOnce([]).mockReturnValueOnce(reload.promise);
    openComm();
    await screen.findByText("Nenhum template cadastrado ainda.");
    fireEvent.change(within(section()).getByPlaceholderText(/Olá \{nome\}/), { target: { value: "Primeira" } });
    fireEvent.click(within(section()).getByRole("button", { name: "Adicionar template" }));
    await waitFor(() => expect(leads.listMessageTemplates).toHaveBeenCalledTimes(2)); // recarga em andamento
    // durante a recarga o formulário continua montado e aceita digitação
    const box = within(section()).getByPlaceholderText(/Olá \{nome\}/) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "Segunda mensagem" } });
    await act(async () => reload.resolve([makeTemplate()]));
    expect((within(section()).getByPlaceholderText(/Olá \{nome\}/) as HTMLTextAreaElement).value).toBe("Segunda mensagem");
  });

  it("criar template coringa (origem em branco): não envia 'origin'", async () => {
    leads.createMessageTemplate.mockResolvedValue(makeTemplate());
    openComm();
    await screen.findByText("Nenhum template cadastrado ainda.");
    fireEvent.change(within(section()).getByPlaceholderText(/Olá \{nome\}/), { target: { value: "  Olá {nome}!  " } });
    fireEvent.click(within(section()).getByRole("button", { name: "Adicionar template" }));
    await waitFor(() => expect(leads.createMessageTemplate).toHaveBeenCalledWith({ stageId: "s-novo", message: "Olá {nome}!" }));
    expect(await screen.findByText("Template criado")).toBeTruthy();
  });

  it("criar template específico por origem e etapa: envia stageId, origin e mensagem", async () => {
    leads.createMessageTemplate.mockResolvedValue(makeTemplate());
    openComm();
    await screen.findByText("Nenhum template cadastrado ainda.");
    fireEvent.change(stageSelect(), { target: { value: "s-contato" } });
    fireEvent.change(originSelect(), { target: { value: "whatsapp" } });
    fireEvent.change(within(section()).getByPlaceholderText(/Olá \{nome\}/), { target: { value: "Retomando" } });
    fireEvent.click(within(section()).getByRole("button", { name: "Adicionar template" }));
    await waitFor(() =>
      expect(leads.createMessageTemplate).toHaveBeenCalledWith({ stageId: "s-contato", origin: "whatsapp", message: "Retomando" }),
    );
  });

  it("mensagem vazia desabilita o botão (a validação de conteúdo vazio é do botão)", async () => {
    openComm();
    await screen.findByText("Nenhum template cadastrado ainda.");
    expect((within(section()).getByRole("button", { name: "Adicionar template" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("duplicidade (mesma etapa e origem): o 409 aparece NO formulário, sem toast", async () => {
    leads.createMessageTemplate.mockRejectedValue(new ApiError(409, "Já existe um template para esta etapa e origem"));
    openComm();
    await screen.findByText("Nenhum template cadastrado ainda.");
    fireEvent.change(within(section()).getByPlaceholderText(/Olá \{nome\}/), { target: { value: "x" } });
    fireEvent.click(within(section()).getByRole("button", { name: "Adicionar template" }));
    expect(await within(section()).findByText("Já existe um template para esta etapa e origem")).toBeTruthy();
  });

  it("editar: etapa fica travada; salvar envia origin (ou null para coringa) e a mensagem", async () => {
    leads.listMessageTemplates.mockResolvedValue([makeTemplate({ id: "a", origin: "google", message: "Antiga" })]);
    leads.updateMessageTemplate.mockResolvedValue(makeTemplate());
    openComm();
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    const selects = within(section()).getAllByRole("combobox");
    const editing = selects[selects.length - 2] as HTMLSelectElement;
    expect(editing.disabled).toBe(true);
    const origin = selects[selects.length - 1] as HTMLSelectElement;
    fireEvent.change(origin, { target: { value: "" } });
    fireEvent.change(within(section()).getByDisplayValue("Antiga"), { target: { value: "Nova" } });
    fireEvent.click(within(section()).getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(leads.updateMessageTemplate).toHaveBeenCalledWith("a", { origin: null, message: "Nova" }));
  });

  it("CFG-02: excluir template pede confirmação que identifica etapa, origem e mensagem; cancelar NÃO exclui", async () => {
    leads.listMessageTemplates.mockResolvedValue([
      makeTemplate({ id: "a", origin: "instagram", message: "Mensagem do Instagram" }),
    ]);
    openComm();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    const confirm = await screen.findByRole("dialog", { name: "Excluir template?" });
    expect(within(confirm).getByText(/Comercial — Novo \(Instagram\)/)).toBeTruthy();
    expect(within(confirm).getByText(/Mensagem do Instagram/)).toBeTruthy();
    expect(leads.deleteMessageTemplate).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(leads.deleteMessageTemplate).not.toHaveBeenCalled();
  });

  it("CFG-02: confirmar exclui o template com a MESMA chamada de antes; mensagem de sucesso só depois", async () => {
    leads.listMessageTemplates.mockResolvedValue([makeTemplate({ id: "a" })]);
    leads.deleteMessageTemplate.mockResolvedValue(undefined);
    openComm();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    const confirm = await screen.findByRole("dialog", { name: "Excluir template?" });
    expect(within(confirm).getByText(/qualquer origem/)).toBeTruthy(); // coringa
    expect(screen.queryByText("Template excluído")).toBeNull();
    fireEvent.click(within(confirm).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(leads.deleteMessageTemplate).toHaveBeenCalledWith("a"));
    expect(await screen.findByText("Template excluído")).toBeTruthy();
  });

  it("CFG-02: falha ao excluir o template mantém o diálogo e não diz que excluiu", async () => {
    leads.listMessageTemplates.mockResolvedValue([makeTemplate({ id: "a" })]);
    leads.deleteMessageTemplate.mockRejectedValue(new ApiError(500, "x"));
    openComm();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    const confirm = await screen.findByRole("dialog", { name: "Excluir template?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText(/Erro inesperado no servidor/)).toBeTruthy();
    expect(screen.queryByText("Template excluído")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Excluir template?" })).toBeTruthy();
  });

  it("CFG-06/CFG-07: campos de pipeline, etapa, tag e template têm nome acessível", async () => {
    open();
    await screen.findByText("Comercial");
    for (const name of ["Nome do novo pipeline", "Nome da nova tag"]) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "Editar pipeline Comercial" }));
    expect(screen.getByLabelText("Nome do pipeline")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(within(pipelineCard("Comercial")).getByRole("button", { name: /Novo/ }));
    expect(screen.getByLabelText("Nome da etapa")).toBeTruthy();
    fireEvent.click(within(pipelineCard("Comercial")).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(within(pipelineCard("Comercial")).getByRole("button", { name: "+ Etapa" }));
    expect(screen.getByLabelText("Nome da nova etapa")).toBeTruthy();
    cleanup();
    openComm();
    for (const name of ["Etapa do template", "Origem do template", "Mensagem do template"]) {
      expect(await screen.findByLabelText(name)).toBeTruthy();
    }
  });

  it("sem pipeline não há formulário de template; orienta a criar um", async () => {
    pipes.list.mockResolvedValue([]);
    openComm();
    expect(await screen.findByText("Crie um pipeline acima antes de configurar mensagens.")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-29..F-31 navegação, áreas internas e permissões da página", () => {
  it("admin vê o link de Automações; o de Notificações só com a feature contratada", async () => {
    open();
    await screen.findByText("Comercial");
    expect(screen.getByRole("link", { name: "Automações comerciais" }).getAttribute("href")).toBe("/configuracoes/automacoes");
    expect(screen.queryByRole("link", { name: "Notificações" })).toBeNull();
    cleanup();
    open({ user: { ...ADMIN, features: { crm: true, notifications: true } } });
    await screen.findByText("Comercial");
    expect(screen.getByRole("link", { name: "Notificações" }).getAttribute("href")).toBe("/configuracoes/notificacoes");
  });

  it("gestor vê Automações (consulta) mas não link de Integrações — que nunca esteve nesta página", async () => {
    open({ user: GESTOR });
    await screen.findByText("Comercial");
    expect(screen.getByRole("link", { name: "Automações comerciais" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Integrações/ })).toBeNull();
  });

  it("sem a feature 'crm' o link de Automações não aparece", async () => {
    open({ user: { ...ADMIN, features: { crm: false } } });
    await screen.findByText("Comercial");
    expect(screen.queryByRole("link", { name: "Automações comerciais" })).toBeNull();
  });

  it("áreas internas da GSM (Prospecção) só para staff; cliente comum nunca as vê", async () => {
    open();
    await screen.findByText("Comercial");
    expect(screen.queryByText(/Prospecção — /)).toBeNull();
    cleanup();
    open({ user: STAFF, route: "/?secao=interno" });
    expect(await screen.findByRole("heading", { name: "Prospecção — Estágios" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Prospecção — mensagens de WhatsApp" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Prospecção — IA dos textos" })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
describe("Prompt 08 — navegação por categorias (uma rota, `?secao=`)", () => {
  const nav = () => screen.getByRole("navigation", { name: "Seções das configurações" });

  it("o padrão é 'Funil de vendas' (pipelines, tags, origens) e o botão ativo é anunciado", async () => {
    open();
    expect(await screen.findByRole("heading", { name: "Pipelines e etapas" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tags" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Origens" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Pipeline — mensagens de WhatsApp" })).toBeNull();
    expect(within(nav()).getByRole("button", { name: /Pipelines, tags e origens/ }).getAttribute("aria-current")).toBe("page");
  });

  it("clicar em 'Mensagens de WhatsApp' troca a categoria sem sair da página", async () => {
    open();
    await screen.findByRole("heading", { name: "Pipelines e etapas" });
    fireEvent.click(within(nav()).getByRole("button", { name: /Mensagens de WhatsApp/ }));
    expect(await screen.findByRole("heading", { name: "Pipeline — mensagens de WhatsApp" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Pipelines e etapas" })).toBeNull();
  });

  it("?secao=interno para cliente comum volta ao padrão: a área interna nunca é montada", async () => {
    open({ route: "/?secao=interno" });
    expect(await screen.findByRole("heading", { name: "Pipelines e etapas" })).toBeTruthy();
    expect(screen.queryByText(/Prospecção — /)).toBeNull();
    expect(within(nav()).queryByRole("button", { name: /Prospecção \(GSM\)/ })).toBeNull();
    // e a IA dos textos (chamada interna) nem é solicitada
    expect(vi.mocked(sdrService.getAiSettings)).not.toHaveBeenCalled();
  });

  it("staff vê a categoria interna; atalhos de Equipe e Integrações só com permissão/feature", async () => {
    open({ user: STAFF });
    await screen.findByRole("heading", { name: "Pipelines e etapas" });
    expect(within(nav()).getByRole("button", { name: /Prospecção \(GSM\)/ })).toBeTruthy();
    cleanup();
    open({ user: GESTOR });
    await screen.findByRole("heading", { name: "Pipelines e etapas" });
    expect(within(nav()).getByRole("link", { name: "Equipe e usuários" }).getAttribute("href")).toBe("/equipe");
    expect(within(nav()).queryByRole("link", { name: "Integrações" })).toBeNull();
    expect(within(nav()).queryByRole("button", { name: /Prospecção \(GSM\)/ })).toBeNull();
  });
});

