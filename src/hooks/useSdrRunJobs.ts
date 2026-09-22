import { sdrService } from "../services/SdrService";
import type { SdrDiscoveryJob, SdrDiscoveryJobStatus } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Jobs de UM run, opcionalmente filtrados por status — usado pra mostrar
 * "falhas" (`dead`) na tela de execução. Não faz polling próprio: o
 * chamador passa `refreshKey` (ex. `run.failureCount`) como parte da
 * dependência, então isto só refaz a busca quando o número de falhas do
 * run (já vindo do polling de `useSdrCampaignRun`) muda. */
export function useSdrRunJobs(
  runId: string | null,
  status: SdrDiscoveryJobStatus | undefined,
  refreshKey: number,
): AsyncResourceState<SdrDiscoveryJob[]> {
  return useAsyncResource(
    () => (runId ? sdrService.listRunJobs(runId, status) : Promise.resolve([])),
    [runId, status, refreshKey],
  );
}
