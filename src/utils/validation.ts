// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.

/**
 * Validação de formulário para o USUÁRIO (Etapa 4): mensagens em
 * português, só depois que o campo foi preenchido/tocado, e nunca
 * bloqueando campos opcionais vazios. A validação definitiva continua no
 * backend (422 → `describeError`).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** `null` = ok (inclusive vazio, quando opcional). */
export function emailError(value: string, { required = false } = {}): string | null {
  const v = value.trim();
  if (!v) return required ? "Informe o e-mail." : null;
  return isValidEmail(v) ? null : "E-mail inválido. Confira se tem @ e o domínio (ex.: nome@empresa.com).";
}

/** Telefone BR: DDD + 8 ou 9 dígitos (com ou sem máscara). */
export function phoneError(value: string, { required = false } = {}): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return required ? "Informe o telefone." : null;
  if (digits.length < 10) return "Telefone incompleto. Inclua o DDD (ex.: (11) 91234-5678).";
  if (digits.length > 11) return "Telefone com dígitos demais.";
  return null;
}

export function requiredError(value: string, label: string): string | null {
  return value.trim() ? null : `Informe ${label}.`;
}
