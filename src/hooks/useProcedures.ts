import { proceduresService } from "../services/ProceduresService";
import type { Procedure } from "../types/operations";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useProcedures(): AsyncResourceState<Procedure[]> {
  return useAsyncResource(() => proceduresService.list(), []);
}
