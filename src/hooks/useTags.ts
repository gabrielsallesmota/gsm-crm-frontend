import { tagsService } from "../services/TagsService";
import type { Tag } from "../types/tag";
import { invalidateShared, sharedRequest } from "../utils/requestCache";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useTags(): AsyncResourceState<Tag[]> {
  const { currentTenantId } = useAuth();
  const key = `tags:${currentTenantId ?? "-"}`;
  const resource = useAsyncResource(
    () => sharedRequest(key, () => tagsService.list()),
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
