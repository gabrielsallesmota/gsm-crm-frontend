// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import { ApiError } from "../types/common.ts";

/**
 * Mensagem para o USUÁRIO a partir de um erro de API — padrão único do app
 * (Etapa 1). Nunca mostra detalhe técnico (UUID, "IntegrityError", stack):
 * - 400/409/422: a mensagem do backend (regras de negócio, já em português);
 * - 401: motivo do backend (login/senha atual incorreta) ou "sessão
 *   expirou" — sessão expirada de fato já dispara logout no sessionClient;
 * - 403: sem permissão (ou o motivo do backend, ex.:
 *   organização suspensa / troca de senha obrigatória);
 * - 404: genérico (o backend inclui o id no texto);
 * - 429: aguarde; 500/503: indisponível, tente de novo; rede (status 0).
 */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 0:
        return err.message || "Não foi possível conectar ao servidor. Verifique sua conexão.";
      case 401:
        return err.message || "Sua sessão expirou. Entre novamente para continuar.";
      case 403:
        return err.message || "Você não tem permissão para esta ação.";
      case 404:
        return "Registro não encontrado — ele pode ter sido removido ou você não tem acesso a ele.";
      case 429:
        return "Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.";
      case 500:
        return "Erro inesperado no servidor. Tente novamente em instantes.";
      case 502:
      case 503:
      case 504:
        return "Serviço temporariamente indisponível. Tente novamente em instantes.";
      default:
        return err.message || fallback;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  password: "Senha",
  title: "Título",
  due_at: "Vencimento",
  at: "Data/hora",
  phone: "Telefone",
  color: "Cor",
  role: "Papel",
  stage_id: "Etapa",
  owner_id: "Responsável",
  expected_value: "Valor",
  probability: "Probabilidade",
};

/** `detail` do FastAPI: string (regra de negócio) ou lista de erros de
 * validação do Pydantic (422) — vira UMA frase legível, sem `loc`/`type`. */
export function readableDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { loc?: unknown[]; msg?: unknown };
    const field = Array.isArray(first.loc) ? String(first.loc[first.loc.length - 1] ?? "") : "";
    const label = FIELD_LABELS[field] ?? field;
    const msg = typeof first.msg === "string" ? first.msg : "valor inválido";
    return label ? `${label}: ${msg}` : msg;
  }
  return fallback;
}
