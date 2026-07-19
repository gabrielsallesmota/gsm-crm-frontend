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
