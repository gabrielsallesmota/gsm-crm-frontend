/** Formatação de telefone BR pra digitação em formulário — extraído de
 * `TerapeutaDaVezPage.tsx` (única tela que já mascarava telefone) pra
 * reaproveitar nos formulários de Leads/Prospecção/Clientes, que até então
 * aceitavam qualquer texto no campo "Telefone" sem limite nenhum de
 * caracteres (dava pra digitar uma string de 19 dígitos, por exemplo).
 * Trava em 11 dígitos (DDD + 9 dígitos, o celular BR mais longo) e formata
 * como "(11) 91234-5678" incrementalmente enquanto a pessoa digita. */
export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

export function formatPhone(raw: string): string {
  const v = onlyDigits(raw).slice(0, 11);
  if (v.length > 10) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  if (v.length > 6) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  if (v.length > 2) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  return v;
}

/** Espelha `app.shared.phone.normalize_phone` do backend — DDI 55 + só
 * dígitos, formato que o `wa.me/...` espera. Usado onde a tela só tem o
 * telefone CRU salvo (ex.: `ReturnReservation.clientPhone`), sem uma versão
 * já normalizada vinda do backend (diferente de Leads/Prospecção, que
 * expõem `phoneNormalized` pronto). */
export function toWhatsappPhone(raw: string): string {
  const digits = onlyDigits(raw);
  if (digits.startsWith("55") && digits.length > 11) return digits;
  const national = digits.replace(/^0+/, "");
  return national ? `55${national}` : digits;
}
