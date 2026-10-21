import { useEffect, useState } from "react";
import { can } from "../auth/permissions";
import { isDemoMode } from "../services/factory";
import { tradingApi } from "../services/tradingApi";
import type { AuthUser } from "../types/auth";

const cache = new Map<string, boolean>();

/**
 * O menu "Trading" só aparece para quem tem a permissão trading:admin NO BACKEND: pergunta a
 * `/trading/access` uma vez por usuário. Qualquer erro (403, rede) = sem acesso; o menu não revela
 * que o módulo existe. A segurança real continua no servidor.
 */
export function useTradingAccess(user: AuthUser | null | undefined): boolean {
  const key = user?.id ?? "";
  const eligible = !!user && !isDemoMode && can(user, "platform.internal");
  const [ok, setOk] = useState<boolean>(() => (eligible ? (cache.get(key) ?? false) : false));
  useEffect(() => {
    if (!eligible) {
      setOk(false);
      return;
    }
    if (cache.has(key)) {
      setOk(cache.get(key) ?? false);
      return;
    }
    let cancelled = false;
    tradingApi
      .access()
      .then(() => cache.set(key, true))
      .catch(() => cache.set(key, false))
      .finally(() => {
        if (!cancelled) setOk(cache.get(key) ?? false);
      });
    return () => {
      cancelled = true;
    };
  }, [eligible, key]);
  return ok;
}
