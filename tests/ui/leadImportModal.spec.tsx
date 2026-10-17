// FASE 0 — caracterização da importação de leads (F-10). Descreve o fluxo ATUAL, inclusive seus
// limites (envio em lote único, descartes silenciosos). Não implementa lotes (D-10 é futuro).
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/LeadsService", () => ({ leadsService: { bulkImport: vi.fn() } }));
vi.mock("../../src/services/UsersService", () => ({ usersService: { directory: vi.fn() } }));

import { LeadImportModal } from "../../src/components/leads/LeadImportModal";
import { leadsService } from "../../src/services/LeadsService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import type { ImportRowInput, ImportSummary } from "../../src/types/lead";
import { ADMIN, GESTOR, STAGES, VENDEDOR, deferred, renderApp } from "./support/harness";

const api = vi.mocked(leadsService);

afterEach(cleanup);

const TEAM = [
  { id: "u-admin", name: "Ana Admin", role: "admin" as const },
  { id: "u-vend", name: "Vera Vendedora", role: "vendedor" as const },
];

const SUMMARY: ImportSummary = { total: 2, created: 2, updated: 0, skipped: 0, errors: 0, rows: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usersService.directory).mockResolvedValue(TEAM);
  api.bulkImport.mockResolvedValue(SUMMARY);
});

function open(options: Parameters<typeof renderApp>[1] = {}) {
  const onClose = vi.fn();
  const onImported = vi.fn();
  const view = renderApp(
    <LeadImportModal
      pipelineId="p1"
      stages={STAGES}
      defaultStageId="s-novo"
      onClose={onClose}
      onImported={onImported}
    />,
    options,
  );
  return { ...view, onClose, onImported };
}

