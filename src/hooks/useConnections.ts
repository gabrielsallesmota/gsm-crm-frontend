import { connectionsService } from "../services/ConnectionsService";
import type { Connection, ProvidersOverview } from "../types/connections";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Leituras das conexões (CRM-003B.4/B.5). Mutações chamam
 * `connectionsService` direto nos componentes, com ação explícita. */
export function useProvidersOverview(): AsyncResourceState<ProvidersOverview> {
  return useAsyncResource(() => connectionsService.overview(), []);
}

export function useMyConnections(): AsyncResourceState<Connection[]> {
  return useAsyncResource(() => connectionsService.list(), []);
}
