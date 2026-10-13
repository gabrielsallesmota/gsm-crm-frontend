import { automationsService } from "../services/AutomationsService";
import type { AutomationRule } from "../types/automations";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Leitura das regras (CRM-003C). Gravar é explícito, por regra, nos componentes. */
export function useAutomationRules(): AsyncResourceState<AutomationRule[]> {
  return useAsyncResource(() => automationsService.list(), []);
}
