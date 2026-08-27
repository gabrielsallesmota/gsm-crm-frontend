/**
 * Senha simples da gestão de "Terapeuta da Vez" — pedido explícito do
 * cliente pra NÃO usar login/senha do CRM aqui, só um valor compartilhado
 * enviado no header `X-Operations-Password` (ver backend
 * `require_operations_access`). `sessionStorage` (não `localStorage`) de
 * propósito: cada aba/sessão pede de novo, não fica salvo pra sempre num
 * computador compartilhado da loja.
 */
const STORAGE_KEY = "td_operations_password";

export function getOperationsPassword(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setOperationsPassword(password: string | null): void {
  try {
    if (password) sessionStorage.setItem(STORAGE_KEY, password);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage indisponível (modo privado restrito etc.) — sem
    // persistência, só pede a senha de novo no próximo request.
  }
}
