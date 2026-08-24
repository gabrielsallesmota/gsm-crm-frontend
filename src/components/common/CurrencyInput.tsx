import { useEffect, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
}

/** Input de valor monetário — formata como "R$ 1.500,00" enquanto a pessoa
 * digita (máscara de centavos: cada dígito novo entra na casa decimal,
 * empurrando o resto pra esquerda, igual app de banco). Substitui direto
 * qualquer `<input type="number">` de valor — mesma API de `value`/`onChange`
 * numérico, só que sempre exibe formatado em vez de aceitar texto livre. */
export function CurrencyInput({ value, onChange, ...rest }: CurrencyInputProps) {
  const [cents, setCents] = useState(() => Math.round(value * 100));

  useEffect(() => {
    const nextCents = Math.round(value * 100);
    setCents((current) => (current === nextCents ? current : nextCents));
  }, [value]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    const nextCents = digitsOnly ? Number(digitsOnly) : 0;
    setCents(nextCents);
    onChange(nextCents / 100);
  }

  return <input {...rest} inputMode="numeric" value={formatCents(cents)} onChange={handleChange} />;
}
