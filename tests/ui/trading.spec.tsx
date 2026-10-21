// GSM Private Trading, etapa 1: a página só reflete o estado do servidor e nunca promete motor.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/tradingApi", () => ({
  tradingApi: {
    access: vi.fn(),
    overview: vi.fn(),
    riskEvents: vi.fn(),
    audit: vi.fn(),
    changePolicy: vi.fn(),
    killSwitch: vi.fn(),
    releaseKillSwitch: vi.fn(),
    bot: vi.fn(),
    mode: vi.fn(),
  },
}));

import { TradingPage } from "../../src/pages/TradingPage";
import { isNavItemVisible, navSections } from "../../src/layouts/navigation";
import { tradingApi } from "../../src/services/tradingApi";
import type { TradingOverview } from "../../src/types/trading";
import { STAFF, renderApp } from "./support/harness";

const api = vi.mocked(tradingApi);
afterEach(cleanup);

const params = {
  daily_target_pct: 1, daily_stop_pct: 2, weekly_stop_pct: 5, risk_per_trade_pct: 0.25,
  max_open_positions: 1, max_consecutive_losses: 3, stale_data_seconds: 90,
  open_positions_policy: "close_market" as const, timezone: "America/Sao_Paulo",
  leverage: 0, martingale: false, loss_recovery: false,
};
const overview = (over: Partial<TradingOverview> = {}): TradingOverview => ({
  permissao: "trading:admin",
  controle: { modo: "PAPER", bot: "STOPPED", kill_switch: { ativo: false, motivo: null, desde: null }, live_liberado: false },
  bloqueios: [{ codigo: "MOTOR_INDISPONIVEL", mensagem: "O motor de execução ainda não foi implementado." }],
  motor: { disponivel: false },
  patrimonio: null,
  politica: { versao: 1, parametros: params, vigente_desde: "2026-10-21T00:00:00Z", motivo: null },
  politica_pendente: null,
  catalogo: {
    brokers: [{ code: "binance_spot", name: "Binance Spot", market: "crypto_spot", enabled: true }],
    assets: [{ broker: "binance_spot", symbol: "BTCUSDT", enabled: true }, { broker: "binance_spot", symbol: "ETHUSDT", enabled: true }],
    accounts: [],
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.riskEvents.mockResolvedValue([]);
  api.audit.mockResolvedValue([]);
});

describe("menu", () => {
  it("o item Trading só existe quando o backend confirmou a permissão", () => {
    const todos = (acesso: boolean) => navSections(STAFF, acesso).flatMap((s) => s.items).map((i) => i.label);
    expect(todos(false)).not.toContain("Trading");
    expect(todos(true)).toContain("Trading");
    const item = navSections(STAFF, true).flatMap((s) => s.items).find((i) => i.label === "Trading")!;
    expect(isNavItemVisible(STAFF, item, false)).toBe(false);
  });
});

describe("página", () => {
  it("mostra os bloqueios, os limites e não deixa iniciar sem motor nem escolher LIVE", async () => {
    api.overview.mockResolvedValue(overview());
    renderApp(<TradingPage />, { user: STAFF });
    expect(await screen.findByText(/O motor de execução ainda não foi implementado\./)).toBeTruthy();
    expect(screen.getByText("−2%")).toBeTruthy();
    expect(screen.getByText("−5%")).toBeTruthy();
    expect(screen.getByText("0 (fixa)")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Iniciar bot" }) as HTMLButtonElement).disabled).toBe(true);
    const live = screen.getByRole("option", { name: "LIVE (bloqueado)" }) as HTMLOptionElement;
    expect(live.disabled).toBe(true);
    // abas de etapas futuras ficam desabilitadas, sem fingir funcionalidade
    expect((screen.getByRole("tab", { name: "Backtesting" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("tab", { name: "Gestão de Risco" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("com o kill switch acionado destaca o bloqueio e pede senha para liberar", async () => {
    api.overview.mockResolvedValue(
      overview({
        controle: { modo: "PAPER", bot: "STOPPED", kill_switch: { ativo: true, motivo: "teste", desde: "2026-10-21T10:00:00Z" }, live_liberado: false },
        bloqueios: [{ codigo: "KILL_SWITCH", mensagem: "Kill switch acionado." }],
      }),
    );
    renderApp(<TradingPage />, { user: STAFF });
    expect(await screen.findByText("Kill switch acionado.")).toBeTruthy();
    expect(screen.getByText(/Motivo do kill switch: teste/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Liberar kill switch" }));
    expect(await screen.findByLabelText("Sua senha")).toBeTruthy();
  });

  it("política: envia só o que mudou e explica o que ficou para o próximo período", async () => {
    api.overview.mockResolvedValue(overview());
    api.changePolicy.mockResolvedValue({
      alterado: true, afrouxados: ["daily_stop_pct"], apertados: [],
      politica: { versao: 1, parametros: params, vigente_desde: "2026-10-21T00:00:00Z", motivo: null },
      politica_pendente: { versao: 2, parametros: { ...params, daily_stop_pct: 2.5 }, vigente_desde: "2026-10-22T03:00:00Z", motivo: null },
    });
    renderApp(<TradingPage />, { user: STAFF });
    fireEvent.click(await screen.findByRole("tab", { name: "Gestão de Risco" }));
    fireEvent.change(await screen.findByLabelText("Stop diário (%)"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar política" }));
    await waitFor(() => expect(api.changePolicy).toHaveBeenCalledWith({ daily_stop_pct: 2.5 }, undefined));
    expect(await screen.findByText(/só valem a partir de/)).toBeTruthy();
  });
});
