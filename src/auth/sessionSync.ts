// Imports com extensão `.ts` de propósito: roda também no Node (`npm test`).
import type { AuthUser, Session } from "../types/auth.ts";

/** O que o `AuthProvider` guarda no localStorage (chave `gsm_crm_session`). */
export interface StoredSession {
  user: AuthUser;
  tokens: Session["tokens"];
}

export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/** Reação desta aba a uma mudança de sessão feita em OUTRA aba (evento
 * `storage`, que só dispara nas demais abas). Função pura — testada em
 * `tests/sessionSync.test.ts`. */
export function classifyExternalSessionChange(
  current: Pick<AuthUser, "id" | "tenantId"> | null,
  next: StoredSession | null,
): "logout" | "reload" | "adopt-tokens" | "ignore" {
  if (!next) return current ? "logout" : "ignore";
  if (!current) return "reload";
  if (next.user.id !== current.id || next.user.tenantId !== current.tenantId) return "reload";
  return "adopt-tokens";
}
