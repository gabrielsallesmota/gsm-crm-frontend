import { resolveCrmMode, type CrmMode } from "./modeResolution";

export type { CrmMode };

export const CRM_MODE: CrmMode = resolveCrmMode(
  import.meta.env.VITE_CRM_MODE as string | undefined,
  typeof location !== "undefined" ? location.hostname : "",
);
export const isDemoMode = CRM_MODE === "demo";

/**
 * Único lugar do projeto que decide mock vs. api por domínio — nenhum
 * `services/XService.ts` deve comparar `CRM_MODE`/`isDemoMode` diretamente,
 * só chamar `selectRepository(() => new XMockRepository(), () => new
 * XApiRepository())`. As duas implementações são lazy (funções, não
 * valores) para nunca instanciar a que não vai ser usada.
 */
export function selectRepository<T>(demo: () => T, api: () => T): T {
  return CRM_MODE === "demo" ? demo() : api();
}
