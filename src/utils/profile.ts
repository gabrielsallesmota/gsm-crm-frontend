import { isDemoMode } from "../services/factory";

/** Quem ainda não tem telefone cadastrado (convites antigos e contas criadas antes do campo existir)
 * vê o modal "Complete seu cadastro" logo no primeiro login. Sessão de suporte e modo demonstração
 * não pedem nada. A troca obrigatória de senha vem primeiro (outra tela). */
export function needsProfileCompletion(
  user: { phone?: string | null; mustChangePassword: boolean; impersonation?: unknown } | null | undefined,
): boolean {
  return !!user && !isDemoMode && !user.phone && !user.mustChangePassword && !user.impersonation;
}
