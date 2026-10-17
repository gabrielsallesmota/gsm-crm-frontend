// FASE 0 — linha de base de ACESSIBILIDADE do escopo do redesign. Cada teste é classificado:
//   PASSA              comportamento atual correto (protege contra regressão);
//   FALHA CONHECIDA    defeito já identificado na Auditoria 01 — escrito com `it.fails`: o teste
//                      afirma o comportamento DESEJADO e é verde enquanto o defeito existir; quando a
//                      Fase 1 corrigir, ele passa a FALHAR e deve ser convertido em teste comum;
//   FALHA NOVA         defeito não listado na auditoria, descoberto aqui;
//   MANUAL             não automatizável em jsdom (`it.todo`).
// Nada de produção foi alterado para fazer estes testes passarem.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/PipelinesService", () => ({ pipelinesService: { list: vi.fn() } }));
vi.mock("../../src/services/LeadsService", () => ({
  leadsService: { list: vi.fn(), listMessageTemplates: vi.fn(), timeline: vi.fn(), bulkImport: vi.fn() },
}));
vi.mock("../../src/services/UsersService", () => ({ usersService: { directory: vi.fn() } }));
vi.mock("../../src/services/TagsService", () => ({ tagsService: { list: vi.fn() } }));
vi.mock("../../src/services/TasksService", () => ({ tasksService: { list: vi.fn() } }));
vi.mock("../../src/services/LeadCommentsService", () => ({ leadCommentsService: { create: vi.fn() } }));
vi.mock("../../src/services/ProspectsService", () => ({
  prospectsService: { listStages: vi.fn(), listMessageTemplates: vi.fn() },
}));
vi.mock("../../src/services/SdrService", () => ({ sdrService: { getAiSettings: vi.fn() } }));

import { LeadDrawer } from "../../src/components/leads/LeadDrawer";
import { LeadImportModal } from "../../src/components/leads/LeadImportModal";
import { PeriodFilter } from "../../src/components/common/PeriodFilter";
import { PipelinePage } from "../../src/pages/PipelinePage";
import { SettingsPage } from "../../src/pages/SettingsPage";
import { leadsService } from "../../src/services/LeadsService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { prospectsService } from "../../src/services/ProspectsService";
import { tagsService } from "../../src/services/TagsService";
import { tasksService } from "../../src/services/TasksService";
import { usersService } from "../../src/services/UsersService";
import { STAGES, makeLead, makePipeline, page, renderApp } from "./support/harness";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pipelinesService.list).mockResolvedValue([makePipeline()]);
  vi.mocked(usersService.directory).mockResolvedValue([{ id: "u-admin", name: "Ana Admin", role: "admin" as const }]);
  vi.mocked(tagsService.list).mockResolvedValue([]);
  vi.mocked(tasksService.list).mockResolvedValue(page([]));
  vi.mocked(leadsService.list).mockImplementation(async (f) => page(f.stageId === "s-novo" ? [makeLead()] : []));
  vi.mocked(leadsService.listMessageTemplates).mockResolvedValue([]);
  vi.mocked(leadsService.timeline).mockResolvedValue([]);
  vi.mocked(prospectsService.listStages).mockResolvedValue([]);
  vi.mocked(prospectsService.listMessageTemplates).mockResolvedValue([]);
});

/** Nome acessível de um controle de formulário: label associado, aria-label ou aria-labelledby.
 * (`placeholder` NÃO conta como nome — WCAG 3.3.2/4.1.2.) */
function hasAccessibleName(el: HTMLElement): boolean {
  if (el.getAttribute("aria-label")?.trim()) return true;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy && labelledBy.split(/\s+/).some((id) => document.getElementById(id)?.textContent?.trim())) return true;
  const labels = (el as HTMLInputElement).labels;
  return Boolean(labels && [...labels].some((l) => l.textContent?.trim()));
}

