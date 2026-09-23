import { onlyDigits } from "./phone";

/** Formatação de CNPJ pra digitação em formulário — mesmo racional
 * incremental de `formatPhone` (`utils/phone.ts`). Trava em 14 dígitos e
 * formata como "11.222.333/0001-81" enquanto a pessoa digita. Não valida
 * dígito verificador aqui — isso é responsabilidade do backend
 * (`check_digits_valid` na resposta do PATCH), esta função só mascara. */
export function formatCnpj(raw: string): string {
  const v = onlyDigits(raw).slice(0, 14);
  if (v.length > 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  if (v.length > 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  if (v.length > 5) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length > 2) return `${v.slice(0, 2)}.${v.slice(2)}`;
  return v;
}
