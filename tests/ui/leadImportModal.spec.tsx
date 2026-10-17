// FASE 0 (caracterização) + FASE 1B (importação em lotes, D-10): validação antes do envio, lotes
// de 500 com Idempotency-Key, progresso real, retomada, cancelamento e relatório por linha.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/LeadsService", () => ({ leadsService: { bulkImport: vi.fn() } }));
vi.mock("../../src/services/UsersService", () => ({ usersService: { directory: vi.fn() } }));

import { LeadImportModal } from "../../src/components/leads/LeadImportModal";
import { leadsService } from "../../src/services/LeadsService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import { BATCH_SIZE } from "../../src/utils/leadImport";
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
      retrySleep={instantSleep}
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
const instantSleep = () => Promise.resolve();
/** Resposta do servidor para um lote: tudo criado. */
const created = (rows: ImportRowInput[]): ImportSummary => ({
  total: rows.length,
  created: rows.length,
  updated: 0,
  skipped: 0,
  errors: 0,
  rows: rows.map((r, i) => ({ rowIndex: i, outcome: "created" as const, name: r.name, detail: null })),
});
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

  it("1B: linhas sem nome NÃO são enviadas, mas aparecem na pré-importação (e depois no relatório)", async () => {
    open();
    await upload("Nome,Telefone\nAna,1\n,2\nBia,3\n   ,4");
    await screen.findByText(/4 linha\(s\) encontrada\(s\)/);
    expect(submit().textContent).toBe("Importar 2 lead(s)");
    const preview = screen.getByRole("region", { name: "Pré-importação" });
    expect(preview.textContent).toMatch(/Linhas:\s*4.*Válidas:\s*2.*Inválidas:\s*2/s);
    expect(preview.textContent).toMatch(/linha 3: Nome é obrigatório/);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent().map((r) => r.name)).toEqual(["Ana", "Bia"]);
  });

  it("origem reconhecida é normalizada; origem desconhecida segue SEM origem e a pré-importação avisa", async () => {
    open();
    await upload("Nome,Origem\nAna,WhatsApp\nBia,Indicação do vizinho");
    await screen.findByText(/2 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await waitFor(() => expect(api.bulkImport).toHaveBeenCalled());
    expect(rowsSent()).toEqual([{ name: "Ana", origin: "whatsapp" }, { name: "Bia" }]);
  });

  it("1B: origem desconhecida e telefone curto geram AVISO antes de importar", async () => {
    open();
    await upload("Nome,Origem,Telefone\nAna,Indicação do vizinho,123");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    const preview = screen.getByRole("region", { name: "Pré-importação" });
    expect(preview.textContent).toMatch(/1 linha\(s\) com origem desconhecida/);
    expect(preview.textContent).toMatch(/1 linha\(s\) com telefone curto/);
    expect(preview.textContent).toMatch(/apenas que passou/);
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
    expect(api.bulkImport).toHaveBeenCalledWith(
      [{ name: "Ana" }],
      "p1",
      "s-novo",
      "u-admin",
      "skip",
      expect.stringMatching(/^imp-[a-z0-9]+-0000$/),
    );
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
describe("1B limites e lotes (D-10)", () => {
  it.each([
    [1, 1],
    [500, 1],
    [501, 2],
    [2000, 4],
    [2001, 5],
    [10000, 20],
  ])(
    "%i linha(s): enviadas em %i lote(s) de até 500, em ordem, sem perder nenhuma",
    async (n, calls) => {
      api.bulkImport.mockImplementation(async (rows) => created(rows));
      open();
      await upload(csvOf(n));
      await screen.findByText(new RegExp(`${n} linha\\(s\\) encontrada\\(s\\)`));
      expect(submit().textContent).toBe(`Importar ${n} lead(s)`);
      expect(screen.getByRole("region", { name: "Pré-importação" }).textContent).toMatch(
        new RegExp(`Lotes:\\s*${calls}`),
      );
      fireEvent.click(submit());
      await screen.findByText("Concluído", undefined, { timeout: 20000 });
      expect(api.bulkImport).toHaveBeenCalledTimes(calls);
      const sent = api.bulkImport.mock.calls.map((c) => c[0]);
      expect(sent.every((rows) => rows.length <= BATCH_SIZE)).toBe(true);
      expect(sent.flat()).toHaveLength(n);
      expect(sent.flat().map((r) => r.name)).toEqual(Array.from({ length: n }, (_, i) => `Lead ${i}`));
      const keys = api.bulkImport.mock.calls.map((c) => c[5]);
      expect(new Set(keys).size).toBe(calls); // uma chave por lote
    },
    60000,
  );

  it("10.001 linhas: bloqueado ANTES de enviar qualquer coisa, com mensagem clara", async () => {
    open();
    await upload(csvOf(10001));
    expect(await screen.findByText(/limite é 10\.000/)).toBeTruthy();
    expect(screen.getByText(/Nada foi importado/)).toBeTruthy();
    expect(submit().disabled).toBe(true);
    expect(api.bulkImport).not.toHaveBeenCalled();
  });

  it("arquivo acima de 5 MB é recusado antes de processar", async () => {
    open();
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const big = new File(["Nome\nAna"], "grande.csv", { type: "text/csv" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText(/limite é 5 MB/)).toBeTruthy();
    expect(api.bulkImport).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-10 / 1B processamento, progresso e resultado", () => {
  it("durante a importação: barra de progresso real, contadores e 'Cancelar importação'", async () => {
    const first = deferred<ImportSummary>();
    api.bulkImport.mockReturnValueOnce(first.promise);
    api.bulkImport.mockImplementation(async (rows) => created(rows));
    open();
    await upload(csvOf(600));
    await screen.findByText(/600 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    const bar = (await screen.findByRole("progressbar", { name: "Progresso da importação" })) as HTMLProgressElement;
    expect(bar.max).toBe(600);
    expect(bar.value).toBe(0);
    expect(screen.getByText(/Enviando lote 1 de 2/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Cancelar importação" }) as HTMLButtonElement).disabled).toBe(false);
    first.resolve(created(Array.from({ length: 500 }, (_, i) => ({ name: `Lead ${i}` }))));
    await screen.findByText("Concluído");
    expect(screen.getByText(/Criados:/).textContent).toMatch(/600/);
  });

  it("resumo com totais por categoria; motivos por linha com o NÚMERO ORIGINAL; 'Ver no pipeline' recarrega e fecha", async () => {
    api.bulkImport.mockResolvedValue({
      total: 4,
      created: 1,
      updated: 1,
      skipped: 2,
      errors: 0,
      rows: [
        { rowIndex: 0, outcome: "created", name: "Ana", detail: null },
        { rowIndex: 1, outcome: "updated", name: "Caio", detail: null },
        { rowIndex: 2, outcome: "skipped", name: "Bia", detail: "Telefone já cadastrado para 'Bia'", reason: "duplicate" },
        { rowIndex: 3, outcome: "skipped", name: "Dani", detail: "Telefone pertence a outro responsável", reason: "permission" },
      ],
    });
    const { onImported, onClose } = open();
    await upload("Nome,Telefone\nAna,1\nCaio,2\nBia,3\nDani,4\n,5");
    await screen.findByText(/5 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    expect(await screen.findByText("Concluído com erros")).toBeTruthy();
    const stats = document.querySelector("[class*='summaryStats']") as HTMLElement;
    expect(stats.textContent).toMatch(/arquivo:\s*5.*Criados:\s*1.*Atualizados:\s*1.*ignorados:\s*1.*permissão:\s*1.*validação:\s*1/s);
    const list = screen.getByLabelText("Linhas que precisam de atenção");
    expect(list.textContent).toMatch(/Linha 4 \(Bia\) — Duplicado ignorado: Telefone já cadastrado/);
    expect(list.textContent).toMatch(/Linha 5 \(Dani\) — Sem permissão/);
    expect(list.textContent).toMatch(/Linha 6 \(sem nome\) — Falha de validação: Nome é obrigatório/);
    expect(screen.getByRole("button", { name: "Baixar relatório (CSV)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver no pipeline" }));
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("falha NÃO recuperável (422): para no lote, mostra a mensagem e oferece retomar sem reenviar o arquivo", async () => {
    api.bulkImport.mockRejectedValueOnce(new ApiError(422, "Falha de validação do lote"));
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    expect(await screen.findByText("Falhou")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toMatch(/Falha de validação do lote.*lote 1 de 1/);
    expect(api.bulkImport).toHaveBeenCalledTimes(1); // 422 não é repetido às cegas
    api.bulkImport.mockImplementation(async (rows) => created(rows));
    fireEvent.click(screen.getByRole("button", { name: "Retomar importação" }));
    await screen.findByText("Concluído");
    expect(api.bulkImport).toHaveBeenCalledTimes(2);
  });

  it("falha do servidor (500) e de rede: repete o MESMO lote com a MESMA chave e conclui sem duplicar", async () => {
    api.bulkImport
      .mockRejectedValueOnce(new ApiError(500, ""))
      .mockRejectedValueOnce(new ApiError(0, "sem rede"))
      .mockImplementation(async (rows) => created(rows));
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await screen.findByText("Concluído");
    expect(api.bulkImport).toHaveBeenCalledTimes(3);
    const keys = api.bulkImport.mock.calls.map((c) => c[5]);
    expect(new Set(keys).size).toBe(1);
  });

  it("500 persistente: após as tentativas a importação falha com mensagem em texto e o lote vira 'não confirmado'", async () => {
    api.bulkImport.mockRejectedValue(new ApiError(500, ""));
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    expect(await screen.findByText(/Erro inesperado no servidor/)).toBeTruthy();
    expect(api.bulkImport).toHaveBeenCalledTimes(3);
    expect(screen.getByLabelText("Linhas que precisam de atenção").textContent).toMatch(/Erro de processamento/);
  });

  it("falha parcial: lotes anteriores ficam gravados; retomar reenvia SÓ o que faltou", async () => {
    api.bulkImport
      .mockImplementationOnce(async (rows) => created(rows))
      .mockRejectedValueOnce(new ApiError(403, "Sessão sem permissão"));
    open();
    await upload(csvOf(1000));
    await screen.findByText(/1000 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    expect(await screen.findByText("Falhou")).toBeTruthy();
    expect(screen.getByText(/Criados:/).textContent).toMatch(/500/);
    expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toMatch(/lote 2 de 2/);
    api.bulkImport.mockImplementation(async (rows) => created(rows));
    fireEvent.click(screen.getByRole("button", { name: "Retomar importação" }));
    await screen.findByText("Concluído");
    expect(api.bulkImport).toHaveBeenCalledTimes(3); // 1 ok + 1 falho + 1 retomado (o lote 1 NÃO volta)
    const keys = api.bulkImport.mock.calls.map((c) => c[5]);
    expect(keys[1]).toBe(keys[2]); // o lote que falhou é reenviado com a mesma chave
    expect(keys[0]).not.toBe(keys[1]);
    expect(screen.getByText(/Criados:/).textContent).toMatch(/1\.000/);
  });

  it("cancelar interrompe DEPOIS do lote em andamento e informa o que ficou sem processar", async () => {
    const first = deferred<ImportSummary>();
    api.bulkImport.mockReturnValueOnce(first.promise);
    open();
    await upload(csvOf(1200));
    await screen.findByText(/1200 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await screen.findByRole("progressbar");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar importação" }));
    first.resolve(created(Array.from({ length: 500 }, (_, i) => ({ name: `Lead ${i}` }))));
    expect(await screen.findByText("Cancelada")).toBeTruthy();
    expect(api.bulkImport).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Criados:/).textContent).toMatch(/500/);
    expect(screen.getByLabelText("Linhas que precisam de atenção").textContent).toMatch(/Não processado/);
    expect(screen.getByRole("button", { name: "Retomar importação" })).toBeTruthy();
  });

  it("estratégia 'duplicar' + falha de rede: o reenvio usa a mesma chave (o servidor devolve o lote já gravado)", async () => {
    api.bulkImport
      .mockRejectedValueOnce(new ApiError(0, "timeout"))
      .mockImplementation(async (rows) => created(rows));
    open();
    await upload("Nome,Telefone\nAna,11999990000");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.change(screen.getByLabelText("Se o telefone já existir"), { target: { value: "duplicate" } });
    fireEvent.click(submit());
    await screen.findByText("Concluído");
    const [a, b] = api.bulkImport.mock.calls;
    expect(a![5]).toBe(b![5]);
    expect(a![4]).toBe("duplicate");
  });

  it("fechar a aba durante o envio pede confirmação (beforeunload) e só enquanto roda", async () => {
    const pending = deferred<ImportSummary>();
    api.bulkImport.mockReturnValue(pending.promise);
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    const idle = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);
    fireEvent.click(submit());
    await screen.findByRole("progressbar");
    const running = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(running);
    expect(running.defaultPrevented).toBe(true);
    pending.resolve(SUMMARY);
    await screen.findByText("Concluído");
  });

  it("recarregar a página e reenviar a MESMA planilha com os MESMOS parâmetros reaproveita a identidade da importação", async () => {
    api.bulkImport.mockRejectedValue(new ApiError(403, "Sem permissão"));
    const first = open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await screen.findByText("Falhou");
    const keyBefore = api.bulkImport.mock.calls[0]![5];
    first.unmount(); // “recarregou a página”
    api.bulkImport.mockImplementation(async (rows) => created(rows));
    open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await screen.findByText("Concluído");
    expect(api.bulkImport.mock.calls.at(-1)![5]).toBe(keyBefore);
    expect(screen.getByText(/retomou uma importação interrompida/)).toBeTruthy();
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

  it("IMP-01: durante o envio nada fecha o diálogo (Esc, fundo e ×)", async () => {
    const pending = deferred<ImportSummary>();
    api.bulkImport.mockReturnValue(pending.promise);
    const { onClose } = open();
    await upload("Nome\nAna");
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(submit());
    await screen.findByRole("progressbar");
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(onClose).not.toHaveBeenCalled();
    pending.resolve(SUMMARY);
    await screen.findByText("Concluído");
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
    expect(alert.textContent).toMatch(/^Lote recusado/);
    expect(within(dialog).getAllByRole("alert")).toHaveLength(1);
  });

  it("texto do modal descreve de/para e estratégia de telefone existente", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Importar leads via CSV" });
    expect(within(dialog).getByText(/telefone já existir cadastrado/)).toBeTruthy();
  });
});
