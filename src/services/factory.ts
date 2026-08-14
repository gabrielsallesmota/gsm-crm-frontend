export type CrmMode = "demo" | "production";

function resolveMode(): CrmMode {
  const envMode = import.meta.env.VITE_CRM_MODE as string | undefined;
  if (envMode === "demo" || envMode === "production") return envMode;
  const host = typeof location !== "undefined" ? location.hostname : "";
  if (host.startsWith("demo.")) return "demo";
  if (host.startsWith("crm.")) return "production";
  return "demo";
}

export const CRM_MODE: CrmMode = resolveMode();
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
