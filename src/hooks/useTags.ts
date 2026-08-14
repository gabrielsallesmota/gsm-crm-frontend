import { tagsService } from "../services/TagsService";
import type { Tag } from "../types/tag";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useTags(): AsyncResourceState<Tag[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => tagsService.list(), [currentTenantId]);
}
