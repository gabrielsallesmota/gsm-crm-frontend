export type CrmMode = "demo" | "production";

/**
 * Decide mock (demo) × API real. PRODUÇÃO é o padrão: demo só quando pedido
 * explicitamente (`VITE_CRM_MODE=demo`) ou num host `demo.*`. Antes, qualquer
 * host que não começasse com `crm.` (ex.: `app.cliente.com.br`) caía em demo
 * — dados fictícios e botões "Admin GSM" na tela de login de um cliente real
 * (auditoria FE-P1-08).
 */
export function resolveCrmMode(envMode: string | undefined, hostname: string): CrmMode {
  if (envMode === "demo" || envMode === "production") return envMode;
  return hostname.startsWith("demo.") ? "demo" : "production";
}