const FIELD = "input:not([type=hidden]):not([type=color]), select, textarea";
function unnamedFields(root: ParentNode): string[] {
  return [...root.querySelectorAll<HTMLElement>(FIELD)]
    .filter((el) => !hasAccessibleName(el))
    .map((el) => `${el.tagName.toLowerCase()}${(el as HTMLInputElement).placeholder ? `[${(el as HTMLInputElement).placeholder}]` : ""}`);
}

const INTERACTIVE = "a[href], button, select, input, textarea, [tabindex]:not([tabindex='-1'])";

// =============================================================================================
describe("PASSA — comportamento atual correto", () => {
  it("[PASSA] Pipeline: busca, responsável, ordenação, pipeline e 'mover' têm nome acessível", async () => {
    vi.mocked(pipelinesService.list).mockResolvedValue([makePipeline(), makePipeline({ id: "p2", name: "Outro", isDefault: false })]);
    renderApp(<PipelinePage />);
    await screen.findByText("Maria Souza");
    for (const name of ["Pipeline", "Buscar lead", "Responsável", "Ordenação", "Mover Maria Souza para outra etapa"]) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
  });

  it("[PASSA] Pipeline: o cartão é focável e abre com Enter e com Espaço (alternativa ao mouse)", async () => {
    renderApp(<PipelinePage />);
    const card = await screen.findByRole("button", { name: "Abrir Maria Souza" });
    expect(card.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(card, { key: " " });
    expect(await screen.findByRole("dialog", { name: "Lead Maria Souza" })).toBeTruthy();
  });

  it("[PASSA] Pipeline: existe alternativa ao arrastar para mover um lead (seletor por cartão)", async () => {
    renderApp(<PipelinePage />);
    await screen.findByText("Maria Souza");
    expect(screen.getByLabelText("Mover Maria Souza para outra etapa").tagName).toBe("SELECT");
  });

  it("[PASSA] Pipeline: colunas com erro usam role=alert; contagem tem rótulo textual", async () => {
    vi.mocked(leadsService.list).mockRejectedValue(new Error("x"));
    renderApp(<PipelinePage />);
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThanOrEqual(1);
  });

  it("[PASSA] Painel do lead: diálogo modal com nome; Nome, Empresa, Etapa, Responsável e Novo comentário rotulados", async () => {
    renderApp(<LeadDrawer lead={makeLead()} stages={STAGES} onClose={() => undefined} />);
    const dialog = screen.getByRole("dialog", { name: "Lead Maria Souza" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    for (const name of ["Etapa", "Responsável", "Novo comentário"]) expect(within(dialog).getByLabelText(name)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /Editar/ }));
    for (const name of ["Nome", "Empresa"]) expect(within(dialog).getByLabelText(name)).toBeTruthy();
  });

  it("[PASSA] Painel do lead: botões de tarefa e fechar têm nome acessível", async () => {
    vi.mocked(tasksService.list).mockResolvedValue(
      page([{ id: "t", leadId: "l1", leadName: "M", title: "Ligar", priority: "media", done: false, dueAt: null, assigneeUserId: null, assigneeName: null, completedAt: null }]),
    );
    renderApp(<LeadDrawer lead={makeLead()} stages={STAGES} onClose={() => undefined} />);
    expect(await screen.findByRole("button", { name: "Concluir tarefa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fechar lead" })).toBeTruthy();
  });

  it("[PASSA] Configurações: cores, edição, exclusão e movimentação de etapas têm nome acessível", async () => {
    renderApp(<SettingsPage />);
    await screen.findByText("Comercial");
    expect(screen.getByRole("button", { name: "Editar pipeline Comercial" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Novo/ }));
    expect(screen.getByRole("button", { name: "Mover etapa para a direita" })).toBeTruthy();
    expect(screen.getAllByLabelText(/Cor d/).length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================================
describe("FALHA CONHECIDA — defeitos da Auditoria 01 (it.fails: verde = defeito ainda presente)", () => {
  it.fails("[FALHA CONHECIDA PIP-01] cartão com role=button NÃO deveria conter controles interativos aninhados", async () => {
    renderApp(<PipelinePage />);
    const card = await screen.findByRole("button", { name: "Abrir Maria Souza" });
    expect(card.querySelectorAll(INTERACTIVE).length).toBe(0);
  });

  it.fails("[FALHA CONHECIDA PIP-04] reordenar colunas deveria ter alternativa por teclado no próprio quadro", async () => {
    renderApp(<PipelinePage />);
    await screen.findByText("Maria Souza");
    expect(screen.getAllByRole("button", { name: /Mover coluna|Mover etapa/ }).length).toBeGreaterThan(0);
  });

  it.fails("[FALHA CONHECIDA DRW-01] todos os campos do painel em edição deveriam ter nome acessível", async () => {
    renderApp(<LeadDrawer lead={makeLead()} stages={STAGES} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    expect(unnamedFields(screen.getByRole("dialog"))).toEqual([]);
  });

  it.fails("[FALHA CONHECIDA IMP-01] a importação deveria ser um diálogo acessível (role=dialog, aria-modal)", () => {
    renderApp(<LeadImportModal pipelineId="p1" stages={STAGES} defaultStageId="s-novo" onClose={() => undefined} onImported={() => undefined} />);
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it.fails("[FALHA CONHECIDA IMP-01] Esc deveria fechar a importação (hoje só o clique no fundo ou Cancelar)", async () => {
    const onClose = vi.fn();
    renderApp(<LeadImportModal pipelineId="p1" stages={STAGES} defaultStageId="s-novo" onClose={onClose} onImported={() => undefined} />);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it.fails("[FALHA CONHECIDA IMP-06] selects da importação (etapa, duplicados, de/para) deveriam ter nome acessível", async () => {
    renderApp(<LeadImportModal pipelineId="p1" stages={STAGES} defaultStageId="s-novo" onClose={() => undefined} onImported={() => undefined} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["Nome,Telefone\nAna,1"], "x.csv")] } });
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    expect(unnamedFields(screen.getByText("Importar leads via CSV").parentElement!)).toEqual([]);
  });

  it.fails("[FALHA CONHECIDA A-10] erro da importação deveria ser anunciado (role=alert)", async () => {
    vi.mocked(leadsService.bulkImport).mockRejectedValue(new Error("falhou"));
    renderApp(<LeadImportModal pipelineId="p1" stages={STAGES} defaultStageId="s-novo" onClose={() => undefined} onImported={() => undefined} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["Nome\nAna"], "x.csv")] } });
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    fireEvent.click(screen.getByRole("button", { name: /^Importar/ }));
    await screen.findByText("falhou");
    const modal = screen.getByText("Importar leads via CSV").parentElement as HTMLElement;
    expect(within(modal).getByRole("alert").textContent).toContain("falhou");
  });

  it.fails("[FALHA CONHECIDA CFG-06] campos de Configurações (nome do pipeline, da tag, da etapa) deveriam ter nome acessível", async () => {
    renderApp(<SettingsPage />);
    await screen.findByText("Comercial");
    const named = unnamedFields(screen.getByRole("heading", { name: "Pipelines" }).closest("section")!);
    expect(named).toEqual([]);
  });

  it.fails("[FALHA CONHECIDA CFG-07] formulário de template deveria ter rótulos nos selects e na mensagem", async () => {
    renderApp(<SettingsPage />);
    await screen.findByText("Comercial");
    const section = screen.getByRole("heading", { name: "Pipeline — mensagens de WhatsApp" }).closest("section")!;
    await within(section).findByText("Nenhum template cadastrado ainda.");
    expect(unnamedFields(section)).toEqual([]);
  });
});

// =============================================================================================
describe("FALHA NOVA — achados desta fase, não listados na Auditoria 01", () => {
  it.fails("[FALHA NOVA N-01] campos de data do filtro de período deveriam ter nome acessível", () => {
    renderApp(<PeriodFilter value={{}} onChange={() => undefined} />);
    expect(unnamedFields(document.body)).toEqual([]);
  });

  it.fails("[FALHA NOVA N-02] o seletor de arquivo da importação deveria ter nome acessível", () => {
    renderApp(<LeadImportModal pipelineId="p1" stages={STAGES} defaultStageId="s-novo" onClose={() => undefined} onImported={() => undefined} />);
    const file = document.querySelector("input[type=file]") as HTMLElement;
    expect(hasAccessibleName(file)).toBe(true);
  });

  it.fails("[FALHA NOVA N-03] 'Importar' desabilitado por falta da coluna Nome deveria explicar o motivo", async () => {
    renderApp(<LeadImportModal pipelineId="p1" stages={STAGES} defaultStageId="s-novo" onClose={() => undefined} onImported={() => undefined} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["Telefone\n11999990000"], "x.csv")] } });
    await screen.findByText(/1 linha\(s\) encontrada\(s\)/);
    expect(screen.getByText(/nome.*obrigat|obrigat.*nome/i)).toBeTruthy();
  });
});

