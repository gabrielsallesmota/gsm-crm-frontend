export function brl(n: number): string {
  return (n || 0).toLocaleString("pt-BR");
}

export function shortCurrency(n: number): string {
  const v = n || 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(".", ",") + "k";
  return brl(v);
}
