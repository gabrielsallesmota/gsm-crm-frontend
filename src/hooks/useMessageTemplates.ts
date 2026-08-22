import { prospectsService } from "../services/ProspectsService";
import type { MessageTemplate } from "../types/prospect";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useMessageTemplates(): AsyncResourceState<MessageTemplate[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => prospectsService.listMessageTemplates(), [currentTenantId]);
}
