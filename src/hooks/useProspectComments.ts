import { prospectCommentsService } from "../services/ProspectCommentsService";
import type { ProspectComment } from "../types/prospect";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useProspectComments(prospectId: string): AsyncResourceState<ProspectComment[]> {
  return useAsyncResource(() => prospectCommentsService.list(prospectId), [prospectId]);
}
