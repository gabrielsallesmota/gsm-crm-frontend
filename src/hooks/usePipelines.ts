import { pipelinesService } from "../services/PipelinesService";
import type { Pipeline } from "../types/pipeline";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function usePipelines(): AsyncResourceState<Pipeline[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => pipelinesService.list(), [currentTenantId]);
}
