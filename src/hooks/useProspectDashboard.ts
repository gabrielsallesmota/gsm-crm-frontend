import { prospectsService } from "../services/ProspectsService";
import type { ProspectDashboardMetrics } from "../types/prospect";
import type { Period } from "../utils/periods";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

/**
 * `period` é opcional e sem valor padrão de propósito — hooks não podem ser
 * condicionais. Quem quiser buscar só quando precisar (ex.: filtro "Ativo"/
 * "Todos" do Dashboard) deve montar/desmontar o componente que chama este
 * hook, não chamá-lo sempre e ignorar o resultado.
 */
export function useProspectDashboard(period?: Period): AsyncResourceState<ProspectDashboardMetrics> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(
    () => prospectsService.getDashboardMetrics(period),
    [currentTenantId, period?.dateFrom, period?.dateTo],
  );
}
