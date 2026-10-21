import { apiRequest } from "../repositories/api/ApiClient";
import type {
  PolicyChangeResult,
  RiskParams,
  TradingAuditEvent,
  TradingOverview,
  TradingRiskEvent,
} from "../types/trading";

const T = "/api/v1/trading";
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** O frontend só pede: quem decide bloqueios é o backend. */
export const tradingApi = {
  access: () => apiRequest<{ permissao: string }>(`${T}/access`),
  overview: () => apiRequest<TradingOverview>(`${T}/overview`),
  riskEvents: () => apiRequest<TradingRiskEvent[]>(`${T}/risk/events?limit=50`),
  audit: () => apiRequest<TradingAuditEvent[]>(`${T}/audit?limit=100`),
  changePolicy: (parametros: Partial<RiskParams>, motivo?: string) =>
    apiRequest<PolicyChangeResult>(`${T}/risk/policy`, json("PUT", { parametros, motivo })),
  killSwitch: (motivo: string) => apiRequest(`${T}/control/kill-switch`, json("POST", { motivo })),
  releaseKillSwitch: (motivo: string, senha: string) =>
    apiRequest(`${T}/control/kill-switch/release`, json("POST", { motivo, senha })),
  bot: (acao: "start" | "pause" | "stop") => apiRequest(`${T}/control/bot`, json("POST", { acao })),
  mode: (modo: "PAPER" | "DEMO") => apiRequest(`${T}/control/mode`, json("PUT", { modo })),
};
