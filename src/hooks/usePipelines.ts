import { pipelinesService } from "../services/PipelinesService";
import type { Pipeline } from "../types/pipeline";
import { invalidateShared, sharedRequest } from "../utils/requestCache";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

/** Página, drawer do lead e importação pedem os pipelines juntos — uma
 * requisição só (ver `utils/requestCache.ts`). */
export function usePipelines(): AsyncResourceState<Pipeline[]> {
  const { currentTenantId } = useAuth();
  const key = `pipelines:${currentTenantId ?? "-"}`;
  const resource = useAsyncResource(
    () => sharedRequest(key, () => pipelinesService.list()),
    [currentTenantId],
  );
  return {
    ...resource,
    reload: () => {
      invalidateShared(key);
      resource.reload();
    },
  };
}
