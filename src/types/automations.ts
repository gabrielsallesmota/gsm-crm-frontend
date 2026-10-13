/** Automações comerciais (CRM-003C). Três regras próprias por empresa; o resumo diário e o
 * aviso de novo lead já vivem na Central de Notificações e são só apresentados junto. */
export type AutomationKey = "follow_up" | "overdue_task" | "stalled_opportunity";

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
