// FASE 1B — acessibilidade remanescente do Pipeline: PIP-04 (reordenar etapas sem arrastar),
// PIP-05 (mover lead descobrível/por teclado, sem `display: none`) e PIP-12 (alvos de toque).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/PipelinesService", () => ({
  pipelinesService: { list: vi.fn(), reorderStages: vi.fn() },
}));
vi.mock("../../src/services/LeadsService", () => ({
  leadsService: { list: vi.fn(), move: vi.fn(), listMessageTemplates: vi.fn(), timeline: vi.fn(), bulkImport: vi.fn() },
}));
vi.mock("../../src/services/UsersService", () => ({ usersService: { directory: vi.fn() } }));
vi.mock("../../src/services/TagsService", () => ({ tagsService: { list: vi.fn() } }));
vi.mock("../../src/services/TasksService", () => ({ tasksService: { list: vi.fn() } }));
vi.mock("../../src/services/LeadCommentsService", () => ({ leadCommentsService: { create: vi.fn() } }));

import { PipelinePage } from "../../src/pages/PipelinePage";
import { leadsService } from "../../src/services/LeadsService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { tagsService } from "../../src/services/TagsService";
import { tasksService } from "../../src/services/TasksService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import { ADMIN, GESTOR, STAGES, VENDEDOR, makeLead, makePipeline, page, renderApp } from "./support/harness";

const api = vi.mocked(pipelinesService);
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue([makePipeline()]);
  api.reorderStages.mockResolvedValue(undefined as never);
  vi.mocked(usersService.directory).mockResolvedValue([{ id: "u-admin", name: "Ana Admin", role: "admin" as const }]);
  vi.mocked(tagsService.list).mockResolvedValue([]);
  vi.mocked(tasksService.list).mockResolvedValue(page([]));
  vi.mocked(leadsService.list).mockImplementation(async (f) => page(f.stageId === "s-novo" ? [makeLead()] : []));
  vi.mocked(leadsService.listMessageTemplates).mockResolvedValue([]);
  vi.mocked(leadsService.timeline).mockResolvedValue([]);
});

const left = (label: string) => screen.getByRole("button", { name: `Mover etapa ${label} para a esquerda` }) as HTMLButtonElement;
const right = (label: string) => screen.getByRole("button", { name: `Mover etapa ${label} para a direita` }) as HTMLButtonElement;

describe("PIP-04 reordenar etapas por teclado", () => {
  it("admin e gestor veem os botões em CADA coluna; as pontas ficam desabilitadas", async () => {
    for (const user of [ADMIN, GESTOR]) {
      const view = renderApp(<PipelinePage />, { user });
      await screen.findByText("Maria Souza");
      expect(screen.getAllByRole("button", { name: /Mover etapa .* para a (esquerda|direita)/ })).toHaveLength(STAGES.length * 2);
      expect(left("Novo").disabled).toBe(true);
      expect(right("Novo").disabled).toBe(false);
      expect(left("Perdido").disabled).toBe(false);
      expect(right("Perdido").disabled).toBe(true);
      view.unmount();
    }
  });

  it("vendedor (sem a permissão pipeline.reorder) não vê os botões", async () => {
    renderApp(<PipelinePage />, { user: VENDEDOR });
    await screen.findByText("Maria Souza");
    expect(screen.queryByRole("button", { name: /Mover etapa/ })).toBeNull();
  });

  it("mover para a direita envia a NOVA ordem completa, avisa a posição e recarrega as etapas", async () => {
    renderApp(<PipelinePage />);
    await screen.findByText("Maria Souza");
    api.list.mockClear();
    fireEvent.click(right("Novo"));
    await waitFor(() =>
      expect(api.reorderStages).toHaveBeenCalledWith("p1", ["s-contato", "s-novo", "s-ganho", "s-perdido"]),
    );
    expect(await screen.findByText("Etapa Novo movida para a posição 2 de 4")).toBeTruthy();
    await waitFor(() => expect(api.list).toHaveBeenCalled());
  });

  it("mover para a esquerda troca com a vizinha anterior", async () => {
    renderApp(<PipelinePage />);
    await screen.findByText("Maria Souza");
    fireEvent.click(left("Ganho"));
    await waitFor(() =>
      expect(api.reorderStages).toHaveBeenCalledWith("p1", ["s-novo", "s-ganho", "s-contato", "s-perdido"]),
    );
  });

  it("o foco volta ao mesmo botão depois que o quadro é reordenado", async () => {
    renderApp(<PipelinePage />);
    await screen.findByText("Maria Souza");
    const reordered = [STAGES[1]!, STAGES[0]!, STAGES[2]!, STAGES[3]!].map((s, order) => ({ ...s, order }));
    api.list.mockResolvedValue([makePipeline({ stages: reordered })]);
    right("Novo").focus();
    fireEvent.click(right("Novo"));
    await waitFor(() => {
      const headers = screen.getAllByTitle("Total real nesta etapa");
      expect(headers).toHaveLength(4);
      expect(screen.getAllByRole("button", { name: /Mover etapa/ })[0]!.getAttribute("aria-label")).toBe(
        "Mover etapa Em contato para a esquerda",
      );
    });
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Mover etapa Novo para a direita"));
  });

  it("chegou à ponta: o foco vai para o botão oposto da mesma etapa (o clicado ficou desabilitado)", async () => {
    renderApp(<PipelinePage />);
    await screen.findByText("Maria Souza");
    const reordered = [STAGES[0]!, STAGES[1]!, STAGES[3]!, STAGES[2]!].map((s, order) => ({ ...s, order }));
    api.list.mockResolvedValue([makePipeline({ stages: reordered })]);
    right("Ganho").focus();
    fireEvent.click(right("Ganho"));
    await waitFor(() => expect(api.reorderStages).toHaveBeenCalledWith("p1", ["s-novo", "s-contato", "s-perdido", "s-ganho"]));
    await waitFor(() => expect(right("Ganho").disabled).toBe(true));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Mover etapa Ganho para a esquerda"));
  });

  it("falha da API: avisa o erro, não recarrega e deixa a ordem como estava", async () => {
    renderApp(<PipelinePage />);
    await screen.findByText("Maria Souza");
    api.reorderStages.mockRejectedValue(new ApiError(403, "Sem permissão para reordenar"));
    api.list.mockClear();
    fireEvent.click(right("Novo"));
    expect(await screen.findByText(/Sem permissão para reordenar/)).toBeTruthy();
    expect(api.list).not.toHaveBeenCalled();
    expect(left("Novo").disabled).toBe(true); // continua na primeira posição
  });

  it("arrastar continua funcionando (alternativa, não substituição)", async () => {
    renderApp(<PipelinePage />);
    await screen.findByText("Maria Souza");
    const header = screen.getAllByTitle("Total real nesta etapa")[0]!.parentElement as HTMLElement;
    expect(header.getAttribute("draggable")).toBe("true");
  });
});

