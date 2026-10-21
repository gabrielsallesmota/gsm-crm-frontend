/** GSM Private Trading (permissão trading:admin). Espelha as respostas de /api/v1/trading. */
export type TradingMode = "PAPER" | "DEMO" | "LIVE";
export type BotState = "STOPPED" | "PAUSED" | "RUNNING";

export interface TradingBlock {
  codigo: string;
  mensagem: string;
}

export interface RiskParams {
  daily_target_pct: number;
  daily_stop_pct: number;
  weekly_stop_pct: number;
  risk_per_trade_pct: number;
  max_open_positions: number;
  max_consecutive_losses: number;
  stale_data_seconds: number;
  open_positions_policy: "close_market" | "keep_protected";
  timezone: string;
  leverage: number;
  martingale: boolean;
  loss_recovery: boolean;
}

export interface PolicyView {
  versao: number;
  parametros: RiskParams;
  vigente_desde: string;
  motivo: string | null;
}

export interface TradingOverview {
  permissao: "trading:admin";
  controle: {
    modo: TradingMode;
    bot: BotState;
    kill_switch: { ativo: boolean; motivo: string | null; desde: string | null };
    live_liberado: boolean;
  };
  bloqueios: TradingBlock[];
  motor: { disponivel: boolean };
  /** null até existir motor e conta: nada de número inventado. */
  patrimonio: null;
  politica: PolicyView;
  politica_pendente: PolicyView | null;
  catalogo: {
    brokers: { code: string; name: string; market: string; enabled: boolean }[];
    assets: { broker: string; symbol: string; enabled: boolean }[];
    accounts: { id: string; label: string; environment: TradingMode; live_enabled: boolean; api_key_hint: string | null }[];
  };
}

export interface PolicyChangeResult {
  alterado: boolean;
  afrouxados?: string[];
  apertados?: string[];
  politica: PolicyView;
  politica_pendente?: PolicyView | null;
  mensagem?: string;
}

export interface TradingRiskEvent {
  id: number;
  at: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  details: Record<string, unknown> | null;
}

export interface TradingAuditEvent {
  id: number;
  at: string;
  actor: string;
  ip: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
}
