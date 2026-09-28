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

/**
 * Código de pareamento do TERMINAL da recepção (header
 * `X-Operations-Kiosk-Token`). Diferente da senha de gestão, fica em
 * `localStorage`: o terminal é um dispositivo fixo da loja, pareado uma
 * vez (sem login do CRM, como o cliente pediu). O backend não responde
 * nenhuma rota do painel sem ele — antes o painel era aberto à internet.
 */
const KIOSK_STORAGE_KEY = "td_kiosk_token";
export const KIOSK_UNAUTHORIZED_EVENT = "td-kiosk-unauthorized";

export function getKioskToken(): string | null {
  try {
    return localStorage.getItem(KIOSK_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setKioskToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(KIOSK_STORAGE_KEY, token);
    else localStorage.removeItem(KIOSK_STORAGE_KEY);
  } catch {
    // storage indisponível — o terminal pede o código de novo.
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
