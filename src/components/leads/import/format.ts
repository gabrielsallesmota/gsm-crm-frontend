import type { ImportState } from "../../../utils/leadImport";

export const STATE_LABEL: Record<ImportState, string> = {
  waiting: "Aguardando",
  validating: "Validando",
  processing: "Processando",
  completed: "Concluído",
  completed_with_errors: "Concluído com erros",
  failed: "Falhou",
  cancelled: "Cancelada",
};

/** Quantas linhas problemáticas aparecem na tela; o relatório completo é o CSV baixável. */
export const REPORT_ROWS_SHOWN = 200;

export const dateTime = (ms: number) =>
  ms > 0 ? new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "data desconhecida";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
