import { apiRequest } from "../repositories/api/ApiClient";
import { NotImplementedError } from "../utils/errors";
import { selectRepository } from "./factory";
import { toAutomationRule, toAutomationRules } from "../utils/automations";
import type { AutomationKey, AutomationRule, UpdateAutomationInput } from "../types/automations";

/**
 * Automações comerciais (CRM-003C) — consome `/api/v1/automations`. Nenhuma chamada daqui
 * envia mensagem: as regras criam tarefas internas ou avisam a equipe. Autorização: backend
 * (papel, feature `crm`, sessão de suporte).
 */
const BASE = "/api/v1/automations";

export interface AutomationsApi {
  list(): Promise<AutomationRule[]>;
  update(key: AutomationKey, input: UpdateAutomationInput): Promise<AutomationRule>;
}

class AutomationsApiClient implements AutomationsApi {
  async list(): Promise<AutomationRule[]> {
    return toAutomationRules(await apiRequest<Record<string, unknown>>(BASE));
  }

  async update(key: AutomationKey, input: UpdateAutomationInput): Promise<AutomationRule> {
    const body: Record<string, unknown> = { version: input.version };
    if (input.enabled !== undefined) body.enabled = input.enabled;
    if (input.params) body.params = input.params;
    const saved = toAutomationRule(
      await apiRequest<Record<string, unknown>>(`${BASE}/${key}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    );
    if (!saved) throw new Error("Resposta inesperada do servidor.");
    return saved;
  }
}

function unavailable(): never {
  throw new NotImplementedError(
    "Automações comerciais",
    "As automações usam a API real e não funcionam na demonstração.",
  );
}

const demo: AutomationsApi = {
  list: async () => unavailable(),
  update: async () => unavailable(),
};

export const automationsService: AutomationsApi = selectRepository(
  () => demo,
  () => new AutomationsApiClient(),
);
