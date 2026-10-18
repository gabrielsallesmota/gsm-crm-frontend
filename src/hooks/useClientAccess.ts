import { can } from "../auth/permissions";
import { isImpersonating, isReadOnlySupport } from "../auth/impersonation";
import { useAuth } from "./useAuth";

/**
 * O que a pessoa pode fazer em Clientes. Ver clientes é de qualquer papel (feature `clients`);
 * alterar dinheiro (contratos, parcelas, valores, pagamento) e excluir é de admin e gestor — e
 * nunca em sessão de suporte somente-leitura. O backend recusa o resto (403); isto só evita
 * mostrar botões que falhariam.
 */
export function useClientAccess(): { canManage: boolean } {
  const { user } = useAuth();
  const readOnlySupport = isImpersonating(user) && isReadOnlySupport(user?.impersonation);
  return { canManage: can(user, "clients.manage") && !readOnlySupport };
}
