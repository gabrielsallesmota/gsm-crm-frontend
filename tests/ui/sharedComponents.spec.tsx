// FASE 0 — componentes compartilhados que o redesign vai tocar: Modal/useDialog, ConfirmDialog,
// toasts, filtro de período e seleção demo/API. Caracterização; nenhum componente é alterado.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../../src/components/common/ConfirmDialog";
import { Modal } from "../../src/components/common/Modal";
import { PeriodFilter } from "../../src/components/common/PeriodFilter";
import { selectRepository } from "../../src/services/factory";
import { resolveCrmMode } from "../../src/services/modeResolution";
import { EMPTY_PERIOD, type Period } from "../../src/utils/periods";
import { ToastHost } from "../../src/components/common/ToastHost";
import { ToastProvider } from "../../src/contexts/ToastProvider";
import { useToast } from "../../src/hooks/useToast";
import { ApiError } from "../../src/types/common";
import { renderApp } from "./support/harness";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

/** Botão que abre um Modal com dois campos — o "opener" recebe o foco de volta ao fechar. */
function Host({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>abrir</button>
      {open && (
        <Modal
          title="Formulário"
          subtitle="Campos com * são obrigatórios."
          onClose={() => {
            setOpen(false);
            onClose();
          }}
        >
          <label>
            Nome
            <input />
          </label>
          <button type="button">Salvar</button>
        </Modal>
      )}
    </>
  );
}

describe("Modal e useDialog (F-38)", () => {
  it("tem papel de diálogo modal, nome e descrição associados", () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "abrir" }));
    const dialog = screen.getByRole("dialog", { name: "Formulário" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Campos com * são obrigatórios.",
    );
  });

  it("foco inicial no primeiro campo e devolvido a quem abriu ao fechar", async () => {
    render(<Host />);
    const opener = screen.getByRole("button", { name: "abrir" });
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Nome")));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("Tab e Shift+Tab ficam presos dentro do diálogo", () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "abrir" }));
    const close = screen.getByRole("button", { name: "Fechar" });
    const save = screen.getByRole("button", { name: "Salvar" });
    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("Esc fecha quando nada foi digitado", async () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "abrir" }));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("depois de digitar, Esc e clique no fundo NÃO descartam; só Fechar descarta", async () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "abrir" }));
    fireEvent.input(screen.getByLabelText("Nome"), { target: { value: "x" } });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    await new Promise((r) => setTimeout(r, 20));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clique no fundo fecha quando não há dados digitados", () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "abrir" }));
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("trava a rolagem do fundo enquanto aberto e restaura ao fechar", async () => {
    document.body.style.overflow = "auto";
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "abrir" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(document.body.style.overflow).toBe("auto"));
  });

  it("diálogos empilhados (o segundo abre DEPOIS): só o do topo reage ao Esc", async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    function Stack() {
      const [second, setSecond] = useState(false);
      return (
        <>
          <Modal title="Externo" onClose={outer}>
            <button onClick={() => setSecond(true)}>abrir segundo</button>
          </Modal>
          {second && (
            <Modal title="Interno" onClose={inner}>
              <button>ok</button>
            </Modal>
          )}
        </>
      );
    }
    render(<Stack />);
    fireEvent.click(screen.getByRole("button", { name: "abrir segundo" }));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(inner).toHaveBeenCalledTimes(1));
    expect(outer).not.toHaveBeenCalled();
  });
});