describe("PIP-05 mover lead sem arrastar é descobrível", () => {
  const css = readFileSync(resolve(__dirname, "../../src/components/pipeline/LeadCard.module.css"), "utf8");

  it("o seletor 'mover' existe para cada cartão, com nome acessível e fora de qualquer tabindex negativo", async () => {
    renderApp(<PipelinePage />);
    await screen.findByText("Maria Souza");
    const select = screen.getByLabelText("Mover Maria Souza para outra etapa") as HTMLSelectElement;
    expect(select.tabIndex).not.toBe(-1);
    expect(select.value).toBe("s-novo");
  });

  it("o CSS não tira o seletor da árvore de acessibilidade em nenhuma largura/dispositivo (sem display:none)", () => {
    const blocks = [...css.matchAll(/\.move[^{]*\{([^}]*)\}/g)].map((m) => m[1] ?? "");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toMatch(/display:\s*none/);
      expect(block).not.toMatch(/visibility:\s*hidden/);
    }
  });

  it("no desktop com mouse fica visualmente oculto e aparece quando o foco chega ao cartão", () => {
    expect(css).toMatch(/\.move:not\(:focus\)\s*\{[^}]*clip/);
    expect(css).toMatch(/\.card:has\(:focus-visible\) \.move/);
  });
});

describe("PIP-12 alvos de toque dos botões de contato do cartão", () => {
  const files = [
    "../../src/components/prospects/WhatsappButton.module.css",
    "../../src/components/leads/EmailButton.module.css",
  ];

  it.each(files)("%s: .btnSmall tem mínimo de 24px (28px) e 44px em telas de toque", (file) => {
    const css = readFileSync(resolve(__dirname, file), "utf8");
    const base = css.match(/\.btnSmall\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(Number(base.match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(24);
    expect(Number(base.match(/min-width:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(24);
    const coarse = css.match(/@media \(pointer: coarse\)\s*\{[^@]*?\.btnSmall\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(Number(coarse.match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44);
  });

  it("os botões de etapa do cabeçalho também respeitam o mínimo", () => {
    const css = readFileSync(resolve(__dirname, "../../src/components/pipeline/KanbanColumn.module.css"), "utf8");
    const base = css.match(/\.moveBtn\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(Number(base.match(/width:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(24);
    expect(Number(base.match(/height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(24);
  });
});

describe("Prompt 06 — o realce do destino do arraste NÃO desloca o layout", () => {
  it("'Soltar aqui' é uma sobreposição (position: absolute + pointer-events: none), não um bloco no fluxo", () => {
    const css = readFileSync(resolve(__dirname, "../../src/components/pipeline/KanbanColumn.module.css"), "utf8");
    const block = css.match(/\.dropHint\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(block).toMatch(/position:\s*absolute/);
    expect(block).toMatch(/pointer-events:\s*none/);
    // dica da coluna vazia: espaço reservado (visibility), nunca inserida/removida no arraste
    expect(css).toMatch(/\.emptyHint\s*\{[^}]*visibility:\s*hidden/);
  });
});
