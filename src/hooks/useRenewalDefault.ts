import { useEffect, useState } from "react";
import { can } from "../auth/permissions";
import { automationsService } from "../services/AutomationsService";
import type { RenewalAlertMode } from "../types/client";
import { alertModeFromIndex } from "../utils/renewal";
import { useAuth } from "./useAuth";

export interface RenewalDefault {
  mode: RenewalAlertMode;
  value: number;
  enabled: boolean;
}

/**
 * Padrão do tenant para o alerta de renovação (regra `renewal` das automações). Só admin e gestor
 * leem as automações; para os demais devolve `null` e a tela diz apenas "padrão da empresa".
 * Falha de rede também vira `null` — é só informação de apoio.
 */
export function useRenewalDefault(): RenewalDefault | null {
  const { user } = useAuth();
  const allowed = can(user, "automations.view");
  const [value, setValue] = useState<RenewalDefault | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    automationsService
      .list()
      .then((rules) => {
        const rule = rules.find((r) => r.key === "renewal");
        if (cancelled || !rule) return;
        setValue({
          mode: alertModeFromIndex(rule.params["alert_mode"] ?? 0),
          value: rule.params["alert_value"] ?? 0,
          enabled: rule.enabled,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  return allowed ? value : null;
}