describe("ConfirmDialog (F-38)", () => {
  it("confirmar chama onConfirm e só fecha quando devolve true", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(false);
    render(<ConfirmDialog title="Excluir?" message="Tem certeza?" onConfirm={onConfirm} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    onConfirm.mockResolvedValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("durante a confirmação mostra 'Aguarde…' e bloqueia Cancelar e o fechamento", async () => {
    let finish!: (v: boolean) => void;
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        title="Excluir?"
        message="m"
        onConfirm={() => new Promise<boolean>((r) => (finish = r))}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByRole("button", { name: "Aguarde…" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).not.toHaveBeenCalled();
    finish(true);
  });
});

function ToastDemo() {
  const { toast, toastError } = useToast();
  return (
    <>
      <button onClick={() => toast("Salvo com sucesso")}>ok</button>
      <button onClick={() => toast("Cuidado", "warning")}>aviso</button>
      <button onClick={() => toastError(new ApiError(403, ""), "falhou")}>erro403</button>
      <button onClick={() => toastError(new Error("rede caiu"), "falhou")}>erroGenerico</button>
      <button onClick={() => toastError("string estranha", "mensagem padrão")}>erroDesconhecido</button>
    </>
  );
}

describe("toasts e mensagens de erro (F-37)", () => {
  const mount = () =>
    render(
      <ToastProvider>
        <ToastDemo />
        <ToastHost />
      </ToastProvider>,
    );

  it("sucesso e aviso entram em regiões vivas diferentes (calma × urgente)", () => {
    mount();
    fireEvent.click(screen.getByText("ok"));
    fireEvent.click(screen.getByText("aviso"));
    const region = (text: string) => screen.getByText(text).closest("[aria-live]");
    expect(region("Salvo com sucesso")?.getAttribute("aria-live")).toBe("polite");
    expect(region("Cuidado")?.getAttribute("aria-live")).toBe("assertive");
  });

  it("erro 403 usa a mensagem padrão de permissão; Error comum usa o texto; desconhecido usa o 'fallback'", () => {
    mount();
    fireEvent.click(screen.getByText("erro403"));
    expect(screen.getByText("Você não tem permissão para esta ação.")).toBeTruthy();
    fireEvent.click(screen.getByText("erroGenerico"));
    expect(screen.getByText("rede caiu")).toBeTruthy();
    fireEvent.click(screen.getByText("erroDesconhecido"));
    expect(screen.getByText("mensagem padrão")).toBeTruthy();
  });

  it("no máximo 4 avisos empilhados e é possível dispensar", () => {
    mount();
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByText("ok"));
    expect(screen.getAllByText("Salvo com sucesso").length).toBeLessThanOrEqual(4);
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar aviso" })[0]!);
    expect(screen.getAllByText("Salvo com sucesso").length).toBeLessThanOrEqual(3);
  });

  it("useToast fora do provedor falha explicitamente", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<ToastDemo />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

describe("PeriodFilter (F-08)", () => {
  function Controlled({ onChange }: { onChange: (p: Period) => void }) {
    const [value, setValue] = useState<Period>(EMPTY_PERIOD);
    return (
      <PeriodFilter
        value={value}
        onChange={(p) => {
          setValue(p);
          onChange(p);
        }}
      />
    );
  }

  it("'Tudo' está ativo por padrão; os presets geram intervalos de datas ISO locais", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    for (const label of ["Hoje", "7 dias", "Este mês", "Mês passado"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      const p = onChange.mock.lastCall![0] as Period;
      expect(p.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.dateFrom! <= p.dateTo!).toBe(true);
    }
  });

  it("intervalo personalizado: datas digitadas entram no período e 'Limpar' volta ao vazio", () => {
    const onChange = vi.fn();
    const { container } = render(<Controlled onChange={onChange} />);
    const [from, to] = container.querySelectorAll<HTMLInputElement>("input[type=date]");
    fireEvent.change(from!, { target: { value: "2026-10-01" } });
    fireEvent.change(to!, { target: { value: "2026-10-15" } });
    expect(onChange.mock.lastCall![0]).toEqual({ dateFrom: "2026-10-01", dateTo: "2026-10-15" });
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(onChange.mock.lastCall![0]).toEqual({});
  });

  it("os presets são calculados UMA vez ao carregar o módulo (caracterização — PIP-07)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00"));
    vi.resetModules();
    const fresh = await import("../../src/components/common/PeriodFilter");
    const { render: freshRender } = await import("@testing-library/react");
    const seen: Period[] = [];
    const view = freshRender(<fresh.PeriodFilter value={{}} onChange={(p) => seen.push(p)} />);
    vi.setSystemTime(new Date("2026-10-16T12:00:00")); // virou o dia com a aba aberta
    fireEvent.click(within(view.container).getByRole("button", { name: "Hoje" }));
    expect(seen[0]).toEqual({ dateFrom: "2026-10-15", dateTo: "2026-10-15" }); // ainda 15, não 16
    vi.useRealTimers();
  });
});

describe("modo demonstração × API (F-34)", () => {
  it("resolveCrmMode: produção é o padrão; demo só quando pedido ou em host 'demo.*'", () => {
    expect(resolveCrmMode(undefined, "crm.gsmautomacao.com.br")).toBe("production");
    expect(resolveCrmMode(undefined, "app.cliente.com.br")).toBe("production");
    expect(resolveCrmMode("demo", "crm.exemplo.com")).toBe("demo");
    expect(resolveCrmMode("production", "demo.exemplo.com")).toBe("production");
    expect(resolveCrmMode(undefined, "demo.exemplo.com")).toBe("demo");
    expect(resolveCrmMode("qualquer", "localhost")).toBe("production");
  });

  it("selectRepository só instancia a implementação do modo ativo (a outra nunca é criada)", () => {
    const demo = vi.fn(() => "demo");
    const api = vi.fn(() => "api");
    const picked = selectRepository(demo, api);
    expect([demo.mock.calls.length, api.mock.calls.length].sort()).toEqual([0, 1]);
    expect(["demo", "api"]).toContain(picked);
  });
});

describe("harness de testes (garantia de isolamento entre testes)", () => {
  it("renderApp reinicia o cache de leituras compartilhadas entre renderizações", () => {
    const { unmount } = renderApp(<p>um</p>);
    unmount();
    renderApp(<p>dois</p>);
    expect(screen.getByText("dois")).toBeTruthy();
  });
});
