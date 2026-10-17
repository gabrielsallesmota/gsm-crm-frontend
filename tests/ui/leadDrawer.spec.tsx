// FASE 0 — rede de segurança do painel do lead (matriz F-13..F-22). Caracterização do
// comportamento ATUAL; defeitos conhecidos ficam nos arquivos `*Known*`/`a11yKnownFailures`.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/PipelinesService", () => ({ pipelinesService: { list: vi.fn() } }));
vi.mock("../../src/services/LeadsService", () => ({
  leadsService: {
    update: vi.fn(),
    move: vi.fn(),
    delete: vi.fn(),
    timeline: vi.fn(),
    listMessageTemplates: vi.fn(),
  },
}));
vi.mock("../../src/services/UsersService", () => ({ usersService: { directory: vi.fn() } }));
vi.mock("../../src/services/TagsService", () => ({ tagsService: { list: vi.fn() } }));
vi.mock("../../src/services/TasksService", () => ({
  tasksService: { list: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
vi.mock("../../src/services/LeadCommentsService", () => ({
  leadCommentsService: { create: vi.fn() },
}));

import { LeadDrawer } from "../../src/components/leads/LeadDrawer";
import { leadCommentsService } from "../../src/services/LeadCommentsService";
import { leadsService } from "../../src/services/LeadsService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { tagsService } from "../../src/services/TagsService";
import { tasksService } from "../../src/services/TasksService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import type { LeadMessageTemplate } from "../../src/types/lead";
import {
  ADMIN,
  GESTOR,
  STAGES,
  SUPPORT_READ_ONLY,
  VENDEDOR,
  makeLead,
  makePipeline,
  makeTask,
  makeTemplate,
  page,
  renderApp,
} from "./support/harness";

const api = vi.mocked(leadsService);
const tasks = vi.mocked(tasksService);

afterEach(cleanup);

const TEAM = [
  { id: "u-admin", name: "Ana Admin", role: "admin" as const },
  { id: "u-vend", name: "Vera Vendedora", role: "vendedor" as const },
];
const TAGS = [
  { id: "tag1", label: "VIP", color: "#ff0000", bg: "#330000" },
  { id: "tag2", label: "Retorno", color: "#00ff00", bg: "#003300" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pipelinesService.list).mockResolvedValue([makePipeline()]);
  vi.mocked(usersService.directory).mockResolvedValue(TEAM);
  vi.mocked(tagsService.list).mockResolvedValue(TAGS);
  tasks.list.mockResolvedValue(page([]));
  api.timeline.mockResolvedValue([]);
  api.listMessageTemplates.mockResolvedValue([]);
});

interface Props {
  lead?: ReturnType<typeof makeLead>;
  templates?: LeadMessageTemplate[];
  onClose?: () => void;
  onSaved?: (lead: ReturnType<typeof makeLead>) => void;
  onDeleted?: (id: string) => void;
}

function open(props: Props = {}, options: Parameters<typeof renderApp>[1] = {}) {
  const handlers = {
    onClose: props.onClose ?? vi.fn(),
    onSaved: props.onSaved ?? vi.fn(),
    onDeleted: props.onDeleted ?? vi.fn(),
  };
  const view = renderApp(
    <LeadDrawer
      lead={props.lead ?? makeLead()}
      stages={STAGES}
      templates={props.templates ?? []}
      {...handlers}
    />,
    options,
  );
  return { ...view, ...handlers };
}

const dialog = () => screen.getByRole("dialog", { name: "Lead Maria Souza" });

// ---------------------------------------------------------------------------------------------
describe("F-13 abertura, fechamento e carregamento", () => {
  it("abre como diálogo modal com o nome do lead e os dados principais", async () => {
    open();
    const d = dialog();
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(within(d).getByText("Maria Souza")).toBeTruthy();
    expect(within(d).getByText("Clínica Sol")).toBeTruthy();
    expect(within(d).getByText("R$ 1.800")).toBeTruthy();
    expect(within(d).getByText("35%")).toBeTruthy();
    expect(within(d).getByText("(11) 98765-4321")).toBeTruthy();
    expect(within(d).getByText("maria@example.com")).toBeTruthy();
    expect(within(d).getByText("WhatsApp")).toBeTruthy(); // origem
  });

  it("botão Fechar, Esc e clique no fundo chamam onClose (sem alterações pendentes)", async () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Fechar lead" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
    fireEvent.mouseDown(dialog().parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("com comentário digitado, Esc e clique no fundo NÃO fecham (proteção de dados)", async () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.change(screen.getByLabelText("Novo comentário"), { target: { value: "rascunho" } });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(dialog().parentElement as HTMLElement);
    await new Promise((r) => setTimeout(r, 20));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fechar lead" }));
    expect(onClose).toHaveBeenCalledTimes(1); // só o botão descarta
  });

  it("em modo de edição, Esc também não fecha", async () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    await new Promise((r) => setTimeout(r, 20));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("devolve o foco para quem abriu o painel quando ele é desmontado", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const view = open();
    expect(dialog().contains(document.activeElement)).toBe(true);
    view.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("carregando: tarefas e timeline mostram 'Carregando…' e depois o conteúdo", async () => {
    open();
    expect(screen.getAllByText("Carregando…").length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("Nenhuma tarefa para este lead.")).toBeTruthy();
    expect(await screen.findByText("Sem atividades registradas ainda.")).toBeTruthy();
  });

  it("erro ao carregar tarefas e timeline: mensagens próprias; timeline permite tentar de novo", async () => {
    tasks.list.mockRejectedValue(new ApiError(500, "x"));
    api.timeline.mockRejectedValueOnce(new ApiError(500, "x"));
    open();
    expect(await screen.findByText("Não foi possível carregar as tarefas.")).toBeTruthy();
    expect(await screen.findByText(/Não foi possível carregar a linha do tempo/)).toBeTruthy();
    api.timeline.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Sem atividades registradas ainda.")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-14 edição de dados", () => {
  const edit = () => fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

  it("Editar mostra Salvar/Cancelar; Cancelar descarta o rascunho", async () => {
    open();
    edit();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Outro nome" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
    expect(screen.getByText("Maria Souza")).toBeTruthy();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("salvar envia SÓ os campos editáveis (nome, empresa, telefone, e-mail, valor, probabilidade, origem, notas, tags)", async () => {
    const onSaved = vi.fn();
    api.update.mockResolvedValue(makeLead({ name: "Maria S." }));
    open({ onSaved });
    edit();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "  Maria S.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    const [id, input] = api.update.mock.calls[0]!;
    expect(id).toBe("l1");
    expect(Object.keys(input).sort()).toEqual(
      ["company", "email", "name", "notes", "origin", "phone", "probability", "tags", "value"].sort(),
    );
    expect(input.name).toBe("Maria S."); // aparado
    expect(await screen.findByText("Lead atualizado com sucesso")).toBeTruthy();
    expect(onSaved).toHaveBeenCalled();
  });

  it("nome vazio desabilita o Salvar", async () => {
    open();
    edit();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Salvar alterações" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("probabilidade fora de 0–100 é ajustada em silêncio ao salvar (caracterização)", async () => {
    api.update.mockResolvedValue(makeLead());
    open();
    edit();
    const prob = screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
    fireEvent.change(prob, { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]![1].probability).toBe(100);
  });

  it("erro de salvamento: toast de erro, permanece em edição com o rascunho", async () => {
    api.update.mockRejectedValue(new ApiError(500, "x"));
    open();
    edit();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText(/Erro inesperado no servidor/)).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Novo");
  });

  it("tags: só aparecem as selecionáveis em edição; alternar entra no payload", async () => {
    api.update.mockResolvedValue(makeLead({ tags: ["tag1"] }));
    open();
    expect(screen.queryByText("VIP")).toBeNull(); // sem tags no lead e fora da edição, a seção some
    edit();
    fireEvent.click(await screen.findByRole("button", { name: "VIP" }));
    expect(screen.getByRole("button", { name: "VIP" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]![1].tags).toEqual(["tag1"]);
  });

  it("notas: exibidas só quando existem e salvas no texto livre", async () => {
    api.update.mockResolvedValue(makeLead());
    open({ lead: makeLead({ notes: "Prefere tarde" }) });
    expect(screen.getByText("Prefere tarde")).toBeTruthy();
    edit();
    fireEvent.change(screen.getByPlaceholderText("Anotações sobre o lead…"), { target: { value: "Nova nota" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]![1].notes).toBe("Nova nota");
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-15 etapa e responsável (gravam NA HORA)", () => {
  it("trocar a etapa chama a API de mover imediatamente e avisa", async () => {
    api.move.mockResolvedValue(makeLead({ stageId: "s-contato" }));
    open();
    fireEvent.change(screen.getByLabelText("Etapa"), { target: { value: "s-contato" } });
    await waitFor(() => expect(api.move).toHaveBeenCalledWith("l1", "s-contato"));
    expect(await screen.findByText("Movido para Em contato")).toBeTruthy();
  });

  it("etapas finais têm rótulo (ganho)/(perdido) e avisam sem pedir confirmação (D-03: hoje não há)", async () => {
    api.move.mockResolvedValue(makeLead({ stageId: "s-perdido" }));
    open();
    expect(screen.getByRole("option", { name: "Ganho (ganho)" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Etapa"), { target: { value: "s-perdido" } });
    expect(await screen.findByText("Negócio marcado como perdido")).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("erro ao mover: toast de erro", async () => {
    api.move.mockRejectedValue(new ApiError(500, "x"));
    open();
    fireEvent.change(screen.getByLabelText("Etapa"), { target: { value: "s-contato" } });
    expect(await screen.findByText(/Erro inesperado no servidor/)).toBeTruthy();
  });

  it("admin e gestor reatribuem o responsável; a API recebe ownerId", async () => {
    api.update.mockResolvedValue(makeLead({ ownerId: "u-vend" }));
    for (const user of [ADMIN, GESTOR]) {
      api.update.mockClear();
      const view = open({}, { user });
      fireEvent.change(await screen.findByLabelText("Responsável"), { target: { value: "u-vend" } });
      await waitFor(() => expect(api.update).toHaveBeenCalledWith("l1", { ownerId: "u-vend" }));
      view.unmount();
    }
  });

  it("vendedor só VÊ o responsável (sem seletor)", async () => {
    open({ lead: makeLead({ ownerId: "u-vend" }) }, { user: VENDEDOR });
    expect(await screen.findByText("Vera Vendedora")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Responsável" })).toBeNull();
  });

  it("dono que saiu da equipe aparece como 'Usuário inativo' no seletor", async () => {
    open({ lead: makeLead({ ownerId: "u-sumiu" }) });
    expect(await screen.findByRole("option", { name: "Usuário inativo" })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-18 tarefas do lead", () => {
  it("lista as tarefas com atraso sinalizado e as concluídas por último", async () => {
    tasks.list.mockResolvedValue(
      page([
        makeTask({ id: "t-done", title: "Feita", done: true }),
        makeTask({ id: "t-late", title: "Atrasada", dueAt: "2020-01-01T10:00:00Z" }),
        makeTask({ id: "t-ok", title: "No prazo" }),
      ]),
    );
    open();
    expect(await screen.findByText("Atrasada")).toBeTruthy();
    const titles = screen
      .getAllByText(/^(Feita|Atrasada|No prazo)$/)
      .map((e) => e.textContent);
    expect(titles).toEqual(["Atrasada", "No prazo", "Feita"]);
    expect(screen.getByText(/^Atrasada · /)).toBeTruthy();
  });

  it("consulta as tarefas DO lead (leadId) com limite de 50 e avisa quando há mais", async () => {
    tasks.list.mockResolvedValue(page([makeTask()], 80));
    open();
    await screen.findByText("Enviar proposta");
    expect(tasks.list).toHaveBeenCalledWith(expect.objectContaining({ leadId: "l1", scope: "all", pageSize: 50 }));
    expect(screen.getByText(/Mostrando 1 de 80/)).toBeTruthy();
  });

  it("concluir e reabrir chamam update com done e recarregam a lista", async () => {
    tasks.list.mockResolvedValueOnce(page([makeTask()]));
    tasks.list.mockResolvedValue(page([makeTask({ done: true })])); // o que o servidor devolve DEPOIS de concluir
    tasks.update.mockResolvedValue(makeTask({ done: true }));
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Concluir tarefa" }));
    await waitFor(() => expect(tasks.update).toHaveBeenCalledWith("task1", { done: true }));
    await waitFor(() => expect(tasks.list.mock.calls.length).toBeGreaterThanOrEqual(2));
    fireEvent.click(await screen.findByRole("button", { name: "Reabrir tarefa" }));
    await waitFor(() => expect(tasks.update).toHaveBeenCalledWith("task1", { done: false }));
  });

  it("erro ao concluir mostra toast", async () => {
    tasks.list.mockResolvedValue(page([makeTask()]));
    tasks.update.mockRejectedValue(new ApiError(500, "x"));
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Concluir tarefa" }));
    expect(await screen.findByText(/Erro inesperado no servidor/)).toBeTruthy();
  });

  it("'+ Nova tarefa' abre o formulário já vinculado ao lead e cria a tarefa", async () => {
    tasks.create.mockResolvedValue(makeTask());
    open();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nova tarefa" }));
    const modal = await screen.findByRole("dialog", { name: "Nova tarefa" });
    expect(within(modal).getByText("Maria Souza")).toBeTruthy();
    fireEvent.change(within(modal).getByLabelText(/Título/), { target: { value: "Ligar amanhã" } });
    fireEvent.change(modal.querySelector("input[type=datetime-local], input[type=date]") as HTMLInputElement, {
      target: { value: "2099-01-01T10:00" },
    });
    fireEvent.click(within(modal).getByRole("button", { name: /Criar|Salvar/ }));
    await waitFor(() => expect(tasks.create).toHaveBeenCalledTimes(1));
    expect(tasks.create.mock.calls[0]![0]).toMatchObject({ leadId: "l1", title: "Ligar amanhã" });
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-19 comentários e timeline", () => {
  it("comentar envia o texto aparado, limpa o campo e recarrega a timeline", async () => {
    vi.mocked(leadCommentsService.create).mockResolvedValue({
      id: "c1",
      leadId: "l1",
      authorUserId: "u-admin",
      authorName: "Ana Admin",
      text: "Retornar sexta",
      createdAt: "2026-10-15T10:00:00Z",
    });
    open();
    await screen.findByText("Sem atividades registradas ainda.");
    const box = screen.getByLabelText("Novo comentário") as HTMLTextAreaElement;
    const send = screen.getByRole("button", { name: "Comentar" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(box, { target: { value: "  Retornar sexta  " } });
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() => expect(leadCommentsService.create).toHaveBeenCalledWith("l1", "Retornar sexta"));
    await waitFor(() => expect(box.value).toBe(""));
    await waitFor(() => expect(api.timeline.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("erro ao comentar mantém o texto e avisa", async () => {
    vi.mocked(leadCommentsService.create).mockRejectedValue(new ApiError(500, "x"));
    open();
    const box = screen.getByLabelText("Novo comentário") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "texto" } });
    fireEvent.click(screen.getByRole("button", { name: "Comentar" }));
    expect(await screen.findByText(/Erro inesperado no servidor/)).toBeTruthy();
    expect(box.value).toBe("texto");
  });

  it("timeline: descreve criação, mudança de etapa, ganho e comentário, com autor", async () => {
    api.timeline.mockResolvedValue([
      { id: "e1", type: "stage_changed", createdAt: "2026-10-14T10:00:00Z", actorType: "user", actorName: "Ana Admin", payload: { from_stage_name: "Novo", to_stage_name: "Em contato" }, text: null },
      { id: "e2", type: "comment", createdAt: "2026-10-13T10:00:00Z", actorType: "user", actorName: "Ana Admin", payload: {}, text: "Cliente pediu desconto" },
      { id: "e3", type: "created", createdAt: "2026-10-10T10:00:00Z", actorType: "system", actorName: null, payload: { source: "import", to_stage_name: "Novo" }, text: null },
    ]);
    open();
    expect(await screen.findByText("Mudou de etapa")).toBeTruthy();
    expect(screen.getByText("Novo → Em contato")).toBeTruthy();
    expect(screen.getByText("Cliente pediu desconto")).toBeTruthy();
    expect(screen.getByText("Lead criado via importação")).toBeTruthy();
  });

  it("a timeline é pedida SEM limite (o backend devolve no máximo 100 — DRW-05)", async () => {
    open();
    await waitFor(() => expect(api.timeline).toHaveBeenCalledWith("l1"));
    expect(api.timeline.mock.calls[0]).toHaveLength(1); // sem 2º argumento (limit)
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-20 exclusão", () => {
  it("pede confirmação citando o lead; cancelar não exclui", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Excluir lead" }));
    const confirm = await screen.findByRole("dialog", { name: "Excluir lead?" });
    expect(within(confirm).getByText(/"Maria Souza" e o histórico dele/)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Excluir lead?" })).toBeNull());
    expect(api.delete).not.toHaveBeenCalled();
    expect(dialog()).toBeTruthy(); // o painel continua aberto
  });

  it("confirmar exclui, avisa, notifica o pai e fecha o painel", async () => {
    api.delete.mockResolvedValue(undefined);
    const { onDeleted, onClose } = open();
    fireEvent.click(screen.getByRole("button", { name: "Excluir lead" }));
    const confirm = await screen.findByRole("dialog", { name: "Excluir lead?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("l1"));
    expect(await screen.findByText("Lead excluído")).toBeTruthy();
    expect(onDeleted).toHaveBeenCalledWith("l1");
    expect(onClose).toHaveBeenCalled();
  });

  it("erro na exclusão: toast e o diálogo permanece (nada fechado)", async () => {
    api.delete.mockRejectedValue(new ApiError(403, "Você só pode acessar os próprios leads"));
    const { onDeleted } = open();
    fireEvent.click(screen.getByRole("button", { name: "Excluir lead" }));
    const confirm = await screen.findByRole("dialog", { name: "Excluir lead?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Você só pode acessar os próprios leads")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Excluir lead?" })).toBeTruthy();
  });

  it("diálogo empilhado: Esc fecha SÓ a confirmação, não o painel", async () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Excluir lead" }));
    await screen.findByRole("dialog", { name: "Excluir lead?" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Excluir lead?" })).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog()).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-21/F-22 WhatsApp e e-mail do lead", () => {
  const link = (name: RegExp) =>
    within(screen.getByRole("dialog", { name: /^Lead / })).queryByRole("link", { name });
  const t = (extra: Partial<LeadMessageTemplate>) => makeTemplate(extra);

  it("lead com telefone e template do estágio: abre wa.me COM a mensagem renderizada", async () => {
    open({ templates: [t({ message: "Olá {nome} da {empresa}, em {cidade}/{estado}" })] });
    expect(link(/WhatsApp/)?.getAttribute("href")).toBe(
      `https://wa.me/5511987654321?text=${encodeURIComponent("Olá Maria Souza da Clínica Sol, em Campinas/SP")}`,
    );
  });

  it("sem template: o botão aparece e abre a conversa EM BRANCO (mudança de 2026-10-17)", async () => {
    open({ templates: [] });
    expect(link(/WhatsApp/)?.getAttribute("href")).toBe("https://wa.me/5511987654321");
  });

  it("template de OUTRA etapa não vale: abre em branco", async () => {
    open({ templates: [t({ stageId: "s-contato" })] });
    expect(link(/WhatsApp/)?.getAttribute("href")).toBe("https://wa.me/5511987654321");
  });

  it("precedência: template da ORIGEM do lead vence o coringa da etapa", async () => {
    open({
      templates: [
        t({ id: "coringa", origin: null, message: "coringa" }),
        t({ id: "esp", origin: "whatsapp", message: "especifico" }),
      ],
    });
    expect(link(/WhatsApp/)?.getAttribute("href")).toContain("text=especifico");
  });

  it("origem sem template específico cai no coringa; origem diferente não usa o específico de outra", async () => {
    open({
      lead: makeLead({ origin: "instagram" }),
      templates: [
        t({ id: "coringa", origin: null, message: "coringa" }),
        t({ id: "esp", origin: "whatsapp", message: "especifico" }),
      ],
    });
    expect(link(/WhatsApp/)?.getAttribute("href")).toContain("text=coringa");
  });

  it("placeholders sem dado viram vazio (caracterização: 'Olá , tudo bem?')", async () => {
    open({
      lead: makeLead({ name: "X", company: "", city: "" }),
      templates: [t({ message: "Olá {empresa}, {cidade}; {desconhecido}" })],
    });
    expect(decodeURIComponent(link(/WhatsApp/)!.getAttribute("href")!.split("text=")[1]!)).toBe("Olá , ; {desconhecido}");
  });

  it("lead sem telefone: não há botão de WhatsApp", async () => {
    open({ lead: makeLead({ phoneNormalized: "", phone: "" }), templates: [t({})] });
    expect(link(/WhatsApp/)).toBeNull();
  });

  it("e-mail: mailto com assunto 'empresa — nome'; sem e-mail válido não há botão", async () => {
    const view = open();
    const href = link(/Escrever e-mail/)!.getAttribute("href")!;
    expect(href).toMatch(/^mailto:maria@example\.com/);
    expect(decodeURIComponent(href)).toContain("Clínica Sol — Maria Souza");
    view.unmount();
    open({ lead: makeLead({ email: "" }) });
    expect(link(/Escrever e-mail/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe("permissões e sessão de suporte no painel (apenas UI; o backend é a autoridade)", () => {
  it("sessão de suporte somente leitura: a UI NÃO se esconde sozinha (a recusa vem do backend)", async () => {
    api.move.mockRejectedValue(new ApiError(403, "Sessão de suporte somente leitura"));
    open({}, { user: SUPPORT_READ_ONLY });
    fireEvent.change(screen.getByLabelText("Etapa"), { target: { value: "s-contato" } });
    // a recusa chega como mensagem do backend (403) — caracterização do contrato visível ao usuário
    expect(await screen.findByText("Sessão de suporte somente leitura")).toBeTruthy();
  });

  it("vendedor consegue abrir e editar o PRÓPRIO lead na UI (a restrição por dono é do backend)", async () => {
    api.update.mockResolvedValue(makeLead({ ownerId: "u-vend" }));
    open({ lead: makeLead({ ownerId: "u-vend" }) }, { user: VENDEDOR });
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
  });

  it("trocar a etapa não é duplicado por cliques repetidos enquanto a primeira chamada está em voo", async () => {
    let resolve!: (v: ReturnType<typeof makeLead>) => void;
    api.move.mockReturnValue(new Promise((r) => (resolve = r)));
    open();
    const select = screen.getByLabelText("Etapa") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "s-contato" } });
    await waitFor(() => expect(select.disabled).toBe(true));
    expect(api.move).toHaveBeenCalledTimes(1);
    await act(async () => resolve(makeLead({ stageId: "s-contato" })));
  });
});