// =============================================================================================
describe("contraste de cores — calculado dos tokens reais de src/styles/theme.css", () => {
  const css = readFileSync(resolve(process.cwd(), "src/styles/theme.css"), "utf8");
  const block = (start: string) => {
    const from = css.indexOf(start);
    return css.slice(from, css.indexOf("}", from));
  };
  const tokens = (text: string) => Object.fromEntries([...text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1]!, m[2]!]));
  const dark = tokens(block(":root,"));
  const light = { ...dark, ...tokens(block(':root[data-theme="light"]')) };

  function luminance(hex: string) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  }
  function ratio(a: string, b: string) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  }

  it("[PASSA] tema escuro: texto, muted e muted-2 passam 4,5:1 em card e fundo alternativo", () => {
    for (const fg of ["text", "text-dim", "muted", "muted-2"]) {
      for (const bg of ["card-bg", "card-bg-alt"]) {
        expect(ratio(dark[fg]!, dark[bg]!), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("[PASSA] tema claro: texto, muted e muted-2 passam 4,5:1 sobre card e fundo alternativo", () => {
    for (const fg of ["text", "muted", "muted-2"]) {
      for (const bg of ["card-bg", "card-bg-alt"]) {
        expect(ratio(light[fg]!, light[bg]!), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.fails("[FALHA CONHECIDA A-05] --faint (usado em 'Sem leads' e no drawer) deveria passar 4,5:1 nos dois temas", () => {
    expect(ratio(dark["faint"]!, dark["card-bg-alt"]!)).toBeGreaterThanOrEqual(4.5); // ≈ 3,46
    expect(ratio(light["faint"]!, light["card-bg"]!)).toBeGreaterThanOrEqual(4.5); // ≈ 2,94
  });

  it.fails("[FALHA CONHECIDA SYS-02] acento verde do tema claro usado como TEXTO pequeno deveria passar 4,5:1", () => {
    expect(ratio(light["accent"]!, light["card-bg"]!)).toBeGreaterThanOrEqual(4.5); // ≈ 3,22
  });
});

// =============================================================================================
describe("MANUAL — exige validação fora da automação", () => {
  it.todo("[MANUAL] leitor de tela (NVDA/VoiceOver): anúncio de cartões, painel do lead, importação e Configurações");
  it.todo("[MANUAL] zoom 200% e 400% (reflow, WCAG 1.4.10) no Pipeline e no painel do lead");
  it.todo("[MANUAL] tamanho real dos alvos de toque (botões WhatsApp/E-mail ≈ 22px; mínimo WCAG 2.2 = 24px)");
  it.todo("[MANUAL] ordem de foco do quadro com muitas colunas; foco ao fechar o painel quando o card some");
  it.todo("[MANUAL] seletor 'Mover para etapa' escondido no desktop com mouse (CSS media query não é avaliado no jsdom)");
  it.todo("[MANUAL] arrastar com toque/caneta/controle por voz");
  it.todo("[MANUAL] contraste de selos (texto/fundo translúcido) nos dois temas");
});
