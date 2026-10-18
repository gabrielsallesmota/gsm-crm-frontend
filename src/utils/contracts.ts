// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { RenewalAlertMode } from "../types/client.ts";
import { describeAlert, fmtDate, renewalAlertDate } from "./renewal.ts";

/** Padrão do tenant para o alerta (regra `renewal`), como a tela o enxerga. */
export interface RenewalDefaultLike {
  mode: RenewalAlertMode;
  value: number;
}

/** Validação local — as mesmas regras do backend, para o erro aparecer ANTES de enviar. */
export function validateContractDraft(d: {
  startDate: string;
  endDate: string;
  renewalDate: string;
}): string | null {
  if (!d.startDate) return "Informe o início do contrato.";
  if (d.endDate && d.endDate < d.startDate) return "O fim do contrato não pode ser antes do início.";
  if (d.renewalDate && d.renewalDate < d.startDate) {
    return "A renovação não pode ser antes do início do contrato.";
  }
  return null;
}

/**
 * Texto do aviso: quando a tarefa de renovação vai aparecer, com a regra efetiva (a do contrato ou,
 * sem ela, o padrão da empresa). `null` quando não há data de renovação.
 */
export function alertPreview(
  renewalDate: string,
  mode: RenewalAlertMode | null,
  value: number | null,
  tenantDefault: RenewalDefaultLike | null,
): string | null {
  if (!renewalDate) return null;
  const own = mode !== null;
  const effective = own
    ? { mode, value: value ?? 0 }
    : tenantDefault
      ? { mode: tenantDefault.mode, value: tenantDefault.value }
      : null;
  if (!effective) return "Aviso conforme o padrão da empresa.";
  const from = renewalAlertDate(renewalDate, effective.mode, effective.value);
  const rule = describeAlert(effective.mode, effective.value);
  return `${own ? "" : "Padrão da empresa: "}${rule} — a tarefa aparece em ${fmtDate(from)}.`;
}
