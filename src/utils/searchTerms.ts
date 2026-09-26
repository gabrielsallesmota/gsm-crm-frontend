/** Mesma normalização que o backend usa pra comparar termo de busca
 * (`fold_accents_and_case` + espaços colapsados): "Seguro Saúde" ==
 * "seguro  saude". */
export function normalizeSearchTerm(raw: string): string {
  return raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().split(/\s+/).join(" ");
}

/** Grafia oficial da lista que corresponde a `raw`, ou `null`. */
export function findSuggestion(
  raw: string,
  suggestions: readonly string[] | undefined,
): string | null {
  if (!suggestions) return null;
  const key = normalizeSearchTerm(raw);
  return suggestions.find((s) => normalizeSearchTerm(s) === key) ?? null;
}