async function upload(csv: string | Uint8Array, name = "leads.csv") {
  const input = document.querySelector("input[type=file]") as HTMLInputElement;
  const file = new File([csv as BlobPart], name, { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

const submit = () => screen.getByRole("button", { name: /^Importar/ }) as HTMLButtonElement;
const rowsSent = (): ImportRowInput[] => api.bulkImport.mock.calls[0]![0];
const csvOf = (n: number) =>
  ["Nome,Telefone", ...Array.from({ length: n }, (_, i) => `Lead ${i},11${String(900000000 + i)}`)].join("\n");

// ---------------------------------------------------------------------------------------------
describe("F-10 arquivo", () => {
  it("estado inicial: pede o arquivo e o botão de importar está desabilitado", () => {
    open();
    expect(screen.getByText("Selecione um arquivo .csv exportado da sua planilha")).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it("CSV válido: mostra o nº de linhas, o de/para e habilita 'Importar N lead(s)'", async () => {
    open();
    await upload("Nome,Telefone\nAna,11999990000\nBia,11988880000");
    expect(await screen.findByText(/2 linha\(s\) encontrada\(s\)/)).toBeTruthy();
    expect(submit().textContent).toBe("Importar 2 lead(s)");
    expect(submit().disabled).toBe(false);
  });

  it("CSV vazio ou sem cabeçalhos: mensagem de erro e nada para importar", async () => {
    open();
    await upload("");
    expect(await screen.findByText("Não foi possível ler colunas nesse arquivo.")).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it("só cabeçalho (sem linhas de dados): permanece desabilitado", async () => {
    open();
    await upload("Nome,Telefone");
    await screen.findByText(/0 linha\(s\) encontrada\(s\)/);
    expect(submit().disabled).toBe(true);
  });

  it("separador ponto e vírgula e acentos em UTF-8", async () => {
    open();
    await upload("Nome;Empresa\nJosé;Clínica Ação");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent()).toEqual([{ name: "José", company: "Clínica Ação" }]);
  });

  it("codificação legada (Windows-1252) é decodificada sem caracteres quebrados", async () => {
    open();
    await upload(new Uint8Array([0x4e, 0x6f, 0x6d, 0x65, 0x0a, 0x43, 0x72, 0xe2, 0x6e, 0x69, 0x6f]));
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent()).toEqual([{ name: "Crânio" }]);
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-10 mapeamento", () => {
  it("mapeamento automático por nome do campo (rótulo ou chave, sem diferenciar maiúsculas)", async () => {
    open();
    await upload("NOME,whatsapp,E-mail,Cidade,Coluna Estranha\nAna,11999990000,a@x.com,Rio,zzz");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    const selects = screen.getAllByRole("combobox").slice(-5) as HTMLSelectElement[];
    expect(selects.map((s) => s.value)).toEqual(["name", "whatsapp", "email", "city", "__ignore__"]);
  });

  it("coluna desconhecida é ignorada: não vai para o servidor", async () => {
    open();
    await upload("Nome,Coluna Estranha\nAna,zzz");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent()).toEqual([{ name: "Ana" }]);
  });

  it("mapeamento manual: coluna de nome diferente passa a valer", async () => {
    open();
    await upload("Contato,Fone\nAna,11999990000");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    expect(submit().disabled).toBe(true); // sem coluna 'Nome' reconhecida, nada é importável
    const selects = screen.getAllByRole("combobox").slice(-2) as HTMLSelectElement[];
    fireEvent.change(selects[0]!, { target: { value: "name" } });
    fireEvent.change(selects[1]!, { target: { value: "phone" } });
    expect(submit().disabled).toBe(false);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent()).toEqual([{ name: "Ana", phone: "11999990000" }]);
  });

  it("N-03: sem coluna mapeada para Nome o botão fica desabilitado E a tela explica o motivo", async () => {
    open();
    await upload("Telefone\n11999990000");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    expect(submit().disabled).toBe(true);
    const reason = screen.getByText(/Nome é obrigatório: associe uma coluna/);
    expect(reason.getAttribute("role")).toBe("status");
    expect(submit().getAttribute("aria-describedby")).toBe(reason.id);
    // mapear o Nome tira o aviso e habilita o botão
    const mapSelect = screen.getByLabelText("Campo do lead para a coluna Telefone");
    fireEvent.change(mapSelect, { target: { value: "name" } });
    expect(screen.queryByText(/Nome é obrigatório/)).toBeNull();
    expect(submit().disabled).toBe(false);
  });

  it("N-03: com Nome mapeado mas TODAS as linhas sem nome, a explicação é outra e o envio continua bloqueado", async () => {
    open();
    await upload("Nome,Telefone\n,1\n  ,2");
    await screen.findByText(/2 linha\(s\) encontrada\(s\)/);
    expect(submit().disabled).toBe(true);
    expect(screen.getByText("Nenhuma linha pode ser importada: todas estão sem nome.")).toBeTruthy();
    expect(api.bulkImport).not.toHaveBeenCalled();
  });

  it("duas colunas para o MESMO campo: a última vence, sem aviso (caracterização)", async () => {
    open();
    await upload("Nome,Apelido\nAna,Aninha");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    const selects = screen.getAllByRole("combobox").slice(-2) as HTMLSelectElement[];
    fireEvent.change(selects[1]!, { target: { value: "name" } });
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent()).toEqual([{ name: "Aninha" }]);
  });

  it("linhas sem nome saem do lote em silêncio; o botão conta só as válidas (caracterização)", async () => {
    open();
    await upload("Nome,Telefone\nAna,1\n,2\nBia,3\n   ,4");
    await screen.findByText(/4 linha\(s\) encontrada\(s\)/);
    expect(submit().textContent).toBe("Importar 2 lead(s)");
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent().map((r) => r.name)).toEqual(["Ana", "Bia"]);
  });

  it("origem reconhecida é normalizada; origem desconhecida é DESCARTADA em silêncio e o lead segue", async () => {
    open();
    await upload("Nome,Origem\nAna,WhatsApp\nBia,Indicação do vizinho");
    await screen.findByText(/2 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent()).toEqual([{ name: "Ana", origin: "whatsapp" }, { name: "Bia" }]);
  });

  it("telefone e e-mail inválidos NÃO são validados no navegador (vão como estão; o servidor decide)", async () => {
    open();
    await upload("Nome,Telefone,E-mail\nAna,abc,sem-arroba");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent()).toEqual([{ name: "Ana", phone: "abc", email: "sem-arroba" }]);
  });

  it("valores são aparados e células em branco não são enviadas", async () => {
    open();
    await upload("Nome,Empresa\n  Ana  ,   ");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent()).toEqual([{ name: "Ana" }]);
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-10 parâmetros da importação e permissões", () => {
  const strategy = () => screen.getByRole("option", { name: "Ignorar a linha" }).closest("select") as HTMLSelectElement;

  it("padrões: etapa de entrada = primeira etapa, duplicados = 'ignorar', pipeline do quadro", async () => {
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(api.bulkImport).toHaveBeenCalledWith([{ name: "Ana" }], "p1", "s-novo", "u-admin", "skip");
  });

  it.each([
    ["Ignorar a linha", "skip"],
    ["Atualizar o cadastro existente", "update"],
    ["Cadastrar mesmo assim (duplicar)", "duplicate"],
  ])("estratégia de duplicados '%s' é enviada como %s", async (label, value) => {
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.change(strategy(), { target: { value } });
    expect((screen.getByRole("option", { name: label }) as HTMLOptionElement).selected).toBe(true);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(api.bulkImport.mock.calls[0]![4]).toBe(value);
  });

  it("etapa de entrada escolhida é enviada (UUID real, nunca o nome)", async () => {
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    const stage = screen.getByRole("option", { name: "Em contato" }).closest("select") as HTMLSelectElement;
    fireEvent.change(stage, { target: { value: "s-contato" } });
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(api.bulkImport.mock.calls[0]![2]).toBe("s-contato");
  });

  it("admin e gestor escolhem o responsável pelos leads novos", async () => {
    for (const user of [ADMIN, GESTOR]) {
      api.bulkImport.mockClear();
      const view = open({ user });
      await upload("Nome\nAna");
      await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
      const owner = (await screen.findByRole("option", { name: "Vera Vendedora" })).closest("select") as HTMLSelectElement;
      fireEvent.change(owner, { target: { value: "u-vend" } });
      fireEvent.click(submit());
      await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
      expect(api.bulkImport.mock.calls[0]![3]).toBe("u-vend");
      view.unmount();
    }
  });

  it("vendedor NÃO vê o seletor de responsável e importa sempre para si", async () => {
    open({ user: VENDEDOR });
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    expect(screen.queryByText("Responsável pelos leads novos")).toBeNull();
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(api.bulkImport.mock.calls[0]![3]).toBe("u-vend");
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-10 limites de volume (caracterização do que a TELA faz; o limite de 2.000 é do servidor)", () => {
  it.each([1, 500, 2000, 2001, 10000])(
    "%i linha(s): a tela envia TODAS em UMA chamada, sem lotes e sem aviso de limite",
    async (n) => {
      open();
      await upload(csvOf(n));
      await screen.findByText(new RegExp(`${n} linha\\(s\\) encontrada\\(s\\)`));
      expect(submit().textContent).toBe(`Importar ${n} lead(s)`);
      expect(submit().disabled).toBe(false);
      fireEvent.click(submit());
      await waitFor(() => expect(api.bulkImport).toHaveBeenCalledTimes(1));
      expect(rowsSent()).toHaveLength(n);
      expect(screen.queryByText(/limite|máximo|2\.?000/i)).toBeNull();
    },
    30000,
  );
});

// ---------------------------------------------------------------------------------------------
describe("F-10 processamento e resultado", () => {
  it("durante a importação: botão mostra 'Importando…' e Cancelar fica desabilitado", async () => {
    const pending = deferred<ImportSummary>();
    api.bulkImport.mockReturnValue(pending.promise);
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    expect(await screen.findByRole("button", { name: "Importando…" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    pending.resolve(SUMMARY);
    expect(await screen.findByText("Criados:")).toBeTruthy();
  });

  it("resumo com totais; erros listados por linha (nº e nome); 'Ver no pipeline' recarrega e fecha", async () => {
    api.bulkImport.mockResolvedValue({
      total: 5,
      created: 2,
      updated: 1,
      skipped: 1,
      errors: 1,
      rows: [
        { rowIndex: 0, outcome: "created", name: "Ana", detail: null },
        { rowIndex: 3, outcome: "skipped", name: "Bia", detail: "Telefone já cadastrado para 'Bia'" },
        { rowIndex: 4, outcome: "error", name: "", detail: "Nome obrigatório" },
      ],
    });
    const { onImported, onClose } = open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    expect(await screen.findByText("Linhas processadas:")).toBeTruthy();
    const stats = document.querySelector("[class*='summaryStats']") as HTMLElement;
    expect(stats.textContent).toMatch(/processadas:\s*5.*Criados:\s*2.*Atualizados:\s*1.*Ignorados:\s*1.*erro:\s*1/s);
    expect(screen.getByText(/Linha 5 \(sem nome\): Nome obrigatório/)).toBeTruthy();
    // caracterização (IMP-07): o MOTIVO de cada linha ignorada não é exibido
    expect(screen.queryByText(/Telefone já cadastrado/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver no pipeline" }));
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("falha da API: mensagem do erro em texto, lote preservado para nova tentativa", async () => {
    api.bulkImport.mockRejectedValueOnce(new ApiError(422, "Falha de validação do lote"));
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    expect(await screen.findByText("Falha de validação do lote")).toBeTruthy();
    expect(submit().disabled).toBe(false); // continua possível tentar de novo sem reenviar o arquivo
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalledTimes(2));
  });

  it("422 de lote grande vira mensagem genérica quando o servidor não explica (sem dica de limite)", async () => {
    api.bulkImport.mockRejectedValueOnce(new ApiError(500, ""));
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    expect(await screen.findByText(/Erro inesperado no servidor/)).toBeTruthy();
  });

  it("Cancelar fecha a importação sem enviar nada", async () => {
    const { onClose } = open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.bulkImport).not.toHaveBeenCalled();
  });

  it("IMP-01: é um diálogo modal com nome; Esc e clique no fundo fecham enquanto nada foi escolhido", async () => {
    const { onClose } = open();
    const dialog = screen.getByRole("dialog", { name: "Importar leads via CSV" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("IMP-01: depois de escolher o arquivo, Esc e clique no fundo NÃO descartam o trabalho; só Cancelar", async () => {
    const { onClose } = open();
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await upload("Nome\nAna");
    fireEvent.input(input); // o navegador dispara `input` além de `change` ao escolher o arquivo
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    await new Promise((r) => setTimeout(r, 20));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("IMP-01: durante o envio nada fecha o diálogo (Esc, fundo, × e Cancelar)", async () => {
    const pending = deferred<ImportSummary>();
    api.bulkImport.mockReturnValue(pending.promise);
    const { onClose } = open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await screen.findByRole("button", { name: "Importando…" });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(onClose).not.toHaveBeenCalled();
    pending.resolve(SUMMARY);
    await screen.findByText("Criados:");
  });

  it("IMP-01: o foco volta para quem abriu a importação ao fechar", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const view = open();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    view.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("IMP-06/N-02: arquivo, parâmetros e de/para têm nome acessível", async () => {
    open();
    expect(screen.getByLabelText("Arquivo CSV com os leads")).toBeTruthy();
    await upload("Nome,Telefone\nAna,1");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    for (const name of ["Estágio de entrada (leads novos)", "Responsável pelos leads novos", "Se o telefone já existir"]) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
    expect((screen.getByLabelText("Campo do lead para a coluna Nome") as HTMLSelectElement).value).toBe("name");
    expect((screen.getByLabelText("Campo do lead para a coluna Telefone") as HTMLSelectElement).value).toBe("phone");
  });

  it("A-10: erro da importação é anunciado UMA vez (role=alert) e o texto continua visível", async () => {
    api.bulkImport.mockRejectedValueOnce(new ApiError(422, "Lote recusado"));
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    const dialog = screen.getByRole("dialog", { name: "Importar leads via CSV" });
    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toBe("Lote recusado");
    expect(within(dialog).getAllByRole("alert")).toHaveLength(1);
  });

  it("texto do modal descreve de/para e estratégia de telefone existente", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Importar leads via CSV" });
    expect(within(dialog).getByText(/telefone já existir cadastrado/)).toBeTruthy();
  });
});
