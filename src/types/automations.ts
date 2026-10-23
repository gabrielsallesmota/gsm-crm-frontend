/** Automações comerciais. Regras próprias por empresa (a de renovação é do módulo Clientes); os
 * resumos e o aviso de novo lead vivem na Central de Notificações e são só apresentados junto.
 * "Tarefa atrasada" foi aposentada: tarefas e compromissos vão consolidados nos resumos. */
export type AutomationKey =
  | "follow_up"
  | "follow_up_due"
  | "unassigned_lead"
  | "stalled_opportunity"
  | "renewal";

export interface ParamLimits {
  minimum: number;
  maximum: number;
  default: number;
}

export interface AutomationRule {
  key: AutomationKey;
  enabled: boolean;
  params: Record<string, number>;
  limits: Record<string, ParamLimits>;
  version: number;
  persisted: boolean;
  updatedAt: string | null;
}

export interface UpdateAutomationInput {
  version: number;
  enabled?: boolean | undefined;
  params?: Record<string, number> | undefined;
}
