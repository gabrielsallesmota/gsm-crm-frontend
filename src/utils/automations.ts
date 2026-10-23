// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { AutomationKey, AutomationRule, ParamLimits } from "../types/automations.ts";

const KEYS: readonly AutomationKey[] = [
  "follow_up",
  "follow_up_due",
  "unassigned_lead",
  "stalled_opportunity",
  "renewal",
];

function obj(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function toAutomationRule(raw: unknown): AutomationRule | null {
  const r = obj(raw);
  const key = KEYS.find((k) => k === r.key);
  if (!key) return null; // regra que esta versão da tela não conhece: ignora
  const params: Record<string, number> = {};
  for (const [name, value] of Object.entries(obj(r.params))) params[name] = num(value);
  const limits: Record<string, ParamLimits> = {};
  for (const [name, value] of Object.entries(obj(r.limits))) {
    const l = obj(value);
    limits[name] = { minimum: num(l.minimum), maximum: num(l.maximum), default: num(l.default) };
  }
  return {
    key,
    enabled: r.enabled === true,
    params,
    limits,
    version: num(r.version),
    persisted: r.persisted === true,
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
  };
}

export function toAutomationRules(raw: unknown): AutomationRule[] {
  const items = obj(raw).items;
  return (Array.isArray(items) ? items : [])
    .map(toAutomationRule)
    .filter((r): r is AutomationRule => r !== null);
}

export interface ParamCopy {
  label: string;
  unit: string;
  hint: string;
}

export interface RuleCopy {
  title: string;
  summary: string;
  /** O que a regra faz, em uma frase para quem não é técnico. */
  detail: string;
  params: Record<string, ParamCopy>;
  /** A regra avisa pessoas pela Central de Notificações (WhatsApp). */
  notifies: boolean;
}

export const RULE_COPY: Record<AutomationKey, RuleCopy> = {
  follow_up: {
    title: "Follow-up automático",
    summary: "Cria uma tarefa para o responsável quando o lead fica parado.",
    detail:
      "Só leads abertos com responsável e sem tarefa pendente. Uma tarefa por período sem movimentação — nunca repete.",
    notifies: false,
    params: {
      days_without_activity: {
        label: "Dias sem movimentação",
        unit: "dias",
        hint: "Depois de quantos dias sem contato ou mudança a tarefa é criada.",
      },
      due_in_days: {
        label: "Prazo da tarefa",
        unit: "dias",
        hint: "0 = vence hoje, 1 = amanhã, e assim por diante.",
      },
    },
  },
  follow_up_due: {
    title: "Follow-up pendente",
    summary: "Avisa o responsável quando chega a data de retornar ao lead.",
    detail:
      "Vale para os retornos da cadência do lead. Um aviso por retorno — os pendentes vão juntos, no máximo um aviso a cada 4 horas.",
    notifies: true,
    params: {},
  },
  unassigned_lead: {
    title: "Lead sem responsável",
    summary: "Avisa gestores e administradores quando um lead fica sem ninguém atendendo.",
    detail: "Um aviso por lead. Leads ganhos ou perdidos não entram.",
    notifies: true,
    params: {
      hours_without_owner: {
        label: "Horas sem responsável",
        unit: "horas",
        hint: "Depois de quantas horas na fila sem dono o gestor é avisado.",
      },
    },
  },
  stalled_opportunity: {
    title: "Oportunidade parada",
    summary: "Avisa o dono do lead que ficou muitos dias na mesma etapa.",
    detail: "Um aviso por permanência na etapa. Leads ganhos ou perdidos não entram.",
    notifies: true,
    params: {
      days_in_stage: {
        label: "Dias na mesma etapa",
        unit: "dias",
        hint: "Depois de quantos dias parado o dono é avisado.",
      },
    },
  },
  renewal: {
    title: "Renovação de contrato",
    summary: "Cria a tarefa \"Renovação — cliente\" quando a data de renovação de um contrato se aproxima.",
    detail:
      "Vale para todos os contratos ativos que têm data de renovação. Cada contrato pode ter o próprio prazo; sem ele, vale este padrão. Uma tarefa por renovação — nunca repete — para o responsável pelo cliente.",
    notifies: false,
    params: {
      alert_mode: {
        label: "Quando avisar",
        unit: "",
        hint: "No 1º dia do mês da renovação, ou uma antecedência fixa.",
      },
      alert_value: {
        label: "Antecedência",
        unit: "",
        hint: "Quantos dias ou meses antes. Não usado no modo \"1º dia do mês\".",
      },
    },
  },
};

/** Valida o rascunho contra os limites que o servidor informou. `null` = tudo certo. */
export function validateDraft(
  rule: AutomationRule,
  draft: Record<string, number | null>,
): string | null {
  for (const [name, limits] of Object.entries(rule.limits)) {
    const value = draft[name];
    const label = RULE_COPY[rule.key].params[name]?.label ?? name;
    if (value === null || value === undefined || !Number.isInteger(value)) {
      return `${label}: informe um número inteiro.`;
    }
    if (value < limits.minimum || value > limits.maximum) {
      return `${label}: use um valor entre ${limits.minimum} e ${limits.maximum}.`;
    }
  }
  return null;
}

/** O que mudou em relação ao salvo — o PUT leva só isso. `undefined` = nada. */
export function changedParams(
  rule: AutomationRule,
  draft: Record<string, number | null>,
): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const [name, value] of Object.entries(draft)) {
    if (typeof value === "number" && value !== rule.params[name]) out[name] = value;
  }
  return Object.keys(out).length ? out : undefined;
}
