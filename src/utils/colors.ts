/** Converte `#rrggbb` num `rgba(r,g,b,alpha)` — usado pra derivar o fundo
 * semitransparente de uma tag a partir só da cor escolhida no seletor (mesma
 * convenção das tags do modo Demo, ver `mock/tags.ts`). */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}
